use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub keywords: Vec<String>,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Group {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub elements: Vec<Node>,
}

/// Untagged: `Rule` MUST come first. A rule JSON would also satisfy `Group`
/// (elements defaults to empty), a group JSON can never satisfy `Rule`
/// (no keywords/color).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(untagged)]
pub enum Node {
    Rule(Rule),
    Group(Group),
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct DisabledDefaults {
    #[serde(default)]
    pub disabled_ids: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StatColorConfigBundle {
    pub defaults: Vec<Node>,
    pub disabled_ids: Vec<String>,
    pub custom: Vec<Node>,
}

// Read-only defaults, embedded at compile time
const DEFAULT_STAT_COLORS_JSON: &str = include_str!("defaultColorCoding.json");

const DISABLED_FILE: &str = "disabled_default_stat_colors.json";
const CUSTOM_FILE: &str = "custom_stat_colors.json";

fn get_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Write to a temp file then rename, so a crash can't leave a half-written config.
fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn read_or_default<T: for<'de> Deserialize<'de> + Default>(path: &Path) -> T {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_stat_color_configs(app: AppHandle) -> Result<StatColorConfigBundle, String> {
    let dir = get_config_dir(&app)?;

    let defaults: Vec<Node> = serde_json::from_str(DEFAULT_STAT_COLORS_JSON)
        .map_err(|e| format!("Invalid embedded default colors: {e}"))?;

    let disabled: DisabledDefaults = read_or_default(&dir.join(DISABLED_FILE));
    // Old-format files fail to parse and fall back to an empty list
    let custom: Vec<Node> = read_or_default(&dir.join(CUSTOM_FILE));

    Ok(StatColorConfigBundle {
        defaults,
        disabled_ids: disabled.disabled_ids,
        custom,
    })
}

#[tauri::command]
pub fn save_disabled_default_stat_colors(
    app: AppHandle,
    disabled_ids: Vec<String>,
) -> Result<(), String> {
    let path = get_config_dir(&app)?.join(DISABLED_FILE);
    let json = serde_json::to_string_pretty(&DisabledDefaults { disabled_ids })
        .map_err(|e| e.to_string())?;
    write_atomic(&path, &json)
}

#[tauri::command]
pub fn save_custom_stat_colors(app: AppHandle, custom: Vec<Node>) -> Result<(), String> {
    let path = get_config_dir(&app)?.join(CUSTOM_FILE);
    let json = serde_json::to_string_pretty(&custom).map_err(|e| e.to_string())?;
    write_atomic(&path, &json)
}
