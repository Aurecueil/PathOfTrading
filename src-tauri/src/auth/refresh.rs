use super::env;
use super::login::expire_session;
use std::fs;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

const WINDOW_LABEL: &str = "poe_refresh_hidden";

/// Error returned by a background refresh that ran into a Cloudflare challenge.
pub const CF_BLOCKED_ERR: &str = "CLOUDFLARE_CHALLENGE";

/// Reports Cloudflare challenge state through a cookie (`__POE_CF_ACTIVE`), because
/// `WebviewWindow::title()` returns the NATIVE window title, not `document.title`.
/// Rust reads this cookie the same way it reads POETOKEN / cf_clearance.
const CF_DETECTOR_SCRIPT: &str = r#"
(function() {
    if (window.__cfDetectorInstalled) return;
    window.__cfDetectorInstalled = true;
    const mark = (on) => {
        try {
            document.cookie = "__POE_CF_ACTIVE=" + (on ? "1" : "0") + "; path=/; max-age=30; SameSite=Lax";
        } catch (_) {}
    };
    const check = () => {
        const t = document.title || "";
        const isCf = t.includes("Just a moment") || t.includes("Attention Required") ||
            !!document.querySelector('#challenge-running, #challenge-stage, .cf-turnstile, iframe[src*="challenges.cloudflare.com"]');
        mark(isCf);
    };
    check();
    setInterval(check, 200);
})();
"#;

/// Clears Cloudflare cookies and web storage inside the Webview while preserving POESESSID
async fn clear_cloudflare_webview_data(window: &WebviewWindow) {
    let _ = env::save_secret("cf_clearance", "");

    let domains = [
        "https://www.pathofexile.com".parse::<Url>().unwrap(),
        "https://pathofexile.com".parse::<Url>().unwrap(),
        "https://challenges.cloudflare.com".parse::<Url>().unwrap(),
    ];

    for domain in &domains {
        if let Ok(cookies) = window.cookies_for_url(domain.clone()) {
            for c in cookies {
                let name = c.name();
                if name.starts_with("cf_")
                    || name.starts_with("__cf")
                    || name.starts_with("_cf")
                    || name.starts_with("__POE_CF")
                    || name.contains("cloudflare")
                {
                    let _ = window.delete_cookie(c);
                }
            }
        }
    }

    let _ = window.eval(
        r#"
        try {
            for (const store of [window.localStorage, window.sessionStorage]) {
                if (!store) continue;
                for (let i = store.length - 1; i >= 0; i--) {
                    const k = store.key(i);
                    if (k && (k.includes('cf') || k.includes('cloudflare') || k.includes('turnstile'))) {
                        store.removeItem(k);
                    }
                }
            }
        } catch (_) {}
        "#,
    );

    tokio::time::sleep(Duration::from_millis(150)).await;
}

