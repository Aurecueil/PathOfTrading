use reqwest::header::{ACCEPT, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterOptionEntry {
    /// Can be a string ID or null
    pub id: Option<String>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownItem {
    pub uniques: bool,
    pub cards: Option<bool>,
    pub currency: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterOptionContainer {
    pub options: Option<Vec<FilterOptionEntry>>,
    pub known_item: Option<KnownItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterInput {
    pub placeholder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterEntry {
    pub id: String,
    pub text: Option<String>,
    pub tip: Option<String>,
    pub option: Option<FilterOptionContainer>,
    pub input: Option<FilterInput>,
    pub full_span: Option<bool>,
    pub half_span: Option<bool>,
    pub min_max: Option<bool>,
    pub sockets: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterGroup {
    pub id: String,
    pub title: Option<String>,
    pub hidden: Option<bool>,
    pub filters: Vec<FilterEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterDataResponse {
    pub result: Vec<FilterGroup>,
}

pub async fn fetch_filters_data(realm: &str) -> Result<FilterDataResponse, String> {
    let client = Client::new();
    let endpoint = crate::trade::get_endpoint();

    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let url = format!("{endpoint}/api/{trade_path}/data/filters");

    let response = client
        .get(&url)
        .header(ACCEPT, "application/json")
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)")
        .send()
        .await
        .map_err(|e| format!("HTTP request error: {e}"))?;

    // Check for HTTP errors (4xx/5xx) before attempting deserialization
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Trade API returned error status: {status}"));
    }

    response
        .json::<FilterDataResponse>()
        .await
        .map_err(|e| format!("Failed to parse filters JSON: {e}"))
}

#[tauri::command]
pub async fn load_filters_data(realm: String) -> Result<FilterDataResponse, String> {
    fetch_filters_data(&realm).await
}
