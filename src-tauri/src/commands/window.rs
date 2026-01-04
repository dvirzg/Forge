use tauri::Manager;
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[tauri::command]
pub fn open_metadata_window(
    app: tauri::AppHandle,
    metadata: serde_json::Value,
    window_title: String,
) -> Result<(), String> {
    let window = app.get_window("metadata");
    
    if let Some(existing_window) = window {
        existing_window.show().map_err(|e| e.to_string())?;
        existing_window.set_focus().map_err(|e| e.to_string())?;
        // Emit metadata to the window
        existing_window
            .emit("metadata-update", metadata)
            .map_err(|e| e.to_string())?;
    } else {
        // Get main window position and size
        let main_window = app.get_window("main").ok_or("Main window not found")?;
        let scale_factor = main_window.scale_factor().unwrap_or(1.0);
        
        let main_position = main_window
            .outer_position()
            .map_err(|e| e.to_string())?;
        let main_size = main_window
            .outer_size()
            .map_err(|e| e.to_string())?;
        
        // Convert physical coordinates to logical
        let main_x = main_position.x as f64 / scale_factor;
        let main_y = main_position.y as f64 / scale_factor;
        let main_width = main_size.width as f64 / scale_factor;
        
        // Position metadata window to the right of main window
        let metadata_width = 450.0;
        let metadata_height = 600.0;
        let x = main_x + main_width + 20.0;
        let y = main_y;
        
        let new_window = tauri::WindowBuilder::new(
            &app,
            "metadata",
            tauri::WindowUrl::App("metadata.html".into())
        )
        .title(&window_title)
        .inner_size(metadata_width, metadata_height)
        .position(x, y)
        .transparent(true)
        .decorations(false)
        .resizable(true)
        .min_inner_size(350.0, 300.0)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;
        
        // Apply vibrancy for frosted glass effect
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
        
        // Emit metadata to the window after a short delay to ensure it's loaded
        std::thread::sleep(std::time::Duration::from_millis(100));
        new_window
            .emit("metadata-update", metadata)
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
