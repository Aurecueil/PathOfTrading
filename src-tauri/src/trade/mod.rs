pub mod cdn;
pub mod fetch;
pub mod filters;
pub mod items;
pub mod league;
pub mod live;
pub mod search;
pub mod settings;
pub mod statics;
pub mod stats;
pub mod whisper;

use reqwest::header::HeaderMap;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::RwLock;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{oneshot, Mutex, Notify};

pub static ENDPOINT: RwLock<&'static str> = RwLock::new("https://www.pathofexile.com");

pub fn get_endpoint() -> &'static str {
    *ENDPOINT.read().unwrap()
}

pub fn is_cloudflare_response(status: StatusCode, headers: &HeaderMap, body: &str) -> bool {
    if headers
        .get("cf-mitigated")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.eq_ignore_ascii_case("challenge"))
        .unwrap_or(false)
    {
        return true;
    }

    if status == StatusCode::FORBIDDEN
        || status == StatusCode::SERVICE_UNAVAILABLE
        || status.as_u16() == 429
    {
        let lower = body.to_lowercase();
        if lower.contains("cf-chl-bypass")
            || lower.contains("_cf_chl_opt")
            || lower.contains("jschl-answer")
            || lower.contains("cf-spinner-please-wait")
            || lower.contains("challenges.cloudflare.com")
            || (lower.contains("cloudflare")
                && (lower.contains("just a moment")
                    || lower.contains("attention required")
                    || lower.contains("enable javascript and cookies to continue")
                    || lower.contains("ray id")))
        {
            return true;
        }
    }

    false
}

// ===========================================================================
// 1. Data Structures & Telemetry Models
// ===========================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchJob {
    pub id: String,
    pub ids: Vec<String>,
    pub min: usize,
    pub wait_ms: u64,
    #[serde(default)]
    pub cache_ok: bool,
    pub reservation: Option<String>,
    pub realm: String,
    #[serde(default, alias = "isToken")]
    pub is_token: bool,
    #[serde(default, alias = "uiId")]
    pub ui_id: Option<String>,
    #[serde(default)]
    pub pseudos: Vec<String>,
}

#[derive(Clone, Serialize, PartialEq, Eq, Debug)]
pub struct OperationTelemetry {
    pub max_requests: usize,
    pub available_requests: usize,
    pub reserved_requests: HashMap<String, usize>,
    pub is_rate_limited: bool,
    pub retry_after_ms: u64,
}

#[derive(Clone, Serialize, PartialEq, Eq, Debug)]
pub struct FullTelemetryState {
    pub search: OperationTelemetry,
    pub fetch: OperationTelemetry,
    pub queue_status: HashMap<String, HashMap<String, usize>>,
}

// ===========================================================================
// 2. In-Memory Session Cache
// ===========================================================================

#[derive(Default)]
pub struct SessionCache {
    search_cache: Mutex<HashMap<String, String>>,
    fetch_cache: Mutex<HashMap<String, Value>>,
}

impl SessionCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn get_search(&self, realm: &str, query: &Value) -> Option<String> {
        let key = format!("{}:{}", realm, query);
        let cache = self.search_cache.lock().await;
        cache.get(&key).cloned()
    }

    pub async fn set_search(&self, realm: &str, query: &Value, val: String) {
        let key = format!("{}:{}", realm, query);
        let mut cache = self.search_cache.lock().await;
        cache.insert(key, val);
    }

    pub async fn get_fetch_item(&self, realm: &str, item_id: &str) -> Option<Value> {
        let key = format!("{}:{}", realm, item_id);
        let cache = self.fetch_cache.lock().await;
        cache.get(&key).cloned()
    }

    pub async fn set_fetch_item(&self, realm: &str, item_id: &str, val: Value) {
        let key = format!("{}:{}", realm, item_id);
        let mut cache = self.fetch_cache.lock().await;
        cache.insert(key, val);
    }
}

// ===========================================================================
// 3. Rate Limiter Core
// ===========================================================================

#[derive(Debug, Clone)]
struct ServerRule {
    max: usize,
    window: Duration,
}

struct RateLimiterCore {
    rules: Vec<ServerRule>,
    history: VecDeque<Instant>,
    penalty_until: Option<Instant>,
    configured_reservations: HashMap<String, usize>,
    used_reservations: HashMap<String, usize>,
    last_reported_server_hits: usize,
}

impl Default for RateLimiterCore {
    fn default() -> Self {
        let mut configured_reservations = HashMap::new();
        configured_reservations.insert("outside".to_string(), 1);
        Self {
            rules: vec![
                ServerRule {
                    max: 12,
                    window: Duration::from_secs(4),
                },
                ServerRule {
                    max: 16,
                    window: Duration::from_secs(12),
                },
            ],
            history: VecDeque::new(),
            penalty_until: None,
            configured_reservations,
            used_reservations: HashMap::new(),
            last_reported_server_hits: 0,
        }
    }
}

impl RateLimiterCore {
    fn primary_rule(&self) -> Option<&ServerRule> {
        self.rules.iter().min_by_key(|r| r.window)
    }

