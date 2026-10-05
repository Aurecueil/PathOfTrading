use super::env;
use super::refresh;
use std::fs;
use std::time::Duration;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

#[tauri::command]
async fn open_poe_login(app: tauri::AppHandle) -> Result<(), String> {
    let login_url: Url = "https://www.pathofexile.com/login?redir=%2Ftrade&lang=en_US"
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;

    // Set up a persistent data directory for the webview profile
    let mut profile_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    profile_dir.push("poe_webview_profile");
    fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;

    let app_handle = app.clone();

    let _window = WebviewWindowBuilder::new(&app, "poe_login", WebviewUrl::External(login_url))
        .title("Path of Exile Login")
        .inner_size(600.0, 750.0)
        // 1. Give WebView2 a persistent storage profile for Cloudflare clearance tokens:
        .data_directory(profile_dir)
        // 2. Note: .user_agent(...) is omitted here so native Edge Client Hints match the engine
        .on_navigation(move |nav_url| {
            let path = nav_url.path();
            if path.starts_with("/trade") || path.starts_with("/my-account") {
                let app_h = app_handle.clone();

                tauri::async_runtime::spawn(async move {
                    // Allow the webview engine time to commit cookies to its store
                    tokio::time::sleep(Duration::from_millis(1000)).await;

                    if let Some(w) = app_h.get_webview_window("poe_login") {
                        let poe_domain: Url = "https://www.pathofexile.com".parse().unwrap();

                        if let Ok(cookies) = w.cookies_for_url(poe_domain) {
                            let mut captured_sessid = None;
                            let mut captured_token = None;

                            for c in cookies {
                                if c.name() == "POESESSID" {
                                    captured_sessid = Some(c.value().to_string());
                                } else if c.name() == "POETOKEN" {
                                    captured_token = Some(c.value().to_string());
                                }
                            }

                            if let Some(sessid) = captured_sessid {
                                let _ = env::save_secret("poesessid", &sessid);

                                let token = match captured_token {
                                    Some(t) => {
                                        let _ = env::save_secret("poetoken", &t);
                                        t
                                    }
                                    None => refresh::refresh_poetoken_background()
                                        .await
                                        .unwrap_or_default(),
                                };

                                let _ = w.close();
                                let _ = app_h.emit("poe_auth_success", token);
                            }
                        }
                    }
                });

                return true;
            }
            true // Allow standard redirects (Steam, OpenID, 2FA)
        })
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
