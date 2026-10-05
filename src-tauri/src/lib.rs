pub mod auth;
pub mod trade;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--disable-blink-features=AutomationControlled --enable-features=NetworkService,NetworkServiceInProcess",
    );

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            auth::login::open_poe_login,
            auth::refresh::refresh_poetoken_background,
            auth::refresh::check_auth_status,
            auth::env::load_secret,
            trade::getitems
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