    fn purge_expired(&mut self, now: Instant) {
        let max_window = self
            .rules
            .iter()
            .map(|r| r.window)
            .max()
            .unwrap_or(Duration::from_secs(60));

        while let Some(&first) = self.history.front() {
            if now.duration_since(first) > max_window {
                self.history.pop_front();
            } else {
                break;
            }
        }
        if self.history.is_empty() {
            self.used_reservations.clear();
        }
    }

    fn check_delay(&mut self, now: Instant, reservation: Option<&str>) -> Option<Duration> {
        self.purge_expired(now);

        if let Some(until) = self.penalty_until {
            if now < until {
                return Some(until - now);
            }
            self.penalty_until = None;
        }

        for rule in &self.rules {
            let hits = self
                .history
                .iter()
                .filter(|&&t| now.duration_since(t) < rule.window)
                .count();
            if hits >= rule.max {
                if let Some(&oldest) = self
                    .history
                    .iter()
                    .find(|&&t| now.duration_since(t) < rule.window)
                {
                    let next_slot = oldest + rule.window;
                    if next_slot > now {
                        return Some(next_slot - now);
                    }
                }
            }
        }

        if let Some(rule) = self.primary_rule() {
            let primary_window_hits = self
                .history
                .iter()
                .filter(|&&t| now.duration_since(t) < rule.window)
                .count();
            let total_reserved: usize = self.configured_reservations.values().sum();
            let general_pool_capacity = rule.max.saturating_sub(total_reserved);
            let res_key = reservation.unwrap_or("general");

            if res_key != "general" {
                let max_res = self
                    .configured_reservations
                    .get(res_key)
                    .copied()
                    .unwrap_or(0);
                let used_res = self.used_reservations.get(res_key).copied().unwrap_or(0);
                if used_res >= max_res {
                    let used_general = primary_window_hits
                        .saturating_sub(self.used_reservations.values().sum::<usize>());
                    if used_general >= general_pool_capacity {
                        return Some(Duration::from_millis(50));
                    }
                }
            } else {
                let used_general = primary_window_hits
                    .saturating_sub(self.used_reservations.values().sum::<usize>());
                if used_general >= general_pool_capacity {
                    return Some(Duration::from_millis(50));
                }
            }
        }
        None
    }

    fn record_dispatch(&mut self, now: Instant, reservation: Option<&str>) {
        self.history.push_back(now);
        if let Some(res) = reservation {
            let max_res = self.configured_reservations.get(res).copied().unwrap_or(0);
            let used = self.used_reservations.entry(res.to_string()).or_insert(0);
            if *used < max_res {
                *used += 1;
            }
        }
    }

