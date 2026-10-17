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
    let url = format!("{endpoint}/api/{trade_path}/search/{league}");

    let poe_token =
        load_secret("poetoken")?.ok_or_else(|| "Missing 'poetoken' secret".to_string())?;
    let poesessid =
        load_secret("poesessid")?.ok_or_else(|| "Missing 'poesessid' secret".to_string())?;
    let cf_clearance = load_secret("cf_clearance")?.filter(|s| !s.trim().is_empty());

    let mut cookie_header = format!("POESESSID={poesessid}; poetoken={poe_token}");
    if let Some(cf) = cf_clearance {
        cookie_header.push_str(&format!("; cf_clearance={cf}"));
    }

    let data = client
        .post(&url)
        .header(CONTENT_TYPE, "application/json")
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)")
        .header(COOKIE, cookie_header)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request error: {e}"))?;

    Ok(data)
}
