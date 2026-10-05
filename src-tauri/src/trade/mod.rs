pub mod item;
pub mod search;

use reqwest::header::{CONTENT_TYPE, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};

pub const ENDPOINT: &str = "https://www.pathofexile.com";

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub id: String,
    pub result: Vec<String>,
    pub total: u64,
}

#[tauri::command]
pub async fn getitems(_app: tauri::AppHandle) -> Result<String, String> {
    match search::search_items(_app).await {
        Ok(data) => {
            let client = Client::new();
            let queryid = data.id;
            // Panic-safe: handles cases where data.result has fewer than 10 items
            let limit = data.result.len().min(10);
            let ids_param = data.result[..limit].join(",");
            let url = format!("{ENDPOINT}/api/trade/fetch/{ids_param}?query={queryid}");

            // .json::<SearchResponse>() automatically parses into your struct
            let data: String = client
                .get(&url)
                .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)")
                .send()
                .await
                .map_err(|e| format!("HTTP request error: {e}"))?
                .error_for_status()
                .map_err(|e| format!("Status code error: {e}"))?
                .text()
                .await
                .map_err(|e| format!("Deserialization error: {e}"))?;

            // Tauri serializes `data` to JSON for your frontend automatically
            Ok(data)
        }
        Err(err) => Err(err),
    }
}