    fn reconcile_headers(&mut self, headers: &HeaderMap) {
        let rule_hdr = headers
            .get("x-rate-limit-account")
            .or_else(|| headers.get("x-rate-limit-ip"))
            .and_then(|v| v.to_str().ok());
        let state_hdr = headers
            .get("x-rate-limit-account-state")
            .or_else(|| headers.get("x-rate-limit-ip-state"))
            .and_then(|v| v.to_str().ok());

        if let (Some(r_raw), Some(s_raw)) = (rule_hdr, state_hdr) {
            let parsed_rules: Vec<ServerRule> = r_raw
                .split(',')
                .filter_map(|segment| {
                    let parts: Vec<&str> = segment.split(':').collect();
                    if parts.len() >= 2 {
                        let max = parts[0].trim().parse::<usize>().ok()?;
                        let win = parts[1].trim().parse::<u64>().ok()?;
                        Some(ServerRule {
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

            let mut server_primary_hits: Option<usize> = None;
            for segment in s_raw.split(',') {
                let parts: Vec<&str> = segment.split(':').collect();
                if parts.len() == 3 {
                    let hits = parts[0].trim().parse::<usize>().unwrap_or(0);
                    let penalty_secs = parts[2].trim().parse::<u64>().unwrap_or(0);
                    if server_primary_hits.is_none() {
                        server_primary_hits = Some(hits);
                    }
                    if penalty_secs > 0 {
                        let penalty =
                            Duration::from_secs(penalty_secs) + Duration::from_millis(500);
                        let until = Instant::now() + penalty;
                        self.penalty_until =
                            Some(self.penalty_until.map_or(until, |c| c.max(until)));
                    }
                }
            }

            if let Some(srv_hits) = server_primary_hits {
                let now = Instant::now();
                let local_count = if let Some(rule) = self.primary_rule() {
                    self.history
                        .iter()
                        .filter(|&&t| now.duration_since(t) < rule.window)
                        .count()
                } else {
                    self.history.len()
                };

                if srv_hits > local_count {
                    let diff = srv_hits - local_count;
                    for _ in 0..diff {
                        self.history.push_back(now);
                    }
                } else if srv_hits < local_count {
                    let mut diff = local_count - srv_hits;
                    while diff > 0 && !self.history.is_empty() {
                        self.history.pop_front();
                        diff -= 1;
                    }
                }
                self.last_reported_server_hits = srv_hits;
            }
        }
    }

    fn telemetry(&self, now: Instant) -> OperationTelemetry {
        let (max, window) = self
            .primary_rule()
            .map(|r| (r.max, r.window))
            .unwrap_or((12, Duration::from_secs(4)));
        let active_hits = if window.as_secs() > 0 {
            self.history
                .iter()
                .filter(|&&t| now.duration_since(t) < window)
                .count()
        } else {
            0
        };
        let available = max.saturating_sub(active_hits);
        let retry_after_ms = self
            .penalty_until
            .and_then(|u| u.checked_duration_since(now))
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        OperationTelemetry {
            max_requests: max,
            available_requests: available,
            reserved_requests: self.configured_reservations.clone(),
            is_rate_limited: retry_after_ms > 0 || (max > 0 && available == 0),
            retry_after_ms,
        }
    }
}

// ===========================================================================
// 4. Shared Rate Limiter Wrapper
// ===========================================================================

pub struct SharedRateLimiter {
    core: Mutex<RateLimiterCore>,
    update_notify: Arc<Notify>,
}

impl SharedRateLimiter {
    pub fn new(update_notify: Arc<Notify>) -> Self {
        Self {
            core: Mutex::new(RateLimiterCore::default()),
            update_notify,
        }
    }

    pub async fn time_until_next_change(&self) -> Option<Duration> {
        let mut core = self.core.lock().await;
        let now = Instant::now();
        core.purge_expired(now);

        let mut next_change: Option<Instant> = None;
        if let Some(until) = core.penalty_until {
            if until > now {
                next_change = Some(until);
            }
        }

        for rule in &core.rules {
            for &t in core.history.iter() {
                let expires_at = t + rule.window;
                if expires_at > now {
                    next_change = Some(next_change.map_or(expires_at, |cur| cur.min(expires_at)));
                    break;
                }
            }
        }
        next_change.map(|t| t.saturating_duration_since(now))
    }

    pub async fn wait_for_slot(&self, reservation: Option<&str>) {
        loop {
            let delay = {
                let mut core = self.core.lock().await;
                core.check_delay(Instant::now(), reservation)
            };
            match delay {
                Some(d) => tokio::time::sleep(d).await,
                None => break,
            }
        }
    }

    pub async fn record(&self, reservation: Option<&str>) {
        {
            let mut core = self.core.lock().await;
            core.record_dispatch(Instant::now(), reservation);
        }
        self.update_notify.notify_one();
    }

    pub async fn reconcile(&self, headers: &HeaderMap) {
        {
            let mut core = self.core.lock().await;
            core.reconcile_headers(headers);
        }
        self.update_notify.notify_one();
    }

    pub async fn set_penalty(&self, duration: Duration) {
        {
            let mut core = self.core.lock().await;
            let until = Instant::now() + duration;
            core.penalty_until = Some(core.penalty_until.map_or(until, |c| c.max(until)));
        }
        self.update_notify.notify_one();
    }

    pub async fn get_telemetry(&self) -> OperationTelemetry {
        let mut core = self.core.lock().await;
        core.purge_expired(Instant::now());
        core.telemetry(Instant::now())
    }
}

// ===========================================================================
// 5. Unified Service with Diff Emission & Cloudflare Gate
// ===========================================================================

struct PendingFetch {
    job: FetchJob,
    ready_at: Instant,
    collected_results: Vec<Value>,
    tx: oneshot::Sender<Result<Value, String>>,
}

struct SearchTask {
    realm: String,
    query: Value,
    league: String,
    ui_id: Option<String>,
    tx: oneshot::Sender<Result<String, String>>,
}

#[derive(Clone)]
pub struct ApiRateLimiter {
    search_limiter: Arc<SharedRateLimiter>,
    fetch_limiter: Arc<SharedRateLimiter>,
    cache: Arc<SessionCache>,
    search_tasks: Arc<Mutex<VecDeque<SearchTask>>>,
    fetch_queues: Arc<Mutex<HashMap<String, VecDeque<PendingFetch>>>>,
    queue_notify: Arc<Notify>,
    telemetry_notify: Arc<Notify>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    last_emitted_state: Arc<Mutex<Option<FullTelemetryState>>>,
    cf_paused: Arc<AtomicBool>,
    cf_notify: Arc<Notify>,
}

impl ApiRateLimiter {
    pub fn new() -> Self {
        let telemetry_notify = Arc::new(Notify::new());
        Self {
            search_limiter: Arc::new(SharedRateLimiter::new(telemetry_notify.clone())),
            fetch_limiter: Arc::new(SharedRateLimiter::new(telemetry_notify.clone())),
            cache: Arc::new(SessionCache::new()),
            search_tasks: Arc::new(Mutex::new(VecDeque::new())),
            fetch_queues: Arc::new(Mutex::new(HashMap::new())),
            queue_notify: Arc::new(Notify::new()),
            telemetry_notify,
            app_handle: Arc::new(Mutex::new(None)),
            last_emitted_state: Arc::new(Mutex::new(None)),
            cf_paused: Arc::new(AtomicBool::new(false)),
            cf_notify: Arc::new(Notify::new()),
        }
    }

    pub async fn wait_if_cf_paused(&self) {
        while self.cf_paused.load(Ordering::SeqCst) {
            self.cf_notify.notified().await;
        }
    }

    pub async fn trigger_cloudflare_challenge(&self) {
        if self.cf_paused.swap(true, Ordering::SeqCst) {
            // Another worker already triggered the challenge; wait for it to finish
            self.wait_if_cf_paused().await;
            return;
        }
        self.telemetry_notify.notify_one();

        let app_opt = self.app_handle.lock().await.clone();
        if let Some(app) = app_opt {
            let _ = crate::auth::refresh::run_poe_refresh_or_challenge(app, true).await;
        }

        self.cf_paused.store(false, Ordering::SeqCst);
        self.cf_notify.notify_waiters();
        self.queue_notify.notify_waiters();
        self.telemetry_notify.notify_one();
    }

    pub fn start_workers(&self, app: AppHandle) {
        let handle_ref = self.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            *handle_ref.lock().await = Some(app);
        });

        // 1. Search worker
        let this = self.clone();
        tauri::async_runtime::spawn(async move {
            this.run_search_worker().await;
        });

        // 2. Fetch worker
        let this = self.clone();
        tauri::async_runtime::spawn(async move {
            this.run_fetch_batcher().await;
        });

        // 3. Telemetry Diff-Emitter
        let this = self.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                this.emit_telemetry_if_changed().await;

                let next_search = this.search_limiter.time_until_next_change().await;
                let next_fetch = this.fetch_limiter.time_until_next_change().await;

                let shortest_sleep = match (next_search, next_fetch) {
                    (Some(a), Some(b)) => Some(a.min(b)),
                    (Some(a), None) => Some(a),
                    (None, Some(b)) => Some(b),
                    (None, None) => None,
                };

                if let Some(duration) = shortest_sleep {
                    tokio::select! {
                        biased;
                        _ = this.telemetry_notify.notified() => {},
                        _ = tokio::time::sleep(duration) => {},
                    }
                } else {
                    this.telemetry_notify.notified().await;
                }
            }
        });
    }

