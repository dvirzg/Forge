use tauri::{AppHandle, Manager};
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

/// Configuration for creating a side window
pub struct SideWindowConfig {
    pub window_id: &'static str,
    pub url: &'static str,
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub min_width: f64,
    pub min_height: f64,
}

/// Creates or shows a side window positioned next to the main window
pub fn create_or_show_side_window(
    app: &AppHandle,
    config: SideWindowConfig,
) -> Result<tauri::Window, String> {
    // Check if window already exists
    if let Some(existing_window) = app.get_window(config.window_id) {
        existing_window.show().map_err(|e| e.to_string())?;
        existing_window.set_focus().map_err(|e| e.to_string())?;
        return Ok(existing_window);
    }

    // Get main window position and size
    let main_window = app.get_window("main").ok_or("Main window not found")?;
    let scale_factor = main_window.scale_factor().unwrap_or(1.0);
    let main_position = main_window.outer_position().map_err(|e| e.to_string())?;
    let main_size = main_window.outer_size().map_err(|e| e.to_string())?;

    // Calculate position (to the right of main window)
    let x = (main_position.x as f64 / scale_factor) + (main_size.width as f64 / scale_factor) + 20.0;
    let y = main_position.y as f64 / scale_factor;

    // Create new window
    let new_window = tauri::WindowBuilder::new(
        app,
        config.window_id,
        tauri::WindowUrl::App(config.url.into())
    )
    .title(&config.title)
    .inner_size(config.width, config.height)
    .position(x, y)
    .transparent(true)
    .decorations(false)
    .resizable(true)
    .min_inner_size(config.min_width, config.min_height)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;

    new_window.show().map_err(|e| e.to_string())?;

    // Apply macOS vibrancy effect
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

    Ok(new_window)
}
