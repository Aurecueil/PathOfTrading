use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub language: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: "EN".to_string(),
        }
    }
}

pub static CURRENT_LANGUAGE: RwLock<String> = RwLock::new(String::new());

pub fn endpoint_for_language(lang: &str) -> &'static str {
    match lang.to_uppercase().as_str() {
        "BR" => "https://br.pathofexile.com",
        "RU" => "https://ru.pathofexile.com",
        "TH" => "https://th.pathofexile.com",
        "DE" => "https://de.pathofexile.com",
        "FR" => "https://fr.pathofexile.com",
        "ES" => "https://es.pathofexile.com",
        "JP" => "https://jp.pathofexile.com",
        "EN" | _ => "https://www.pathofexile.com",
    }
}

fn get_settings_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&dir);
    dir.join("settings.json")
}

pub fn load_settings_from_disk(app: &AppHandle) -> AppSettings {
    let path = get_settings_path(app);
    let settings = if let Ok(contents) = fs::read_to_string(path) {
        serde_json::from_str::<AppSettings>(&contents).unwrap_or_default()
    } else {
        AppSettings::default()
    };

    if let Ok(mut lang) = CURRENT_LANGUAGE.write() {
        *lang = settings.language.clone();
    }
    if let Ok(mut ep) = crate::trade::ENDPOINT.write() {
        *ep = endpoint_for_language(&settings.language);
    }

    settings
}

#[tauri::command]
pub fn get_language(app: AppHandle) -> String {
    if let Ok(lang) = CURRENT_LANGUAGE.read() {
        if !lang.is_empty() {
            return lang.clone();
        }
    }
    // Fallback if called before setup finishes: load directly from disk
    load_settings_from_disk(&app).language
}

#[tauri::command]
pub fn set_language(
    app: AppHandle,
    language: Option<String>,
    language_code: Option<String>,
) -> Result<(), String> {
    let code = language_code
        .or(language)
        .unwrap_or_else(|| "EN".to_string());

    let settings = AppSettings {
        language: code.clone(),
    };

    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(get_settings_path(&app), json).map_err(|e| e.to_string())?;

    if let Ok(mut lang) = CURRENT_LANGUAGE.write() {
        *lang = code.clone();
    }
    if let Ok(mut ep) = crate::trade::ENDPOINT.write() {
        *ep = endpoint_for_language(&code);
    }

    Ok(())
}