    pub async fn emit_telemetry_if_changed(&self) {
        let current_state = self.get_telemetry_state().await;
        let mut last_state = self.last_emitted_state.lock().await;
        if last_state.as_ref() == Some(&current_state) {
            return;
        }
        *last_state = Some(current_state.clone());
        drop(last_state);

        let handle = self.app_handle.lock().await;
        if let Some(app) = handle.as_ref() {
            let _ = app.emit("limiter-update", current_state);
        }
    }

    pub async fn get_telemetry_state(&self) -> FullTelemetryState {
        let mut search_telemetry = self.search_limiter.get_telemetry().await;
        let mut fetch_telemetry = self.fetch_limiter.get_telemetry().await;

        if self.cf_paused.load(Ordering::SeqCst) {
            search_telemetry.is_rate_limited = true;
            fetch_telemetry.is_rate_limited = true;
        }

        let mut queue_status = HashMap::new();
        {
            let searches = self.search_tasks.lock().await;
            let mut search_counts = HashMap::new();
            for task in searches.iter() {
                *search_counts.entry(task.realm.clone()).or_insert(0) += 1;
            }
            queue_status.insert("search".to_string(), search_counts);
        }
        {
            let fetches = self.fetch_queues.lock().await;
            let mut fetch_counts = HashMap::new();
            for (realm, q) in fetches.iter() {
                fetch_counts.insert(realm.clone(), q.len());
            }
            queue_status.insert("fetch".to_string(), fetch_counts);
        }

        FullTelemetryState {
            search: search_telemetry,
            fetch: fetch_telemetry,
            queue_status,
        }
    }

    pub async fn cancel_ui_jobs(&self, target_id: &str) -> usize {
        let mut removed = 0;
        {
            let mut searches = self.search_tasks.lock().await;
            let before = searches.len();
            searches.retain(|task| task.ui_id.as_deref() != Some(target_id));
            removed += before - searches.len();
        }
        {
            let mut fetches = self.fetch_queues.lock().await;
            for queue in fetches.values_mut() {
                let before = queue.len();
                queue.retain(|pf| {
                    pf.job.ui_id.as_deref() != Some(target_id) && pf.job.id != target_id
                });
                removed += before - queue.len();
            }
        }
        if removed > 0 {
            self.telemetry_notify.notify_one();
        }
        removed
    }

    // --- Search Pipeline ---
    pub async fn search_items(
        &self,
        realm: String,
        payload: Value,
        league: String,
        cache_ok: bool,
        ui_id: Option<String>,
    ) -> Result<String, String> {
        if cache_ok {
            if let Some(cached) = self.cache.get_search(&realm, &payload).await {
                return Ok(cached);
            }
        }

        let (tx, rx) = oneshot::channel();
        {
            let mut tasks = self.search_tasks.lock().await;
            tasks.push_back(SearchTask {
                realm,
                query: payload,
                league,
                ui_id,
                tx,
            });
        }
        self.queue_notify.notify_one();
        self.telemetry_notify.notify_one();

        rx.await
            .map_err(|_| "Search request canceled".to_string())?
    }

