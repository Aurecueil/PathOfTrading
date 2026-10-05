use super::env;

#[tauri::command]
pub async fn refresh_poetoken_background() -> Result<String, String> {
    const HTTP_CLIENT_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

    let poesessid = env::load_secret("poesessid")?
        .ok_or_else(|| "No POESESSID found in storage. Please log in first.".to_string())?;

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none()) // Capture Set-Cookie before 301/302 redirects
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://www.pathofexile.com/trade")
        .header("User-Agent", HTTP_CLIENT_USER_AGENT)
        .header("Cookie", format!("POESESSID={poesessid}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Extract POETOKEN from Set-Cookie headers
    for value in res.headers().get_all(reqwest::header::SET_COOKIE) {
        if let Ok(cookie_str) = value.to_str() {
            if cookie_str.starts_with("POETOKEN=") {
                let token = cookie_str
                    .split(';')
                    .next()
                    .unwrap_or("")
                    .replace("POETOKEN=", "");

                env::save_secret("poetoken", &token)?;
                return Ok(token);
            }
        }
    }

    Err("Failed to refresh POETOKEN. The POESESSID session may have expired.".into())
}

// --- Check Session Status on Boot ---
#[tauri::command]
async fn check_auth_status() -> Result<bool, String> {
    Ok(env::load_secret("poesessid")?.is_some())
}
