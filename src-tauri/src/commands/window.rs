use tauri::{Manager, State};
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
use std::sync::Mutex;
use serde_json::Value;

pub struct MetadataStore(pub Mutex<Option<Value>>);

#[tauri::command]
pub fn open_metadata_window(
    app: tauri::AppHandle,
    metadata: serde_json::Value,
    window_title: String,
    state: State<'_, MetadataStore>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = Some(metadata);
    
    let window = app.get_window("metadata");
    
    if let Some(existing_window) = window {
        existing_window.show().map_err(|e| e.to_string())?;
        existing_window.set_focus().map_err(|e| e.to_string())?;
    } else {
        let main_window = app.get_window("main").ok_or("Main window not found")?;
        let scale_factor = main_window.scale_factor().unwrap_or(1.0);
        let main_position = main_window.outer_position().map_err(|e| e.to_string())?;
        let main_size = main_window.outer_size().map_err(|e| e.to_string())?;
        
        let x = (main_position.x as f64 / scale_factor) + (main_size.width as f64 / scale_factor) + 20.0;
        let y = main_position.y as f64 / scale_factor;
        
        let new_window = tauri::WindowBuilder::new(
            &app,
            "metadata",
            tauri::WindowUrl::App("metadata.html".into())
        )
        .title(&window_title)
        .inner_size(450.0, 600.0)
        .position(x, y)
        .transparent(true)
        .decorations(false)
        .resizable(true)
        .min_inner_size(350.0, 300.0)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;
        
        new_window.show().map_err(|e| e.to_string())?;
        
        #[cfg(target_os = "macos")]
        {
            apply_vibrancy(
                &new_window,
                NSVisualEffectMaterial::Popover,
                Some(NSVisualEffectState::Active),
                Some(20.0)
            )
            .map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_metadata(state: State<'_, MetadataStore>) -> Result<serde_json::Value, String> {
    state.0
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No metadata available".to_string())
}
