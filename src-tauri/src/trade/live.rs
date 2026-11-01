// src-tauri/src/live.rs
use super::tp::TpController;
use crate::auth::env::load_secret;
use futures_util::StreamExt;
use http::header::{
    CACHE_CONTROL, CONNECTION, COOKIE, HOST, ORIGIN, PRAGMA, SEC_WEBSOCKET_KEY,
    SEC_WEBSOCKET_VERSION, UPGRADE, USER_AGENT,
};
use http::Request;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;
use tokio_tungstenite::{
    connect_async, tungstenite::handshake::client::generate_key, tungstenite::protocol::Message,
};
use tokio_util::sync::CancellationToken;

#[derive(Default)]
pub struct LiveSessionState(pub Arc<Mutex<HashMap<String, CancellationToken>>>);

#[derive(Clone, Serialize)]
pub struct LiveItemBatchEvent {
    pub tile_id: String,
    pub item_ids: Vec<String>,
    pub count: u32,
}
#[derive(Clone, Serialize)]
pub struct LiveErrorEvent {
    pub tile_id: String,
    pub message: String,
}

#[tauri::command]
pub async fn start_live_search(
    app: AppHandle,
    state: State<'_, LiveSessionState>,
    tile_id: String,
    realm: String,
    query_id: String,
    league: String,
) -> Result<(), String> {
    // 1. Cancel previous live socket for this tile if one exists
    let mut sessions = state.0.lock().await;
    if let Some(token) = sessions.remove(&tile_id) {
        token.cancel();
    }

    let cancel_token = CancellationToken::new();
    sessions.insert(tile_id.clone(), cancel_token.clone());
    drop(sessions);

    // 2. Resolve URL and secrets
    let trade_path = if realm.to_lowercase() == "poe2" {
        "trade2"
    } else {
        "trade"
    };
    let poe_platform = if realm == "xbox" {
        "xbox/"
    } else if realm == "sony" {
        "sony/"
    } else {
        ""
    };

    let host = "www.pathofexile.com";
    let ws_url = format!("wss://{host}/api/{trade_path}/live/{poe_platform}{league}/{query_id}");

    let poe_token =
        load_secret("poetoken")?.ok_or_else(|| "Missing 'poetoken' secret".to_string())?;
    let poesessid =
        load_secret("poesessid")?.ok_or_else(|| "Missing 'poesessid' secret".to_string())?;
    let cf_clearance = load_secret("cf_clearance")?.filter(|s| !s.trim().is_empty());
    let mut cookie_header = format!("POESESSID={poesessid}; POETOKEN={poe_token}");
    if let Some(cf) = cf_clearance {
        cookie_header.push_str(&format!("; cf_clearance={cf}"));
    }

    let request = Request::builder()
        .uri(&ws_url)
        .header(HOST, host)
        .header(ORIGIN, format!("https://{host}"))
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)")
        .header(COOKIE, cookie_header)
        .header(CONNECTION, "Upgrade")
        .header(UPGRADE, "websocket")
        .header(SEC_WEBSOCKET_VERSION, "13")
        .header(SEC_WEBSOCKET_KEY, generate_key())
        .header(PRAGMA, "no-cache")
        .header(CACHE_CONTROL, "no-cache")
        .body(())
        .map_err(|e| format!("Request build error: {e}"))?;

    let tp: Arc<TpController> = app.state::<Arc<TpController>>().inner().clone();
    tp.clear_live(&tile_id).await;
    tokio::spawn(async move {
        let ws_stream = match connect_async(request).await {
            Ok(res) => res.0,
            Err(e) => {
                let err_msg = format!("Connection failed: {e}");
                eprintln!("[Live WS {tile_id}] {err_msg}");

                let _ = app.emit(&format!("live-status-{tile_id}"), false);
                let _ = app.emit(
                    &format!("live-error-{tile_id}"),
                    LiveErrorEvent {
                        tile_id: tile_id.clone(),
                        message: err_msg,
                    },
                );
                return;
            }
        };

        let (_, mut read) = ws_stream.split();
        let mut exit_reason: Option<String> = None;

        loop {
            tokio::select! {
                            _ = cancel_token.cancelled() => {
                                break;
                            }
                            msg_opt = read.next() => {
                                let msg = match msg_opt {
                                    Some(Ok(Message::Text(t))) => t,
                                    Some(Ok(Message::Ping(_))) | Some(Ok(Message::Pong(_))) => continue,
                                    Some(Ok(Message::Close(frame))) => {
                                        let reason = frame
                                            .map(|f| f.reason.to_string())
                                            .unwrap_or_else(|| "Server closed connection".to_string());
                                        exit_reason = Some(format!("WebSocket closed: {reason}"));
                                        break;
                                    }
                                    None => {
                                        exit_reason = Some("Connection stream ended unexpectedly".to_string());
                                        break;
                                    }
                                    Some(Err(e)) => {
                                        exit_reason = Some(format!("Stream error: {e}"));
                                        break;
                                    }
                                    _ => continue,
                                };

                                if let Ok(val) = serde_json::from_str::<Value>(&msg) {
                                    // Handshake confirmation
                                    if val.get("auth").and_then(|a| a.as_bool()).unwrap_or(false) {
                                        if let Err(e) = app.emit(&format!("live-status-{tile_id}"), true) {
                                            eprintln!("[Live WS {tile_id}] Frontend closed (status emit failed: {e}). Aborting socket.");
                                            break;
                                        }
                                        continue;
                                    }

                                    // Single token result: {"result": "...", "count": 1}
                                    if let Some(single_id) = val.get("result").and_then(|r| r.as_str()) {
                                        let count = val.get("count").and_then(|c| c.as_u64()).unwrap_or(1).max(1) as u32;
                tp.on_live_code(&tile_id, single_id).await;
                let event = LiveItemBatchEvent {
                    tile_id: tile_id.clone(),
                    item_ids: vec![single_id.to_string()],
                    count,
                };

                                        if let Err(e) = app.emit(&format!("live-items-{tile_id}"), event) {
                                            eprintln!("[Live WS {tile_id}] Frontend closed (items emit failed: {e}). Aborting socket.");
                                            break;
                                        }
                                    }
                                    // Array result fallback: {"new": ["...", "..."]}
                                    else if let Some(items) = val.get("new").and_then(|v| v.as_array()) {
                                        let ids: Vec<String> = items
                                            .iter()
                                            .filter_map(|x| x.as_str().map(|s| s.to_string()))
                                            .collect();

                                        if !ids.is_empty() {
                                            for id in &ids { tp.on_live_code(&tile_id, id).await; }
            let event = LiveItemBatchEvent { tile_id: tile_id.clone(), item_ids: ids, count: 1 };


                                            if let Err(e) = app.emit(&format!("live-items-{tile_id}"), event) {
                                                eprintln!("[Live WS {tile_id}] Frontend closed (batch emit failed: {e}). Aborting socket.");
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
        }

        // Notify frontend that the live session has stopped
        let _ = app.emit(&format!("live-status-{tile_id}"), false);

        // If it exited due to an error/close rather than manual cancellation, send the error notification
        if let Some(reason) = exit_reason {
            eprintln!("[Live WS {tile_id}] {reason}");
            let _ = app.emit(
                &format!("live-error-{tile_id}"),
                LiveErrorEvent {
                    tile_id: tile_id.clone(),
                    message: reason,
                },
            );
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn stop_live_search(
    state: State<'_, LiveSessionState>,
    tile_id: String,
) -> Result<(), String> {
    let mut sessions = state.0.lock().await;
    if let Some(token) = sessions.remove(&tile_id) {
        token.cancel();
    }
    Ok(())
}
