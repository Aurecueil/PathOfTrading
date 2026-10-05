use keyring::Entry;

const APP_SERVICE: &str = "Aurecueil.PathOfTrading";

pub fn save_secret(key: &str, secret: &str) -> Result<(), String> {
    let entry = Entry::new(APP_SERVICE, key).map_err(|e| e.to_string())?;
    entry.set_password(secret).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_secret(key: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(APP_SERVICE, key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pwd) => Ok(Some(pwd)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
