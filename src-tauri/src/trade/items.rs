use crate::auth::env::load_secret;
use reqwest::header::{ACCEPT, COOKIE, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flags {
    #[serde(default)]
    pub unique: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    #[serde(rename = "type")]
    pub item_type: String,
    pub text: Option<String>,
    pub name: Option<String>,
    pub disc: Option<String>,
    pub flags: Option<Flags>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub label: String,
    pub entries: Vec<Entry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemDataResponse {
    pub result: Vec<Category>,
}

pub async fn fetch_items_data(realm: &str) -> Result<ItemDataResponse, String> {
    let client = Client::new();
    let endpoint = super::ENDPOINT;

    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let url = format!("{endpoint}/api/{trade_path}/data/items");

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
        .json::<ItemDataResponse>()
        .await
        .map_err(|e| format!("Failed to parse items JSON: {e}"))
}

#[tauri::command]
pub async fn load_item_data(realm: String) -> Result<ItemDataResponse, String> {
    fetch_items_data(&realm).await
}
