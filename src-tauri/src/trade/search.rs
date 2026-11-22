use crate::auth::env::load_secret;
use reqwest::header::{CONTENT_TYPE, COOKIE, USER_AGENT};
use reqwest::{Client, Response};
use serde_json::Value;

pub async fn search_items_trade(
    payload: Value,
    realm: String,
    league: String,
) -> Result<Response, String> {
    let client = Client::new();
    let endpoint = crate::trade::get_endpoint();
    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let poe_platform = if realm == "xbox" {
        "xbox/"
    } else if realm == "sony" {
        "sony/"
    } else {
        ""
    };
    let url = format!("{endpoint}/api/{trade_path}/search/{poe_platform}{league}");

    let mut cookies = Vec::new();

    if let Some(poesessid) = load_secret("poesessid")?.filter(|s| !s.trim().is_empty()) {
        cookies.push(format!("POESESSID={poesessid}"));
    }

    if let Some(poe_token) = load_secret("poetoken")?.filter(|s| !s.trim().is_empty()) {
        cookies.push(format!("poetoken={poe_token}"));
    }

    if let Some(cf) = load_secret("cf_clearance")?.filter(|s| !s.trim().is_empty()) {
        cookies.push(format!("cf_clearance={cf}"));
    }

    let mut request = client
        .post(&url)
        .header(CONTENT_TYPE, "application/json")
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)");

    if !cookies.is_empty() {
        request = request.header(COOKIE, cookies.join("; "));
    }

    let data = request
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request error: {e}"))?;

    Ok(data)
}
