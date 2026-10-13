use reqwest::header::USER_AGENT;
use reqwest::Client;

#[tauri::command]
pub async fn fetch_image_bytes(url: String) -> Result<Vec<u8>, String> {
    let client = Client::new();

    let res = client
        .get(&url)
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)")
        .send()
        .await
        .map_err(|e| format!("Network request failed: {e}"))?;

    let status = res.status();
    if !status.is_success() {
        return Err(format!("CDN returned error status: {status}"));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image byte stream: {e}"))?;

    Ok(bytes.to_vec())
}
