use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tokio::sync::{Mutex, Notify};

use super::{ApiRateLimiter, FetchJob};
use crate::auth::login::get_poe_auth_status;

const MAX_INDEX: usize = 5000;
const MAX_SEEN: usize = 5000;
const UI_REVEAL_TIMEOUT: Duration = Duration::from_secs(5);
const LIVE_WAIT_TIMEOUT: Duration = Duration::from_secs(10);

// ===========================================================================
// Token index (filled by the limiter on every fetch response)
// ===========================================================================

#[derive(Clone, Debug)]
pub enum TpEntry {
    Token {
        token: String,
        hideout: bool,
    },
    /// Item was fetched but has no teleport / whisper token (offline seller, sold, ...)
    NoToken,
}

#[derive(Default)]
pub struct TpIndex {
    entries: StdMutex<HashMap<String, TpEntry>>,
    /// live code -> item ids in the order the fetch returned them (first = top)
    codes: StdMutex<HashMap<String, Vec<String>>>,
    notify: Notify,
}

fn entry_from_item(item: &Value) -> Option<(String, TpEntry)> {
    let id = item.get("id")?.as_str()?.to_string();
    let listing = item.get("listing");
    let pick = |k: &str| {
        listing
            .and_then(|l| l.get(k))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
    };
    let entry = if let Some(t) = pick("hideout_token") {
        TpEntry::Token {
            token: t,
            hideout: true,
        }
    } else if let Some(t) = pick("whisper_token") {
        TpEntry::Token {
            token: t,
            hideout: false,
        }
    } else {
        TpEntry::NoToken
    };
    Some((id, entry))
}

impl TpIndex {
    pub fn ingest_items<'a>(&self, items: impl IntoIterator<Item = &'a Value>) {
        {
            let mut map = self.entries.lock().unwrap();
            if map.len() > MAX_INDEX {
                map.clear();
            }
            for item in items {
                if let Some((id, e)) = entry_from_item(item) {
                    map.insert(id, e);
                }
            }
        }
        self.notify.notify_waiters();
    }

    /// Requested but not returned (sold / removed): lets waiters stop waiting.
    pub fn mark_no_token(&self, id: &str) {
        {
            let mut map = self.entries.lock().unwrap();
            map.entry(id.to_string()).or_insert(TpEntry::NoToken);
        }
        self.notify.notify_waiters();
    }

    /// Response of an `is_token` (live) fetch: `resp` = `{ "result": [items...] }`.
    pub fn ingest_code(&self, code: &str, resp: &Value) {
        let items: Vec<&Value> = resp
            .get("result")
            .and_then(|r| r.as_array())
            .map(|a| a.iter().filter(|v| !v.is_null()).collect())
            .unwrap_or_default();
        let ids: Vec<String> = items
            .iter()
            .filter_map(|i| i.get("id").and_then(|v| v.as_str()).map(String::from))
            .collect();

        self.ingest_items(items.iter().copied());
        {
            let mut c = self.codes.lock().unwrap();
            if c.len() > 500 {
                c.clear();
            }
            c.insert(code.trim().trim_matches('"').to_string(), ids);
        }
        self.notify.notify_waiters();
    }

    pub fn get(&self, id: &str) -> Option<TpEntry> {
        self.entries.lock().unwrap().get(id).cloned()
    }

    pub fn get_code(&self, code: &str) -> Option<Vec<String>> {
        self.codes.lock().unwrap().get(code).cloned()
    }

    async fn wait_for<T>(
        &self,
        timeout: Duration,
        mut probe: impl FnMut() -> Option<T>,
    ) -> Option<T> {
        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            let notified = self.notify.notified();
            tokio::pin!(notified);
            notified.as_mut().enable(); // register BEFORE probing
            if let Some(v) = probe() {
                return Some(v);
            }
            if tokio::time::timeout_at(deadline, notified).await.is_err() {
                return probe();
            }
        }
    }

    pub async fn wait_entry(&self, id: &str, timeout: Duration) -> Option<TpEntry> {
        self.wait_for(timeout, || self.get(id)).await
    }

    pub async fn wait_code(&self, code: &str, timeout: Duration) -> Option<Vec<String>> {
        self.wait_for(timeout, || self.get_code(code)).await
    }
}

