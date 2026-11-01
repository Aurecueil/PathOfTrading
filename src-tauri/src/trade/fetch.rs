use crate::auth::env::load_secret;
use reqwest::header::{COOKIE, USER_AGENT};
use reqwest::{Client, Response};

#[tauri::command]
pub async fn fetch_items_trade(
    ids: String,
    realm: String,
    id: String,
    pseudos: Vec<String>,
) -> Result<Response, String> {
    let client = Client::new();
    let endpoint = crate::trade::get_endpoint();

    let poesessid = load_secret("poesessid")?;
    let poe_token = load_secret("poetoken")?;
    let cf_clearance = load_secret("cf_clearance")?;

    let mut cookies = Vec::new();

    // Only add POESESSID and poetoken if poesessid exists
    if let Some(sessid) = poesessid {
        cookies.push(format!("POESESSID={sessid}"));

        if let Some(token) = poe_token {
            cookies.push(format!("poetoken={token}"));
        }
    }

    // Append cf_clearance if it exists
    if let Some(clearance) = cf_clearance {
        cookies.push(format!("cf_clearance={clearance}"));
    }

    let cookie_header = if cookies.is_empty() {
        None
    } else {
        Some(cookies.join("; "))
    };

    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let mut url = format!("{endpoint}/api/{trade_path}/fetch/{ids}?query={id}&realm={realm}");

    for pseudo in pseudos {
        let p = pseudo.trim();
        if !p.is_empty() {
            url.push_str(&format!("&pseudos[]={p}"));
        }
    }

    let mut req = client
        .get(&url)
        .header(USER_AGENT, "Aurecueil.PathOfTrading (dc:aurecueil)");

    if let Some(cookies) = cookie_header {
        req = req.header(COOKIE, cookies);
    }

    let data = req
        .send()
        .await
        .map_err(|e| format!("HTTP request error: {e}"))?;

    Ok(data)
}
