// #[derive(Serialize, Deserialize, Clone, Debug)]
// pub struct Project {
//     pub id: String,
//     pub name: String,
//     pub path: String,
// }
//
// pub struct AppState {
//     pub projects: Mutex<Vec<Project>>,
// }
//
// #[tauri::command]
// fn get_projects(state: State<AppState>) -> Result<Vec<Project>, String> {
//     let projects = state.projects.lock().map_err(|e| e.to_string())?;
//     Ok(projects.clone())
// }
//
// #[tauri::command]
// fn create_project(name: String, state: State<AppState>) -> Result<Project, String> {
//     let mut projects = state.projects.lock().map_err(|e| e.to_string())?;
//     let new_project = Project {
//         id: uuid_or_timestamp(&name),
//         path: format!("/projects/{}", name.to_lowercase().replace(' ', "_")),
//         name,
//     };
//     projects.push(new_project.clone());
//     Ok(new_project)
// }
//
// #[tauri::command]
// fn open_project(id: String, state: State<AppState>) -> Result<String, String> {
//     let projects = state.projects.lock().map_err(|e| e.to_string())?;
//     if let Some(project) = projects.iter().find(|p| p.id == id) {
//         println!("Opening project: {} at {}", project.name, project.path);
//         // Put custom window creation, navigation, or shell-open logic here
//         Ok(format!("Opened project: {}", project.name))
//     } else {
//         Err("Project not found".into())
//     }
// }
//