// ===========================================================================
// Controller
// ===========================================================================

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum TpMode {
    Regular,
    Live,
    Mixed,
}

#[derive(Clone, Deserialize)]
pub struct TpActive {
    pub tile_id: String,
    pub realm: String,
    pub league: String,
    pub search_id: String,
    pub mode: TpMode,
}

#[derive(Clone, Serialize)]
struct TpStatus {
    tile_id: String,
    status: String,
    message: String,
    item_id: Option<String>,
}

#[derive(Clone, Serialize)]
struct TpReveal {
    tile_id: String,
    index: usize,
    id: String,
}

#[derive(Default)]
struct TpState {
    active: Option<TpActive>,
    /// tile_id -> (search_id, ordered item ids)
    lists: HashMap<String, (String, Vec<String>)>,
    /// item ids (and "code:<code>" for live codes) already teleported to
    seen: HashSet<String>,
    /// tile_id -> live codes, oldest .. newest
    live: HashMap<String, VecDeque<String>>,
}

struct HotkeyState {
    accelerator: String,
    registered: bool,
}

pub struct TpController {
    limiter: ApiRateLimiter,
    index: Arc<TpIndex>,
    st: Mutex<TpState>,
    hotkey: Mutex<HotkeyState>,
    busy: AtomicBool,
}

fn emit_status(
    app: &AppHandle,
    tile_id: &str,
    status: &str,
    message: impl Into<String>,
    item_id: Option<&str>,
) {
    let _ = app.emit(
        "tp-status",
        TpStatus {
            tile_id: tile_id.to_string(),
            status: status.to_string(),
            message: message.into(),
            item_id: item_id.map(str::to_string),
        },
    );
}

impl TpController {
    pub fn new(limiter: ApiRateLimiter) -> Arc<Self> {
        let index = limiter.tp_index();
        Arc::new(Self {
            limiter,
            index,
            st: Mutex::new(TpState::default()),
            hotkey: Mutex::new(HotkeyState {
                accelerator: "KeyK".to_string(),
                registered: false,
            }),
            busy: AtomicBool::new(false),
        })
    }

    // ---- live codes (called from live.rs) -------------------------------

    pub async fn on_live_code(&self, tile_id: &str, code: &str) {
        let code = code.trim().trim_matches('"').to_string();
        let mut st = self.st.lock().await;
        let q = st.live.entry(tile_id.to_string()).or_default();
        q.push_back(code);
        while q.len() > 20 {
            q.pop_front();
        }
    }

    pub async fn clear_live(&self, tile_id: &str) {
        self.st.lock().await.live.remove(tile_id);
    }

    // ---- hotkey ----------------------------------------------------------

