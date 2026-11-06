use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

// Injected via CI/CD environment variable at compile time.
// Falls back to "" (empty string) when unset or during local dev.
const TELEMETRY_KEY: &str = match option_env!("TELEMETRY_KEY") {
    Some(val) => val,
    None => "",
};

const WORKER_BASE_URL: &str = "https://pathoftradinguseractivitytelemetry.aurecueil.uk";

#[derive(Serialize, Deserialize, Debug)]
pub struct TelemetryEvent {
    pub timestamp: i64,
    pub action: String,
}

#[derive(Serialize)]
struct IngestPayload {
    user_id: String,
    events: Vec<TelemetryEvent>,
}

#[derive(Deserialize)]
struct ChallengeResponse {
    challenge: String,
    prefix: String,
}

/// Solves SHA256(challenge + ":" + nonce) starting with `prefix`
fn solve_pow(challenge: &str, prefix: &str) -> String {
    let mut nonce: u64 = 0;
    loop {
        let candidate = format!("{}:{}", challenge, nonce);
        let mut hasher = Sha256::new();
        hasher.update(candidate.as_bytes());
        let hash_hex = hex::encode(hasher.finalize());

        if hash_hex.starts_with(prefix) {
            return nonce.to_string();
        }
        nonce += 1;
    }
}

/// Computes HMAC-SHA256(TELEMETRY_KEY, message)
fn compute_hmac(key: &str, message: &str) -> Result<String, String> {
    let mut mac =
        HmacSha256::new_from_slice(key.as_bytes()).map_err(|e| format!("HMAC key error: {}", e))?;
    mac.update(message.as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}

#[tauri::command]
pub async fn send_telemetry(user_id: String, events: Vec<TelemetryEvent>) -> Result<(), String> {
    let client = reqwest::Client::new();

    // 1. Fetch PoW Challenge from Worker
    let challenge_res: ChallengeResponse = client
        .get(format!("{}/challenge", WORKER_BASE_URL))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    // 2. Solve PoW on a blocking thread so it doesn't freeze the async runtime
    let challenge_clone = challenge_res.challenge.clone();
    let prefix_clone = challenge_res.prefix.clone();
    let solution =
        tauri::async_runtime::spawn_blocking(move || solve_pow(&challenge_clone, &prefix_clone))
            .await
            .map_err(|e| e.to_string())?;

    // 3. Serialize Body & Compute HMAC Signature
    let payload = IngestPayload { user_id, events };
    let raw_body = serde_json::to_string(&payload).map_err(|e| e.to_string())?;

    let now_ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs()
        .to_string();

    let signature_input = format!("{}:{}", now_ts, raw_body);
    let signature = compute_hmac(TELEMETRY_KEY, &signature_input)?;

    // 4. Send Signed + PoW-Solved Request to Worker
    let res = client
        .post(format!("{}/ingest", WORKER_BASE_URL))
        .header("Content-Type", "application/json")
        .header("X-PoW-Challenge", challenge_res.challenge)
        .header("X-PoW-Solution", solution)
        .header("X-Telemetry-Timestamp", now_ts)
        .header("X-Telemetry-Signature", signature)
        .body(raw_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Telemetry rejected ({}): {}", status, err_text));
    }

    Ok(())
}
