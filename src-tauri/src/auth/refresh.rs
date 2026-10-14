use super::env;
use std::fs;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

#[tauri::command]
pub async fn refresh_poetoken_background(app: tauri::AppHandle) -> Result<String, String> {
    // 1. Point to the EXACT same profile dir used during login
    let mut profile_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    profile_dir.push("poe_webview_profile");
    fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;

    // 2. Clean up any stale background window if one got stuck
    if let Some(existing) = app.get_webview_window("poe_refresh_hidden") {
        let _ = existing.close();
        tokio::time::sleep(Duration::from_millis(150)).await;
    }

    let trade_url: Url = "https://www.pathofexile.com/trade"
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;

    // 3. Spawn the window completely invisible and offscreen
    let window =
        WebviewWindowBuilder::new(&app, "poe_refresh_hidden", WebviewUrl::External(trade_url))
            .title("PoE Token Refresh")
            .visible(false) // Hidden from user
            .focused(false)
            .data_directory(profile_dir)
            .build()
            .map_err(|e| e.to_string())?;

    let poe_domain: Url = "https://www.pathofexile.com".parse().unwrap();
    let mut attempts = 0;
    const MAX_ATTEMPTS: usize = 30; // 30 * 250ms = ~7.5s max

    let mut token_result = None;

    // 4. Poll cookie store until POETOKEN appears
    while attempts < MAX_ATTEMPTS {
        tokio::time::sleep(Duration::from_millis(250)).await;
        attempts += 1;

        if let Ok(cookies) = window.cookies_for_url(poe_domain.clone()) {
            for c in &cookies {
                if c.name() == "POETOKEN" && !c.value().is_empty() {
                    token_result = Some(c.value().to_string());
                    break;
                }
            }
        }

        if token_result.is_some() {
            break;
        }
    }

    // 5. Always destroy the hidden window
    let _ = window.close();

    // 6. Return or error
    if let Some(token) = token_result {
        env::save_secret("poetoken", &token)?;
        Ok(token)
    } else {
        Err("Failed to refresh POETOKEN. Session might be expired or Cloudflare challenged.".into())
    }
}

// --- Check Session Status on Boot ---
pub async fn check_auth_status() -> Result<bool, String> {
    Ok(env::load_secret("poesessid")?
        .filter(|s| !s.trim().is_empty())
        .is_some())
}
