#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn clipboard_write(text: String) -> Result<(), String> {
    // Placeholder: Tauri 2 clipboard plugin can be used
    let _ = text;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![clipboard_write])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
