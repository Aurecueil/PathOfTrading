use crate::auth::env::load_secret;
use reqwest::header::{COOKIE, ORIGIN, REFERER, USER_AGENT};
use reqwest::Client;
use serde_json::{json, Value};

#[tauri::command]
pub async fn whisper(
    token: String,
    realm: String,
    league: String,
    searchId: String,
) -> Result<Value, String> {
    let client = Client::new();
    let endpoint = crate::trade::get_endpoint();

    let poesessid = load_secret("poesessid")?
        .ok_or_else(|| "400 Bad Request: poesessid is required".to_string())?;

    let poe_token = load_secret("poetoken")?
        .ok_or_else(|| "400 Bad Request: poe_token is required".to_string())?;

    let cookie_header = format!("POESESSID={poesessid}; POETOKEN={poe_token}");
    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let url = format!("{endpoint}/api/{trade_path}/whisper");

    // Adjust this URL to match the exact search URL/view where the whisper originates
    let referer_url = format!("{endpoint}/{trade_path}/search/{league}/{searchId}");

    let payload = json!({
        "token": token
    });

    let res = client
        .post(&url)
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)")
        .header(REFERER, referer_url)
        .header(ORIGIN, endpoint)
        .header("X-Requested-With", "XMLHttpRequest")
        .header(COOKIE, cookie_header)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request error: {e}"))?;

    let status = res.status();
    let body = res
        .json::<Value>()
        .await
        .map_err(|e| format!("Failed to parse response body as JSON: {e}"))?;

    if !status.is_success() {
        return Err(format!("Request failed with status {status}: {body}"));
    }

    Ok(body)
}
