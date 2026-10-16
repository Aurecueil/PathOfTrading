// src-tauri/src/user_settings.rs
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserSettings {
    #[serde(rename = "colorCoding")]
    pub color_coding: bool,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self { color_coding: true }
    }
}

pub static COLOR_CODING: RwLock<bool> = RwLock::new(true);

fn get_user_settings_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&dir);
    dir.join("settings.json")
}

pub fn load_user_settings_from_disk(app: &AppHandle) -> UserSettings {
    let path = get_user_settings_path(app);
    let settings = if let Ok(contents) = fs::read_to_string(path) {
        serde_json::from_str::<UserSettings>(&contents).unwrap_or_default()
    } else {
        UserSettings::default()
    };

    if let Ok(mut cc) = COLOR_CODING.write() {
        *cc = settings.color_coding;
    }

    settings
}

#[tauri::command]
pub fn get_user_settings(app: AppHandle) -> UserSettings {
    load_user_settings_from_disk(&app)
}

#[tauri::command]
pub fn set_color_coding(app: AppHandle, enabled: bool) -> Result<(), String> {
    let settings = UserSettings {
        color_coding: enabled,
    };

    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(get_user_settings_path(&app), json).map_err(|e| e.to_string())?;

    if let Ok(mut cc) = COLOR_CODING.write() {
        *cc = enabled;
    }

    Ok(())
}
