pub mod auth;
pub mod project;
pub mod settings;
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
                            Ok(t) => println!("POETOKEN refreshed successfully {t}"),
                            Err(err) => eprintln!("Background POETOKEN refresh failed: {err}"),
                        }
                    }
                    Ok(false) => {
                        println!("No session found, skipping background token refresh.");
                    }
                    Err(e) => eprintln!("Failed to check auth status: {e}"),
                }
            });
            trade::settings::load_settings_from_disk(app.handle());
            // initialize();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::login::open_poe_login,
            auth::refresh::refresh_poetoken_background,
            auth::login::get_poe_auth_status,
            auth::login::logout_poe,
            auth::env::load_secret,
            trade::search_items,
            trade::fetch_items,
            trade::get_limiter_state,
            trade::cancel_ui_jobs,
            trade::items::load_item_data,
            trade::filters::load_filters_data,
            trade::stats::load_stats_data,
            trade::league::load_league_data,
            trade::live::start_live_search,
            trade::live::stop_live_search,
            trade::whisper::whisper,
            trade::cdn::fetch_image_bytes,
            trade::statics::load_static_data,
            project::load_project_index,
            project::load_project,
            project::save_project,
            project::delete_project,
            project::export_project_file,
            project::encode_project_code,
            project::decode_project_code,
            auth::login::open_external_url,
            project::window_minimize,
            project::window_toggle_maximize,
            project::window_start_dragging,
            project::exit_app,
            trade::settings::set_language,
            trade::settings::get_language,
            settings::get_user_settings,
            settings::set_color_coding,
            project::colorCodingSettings::save_custom_stat_colors,
            project::colorCodingSettings::save_disabled_default_stat_colors,
            project::colorCodingSettings::get_stat_color_configs,
            project::statgroup::get_stat_group_presets,
            project::statgroup::save_stat_group_presets,
            trade::openWebsite::open_trade_website,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
