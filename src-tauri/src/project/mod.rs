pub mod colorCodingSettings;
pub mod statgroup;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use flate2::{read::ZlibDecoder, write::ZlibEncoder, Compression};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, WebviewWindow};

fn default_mode() -> String {
    "regular".to_string()
}

fn default_realm() -> String {
    "pc".to_string()
}

fn default_league() -> String {
    "Standard".to_string()
}

fn default_scale() -> f64 {
    1.0
}

fn default_currency() -> String {
    "chaos".to_string()
}

fn default_search_on_load() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraState {
    #[serde(default = "default_scale")]
    pub scale: f64,
    #[serde(default, rename = "offsetX")]
    pub offset_x: f64,
    #[serde(default, rename = "offsetY")]
    pub offset_y: f64,
}

impl Default for CameraState {
    fn default() -> Self {
        Self {
            scale: 1.0,
            offset_x: 0.0,
            offset_y: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSearchTile {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub realm: String,
    #[serde(default)]
    pub league: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub full_payload: Value,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default, rename = "displayOptions")]
    pub display_options: Option<Value>,
    #[serde(default = "default_currency")]
    pub currency: String,
    #[serde(default = "default_search_on_load", rename = "searchOnLoad")]
    pub search_on_load: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedAnnotation {
    pub id: u64,
    pub kind: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub color: String,
    pub thickness: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, rename = "flipX", skip_serializing_if = "Option::is_none")]
    pub flip_x: Option<bool>,
    #[serde(default, rename = "flipY", skip_serializing_if = "Option::is_none")]
    pub flip_y: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ProjectItem {
    Annotation(SavedAnnotation),
    Tile(SavedSearchTile),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedProject {
    pub id: String,
    pub name: String,
    #[serde(default = "default_realm")]
    pub realm: String,
    #[serde(default = "default_league")]
    pub league: String,
    #[serde(default)]
    pub camera: CameraState,
    #[serde(default)]
    pub updated_at: u64,
    #[serde(default)]
    pub items: Vec<ProjectItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectIndexEntry {
    pub id: String,
    pub name: String,
    #[serde(default = "default_realm")]
    pub realm: String,
    #[serde(default = "default_league")]
    pub league: String,
    pub updated_at: u64,
    pub tile_count: usize,
    pub annotation_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareCodePayload {
    #[serde(default)]
    pub camera: Option<CameraState>,
    #[serde(default)]
    pub realm: Option<String>,
    #[serde(default)]
    pub league: Option<String>,
    pub items: Vec<ProjectItem>,
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn get_projects_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {e}"))?;
    let dir = base.join("projects");
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create projects directory: {e}"))?;
    }
    Ok(dir)
}

fn get_index_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_projects_dir(app)?.join("index.json"))
}

fn sanitize_id(id: &str) -> String {
    id.chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

fn get_project_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let safe_id = sanitize_id(id);
    if safe_id.is_empty() {
        return Err("Invalid project ID".to_string());
    }
    Ok(get_projects_dir(app)?.join(format!("{safe_id}.json")))
}

fn write_index(app: &AppHandle, index: &mut Vec<ProjectIndexEntry>) -> Result<(), String> {
    index.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    let index_path = get_index_path(app)?;
    let json = serde_json::to_string_pretty(index)
        .map_err(|e| format!("Failed to serialize project index: {e}"))?;
    fs::write(index_path, json).map_err(|e| format!("Failed to write project index: {e}"))
}

#[tauri::command]
pub async fn load_project_index(app: AppHandle) -> Result<Vec<ProjectIndexEntry>, String> {
    let index_path = get_index_path(&app)?;
    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&index_path)
        .map_err(|e| format!("Failed to read project index: {e}"))?;
    let mut entries: Vec<ProjectIndexEntry> = serde_json::from_str(&raw).unwrap_or_default();
    entries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(entries)
}

#[tauri::command]
pub async fn load_project(app: AppHandle, id: String) -> Result<SavedProject, String> {
    let path = get_project_path(&app, &id)?;
    if !path.exists() {
        return Err(format!("Project '{id}' does not exist on disk."));
    }

    let raw =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read project '{id}': {e}"))?;
    let project: SavedProject =
        serde_json::from_str(&raw).map_err(|e| format!("Failed to parse project '{id}': {e}"))?;
    Ok(project)
}