    async fn run_search_worker(&self) {
        loop {
            self.wait_if_cf_paused().await;

            let task = loop {
                let mut tasks = self.search_tasks.lock().await;
                if let Some(t) = tasks.pop_back() {
                    break t;
                }
                drop(tasks);
                self.queue_notify.notified().await;
            };

            if task.tx.is_closed() {
                self.telemetry_notify.notify_one();
                continue;
            }

            self.wait_if_cf_paused().await;
            self.search_limiter.wait_for_slot(None).await;
            self.wait_if_cf_paused().await;
            self.search_limiter.record(None).await;
            self.telemetry_notify.notify_one();

            let result = search::search_items_trade(
                task.query.clone(),
                task.realm.clone(),
                task.league.clone(),
            )
            .await;

            match result {
                Ok(resp) => {
                    let status = resp.status();
                    let headers = resp.headers().clone();
                    self.search_limiter.reconcile(&headers).await;

                    let is_429 = status.as_u16() == 429;
                    let text = resp.text().await.unwrap_or_default();

                    if is_cloudflare_response(status, &headers, &text) {
                        if !task.tx.is_closed() {
                            let mut tasks = self.search_tasks.lock().await;
                            tasks.push_back(task);
                        }
                        self.trigger_cloudflare_challenge().await;
                        continue;
                    }

                    let parsed_json: Option<Value> = serde_json::from_str(&text).ok();
                    let error_code = parsed_json
                        .as_ref()
                        .and_then(|j| j.get("error"))
                        .and_then(|e| e.get("code"))
                        .and_then(|c| c.as_i64());

                    if is_429 || error_code == Some(3) {
                        let retry_secs = headers
                            .get("retry-after")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(5);
                        self.search_limiter
                            .set_penalty(
                                Duration::from_secs(retry_secs) + Duration::from_millis(500),
                            )
                            .await;
                        if !task.tx.is_closed() {
                            let mut tasks = self.search_tasks.lock().await;
                            tasks.push_back(task);
                        }
                        self.telemetry_notify.notify_one();
                        continue;
                    }

                    if let Some(ref j) = parsed_json {
                        if let Some(err) = j.get("error") {
                            let _ = task.tx.send(Err(err.to_string()));
                            self.telemetry_notify.notify_one();
                            continue;
                        }
                    }

                    if !status.is_success() {
                        let _ = task
                            .tx
                            .send(Err(format!("HTTP Error {}: {}", status, text)));
                        self.telemetry_notify.notify_one();
                        continue;
                    }

                    self.cache
                        .set_search(&task.realm, &task.query, text.clone())
                        .await;
                    let _ = task.tx.send(Ok(text));
                }
                Err(e) => {
                    let _ = task.tx.send(Err(e));
                }
            }
            self.telemetry_notify.notify_one();
        }
    }

    // --- Fetch Pipeline ---
    pub async fn fetch_items(&self, job: FetchJob) -> Result<Value, String> {
        let realm = job.realm.clone();

        if !job.is_token && job.cache_ok {
            let mut all_found = true;
            let mut cached_results = Vec::new();
            for id in &job.ids {
                if let Some(item_val) = self.cache.get_fetch_item(&realm, id).await {
                    cached_results.push(item_val);
                } else {
                    all_found = false;
                    break;
                }
            }
            if all_found && !cached_results.is_empty() {
                return Ok(serde_json::json!({ "result": cached_results }));
            }
        }

        let (tx, rx) = oneshot::channel();
        let ready_at = if job.is_token {
            Instant::now()
        } else {
            Instant::now() + Duration::from_millis(job.wait_ms)
        };

        {
            let mut queues = self.fetch_queues.lock().await;
            let queue = queues.entry(realm).or_default();
            queue.push_back(PendingFetch {
                job,
                ready_at,
                collected_results: Vec::new(),
                tx,
            });
        }
        self.queue_notify.notify_one();
        self.telemetry_notify.notify_one();

        rx.await.map_err(|_| "Fetch request canceled".to_string())?
    }

