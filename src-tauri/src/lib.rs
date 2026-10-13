pub mod auth;
pub mod project;
pub mod trade;

// fn initialize() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let limiter = trade::ApiRateLimiter::new();
    let live_state = trade::live::LiveSessionState::default();

    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--disable-blink-features=AutomationControlled --enable-features=NetworkService,NetworkServiceInProcess",
    );

    let limiter_setup = limiter.clone();

    tauri::Builder::default()
        .manage(limiter)
        .manage(live_state)
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Start the search worker & multi-realm batching engine
            limiter_setup.start_workers(app_handle.clone());

            // Run token refresh in the background on startup
            tauri::async_runtime::spawn(async move {
                match auth::refresh::check_auth_status().await {
                    Ok(true) => {
                        println!("Existing session found. Refreshing POETOKEN...");
                        match auth::refresh::refresh_poetoken_background(app_handle).await {
                            Ok(token) => println!("POETOKEN refreshed successfully: {token}"),
                            Err(err) => eprintln!("Background POETOKEN refresh failed: {err}"),
                        }
                    }
                    Ok(false) => {
                        println!("No session found, skipping background token refresh.");
                    }
                    Err(e) => eprintln!("Failed to check auth status: {e}"),
                }
            });

            // initialize();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::login::open_poe_login,
            auth::refresh::refresh_poetoken_background,
            auth::refresh::check_auth_status,
            auth::env::load_secret,
            trade::search_items,
            trade::fetch_items,
            trade::get_limiter_state,
            trade::items::load_item_data,
            trade::filters::load_filters_data,
            trade::stats::load_stats_data,
            trade::league::load_league_data,
            trade::live::start_live_search,
            trade::live::stop_live_search,
            trade::whisper::whisper,
            trade::cdn::fetch_image_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
