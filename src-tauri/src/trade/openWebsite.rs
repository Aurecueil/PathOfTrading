use crate::auth::login::open_external_url;

#[tauri::command]
pub async fn open_trade_website(
    search_id: String,
    realm: String,
    league: String,
) -> Result<(), String> {
    let endpoint = crate::trade::get_endpoint();
    let trade_path = if realm == "poe2" { "trade2" } else { "trade" };
    let url = format!("{endpoint}/{trade_path}/search/{league}/{search_id}");

    // Await the asynchronous open_external_url function and handle the Result
    open_external_url(url).await
}
