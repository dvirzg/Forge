use tauri::{Manager, State};
use std::sync::Mutex;
use serde_json::Value;
use crate::utils::window_utils::{create_or_show_side_window, SideWindowConfig};

pub struct MetadataStore(pub Mutex<Option<Value>>);
pub struct PdfStore(pub Mutex<Option<Value>>);

#[tauri::command]
pub fn open_metadata_window(
    app: tauri::AppHandle,
    metadata: serde_json::Value,
    window_title: String,
    state: State<'_, MetadataStore>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = Some(metadata);
    
    let _window = create_or_show_side_window(
        &app,
        SideWindowConfig {
            window_id: "metadata",
            url: "metadata.html",
            title: window_title,
            width: 450.0,
            height: 600.0,
            min_width: 350.0,
            min_height: 300.0,
        },
    )?;
    
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

#[tauri::command]
pub fn open_pdf_window(
    app: tauri::AppHandle,
    pdf_data: serde_json::Value,
    window_title: String,
    state: State<'_, PdfStore>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = Some(pdf_data.clone());
    
    let window = create_or_show_side_window(
        &app,
        SideWindowConfig {
            window_id: "pdf_viewer",
            url: "pdf-viewer.html",
            title: window_title,
            width: 800.0,
            height: 1000.0,
            min_width: 400.0,
            min_height: 400.0,
        },
    )?;
    
    // Emit update event to window (if it already existed, update it)
    if let Some(data) = state.0.lock().unwrap().as_ref() {
        window.emit("pdf-update", data).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_pdf_data(state: State<'_, PdfStore>) -> Result<serde_json::Value, String> {
    state.0
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No PDF data available".to_string())
}

#[tauri::command]
pub fn update_pdf_window(
    app: tauri::AppHandle,
    pdf_data: serde_json::Value,
    state: State<'_, PdfStore>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = Some(pdf_data.clone());
    
    if let Some(window) = app.get_window("pdf_viewer") {
        window.emit("pdf-update", &pdf_data).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