    async fn run_fetch_batcher(&self) {
        loop {
            self.wait_if_cf_paused().await;

            let now = Instant::now();

            // 1. Priority Check: Find the MOST RECENT `is_token` job
            let mut token_target: Option<(String, usize)> = None;
            {
                let queues = self.fetch_queues.lock().await;
                'outer: for (realm, queue) in queues.iter() {
                    for (idx, pf) in queue.iter().enumerate().rev() {
                        if pf.job.is_token && !pf.tx.is_closed() {
                            token_target = Some((realm.clone(), idx));
                            break 'outer;
                        }
                    }
                }
            }

            if let Some((realm, idx)) = token_target {
                let pending = {
                    let mut queues = self.fetch_queues.lock().await;
                    match queues.get_mut(&realm) {
                        Some(q) if idx < q.len() => q.remove(idx).unwrap(),
                        _ => continue,
                    }
                };

                if pending.tx.is_closed() {
                    self.telemetry_notify.notify_one();
                    continue;
                }

                let token_id = pending
                    .job
                    .ids
                    .first()
                    .cloned()
                    .map(|id| id.trim().trim_matches('"').to_string())
                    .unwrap_or_default();

                if token_id.is_empty() {
                    let _ = pending.tx.send(Err("Empty token ID provided".to_string()));
                    self.telemetry_notify.notify_one();
                    continue;
                }

                let res_name = pending.job.reservation.clone();
                self.wait_if_cf_paused().await;
                self.fetch_limiter.wait_for_slot(res_name.as_deref()).await;
                self.wait_if_cf_paused().await;
                self.fetch_limiter.record(res_name.as_deref()).await;
                self.telemetry_notify.notify_one();

                let query_id = pending.job.id.clone();
                let pseudos = pending
                    .job
                    .pseudos
                    .iter()
                    .map(|p| p.trim().to_string())
                    .filter(|p| !p.is_empty())
                    .collect::<Vec<String>>();

                let response =
                    fetch::fetch_items_trade(token_id.clone(), realm.clone(), query_id, pseudos)
                        .await;

                match response {
                    Ok(resp) => {
                        let status = resp.status();
                        let headers = resp.headers().clone();
                        self.fetch_limiter.reconcile(&headers).await;

                        let is_429 = status.as_u16() == 429;
                        let text = resp.text().await.unwrap_or_default();

                        // Stop all fetching via rate limiter & display Cloudflare window on challenge
                        if is_cloudflare_response(status, &headers, &text) {
                            if !pending.tx.is_closed() {
                                let mut queues = self.fetch_queues.lock().await;
                                let queue = queues.entry(realm).or_default();
                                queue.push_back(pending);
                            }
                            self.trigger_cloudflare_challenge().await;
                            continue;
                        }

                        let parsed_json: Option<Value> = serde_json::from_str(&text).ok();
                        let error_code = parsed_json
                            .as_ref()
                            .and_then(|j| j.get("error"))
                            .and_then(|e| e.get("code"))
                            .and_then(|c| c.as_i64());

                        if is_429 || error_code == Some(3) {
                            let retry_secs = headers
                                .get("retry-after")
                                .and_then(|v| v.to_str().ok())
                                .and_then(|s| s.parse::<u64>().ok())
                                .unwrap_or(5);
                            self.fetch_limiter
                                .set_penalty(
                                    Duration::from_secs(retry_secs) + Duration::from_millis(500),
                                )
                                .await;
                            if !pending.tx.is_closed() {
                                let mut queues = self.fetch_queues.lock().await;
                                let queue = queues.entry(realm).or_default();
                                queue.push_back(pending);
                            }
                            self.telemetry_notify.notify_one();
                            continue;
                        }

                        if let Some(ref j) = parsed_json {
                            if let Some(err) = j.get("error") {
                                let _ = pending.tx.send(Err(err.to_string()));
                                self.telemetry_notify.notify_one();
                                continue;
                            }
                        }

                        if !status.is_success() {
                            let _ = pending
                                .tx
                                .send(Err(format!("HTTP Error {}: {}", status, text)));
                            self.telemetry_notify.notify_one();
                            continue;
                        }

                        if let Some(json) = parsed_json {
                            let _ = pending.tx.send(Ok(json));
                        } else {
                            let _ = pending.tx.send(Err("Invalid JSON payload".to_string()));
                        }
                    }
                    Err(err) => {
                        let _ = pending.tx.send(Err(err));
                    }
                }
                self.telemetry_notify.notify_one();
                continue;
            }

            // 2. Standard Batched Execution (Non-Token Jobs Only)
            let mut target_realm: Option<String> = None;
            {
                let queues = self.fetch_queues.lock().await;
                for (realm, queue) in queues.iter() {
                    if queue
                        .iter()
                        .any(|pf| !pf.job.is_token && pf.ready_at <= now && !pf.tx.is_closed())
                    {
                        target_realm = Some(realm.clone());
                        break;
                    }
                }
            }

            let realm = match target_realm {
                Some(r) => r,
                None => {
                    tokio::select! {
                        _ = self.queue_notify.notified() => {},
                        _ = tokio::time::sleep(Duration::from_millis(5)) => {},
                    }
                    continue;
                }
            };

            let mut selected_ids: Vec<String> = Vec::with_capacity(10);
            let mut combined_pseudos: Vec<String> = Vec::new();
            let mut job_allocations: Vec<(String, Vec<String>)> = Vec::new();
            let mut reservation_to_charge: Option<String> = None;
            let mut primary_query_id: Option<String> = None;

            {
                let mut queues = self.fetch_queues.lock().await;
                let queue = match queues.get_mut(&realm) {
                    Some(q) => q,
                    None => continue,
                };
                queue.retain(|pf| !pf.tx.is_closed());

                let candidate_indices: Vec<usize> = (0..queue.len())
                    .filter(|&i| !queue[i].job.is_token && queue[i].ready_at <= now)
                    .rev()
                    .collect();

                if candidate_indices.is_empty() {
                    continue;
                }

                let mut batch_count = 0;
                let mut allocation_plan: HashMap<String, usize> = HashMap::new();

                for &idx in &candidate_indices {
                    if primary_query_id.is_none() {
                        primary_query_id = Some(queue[idx].job.id.clone());
                    }
                    if reservation_to_charge.is_none() && queue[idx].job.reservation.is_some() {
                        reservation_to_charge = queue[idx].job.reservation.clone();
                    }
                }

                for &idx in &candidate_indices {
                    if batch_count >= 10 {
                        break;
                    }
                    let job = &queue[idx].job;
                    let target_min = job.min.clamp(1, job.ids.len());
                    let current_allocated = allocation_plan.get(&job.id).copied().unwrap_or(0);
                    if current_allocated < target_min {
                        let needed = target_min - current_allocated;
                        let space_left = 10 - batch_count;
                        let take = needed.min(space_left);
                        if take > 0 {
                            *allocation_plan.entry(job.id.clone()).or_insert(0) += take;
                            batch_count += take;
                        }
                    }
                }

                if batch_count < 10 {
                    for &idx in &candidate_indices {
                        if batch_count >= 10 {
                            break;
                        }
                        let job = &queue[idx].job;
                        let current_allocated = allocation_plan.get(&job.id).copied().unwrap_or(0);
                        let remaining_in_job = job.ids.len().saturating_sub(current_allocated);
                        let space_left = 10 - batch_count;
                        let take = remaining_in_job.min(space_left);
                        if take > 0 {
                            *allocation_plan.entry(job.id.clone()).or_insert(0) += take;
                            batch_count += take;
                        }
                    }
                }

                for &idx in &candidate_indices {
                    let pending = &mut queue[idx];
                    if let Some(&count) = allocation_plan.get(&pending.job.id) {
                        if count > 0 {
                            let take_count = count.min(pending.job.ids.len());
                            let drained: Vec<String> =
                                pending.job.ids.drain(0..take_count).collect();
                            let mut clean_drained = Vec::with_capacity(drained.len());
                            for raw_id in drained {
                                let clean_id = raw_id.trim().trim_matches('"').to_string();
                                if !clean_id.is_empty() && selected_ids.len() < 10 {
                                    selected_ids.push(clean_id.clone());
                                    clean_drained.push(clean_id);
                                }
                            }
                            if !clean_drained.is_empty() {
                                for pseudo in &pending.job.pseudos {
                                    let clean_pseudo = pseudo.trim().to_string();
                                    if !clean_pseudo.is_empty()
                                        && !combined_pseudos.contains(&clean_pseudo)
                                    {
                                        combined_pseudos.push(clean_pseudo);
                                    }
                                }
                                job_allocations.push((pending.job.id.clone(), clean_drained));
                            }
                        }
                    }
                }
            }

            if selected_ids.is_empty() {
                tokio::time::sleep(Duration::from_millis(10)).await;
                continue;
            }

            self.wait_if_cf_paused().await;
            self.fetch_limiter
                .wait_for_slot(reservation_to_charge.as_deref())
                .await;
            self.wait_if_cf_paused().await;
            self.fetch_limiter
                .record(reservation_to_charge.as_deref())
                .await;
            self.telemetry_notify.notify_one();

            let joined_ids = selected_ids
                .iter()
                .take(10)
                .cloned()
                .collect::<Vec<String>>()
                .join(",");
            let query_id = primary_query_id
                .or_else(|| job_allocations.first().map(|(id, _)| id.clone()))
                .unwrap_or_default();

            let response =
                fetch::fetch_items_trade(joined_ids, realm.clone(), query_id, combined_pseudos)
                    .await;

            match response {
                Ok(resp) => {
                    let status = resp.status();
                    let headers = resp.headers().clone();
                    self.fetch_limiter.reconcile(&headers).await;

                    let is_429 = status.as_u16() == 429;
                    let text = resp.text().await.unwrap_or_default();

                    // Stop all fetching via rate limiter & display Cloudflare window on challenge
                    if is_cloudflare_response(status, &headers, &text) {
                        {
                            let mut queues = self.fetch_queues.lock().await;
                            if let Some(queue) = queues.get_mut(&realm) {
                                for (job_id, drained) in job_allocations {
                                    if let Some(pending) =
                                        queue.iter_mut().find(|p| p.job.id == job_id)
                                    {
                                        for id in drained.into_iter().rev() {
                                            pending.job.ids.insert(0, id);
                                        }
                                    }
                                }
                            }
                        }
                        self.trigger_cloudflare_challenge().await;
                        continue;
                    }

                    let parsed_json: Option<Value> = serde_json::from_str(&text).ok();
                    let error_code = parsed_json
                        .as_ref()
                        .and_then(|j| j.get("error"))
                        .and_then(|e| e.get("code"))
                        .and_then(|c| c.as_i64());

                    if is_429 || error_code == Some(3) {
                        let retry_secs = headers
                            .get("retry-after")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(5);
                        self.fetch_limiter
                            .set_penalty(
                                Duration::from_secs(retry_secs) + Duration::from_millis(500),
                            )
                            .await;
                        let mut queues = self.fetch_queues.lock().await;
                        if let Some(queue) = queues.get_mut(&realm) {
                            for (job_id, drained) in job_allocations {
                                if let Some(pending) = queue.iter_mut().find(|p| p.job.id == job_id)
                                {
                                    for id in drained.into_iter().rev() {
                                        pending.job.ids.insert(0, id);
                                    }
                                }
                            }
                        }
                        self.telemetry_notify.notify_one();
                        continue;
                    }

                    if let Some(ref j) = parsed_json {
                        if let Some(err) = j.get("error") {
                            let err_msg = err.to_string();
                            self.fail_jobs_by_id(&realm, &job_allocations, err_msg)
                                .await;
                            self.telemetry_notify.notify_one();
                            continue;
                        }
                    }

                    if !status.is_success() {
                        let err_msg = format!("HTTP Error {}: {}", status, text);
                        self.fail_jobs_by_id(&realm, &job_allocations, err_msg)
                            .await;
                        self.telemetry_notify.notify_one();
                        continue;
                    }

                    if let Some(json) = parsed_json {
                        let mut returned_items_by_id: HashMap<String, Value> = HashMap::new();
                        if let Some(items) = json.get("result").and_then(|r| r.as_array()) {
                            for (idx, item) in items.iter().enumerate() {
                                if let Some(req_id) = selected_ids.get(idx) {
                                    if !item.is_null() {
                                        self.cache
                                            .set_fetch_item(&realm, req_id, item.clone())
                                            .await;
                                        returned_items_by_id.insert(req_id.clone(), item.clone());
                                    }
                                }
                                if let Some(item_id) = item.get("id").and_then(|v| v.as_str()) {
                                    returned_items_by_id.insert(item_id.to_string(), item.clone());
                                }
                            }
                        }

                        let mut queues = self.fetch_queues.lock().await;
                        if let Some(queue) = queues.get_mut(&realm) {
                            for (job_id, drained_ids) in job_allocations {
                                if let Some(pending) = queue.iter_mut().find(|p| p.job.id == job_id)
                                {
                                    for id in &drained_ids {
                                        if let Some(item_val) = returned_items_by_id.get(id) {
                                            pending.collected_results.push(item_val.clone());
                                        }
                                    }
                                }
                            }

                            let mut i = 0;
                            while i < queue.len() {
                                let is_finished = queue[i].job.ids.is_empty()
                                    || queue[i].collected_results.len() >= queue[i].job.min;
                                if is_finished {
                                    let finished = queue.remove(i).unwrap();
                                    let response_payload = serde_json::json!({
                                        "result": finished.collected_results
                                    });
                                    let _ = finished.tx.send(Ok(response_payload));
                                } else {
                                    i += 1;
                                }
                            }
                        }
                    } else {
                        self.fail_jobs_by_id(
                            &realm,
                            &job_allocations,
                            "Invalid JSON payload".to_string(),
                        )
                        .await;
                    }
                }
                Err(err_msg) => {
                    self.fail_jobs_by_id(&realm, &job_allocations, err_msg.to_string())
                        .await;
                }
            }
            self.telemetry_notify.notify_one();
        }
    }

    async fn fail_jobs_by_id(
        &self,
        realm: &str,
        allocations: &[(String, Vec<String>)],
        err_msg: String,
    ) {
        let mut queues = self.fetch_queues.lock().await;
        if let Some(queue) = queues.get_mut(realm) {
            for (job_id, _) in allocations {
                if let Some(pos) = queue.iter().position(|p| p.job.id == *job_id) {
                    let failed = queue.remove(pos).unwrap();
                    let _ = failed.tx.send(Err(err_msg.clone()));
                }
            }
        }
    }
}

// ===========================================================================
// 6. Tauri Command Handlers
// ===========================================================================

#[tauri::command]
pub async fn search_items(
    limiter: State<'_, ApiRateLimiter>,
    realm: String,
    payload: Value,
    league: String,
    cache_ok: Option<bool>,
    ui_id: Option<String>,
) -> Result<String, String> {
    limiter
        .search_items(realm, payload, league, cache_ok.unwrap_or(false), ui_id)
        .await
}

#[tauri::command]
pub async fn fetch_items(
    limiter: State<'_, ApiRateLimiter>,
    job: FetchJob,
) -> Result<Value, String> {
    limiter.fetch_items(job).await
}

#[tauri::command]
pub async fn cancel_ui_jobs(
    limiter: State<'_, ApiRateLimiter>,
    ui_id: String,
) -> Result<usize, String> {
    Ok(limiter.cancel_ui_jobs(&ui_id).await)
}

#[tauri::command]
pub async fn get_limiter_state(
    limiter: State<'_, ApiRateLimiter>,
) -> Result<FullTelemetryState, String> {
    Ok(limiter.get_telemetry_state().await)
}
