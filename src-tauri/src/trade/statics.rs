use crate::auth::env::load_secret;
use reqwest::header::{ACCEPT, COOKIE, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaticEntry {
    pub id: String,
    pub text: String,
    pub image: Option<String>,
    pub pseudo: Option<bool>,
    pub subtext: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaticCategory {
    pub id: String,
    pub label: Option<String>,
    pub entries: Vec<StaticEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaticDataResponse {
    pub result: Vec<StaticCategory>,
}

pub async fn fetch_static_data(realm: &str) -> Result<StaticDataResponse, String> {
    let client = Client::new();
    let endpoint = crate::trade::get_endpoint();

    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let url = format!("{endpoint}/api/{trade_path}/data/static");

    // Load auth secrets
    let poe_token =
        load_secret("poetoken")?.ok_or_else(|| "Missing 'poetoken' secret".to_string())?;
    let poesessid =
        load_secret("poesessid")?.ok_or_else(|| "Missing 'poesessid' secret".to_string())?;

    let cookie_header = format!("POESESSID={poesessid}; poetoken={poe_token}");

    let response = client
        .get(&url)
        .header(ACCEPT, "application/json")
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)")
        .header(COOKIE, cookie_header)
        .send()
        .await
        .map_err(|e| format!("HTTP request error: {e}"))?;

    // Check for HTTP errors (4xx/5xx) before attempting deserialization
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Trade API returned error status: {status}"));
    }

    response
        .json::<StaticDataResponse>()
        .await
        .map_err(|e| format!("Failed to parse static data JSON: {e}"))
}

#[tauri::command]
pub async fn load_static_data(realm: String) -> Result<StaticDataResponse, String> {
    fetch_static_data(&realm).await
}