#[tauri::command]
pub async fn save_project(
    app: AppHandle,
    mut project: SavedProject,
) -> Result<ProjectIndexEntry, String> {
    let now = now_epoch_ms();
    project.updated_at = now;

    let path = get_project_path(&app, &project.id)?;
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write project file: {e}"))?;

    let mut tile_count = 0;
    let mut annotation_count = 0;
    for item in &project.items {
        match item {
            ProjectItem::Tile(_) => tile_count += 1,
            ProjectItem::Annotation(_) => annotation_count += 1,
        }
    }

    let entry = ProjectIndexEntry {
        id: project.id.clone(),
        name: project.name.clone(),
        realm: project.realm.clone(),
        league: project.league.clone(),
        updated_at: now,
        tile_count,
        annotation_count,
    };

    let mut index = load_project_index(app.clone()).await.unwrap_or_default();
    if let Some(existing) = index.iter_mut().find(|e| e.id == project.id) {
        *existing = entry.clone();
    } else {
        index.push(entry.clone());
    }

    write_index(&app, &mut index)?;
    Ok(entry)
}

#[tauri::command]
pub async fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    let path = get_project_path(&app, &id)?;
    if path.exists() {
        let _ = fs::remove_file(path);
    }

    let mut index = load_project_index(app.clone()).await.unwrap_or_default();
    index.retain(|e| e.id != id);
    write_index(&app, &mut index)?;
    Ok(())
}

/// Opens native Windows Explorer Save dialog to choose location and name (.pot extension).
/// Returns Ok(Some(saved_path)) if saved, or Ok(None) if the user canceled the dialog.
#[tauri::command]
pub async fn export_project_file(app: AppHandle, id: String) -> Result<Option<String>, String> {
    let project = load_project(app, id).await?;

    let default_stem = if project.name.trim().is_empty() {
        "project".to_string()
    } else {
        project
            .name
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                    c
                } else {
                    '_'
                }
            })
            .collect::<String>()
            .trim()
            .to_string()
    };

    let default_filename = format!("{default_stem}.pot");

    let chosen_path = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Export Path of Trading Project")
            .add_filter("Path of Trading Project (*.pot)", &["pot"])
            .set_file_name(&default_filename)
            .save_file()
    })
    .await
    .map_err(|e| format!("Dialog task error: {e}"))?;

    let Some(mut target_path) = chosen_path else {
        return Ok(None);
    };

    if target_path.extension().and_then(|s| s.to_str()) != Some("pot") {
        target_path.set_extension("pot");
    }

    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project for export: {e}"))?;
    fs::write(&target_path, json).map_err(|e| format!("Failed to write .pot file: {e}"))?;

    Ok(Some(target_path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn encode_project_code(payload: ShareCodePayload) -> Result<String, String> {
    let json_bytes =
        serde_json::to_vec(&payload).map_err(|e| format!("JSON serialization error: {e}"))?;

    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::best());
    encoder
        .write_all(&json_bytes)
        .map_err(|e| format!("Zlib write error: {e}"))?;
    let compressed = encoder
        .finish()
        .map_err(|e| format!("Zlib finish error: {e}"))?;

    Ok(BASE64.encode(compressed))
}

#[tauri::command]
pub fn decode_project_code(code: String) -> Result<ShareCodePayload, String> {
    let trimmed = code.trim();
    let compressed = BASE64
        .decode(trimmed)
        .map_err(|e| format!("Invalid Base64 share code: {e}"))?;

    let mut decoder = ZlibDecoder::new(&compressed[..]);
    let mut json_str = String::new();
    decoder
        .read_to_string(&mut json_str)
        .map_err(|e| format!("Zlib decompression failed: {e}"))?;

    if let Ok(payload) = serde_json::from_str::<ShareCodePayload>(&json_str) {
        return Ok(payload);
    }
    if let Ok(project) = serde_json::from_str::<SavedProject>(&json_str) {
        return Ok(ShareCodePayload {
            camera: Some(project.camera),
            realm: Some(project.realm),
            league: Some(project.league),
            items: project.items,
        });
    }
    if let Ok(items) = serde_json::from_str::<Vec<ProjectItem>>(&json_str) {
        return Ok(ShareCodePayload {
            camera: None,
            realm: None,
            league: None,
            items,
        });
    }

    Err("Decoded JSON did not match expected project code schema.".to_string())
}

// ============================================================================
// Custom Titlebar Window Commands
// ============================================================================

#[tauri::command]
pub fn window_minimize(window: WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
pub fn window_toggle_maximize(window: WebviewWindow) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
pub fn window_start_dragging(window: WebviewWindow) {
    let _ = window.start_dragging();
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}
