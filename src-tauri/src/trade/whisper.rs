use crate::auth::env::load_secret;
use reqwest::header::{COOKIE, ORIGIN, REFERER, USER_AGENT};
use reqwest::Client;
use serde_json::{json, Value};

async fn send_whisper(
    client: &Client,
    url: &str,
    referer_url: &str,
    origin: &str,
    cookie_header: &str,
    payload: &Value,
) -> Result<Value, String> {
    let res = client
        .post(url)
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)")
        .header(REFERER, referer_url)
        .header(ORIGIN, origin)
        .header("X-Requested-With", "XMLHttpRequest")
        .header(COOKIE, cookie_header)
        .json(payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request error: {e}"))?;

    let status = res.status();
    let body_text = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    if !status.is_success() {
        return Err(body_text);
    }

    serde_json::from_str(&body_text)
        .map_err(|e| format!("Failed to parse response body as JSON: {e}"))
}

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

    let cf_clearance = load_secret("cf_clearance")?.filter(|s| !s.trim().is_empty());
    let mut cookie_header = format!("POESESSID={poesessid}; POETOKEN={poe_token}");
    if let Some(cf) = cf_clearance {
        cookie_header.push_str(&format!("; cf_clearance={cf}"));
    }

    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let url = format!("{endpoint}/api/{trade_path}/whisper");
    let referer_url = format!("{endpoint}/{trade_path}/search/{league}/{searchId}");

    // First request: no `continue`
    let first_payload = json!({ "token": token });
    let first = send_whisper(
        &client,
        &url,
        &referer_url,
        &endpoint,
        &cookie_header,
        &first_payload,
    )
    .await?;

    // success:false with a `continue` -> one followup using that value
    if first.get("success").and_then(Value::as_bool) == Some(false) {
        if let Some(c) = first.get("continue") {
            let followup_payload = json!({ "token": token, "continue": c });
            return send_whisper(
                &client,
                &url,
                &referer_url,
                &endpoint,
                &cookie_header,
                &followup_payload,
            )
            .await;
        }
    }

    Ok(first)
}
