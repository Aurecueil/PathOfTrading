use super::env;
use std::fs;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

const CF_DETECTOR_SCRIPT: &str = r#"
(function() {
    if (window.__cfDetectorInstalled) return;
    window.__cfDetectorInstalled = true;
    setInterval(() => {
        const isCf = document.title.includes("Just a moment") ||
                     document.title.includes("Attention Required") ||
                     !!document.querySelector('#challenge-running, #challenge-stage, .cf-turnstile, iframe[src*="challenges.cloudflare.com"]');
        if (isCf && !document.title.startsWith("__CF_CHALLENGE__")) {
            document.title = "__CF_CHALLENGE__:" + document.title;
        }
    }, 200);
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

    if let Some(existing) = app.get_webview_window("poe_refresh_hidden") {
        let _ = existing.close();
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    let trade_url: Url = "https://www.pathofexile.com/trade"
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;

    // Always spawn hidden first so we can clear stale CF data before showing the popup
    let window = WebviewWindowBuilder::new(
        &app,
        "poe_refresh_hidden",
        WebviewUrl::External(trade_url.clone()),
    )
    .title(if force_show {
        "Cloudflare Verification - Path of Exile"
    } else {
        "PoE Token Refresh"
    })
    .inner_size(650.0, 750.0)
    .visible(false)
    .focused(false)
    .initialization_script(CF_DETECTOR_SCRIPT)
    .data_directory(profile_dir)
    .build()
    .map_err(|e| e.to_string())?;

    let mut is_shown = false;

    // If explicitly triggered by a Cloudflare block on trade fetches, clear CF data immediately before showing
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

    let mut attempts = 0;
    let mut max_attempts: usize = if force_show { 480 } else { 30 }; // 120s interactive, 7.5s hidden

    let mut token_result = None;
    let mut cf_clearance_result = None;

    while attempts < max_attempts {
        tokio::time::sleep(Duration::from_millis(250)).await;
        attempts += 1;

        if app.get_webview_window("poe_refresh_hidden").is_none() {
            return Err("Verification window was closed by user.".into());
        }

        let _ = window.eval(CF_DETECTOR_SCRIPT);

        let mut is_cf_challenged = false;
        if let Ok(title) = window.title() {
            let lower = title.to_lowercase();
            if title.starts_with("__CF_CHALLENGE__:")
                || lower.contains("just a moment")
                || lower.contains("attention required")
                || lower.contains("cloudflare")
                || lower.contains("security check")
            {
                is_cf_challenged = true;
            }
        }

        let mut current_token = None;
        let mut current_cf = None;
        let mut has_cf_chl_cookie = false;

        for domain in &domains {
            if let Ok(cookies) = window.cookies_for_url(domain.clone()) {
                for c in &cookies {
                    let name = c.name();
                    if name == "POETOKEN" && !c.value().is_empty() {
                        current_token = Some(c.value().to_string());
                    } else if name == "cf_clearance" && !c.value().is_empty() {
                        current_cf = Some(c.value().to_string());
                    } else if name.starts_with("__cf_chl") || name.starts_with("cf_chl") {
                        has_cf_chl_cookie = true;
                    }
                }
            }
        }

        // If background refresh hits a Cloudflare challenge or stalls without POETOKEN,
        // clear stale Cloudflare browser data first, reload, and reveal the window
        if !is_shown
            && (is_cf_challenged
                || (has_cf_chl_cookie && current_token.is_none())
                || (attempts == 14 && current_token.is_none()))
        {
            is_shown = true;
            max_attempts = attempts + 480; // Extend timeout to 2 minutes for user interaction

            clear_cloudflare_webview_data(&window).await;
            let _ = window.navigate(trade_url.clone());

            let _ = window.set_title("Cloudflare Verification - Path of Exile");
            let _ = window.center();
            let _ = window.show();
            let _ = window.set_focus();
            continue;
        }

        // Wait until any active challenge finishes and valid cookies are present
        if !is_cf_challenged {
            if is_shown {
                // Since we wiped cf_clearance before showing, any non-empty current_cf is freshly issued
                if current_cf.is_some() && current_token.is_some() {
                    token_result = current_token;
                    cf_clearance_result = current_cf;
                    break;
                } else if attempts >= 16 && (current_cf.is_some() || current_token.is_some()) {
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
    }

    let _ = window.close();

    if let Some(ref cf) = cf_clearance_result {
        let _ = env::save_secret("cf_clearance", cf);
    }
    if let Some(cf) = cf_clearance_result {
        Ok(cf)
    } else if let Some(token) = token_result {
        env::save_secret("poetoken", &token)?;
        Ok(token)
    } else {
        Err("Failed to refresh POETOKEN or pass Cloudflare challenge.".into())
    }
}

#[tauri::command]
pub async fn refresh_poetoken_background(app: tauri::AppHandle) -> Result<String, String> {
    run_poe_refresh_or_challenge(app, false).await
}

// --- Check Session Status on Boot ---
pub async fn check_auth_status() -> Result<bool, String> {
    Ok(env::load_secret("poesessid")?
        .filter(|s| !s.trim().is_empty())
        .is_some())
}
