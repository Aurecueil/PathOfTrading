use reqwest::header::{ACCEPT, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatOption {
    pub id: i64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatOptionContainer {
    pub options: Vec<StatOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatEntry {
    pub id: String,
    pub text: String,
    #[serde(rename = "type")]
    pub stat_type: String,
    #[serde(default)]
    pub option: Option<StatOptionContainer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatGroup {
    pub id: String,
    pub label: String,
    pub entries: Vec<StatEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsDataResponse {
    pub result: Vec<StatGroup>,
}

pub async fn fetch_stats_data(realm: &str) -> Result<StatsDataResponse, String> {
    let client = Client::new();
    let endpoint = crate::trade::get_endpoint();

    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let url = format!("{endpoint}/api/{trade_path}/data/stats");

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
        .json::<StatsDataResponse>()
        .await
        .map_err(|e| format!("Failed to parse stats JSON: {e}"))
}

#[tauri::command]
pub async fn load_stats_data(realm: String) -> Result<StatsDataResponse, String> {
    fetch_stats_data(&realm).await
}
