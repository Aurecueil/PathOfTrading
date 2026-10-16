use crate::auth::env::load_secret;
use reqwest::header::{ACCEPT, COOKIE, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct League {
    pub id: String,
    pub realm: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeagueData {
    pub result: Vec<League>,
}

pub async fn fetch_league_data(realm: &str) -> Result<LeagueData, String> {
    let client = Client::new();
    let endpoint = "https://www.pathofexile.com";

    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let url = format!("{endpoint}/api/{trade_path}/data/leagues");

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
        .json::<LeagueData>()
        .await
        .map_err(|e| format!("Failed to parse league JSON: {e}"))
}

#[tauri::command]
pub async fn load_league_data(realm: String) -> Result<LeagueData, String> {
    fetch_league_data(&realm).await
}
