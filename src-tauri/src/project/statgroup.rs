use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PresetStat {
    pub id: String,
    /// Snapshot of the stat text, used only as a fallback display.
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub value: Map<String, Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PresetStatGroup {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String, // and | not | if | count | weight | weight2 | crucible | mercenary
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<Map<String, Value>>,
    #[serde(default)]
    pub filters: Vec<PresetStat>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StatGroupPreset {
    pub id: String,
    pub name: String,
    #[serde(default = "default_game")]
    pub game: String, // any | poe | poe2
    #[serde(default)]
    pub groups: Vec<PresetStatGroup>,
}

fn default_game() -> String {
    "any".into()
}

// 1. Keep FILE as just the filename for the user's OS config directory
const FILE: &str = "stat_group_presets.json";

// 2. Load the raw JSON content into a separate constant
const DEFAULT_PRESETS_JSON: &str = include_str!("stat_group_presets.json");

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(FILE)) // Joins "stat_group_presets.json" to the folder path
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stat_group_presets(app: AppHandle) -> Result<Vec<StatGroupPreset>, String> {
    let path = config_path(&app)?;

    // 3. If the user doesn't have a saved file yet, write & return the bundled JSON
    if !path.exists() {
        let defaults: Vec<StatGroupPreset> = serde_json::from_str(DEFAULT_PRESETS_JSON)
            .map_err(|e| format!("Invalid bundled stat_group_presets.json: {e}"))?;
        let _ = write_atomic(&path, DEFAULT_PRESETS_JSON);
        return Ok(defaults);
    }

    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    match serde_json::from_str(&raw) {
        Ok(list) => Ok(list),
        Err(_) => {
            let _ = fs::rename(&path, path.with_extension("json.bad"));
            Ok(Vec::new())
        }
    }
}

#[tauri::command]
pub fn save_stat_group_presets(
    app: AppHandle,
    presets: Vec<StatGroupPreset>,
) -> Result<(), String> {
    let path = config_path(&app)?;
    let json = serde_json::to_string_pretty(&presets).map_err(|e| e.to_string())?;
    write_atomic(&path, &json)
}
