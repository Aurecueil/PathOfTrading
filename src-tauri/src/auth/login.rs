use super::env;
use serde::Serialize;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const OAUTH_HOOK_SCRIPT: &str = r#"
(function() {
    if (window.__poeHookInstalled) return;
    window.__poeHookInstalled = true;

    function reportUsername(name) {
        if (!name || typeof name !== 'string') return;
        const clean = name.trim();
        if (!clean) return;
        window.__poeCapturedUsername = clean;
        document.title = "__POE_USER__:" + clean;
        document.cookie = "POE_USERNAME=" + encodeURIComponent(clean) + "; path=/; max-age=86400; SameSite=Lax";
    }

    // 1. Hook fetch for https://www.pathofexile.com/oauth/token
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const res = await origFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            if (url.includes('/oauth/token')) {
                res.clone().json().then(data => {
                    if (data && data.username) reportUsername(data.username);
                }).catch(() => {});
            }
        } catch (_) {}
        return res;
    };

    // 2. Hook XMLHttpRequest for https://www.pathofexile.com/oauth/token
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__poeUrl = String(url || '');
        return origOpen.call(this, method, url, ...rest);
    };

    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        if (this.__poeUrl && this.__poeUrl.includes('/oauth/token')) {
            this.addEventListener('load', function() {
                try {
                    const data = JSON.parse(this.responseText);
                    if (data && data.username) reportUsername(data.username);
                } catch (_) {}
            });
        }
        return origSend.apply(this, args);
    };

    // 3. Fallback: check DOM profile link if page already rendered it
    setInterval(() => {
        if (window.__poeCapturedUsername) {
            if (!document.title.startsWith("__POE_USER__:")) {
                document.title = "__POE_USER__:" + window.__poeCapturedUsername;
            }
            return;
        }
        const el = document.querySelector('.profile-link a, a[href*="/account/view-profile/"]');
        if (el && el.textContent) {
            reportUsername(el.textContent);
        }
    }, 250);
})();
"#;

#[derive(Serialize, Clone)]
pub struct AuthStatusPayload {
    pub logged_in: bool,
    pub username: Option<String>,
}

#[tauri::command]
pub async fn get_poe_auth_status() -> Result<AuthStatusPayload, String> {
    let sessid = env::load_secret("poesessid")?.filter(|s| !s.trim().is_empty());
    let poetoken = env::load_secret("poetoken")?.filter(|s| !s.trim().is_empty());
    let username = env::load_secret("poe_username")?.filter(|s| !s.trim().is_empty());

    let logged_in = sessid.is_some() || poetoken.is_some();

    Ok(AuthStatusPayload {
        logged_in,
        username,
    })
}

