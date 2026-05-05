use std::sync::Mutex;

struct BackendProcess(Mutex<Option<std::process::Child>>);

#[tauri::command]
fn select_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app
        .dialog()
        .file()
        .blocking_pick_folder();
    match path {
        Some(p) => Ok(Some(p.as_path().unwrap().to_string_lossy().to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
fn read_image_as_base64(path: String) -> Result<String, String> {
    use base64::Engine;
    let data = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn start_backend(state: tauri::State<'_, BackendProcess>) -> Result<String, String> {
    let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    if let Some(ref mut child) = *guard {
        match child.try_wait() {
            Ok(Some(_)) => {} // exited, clear it
            Ok(None) => return Err("Backend already running".into()),
            Err(_) => {}
        }
    }
    let child = std::process::Command::new("python3")
        .args([
            "-m",
            "uvicorn",
            "peakpick_ml.server:app",
            "--host",
            "0.0.0.0",
            "--port",
            "7878",
        ])
        .current_dir(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .join("ml-backend"),
        )
        .spawn()
        .map_err(|e| format!("Failed to start backend: {}", e))?;
    *guard = Some(child);
    Ok("started".into())
}

#[tauri::command]
fn stop_backend(state: tauri::State<'_, BackendProcess>) -> Result<String, String> {
    let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    if let Some(mut child) = guard.take() {
        child.kill().map_err(|e| format!("Failed to kill backend: {}", e))?;
        child.wait().ok();
        Ok("stopped".into())
    } else {
        Err("No backend process running".into())
    }
}

#[tauri::command]
fn get_backend_status(state: tauri::State<'_, BackendProcess>) -> Result<bool, String> {
    let mut guard = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    match *guard {
        Some(ref mut child) => match child.try_wait() {
            Ok(Some(_)) => {
                // Process exited, clear state
                *guard = None;
                Ok(false)
            }
            Ok(None) => Ok(true),
            Err(_) => Ok(false),
        },
        None => Ok(false),
    }
}

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            select_folder,
            read_image_as_base64,
            start_backend,
            stop_backend,
            get_backend_status,
            get_app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
