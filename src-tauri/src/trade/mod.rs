pub mod fetch;
pub mod filters;
pub mod items;
pub mod search;

use futures::future::BoxFuture;
use reqwest::{header::HeaderMap, Response};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{oneshot, Mutex, Notify};

pub const ENDPOINT: &str = "https://www.pathofexile.com";

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub id: String,
    pub result: Vec<String>,
    pub total: u64,
}

#[derive(Clone, Serialize)]
pub struct LimiterStatus {
    pub max: usize,
    pub window_secs: u64,
    pub current_count: usize,
    pub penalty_seconds_left: u64,
    pub queued_ids: Vec<String>,
}

#[derive(Clone, Serialize)]
pub struct FullLimiterState {
    pub search: LimiterStatus,
    pub fetch: LimiterStatus,
}

// ---------------------------------------------------------------------------
// 1. Sliding Window Rate Tracker
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct Rule {
    max: usize,
    window: Duration,
}

#[derive(Default)]
struct RateTracker {
    rules: Vec<Rule>,
    history: VecDeque<Instant>,
    penalty_until: Option<Instant>,
}

impl RateTracker {
    fn delay_needed(&mut self, now: Instant) -> Option<Duration> {
        if let Some(until) = self.penalty_until {
            if now < until {
                return Some(until - now);
            }
            self.penalty_until = None;
        }

        let mut max_wait: Option<Duration> = None;
        for rule in &self.rules {
            let active_count = self
                .history
                .iter()
                .filter(|&&t| now.duration_since(t) < rule.window)
                .count();

            if active_count >= rule.max {
                if let Some(&oldest_in_window) = self
                    .history
                    .iter()
                    .find(|&&t| now.duration_since(t) < rule.window)
                {
                    let next_slot = oldest_in_window + rule.window;
                    if next_slot > now {
                        let wait = next_slot - now;
                        max_wait = Some(max_wait.map_or(wait, |w| w.max(wait)));
                    }
                }
            }
        }

        max_wait
    }

    fn record_dispatch(&mut self, now: Instant) {
        self.history.push_back(now);
        let max_retention = Duration::from_secs(3600); // 1 hour max retention window
        while let Some(&first) = self.history.front() {
            if now.duration_since(first) > max_retention {
                self.history.pop_front();
            } else {
                break;
            }
        }
    }

