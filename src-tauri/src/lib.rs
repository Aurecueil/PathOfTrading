pub mod auth;
pub mod project;
pub mod settings;
pub mod trade;

// fn initialize() {}
#[cfg(windows)]
unsafe extern "system" fn block_alt_menu(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _id: usize,
    _data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::LRESULT;
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::WM_SYSCOMMAND;

    const SC_KEYMENU: usize = 0xF100;
    // lparam == 0 means Alt was pressed alone (Alt+Space has lparam == ' ')
    if msg == WM_SYSCOMMAND && (wparam.0 & 0xFFF0) == SC_KEYMENU && lparam.0 == 0 {
        return LRESULT(0);
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let limiter = trade::ApiRateLimiter::new();
    let live_state = trade::live::LiveSessionState::default();

    let tp_controller = trade::tp::TpController::new(limiter.clone());

    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--disable-blink-features=AutomationControlled --enable-features=NetworkService,NetworkServiceInProcess",
    );

    let limiter_setup = limiter.clone();

    tauri::Builder::default()
        .manage(limiter)
        .manage(live_state)
        .manage(tp_controller)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
                            Ok(_) => println!("POETOKEN refreshed successfully"),
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
            #[cfg(windows)]
            {
                use tauri::Manager;
                use windows::Win32::Foundation::HWND;
                use windows::Win32::UI::Shell::SetWindowSubclass;

                let win = app.get_webview_window("main").unwrap();
                let raw = win.hwnd().unwrap().0;
                unsafe {
                    let _ = SetWindowSubclass(HWND(raw as _), Some(block_alt_menu), 1, 0);
                }
            }
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
            trade::tp::tp_set_active,
            trade::tp::tp_set_items,
            trade::tp::tp_clear_seen,
            trade::tp::tp_set_hotkey,
            project::fetch_prices::fetch_pricing_index,
            project::fetch_prices::fetch_realm_pricing,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