#[tauri::command]
pub async fn open_poe_login(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("poe_login") {
        let _ = existing.set_focus();
        return Ok(());
    }

    let login_url: Url = "https://www.pathofexile.com/login?redir=%2Ftrade&lang=en_US"
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;

    let mut profile_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    profile_dir.push("poe_webview_profile");
    fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let is_handling_auth = Arc::new(AtomicBool::new(false));

    let _window = WebviewWindowBuilder::new(&app, "poe_login", WebviewUrl::External(login_url))
        .title("Path of Exile Login")
        .inner_size(600.0, 750.0)
        .data_directory(profile_dir)
        .initialization_script(OAUTH_HOOK_SCRIPT)
        .on_navigation(move |nav_url| {
            let path = nav_url.path();

            if path.starts_with("/trade") || path.starts_with("/my-account") {
                if path.starts_with("/my-account") {
                    if let Some(w) = app_handle.get_webview_window("poe_login") {
                        if let Ok(trade_url) = "https://www.pathofexile.com/trade".parse::<Url>() {
                            let _ = w.navigate(trade_url);
                        }
                    }
                }

                if is_handling_auth.swap(true, Ordering::SeqCst) {
                    return true;
                }

                let app_h = app_handle.clone();
                let handling_flag = is_handling_auth.clone();

                tauri::async_runtime::spawn(async move {
                    let poe_domain: Url = "https://www.pathofexile.com".parse().unwrap();
                    let mut attempts = 0;
                    const MAX_ATTEMPTS: usize = 60; // Retains 60-attempt limit from new version

                    while attempts < MAX_ATTEMPTS {
                        tokio::time::sleep(Duration::from_millis(300)).await;
                        attempts += 1;

                        let Some(w) = app_h.get_webview_window("poe_login") else {
                            break;
                        };

                        let _ = w.eval(OAUTH_HOOK_SCRIPT);

                        let mut captured_sessid = None;
                        let mut captured_poetoken = None;
                        let mut captured_username = None;

                        // Account name extraction from window title (New version logic)
                        if let Ok(title) = w.title() {
                            if let Some(name) = title.strip_prefix("__POE_USER__:") {
                                let clean = name.trim();
                                if !clean.is_empty() {
                                    captured_username = Some(clean.to_string());
                                }
                            }
                        }

                        // Cookie extraction
                        if let Ok(cookies) = w.cookies_for_url(poe_domain.clone()) {
                            for c in &cookies {
                                if c.name() == "POESESSID" && !c.value().is_empty() {
                                    captured_sessid = Some(c.value().to_string());
                                } else if c.name() == "POETOKEN" && !c.value().is_empty() {
                                    captured_poetoken = Some(c.value().to_string());
                                } else if c.name() == "POE_USERNAME"
                                    && !c.value().is_empty()
                                    && captured_username.is_none()
                                {
                                    // Account name extraction from cookie fallback (New version logic)
                                    captured_username = Some(percent_decode(c.value()));
                                }
                            }
                        }

                        // Fetch account name via endpoint if missing (New version logic)
                        if captured_sessid.is_some()
                            && captured_poetoken.is_some()
                            && captured_username.is_none()
                        {
                            let _ = w.eval(
                                r#"
                                fetch("https://www.pathofexile.com/oauth/token", {
                                    method: "POST",
                                    credentials: "include"
                                }).then(r => r.json()).then(d => {
                                    if (d && d.username) {
                                        window.__poeCapturedUsername = d.username;
                                        document.title = "__POE_USER__:" + d.username;
                                    }
                                }).catch(() => {});
                                "#,
                            );
                        }

                        // Fast cookie exit matching the old extraction behavior
                        if let (Some(sessid), Some(poetoken)) = (captured_sessid, captured_poetoken)
                        {
                            let _ = env::save_secret("poesessid", &sessid);
                            let _ = env::save_secret("poetoken", &poetoken);
                            if let Some(ref uname) = captured_username {
                                let _ = env::save_secret("poe_username", uname);
                            }

                            let _ = w.close();
                            let _ = app_h.emit(
                                "poe_auth_success",
                                AuthStatusPayload {
                                    logged_in: true,
                                    username: captured_username,
                                },
                            );
                            return;
                        }
                    }

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

fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let mut chars = input.as_bytes().iter().copied();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let hi = chars.next();
            let lo = chars.next();
            if let (Some(h), Some(l)) = (hi, lo) {
                let hex = [h, l];
                if let Ok(s) = std::str::from_utf8(&hex) {
                    if let Ok(val) = u8::from_str_radix(s, 16) {
                        bytes.push(val);
                        continue;
                    }
                }
            }
        }
        bytes.push(b);
    }
    String::from_utf8_lossy(&bytes).into_owned()
}

#[tauri::command]
pub async fn logout_poe(app: tauri::AppHandle) -> Result<(), String> {
    // 1. Wipe locally saved secrets immediately
    let _ = env::save_secret("poesessid", "");
    let _ = env::save_secret("poetoken", "");
    let _ = env::save_secret("poe_username", "");

    // 2. Close any open webview windows using the profile
    if let Some(w) = app.get_webview_window("poe_login") {
        let _ = w.close();
    }
    if let Some(w) = app.get_webview_window("poe_logout_hidden") {
        let _ = w.close();
    }

    // Short pause to allow webview processes to unlock profile files on disk
    tokio::time::sleep(Duration::from_millis(300)).await;

    // 3. Clear webview cookies natively using a temporary window, querying both root & subdomains
    let mut profile_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    profile_dir.push("poe_webview_profile");

    if profile_dir.exists() {
        if let Ok(window) = WebviewWindowBuilder::new(
            &app,
            "poe_logout_hidden",
            WebviewUrl::External("https://www.pathofexile.com".parse().unwrap()),
        )
        .visible(false)
        .data_directory(profile_dir.clone())
        .build()
        {
            let domains = [
                "https://www.pathofexile.com".parse::<Url>().unwrap(),
                "https://pathofexile.com".parse::<Url>().unwrap(),
            ];

            for poe_domain in &domains {
                if let Ok(cookies) = window.cookies_for_url(poe_domain.clone()) {
                    for c in cookies {
                        let name = c.name();
                        // Preserve Cloudflare anti-bot cookies to prevent repeated Cloudflare challenges
                        if !name.starts_with("cf_")
                            && !name.starts_with("__cf")
                            && !name.starts_with("_cf")
                        {
                            let _ = window.delete_cookie(c);
                        }
                    }
                }
            }

            // Flush storage clear via JavaScript execution
            let _ = window.eval(
                r#"
                try {
                    localStorage.clear();
                    sessionStorage.clear();
                } catch (_) {}
                "#,
            );

            tokio::time::sleep(Duration::from_millis(200)).await;
            let _ = window.close();
            tokio::time::sleep(Duration::from_millis(200)).await;
        }

        // 4. Fallback: Clean remaining storage & cookie database folders from profile directory
        let storage_paths = [
            profile_dir.join("Default").join("Cookies"),
            profile_dir.join("Default").join("Network").join("Cookies"),
            profile_dir.join("Default").join("Local Storage"),
            profile_dir.join("Default").join("Session Storage"),
            profile_dir
                .join("EBWebView")
                .join("Default")
                .join("Cookies"),
            profile_dir
                .join("EBWebView")
                .join("Default")
                .join("Network")
                .join("Cookies"),
            profile_dir
                .join("EBWebView")
                .join("Default")
                .join("Local Storage"),
            profile_dir
                .join("EBWebView")
                .join("Default")
                .join("Session Storage"),
        ];

        for path in storage_paths {
            if path.is_file() {
                let _ = fs::remove_file(path);
            } else if path.is_dir() {
                let _ = fs::remove_dir_all(path);
            }
        }
    }

    // 5. Emit logout event to notify UI
    let _ = app.emit(
        "poe_auth_logout",
        AuthStatusPayload {
            logged_in: false,
            username: None,
        },
    );

    Ok(())
}
#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