    fn update_from_headers(&mut self, headers: &HeaderMap) {
        // PoE defines limits per-account or per-ip: check account first, then ip
        let rule_hdr = headers
            .get("x-rate-limit-account")
            .or_else(|| headers.get("x-rate-limit-ip"))
            .and_then(|v| v.to_str().ok());

        let state_hdr = headers
            .get("x-rate-limit-account-state")
            .or_else(|| headers.get("x-rate-limit-ip-state"))
            .and_then(|v| v.to_str().ok());

        if let (Some(r_raw), Some(s_raw)) = (rule_hdr, state_hdr) {
            let parsed_rules: Vec<Rule> = r_raw
                .split(',')
                .filter_map(|segment| {
                    let parts: Vec<&str> = segment.split(':').collect();
                    if parts.len() >= 2 {
                        let max = parts[0].trim().parse::<usize>().ok()?;
                        let win = parts[1].trim().parse::<u64>().ok()?;
                        Some(Rule {
                            max,
                            window: Duration::from_secs(win),
                        })
                    } else {
                        None
                    }
                })
                .collect();

            if !parsed_rules.is_empty() {
                self.rules = parsed_rules;
            }

            // Parse penalties from state: hits:window:penalty_seconds
            for segment in s_raw.split(',') {
                let parts: Vec<&str> = segment.split(':').collect();
                if parts.len() == 3 {
                    if let Ok(penalty_secs) = parts[2].trim().parse::<u64>() {
                        if penalty_secs > 0 {
                            let penalty =
                                Duration::from_secs(penalty_secs) + Duration::from_millis(500);
                            let until = Instant::now() + penalty;
                            self.penalty_until =
                                Some(self.penalty_until.map_or(until, |cur| cur.max(until)));
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 2. Queue Types & Isolated Queue Workers
// ---------------------------------------------------------------------------

type ApiJob = Box<dyn Fn() -> BoxFuture<'static, Result<Response, String>> + Send + Sync>;

struct QueueTask {
    id: String,
    job: ApiJob,
    tx: oneshot::Sender<Result<String, String>>,
}

struct QueueWorker {
    tasks: Mutex<VecDeque<QueueTask>>,
    tracker: Mutex<RateTracker>,
    notify: Notify,
}

impl QueueWorker {
    fn new() -> Self {
        Self {
            tasks: Mutex::new(VecDeque::new()),
            tracker: Mutex::new(RateTracker::default()),
            notify: Notify::new(),
        }
    }
}

// ---------------------------------------------------------------------------
// 3. API Rate Limiter Service
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct ApiRateLimiter {
    fetch_queue: Arc<QueueWorker>,
    search_queue: Arc<QueueWorker>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl ApiRateLimiter {
    pub fn new() -> Self {
        Self {
            fetch_queue: Arc::new(QueueWorker::new()),
            search_queue: Arc::new(QueueWorker::new()),
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start_workers(&self, app: AppHandle) {
        let handle_ref = self.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            *handle_ref.lock().await = Some(app);
        });

        self.start_worker(self.fetch_queue.clone());
        self.start_worker(self.search_queue.clone());
    }

    pub async fn emit_update(&self) {
        let handle = self.app_handle.lock().await;
        if let Some(app) = handle.as_ref() {
            let state = self.get_snapshot().await;
            let _ = app.emit("limiter-update", state);
        }
    }

    pub async fn search_items(
        &self,
        id: String,
        realm: String,
        query: Value,
    ) -> Result<String, String> {
        self.enqueue(
            &self.search_queue,
            id,
            Box::new(move || {
                let q = query.clone();
                let q1 = realm.clone();
                Box::pin(async move { search::search_items_trade(q, q1).await })
            }),
        )
        .await
    }

    pub async fn fetch_items(
        &self,
        id: String,
        realm: String,
        ids: String,
        query: String,
    ) -> Result<String, String> {
        self.enqueue(
            &self.fetch_queue,
            id,
            Box::new(move || {
                let q1 = ids.clone();
                let q2 = query.clone();
                let q3 = realm.clone();
                Box::pin(async move { fetch::fetch_items_trade(q2, q1, q3).await })
            }),
        )
        .await
    }

    async fn enqueue(
        &self,
        worker: &Arc<QueueWorker>,
        id: String,
        job: ApiJob,
    ) -> Result<String, String> {
        let (tx, rx) = oneshot::channel();
        let task = QueueTask {
            id: id.clone(),
            job,
            tx,
        };

        {
            let mut tasks = worker.tasks.lock().await;

            // Remove previous pending request with identical ID
            if let Some(pos) = tasks.iter().position(|t| t.id == id) {
                let old = tasks.remove(pos).unwrap();
                let _ = old
                    .tx
                    .send(Err("Superseded by newer request with same ID".into()));
            }

            // FIFO: push to the BACK of the deque
            tasks.push_back(task);
        }

        worker.notify.notify_one();
        self.emit_update().await;

        rx.await.map_err(|_| "Request was canceled".to_string())?
    }

    pub async fn get_snapshot(&self) -> FullLimiterState {
        let now = Instant::now();

        async fn make_status(worker: &Arc<QueueWorker>, now: Instant) -> LimiterStatus {
            let tasks = worker.tasks.lock().await;
            let tracker = worker.tracker.lock().await;

            let queued_ids: Vec<String> = tasks.iter().map(|t| t.id.clone()).collect();

            let (max, window_secs) = tracker
                .rules
                .first()
                .map(|r| (r.max, r.window.as_secs()))
                .unwrap_or((0, 0));

            let current_count = if window_secs > 0 {
                let win = Duration::from_secs(window_secs);
                tracker
                    .history
                    .iter()
                    .filter(|&&t| now.duration_since(t) < win)
                    .count()
            } else {
                0
            };

            let penalty_seconds_left = tracker
                .penalty_until
                .and_then(|until| until.checked_duration_since(now))
                .map(|d| d.as_secs())
                .unwrap_or(0);

            LimiterStatus {
                max,
                window_secs,
                current_count,
                penalty_seconds_left,
                queued_ids,
            }
        }

        FullLimiterState {
            search: make_status(&self.search_queue, now).await,
            fetch: make_status(&self.fetch_queue, now).await,
        }
    }

    fn start_worker(&self, worker: Arc<QueueWorker>) {
        let limiter = self.clone();

        tauri::async_runtime::spawn(async move {
            loop {
                // 1. Wait until a task is available
                let task = loop {
                    let mut tasks = worker.tasks.lock().await;
                    if let Some(t) = tasks.pop_front() {
                        break t;
                    }
                    drop(tasks);
                    worker.notify.notified().await;
                };

                limiter.emit_update().await;

                if task.tx.is_closed() {
                    continue;
                }

                // 2. Dispatch loop with exponential/header retry handling
                loop {
                    // Wait for active rate-limiting window/penalties to clear
                    loop {
                        let delay = {
                            let mut tracker = worker.tracker.lock().await;
                            tracker.delay_needed(Instant::now())
                        };

                        match delay {
                            Some(d) => tokio::time::sleep(d).await,
                            None => break,
                        }
                    }

                    // Record attempt slot
                    {
                        let mut tracker = worker.tracker.lock().await;
                        tracker.record_dispatch(Instant::now());
                    }
                    limiter.emit_update().await;

                    // 3. Execute HTTP request
                    match (task.job)().await {
                        Ok(resp) => {
                            let status = resp.status();
                            let headers = resp.headers().clone();

                            // Update rules from response headers
                            {
                                let mut tracker = worker.tracker.lock().await;
                                tracker.update_from_headers(&headers);
                            }
                            limiter.emit_update().await;

                            // Handle HTTP 429 Rate Limited
                            if status.as_u16() == 429 {
                                let retry_secs = headers
                                    .get("retry-after")
                                    .and_then(|v| v.to_str().ok())
                                    .and_then(|s| s.parse::<u64>().ok())
                                    .unwrap_or(5);

                                tokio::time::sleep(
                                    Duration::from_secs(retry_secs) + Duration::from_millis(500),
                                )
                                .await;
                                continue;
                            }

                            let body_text = resp.text().await.map_err(|e| e.to_string());
                            let _ = task.tx.send(body_text);
                            break;
                        }
                        Err(err) => {
                            let _ = task.tx.send(Err(err));
                            break;
                        }
                    }
                }
            }
        });
    }
}

// ---------------------------------------------------------------------------
// 4. Tauri Command Handlers
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn search_items(
    limiter: State<'_, ApiRateLimiter>,
    id: String,
    realm: String,
    payload: Value,
) -> Result<String, String> {
    limiter.search_items(id, realm, payload).await
}

#[tauri::command]
pub async fn fetch_items(
    limiter: State<'_, ApiRateLimiter>,
    id: String,
    realm: String,
    ids: String,
    query: String,
) -> Result<String, String> {
    limiter.fetch_items(id, realm, ids, query).await
}

#[tauri::command]
pub async fn get_limiter_state(
    limiter: State<'_, ApiRateLimiter>,
) -> Result<FullLimiterState, String> {
    Ok(limiter.get_snapshot().await)
}
