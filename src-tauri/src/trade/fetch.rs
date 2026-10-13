use crate::auth::env::load_secret;
use reqwest::header::{COOKIE, USER_AGENT};
use reqwest::{Client, Response};

#[tauri::command]
pub async fn fetch_items_trade(ids: String, realm: String) -> Result<Response, String> {
    let client = Client::new();
    let endpoint = super::ENDPOINT;

    let poesessid = load_secret("poesessid")?;
    let poe_token = load_secret("poetoken")?;

    // Determine cookie header based on secret presence:
    // - If poesessid is missing: include neither
    // - If poetoken is missing but poesessid exists: include only POESESSID
    // - Otherwise: include both
    let cookie_header = match (poesessid, poe_token) {
        (Some(sessid), Some(token)) => Some(format!("POESESSID={sessid}; poetoken={token}")),
        (Some(sessid), None) => Some(format!("POESESSID={sessid}")),
        (None, _) => None,
    };
    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let url = format!("{endpoint}/api/{trade_path}/fetch/{ids}");
    let mut req = client
        .get(&url)
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)");

    if let Some(cookies) = cookie_header {
        req = req.header(COOKIE, cookies);
    }

    let data = req
        .send()
        .await
        .map_err(|e| format!("HTTP request error: {e}"))?;

    Ok(data)
}