pub async fn run_poe_refresh_or_challenge(
    app: tauri::AppHandle,
    force_show: bool,
) -> Result<String, String> {
    let mut profile_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    profile_dir.push("poe_webview_profile");
    fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;

    if let Some(existing) = app.get_webview_window(WINDOW_LABEL) {
        let _ = existing.close();
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    let trade_url: Url = "https://www.pathofexile.com/trade"
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;

    // Always spawn hidden first so stale CF data can be cleared before showing the popup.
    // The native title is cosmetic only: never match on it.
    let window =
        WebviewWindowBuilder::new(&app, WINDOW_LABEL, WebviewUrl::External(trade_url.clone()))
            .title("Path of Exile - Verification")
            .inner_size(650.0, 750.0)
            .visible(false)
            .focused(false)
            .initialization_script(CF_DETECTOR_SCRIPT)
            .data_directory(profile_dir)
            .build()
            .map_err(|e| e.to_string())?;

    let mut is_shown = false;

    // Explicitly triggered by a Cloudflare block: clear CF data, reload, show immediately
    if force_show {
        tokio::time::sleep(Duration::from_millis(200)).await;
        clear_cloudflare_webview_data(&window).await;
        let _ = window.navigate(trade_url.clone());
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
        is_shown = true;
    }

    let domains = [
        "https://www.pathofexile.com".parse::<Url>().unwrap(),
        "https://pathofexile.com".parse::<Url>().unwrap(),
    ];

    let mut attempts: usize = 0;
    let max_attempts: usize = if force_show { 480 } else { 30 }; // 120s interactive, 7.5s hidden
    let mut clear_polls: usize = 0; // consecutive polls without an active challenge

    let mut token_result: Option<String> = None;
    let mut cf_clearance_result: Option<String> = None;

    while attempts < max_attempts {
        tokio::time::sleep(Duration::from_millis(250)).await;
        attempts += 1;

        if app.get_webview_window(WINDOW_LABEL).is_none() {
            return Err("Verification window was closed by user.".into());
        }

        let _ = window.eval(CF_DETECTOR_SCRIPT);

        let mut is_cf_challenged = false;
        let mut current_token: Option<String> = None;
        let mut current_cf: Option<String> = None;
        let mut has_cf_chl_cookie = false;

        for domain in &domains {
            if let Ok(cookies) = window.cookies_for_url(domain.clone()) {
                for c in &cookies {
                    let name = c.name();
                    if name == "__POE_CF_ACTIVE" {
                        if c.value() == "1" {
                            is_cf_challenged = true;
                        }
                    } else if name == "POETOKEN" && !c.value().is_empty() {
                        current_token = Some(c.value().to_string());
                    } else if name == "cf_clearance" && !c.value().is_empty() {
                        current_cf = Some(c.value().to_string());
                    } else if name.starts_with("__cf_chl") || name.starts_with("cf_chl") {
                        has_cf_chl_cookie = true;
                    }
                }
            }
        }

        // Background refresh ran into Cloudflare: show nothing here. The caller ends the
        // session (same as a UI logout) and the UI asks the user to log in again.
        if !is_shown && (is_cf_challenged || (has_cf_chl_cookie && current_token.is_none())) {
            let _ = window.close();
            return Err(CF_BLOCKED_ERR.to_string());
        }

        // Challenge still on screen: keep waiting
        if is_cf_challenged {
            clear_polls = 0;
            continue;
        }
        clear_polls += 1;

        if is_shown {
            // cf_clearance was wiped before showing, so any value here is freshly issued
            if current_cf.is_some() && current_token.is_some() {
                token_result = current_token;
                cf_clearance_result = current_cf;
                break;
            }
            // Challenge passed but no POETOKEN (e.g. logged out): keep fresh cf_clearance
            if clear_polls >= 8 && current_cf.is_some() {
                token_result = current_token;
                cf_clearance_result = current_cf;
                break;
            }
        } else if current_token.is_some() {
            token_result = current_token;
            cf_clearance_result = current_cf;
            break;
        }
    }

    let _ = window.close();

    // Save BOTH. Previously the token was dropped whenever cf_clearance existed.
    if let Some(ref t) = token_result {
        env::save_secret("poetoken", t)?;
    }
    if let Some(ref cf) = cf_clearance_result {
        env::save_secret("cf_clearance", cf)?;
    }

    match (token_result, cf_clearance_result) {
        (Some(t), _) => Ok(t),
        (None, Some(cf)) => Ok(cf),
        _ => Err("Failed to refresh POETOKEN or pass Cloudflare challenge.".into()),
    }
}

#[tauri::command]
pub async fn refresh_poetoken_background(app: tauri::AppHandle) -> Result<String, String> {
    match run_poe_refresh_or_challenge(app.clone(), false).await {
        Ok(token) => Ok(token),
        Err(e) => {
            expire_session(&app).await;
            Err(e)
        }
    }
}

// --- Check Session Status on Boot ---
pub async fn check_auth_status() -> Result<bool, String> {
    Ok(env::load_secret("poesessid")?
        .filter(|s| !s.trim().is_empty())
        .is_some())
}