    pub async fn apply_hotkey(
        self: &Arc<Self>,
        app: &AppHandle,
        enable: bool,
    ) -> Result<(), String> {
        let mut hk = self.hotkey.lock().await;
        if enable && hk.registered {
            return Ok(());
        }
        let gs = app.global_shortcut();
        if hk.registered {
            let _ = gs.unregister(hk.accelerator.as_str());
            hk.registered = false;
        }
        if enable {
            let this = self.clone();
            gs.on_shortcut(hk.accelerator.as_str(), move |app, _sc, event| {
                if event.state() == ShortcutState::Pressed {
                    let this = this.clone();
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        this.trigger(app).await;
                    });
                }
            })
            .map_err(|e| format!("Could not register hotkey '{}': {e}", hk.accelerator))?;
            hk.registered = true;
        }
        Ok(())
    }

    // ---- trigger ---------------------------------------------------------

    pub async fn trigger(&self, app: AppHandle) {
        if self.busy.swap(true, Ordering::SeqCst) {
            return; // previous press still running
        }
        self.run(&app).await;
        self.busy.store(false, Ordering::SeqCst);
    }

    async fn run(&self, app: &AppHandle) {
        let active = self.st.lock().await.active.clone();
        let Some(active) = active else {
            emit_status(app, "", "error", "No tile selected for teleport", None);
            return;
        };
        let logged_in = get_poe_auth_status()
            .await
            .map(|s| s.logged_in)
            .unwrap_or(false);
        if !logged_in {
            emit_status(
                app,
                &active.tile_id,
                "error",
                "Log in to use teleport",
                None,
            );
            return;
        }

        let res = match active.mode {
            TpMode::Live => self.run_live(app, &active).await,
            TpMode::Regular | TpMode::Mixed => self.run_list(app, &active).await,
        };
        match res {
            Ok((msg, item_id)) => emit_status(app, &active.tile_id, "done", msg, Some(&item_id)),
            Err((e, item_id)) => emit_status(app, &active.tile_id, "error", e, item_id.as_deref()),
        }
    }

    async fn run_list(
        &self,
        app: &AppHandle,
        a: &TpActive,
    ) -> Result<(String, String), (String, Option<String>)> {
        let (ids, seen) = {
            let st = self.st.lock().await;
            let ids = st
                .lists
                .get(&a.tile_id)
                .filter(|(sid, _)| *sid == a.search_id)
                .map(|(_, v)| v.clone())
                .unwrap_or_default();
            (ids, st.seen.clone())
        };
        if ids.is_empty() {
            return Err(("No results to teleport to".into(), None));
        }

        for (idx, id) in ids.iter().enumerate() {
            if seen.contains(id) {
                continue;
            }
            let entry = match self.index.get(id) {
                Some(e) => e,
                None => self
                    .reveal(app, a, idx, id, &ids)
                    .await
                    .map_err(|e| (e, Some(id.clone())))?,
            };
            match entry {
                TpEntry::NoToken => {
                    self.mark_seen(id).await;
                    continue;
                }
                TpEntry::Token { token, hideout } => {
                    emit_status(
                        app,
                        &a.tile_id,
                        "traveling",
                        if hideout {
                            "Teleporting…"
                        } else {
                            "Whispering…"
                        },
                        Some(id),
                    );
                    self.travel(app, a, &token)
                        .await
                        .map_err(|e| (e, Some(id.clone())))?;
                    self.mark_seen(id).await;
                    return Ok((
                        format!(
                            "{} item #{}",
                            if hideout {
                                "Teleported to"
                            } else {
                                "Whispered"
                            },
                            idx + 1
                        ),
                        id.clone(),
                    ));
                }
            }
        }
        Err((
            "No unseen items left (right-click TP to reset)".into(),
            None,
        ))
    }

    async fn reveal(
        &self,
        app: &AppHandle,
        a: &TpActive,
        idx: usize,
        id: &str,
        ids: &[String],
    ) -> Result<TpEntry, String> {
        emit_status(app, &a.tile_id, "waiting", "Loading item…", Some(id));
        let _ = app.emit(
            "tp-reveal",
            TpReveal {
                tile_id: a.tile_id.clone(),
                index: idx,
                id: id.to_string(),
            },
        );
        if let Some(e) = self.index.wait_entry(id, UI_REVEAL_TIMEOUT).await {
            return Ok(e);
        }

        let batch: Vec<String> = ids
            .iter()
            .skip(idx)
            .filter(|i| self.index.get(i).is_none())
            .take(10)
            .cloned()
            .collect();
        let job = FetchJob {
            id: a.search_id.clone(),
            ids: batch,
            min: 1,
            wait_ms: 0,
            cache_ok: false,
            reservation: None,
            realm: a.realm.clone(),
            is_token: false,
            ui_id: None,
            pseudos: Vec::new(),
        };
        self.limiter
            .fetch_items(job)
            .await
            .map_err(|e| format!("Fetch failed: {e}"))?;
        self.index
            .wait_entry(id, Duration::from_secs(2))
            .await
            .ok_or_else(|| "Item could not be loaded".to_string())
    }

    async fn run_live(
        &self,
        app: &AppHandle,
        a: &TpActive,
    ) -> Result<(String, String), (String, Option<String>)> {
        let code = {
            let st = self.st.lock().await;
            st.live.get(&a.tile_id).and_then(|q| q.back().cloned())
        };
        let Some(code) = code else {
            return Err(("No live items received yet".into(), None));
        };
        let code_key = format!("code:{code}");
        if self.st.lock().await.seen.contains(&code_key) {
            return Err(("No new live items".into(), None));
        }

        emit_status(app, &a.tile_id, "waiting", "Waiting for live item…", None);
        let ids = self
            .index
            .wait_code(&code, LIVE_WAIT_TIMEOUT)
            .await
            .ok_or_else(|| ("Live item is still loading, try again".to_string(), None))?;
        let first = ids
            .first()
            .cloned()
            .ok_or_else(|| ("Item is no longer available".to_string(), None))?;

        match self.index.get(&first) {
            Some(TpEntry::Token { token, hideout }) => {
                emit_status(
                    app,
                    &a.tile_id,
                    "traveling",
                    if hideout {
                        "Teleporting…"
                    } else {
                        "Whispering…"
                    },
                    Some(&first),
                );
                self.travel(app, a, &token)
                    .await
                    .map_err(|e| (e, Some(first.clone())))?;
                self.mark_seen(&first).await;
                self.mark_seen(&code_key).await;
                Ok((
                    if hideout {
                        "Teleported to newest live item".into()
                    } else {
                        "Whispered newest live item".into()
                    },
                    first,
                ))
            }
            _ => {
                self.mark_seen(&code_key).await;
                Err(("Newest live item has no teleport token".into(), Some(first)))
            }
        }
    }
    async fn mark_seen(&self, key: &str) {
        let mut st = self.st.lock().await;
        if st.seen.len() > MAX_SEEN {
            st.seen.clear();
        }
        st.seen.insert(key.to_string());
    }

    async fn travel(&self, _app: &AppHandle, a: &TpActive, token: &str) -> Result<(), String> {
        super::whisper::whisper(
            token.to_string(),
            a.realm.clone(),
            a.league.clone(),
            a.search_id.clone(),
        )
        .await
        .map(|_| ())
    }
}

