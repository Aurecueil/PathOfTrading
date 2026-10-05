use reqwest::header::{CONTENT_TYPE, USER_AGENT};
use reqwest::Client;
use serde_json::json;

#[tauri::command]
pub async fn search_items(_app: tauri::AppHandle) -> Result<super::SearchResponse, String> {
    let client = Client::new();

    let payload = json!({
        "query": {
            "status": { "option": "any" },
            "name": "Mageblood",
            "type": "Heavy Belt",
            "stats": [{ "type": "and", "filters": [] }]
        },
        "sort": { "price": "asc" }
    });
    let endpoint = super::ENDPOINT;
    let url = format!("{endpoint}/api/trade/search/Allflame");

    // .json::<SearchResponse>() automatically parses into your struct
    let data: super::SearchResponse = client
        .post(&url)
        .header(CONTENT_TYPE, "application/json")
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request error: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Status code error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Deserialization error: {e}"))?;

    Ok(data)
}
