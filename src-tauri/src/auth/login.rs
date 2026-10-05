use super::env;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

#[tauri::command]
pub async fn open_poe_login(app: tauri::AppHandle) -> Result<(), String> {
    let login_url: Url = "https://www.pathofexile.com/login?redir=%2Ftrade&lang=en_US"
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;

    // Persistent data directory so Cloudflare cookies & session stay intact
    let mut profile_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    profile_dir.push("poe_webview_profile");
    fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let is_handling_auth = Arc::new(AtomicBool::new(false));

    let _window = WebviewWindowBuilder::new(&app, "poe_login", WebviewUrl::External(login_url))
        .title("Path of Exile Login")
        .inner_size(600.0, 750.0)
        .data_directory(profile_dir)
        .on_navigation(move |nav_url| {
            let path = nav_url.path();

            if path.starts_with("/trade") || path.starts_with("/my-account") {
                // Ensure only one extraction loop runs at a time
                if is_handling_auth.swap(true, Ordering::SeqCst) {
                    return true;
                }

                let app_h = app_handle.clone();
                let handling_flag = is_handling_auth.clone();

                tauri::async_runtime::spawn(async move {
                    let poe_domain: Url = "https://www.pathofexile.com".parse().unwrap();
                    let mut attempts = 0;
                    const MAX_ATTEMPTS: usize = 35; // 35 * 300ms = ~10.5 seconds

                    while attempts < MAX_ATTEMPTS {
                        tokio::time::sleep(Duration::from_millis(300)).await;
                        attempts += 1;

                        let Some(w) = app_h.get_webview_window("poe_login") else {
                            break; // User manually closed the window
                        };

                        if let Ok(cookies) = w.cookies_for_url(poe_domain.clone()) {
                            let mut captured_sessid = None;
                            let mut captured_poetoken = None;

                            for c in &cookies {
                                if c.name() == "POESESSID" && !c.value().is_empty() {
                                    captured_sessid = Some(c.value().to_string());
                                } else if c.name() == "POETOKEN" && !c.value().is_empty() {
                                    captured_poetoken = Some(c.value().to_string());
                                }
                            }

                            // Wait until at least POESESSID is present
                            if let Some(sessid) = captured_sessid {
                                // Once user reaches /trade, POETOKEN is set shortly after POESESSID.
                                // If captured, or after enough attempts, finalize.
                                if let Some(poetoken) = captured_poetoken {
                                    let _ = env::save_secret("poesessid", &sessid);
                                    let _ = env::save_secret("poetoken", &poetoken);

                                    let _ = w.close();
                                    let _ = app_h.emit("poe_auth_success", &sessid);
                                    return;
                                }
                            }
                        }
                    }

                    // Reset flag if loop timed out without capturing the tokens
                    handling_flag.store(false, Ordering::SeqCst);
                });

                return true;
            }

            true
        })
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
