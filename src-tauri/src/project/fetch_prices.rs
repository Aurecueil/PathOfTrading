use tauri::command;

const PRICING_BASE_URL: &str = "https://data.aurecueil.uk";

#[command]
pub async fn fetch_pricing_index() -> Result<String, String> {
    let url = format!("{}/index.json", PRICING_BASE_URL);
    let res = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to fetch index.json: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("HTTP {} when fetching index.json", res.status()));
    }

    res.text()
        .await
        .map_err(|e| format!("Failed to read index.json body: {}", e))
}

#[command]
pub async fn fetch_realm_pricing(realm: String) -> Result<String, String> {
    // Validate realm to prevent path traversal
    if !matches!(realm.as_str(), "pc" | "poe2" | "xbox" | "sony") {
        return Err(format!("Invalid realm: {}", realm));
    }

    let url = format!("{}/{}/current.json", PRICING_BASE_URL, realm);
    let res = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to fetch {}/current.json: {}", realm, e))?;

    if !res.status().is_success() {
        return Err(format!(
            "HTTP {} when fetching {}/current.json",
            res.status(),
            realm
        ));
    }

    res.text()
        .await
        .map_err(|e| format!("Failed to read {}/current.json body: {}", realm, e))
}