// ===========================================================================
// Commands
// ===========================================================================

#[tauri::command]
pub async fn tp_set_active(
    app: AppHandle,
    tp: State<'_, Arc<TpController>>,
    active: Option<TpActive>,
) -> Result<(), String> {
    let enable = active.is_some();
    {
        let mut st = tp.st.lock().await;
        if let Some(a) = &active {
            let tid = a.tile_id.clone();
            st.lists.retain(|k, _| *k == tid);
        } else {
            // Clearing seen items synchronously when disabling avoids the race condition
            st.seen.clear();
        }
        st.active = active;
    }
    tp.inner().apply_hotkey(&app, enable).await
}

#[tauri::command]
pub async fn tp_set_items(
    tp: State<'_, Arc<TpController>>,
    tile_id: String,
    search_id: String,
    ids: Vec<String>,
) -> Result<(), String> {
    tp.st.lock().await.lists.insert(tile_id, (search_id, ids));
    Ok(())
}

#[tauri::command]
pub async fn tp_clear_seen(tp: State<'_, Arc<TpController>>) -> Result<(), String> {
    tp.st.lock().await.seen.clear();
    Ok(())
}

#[tauri::command]
pub async fn tp_set_hotkey(
    app: AppHandle,
    tp: State<'_, Arc<TpController>>,
    accelerator: String,
) -> Result<(), String> {
    let was_registered = {
        let mut hk = tp.hotkey.lock().await;
        let was = hk.registered;
        if was {
            let _ = app.global_shortcut().unregister(hk.accelerator.as_str());
            hk.registered = false;
        }
        hk.accelerator = accelerator;
        was
    };
    if was_registered {
        tp.inner().apply_hotkey(&app, true).await?;
    }
    Ok(())
}
