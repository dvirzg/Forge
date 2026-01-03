// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri::{Manager, Runtime, Window};
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

#[cfg(target_os = "macos")]
use cocoa::appkit::{NSWindow, NSWindowStyleMask};
#[cfg(target_os = "macos")]
use cocoa::base::id;

// Apply macOS vibrancy effect for liquid glass look
pub fn apply_window_vibrancy<R: Runtime>(window: &Window<R>) {
    #[cfg(target_os = "macos")]
    apply_vibrancy(
        window,
        NSVisualEffectMaterial::Popover,
        Some(NSVisualEffectState::Active),
        Some(20.0)
    )
    .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();

            // Apply vibrancy for frosted glass effect
            apply_window_vibrancy(&window);

            // Setup file drop handler
            window.listen("tauri://file-drop", |event| {
                println!("File dropped: {:?}", event.payload());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // commands::image::check_bg_removal_model,  // Temporarily disabled
            // commands::image::download_bg_removal_model,  // Temporarily disabled
            // commands::image::remove_background,  // Temporarily disabled
            commands::image::rotate_image_preview,
            commands::image::rotate_image,
            commands::image::flip_image_preview,
            commands::image::flip_image,
            commands::image::convert_image,
            commands::image::get_image_metadata,
            commands::image::strip_metadata,
            commands::image::crop_image,
            commands::pdf::merge_pdfs,
            commands::pdf::rotate_pdf,
            commands::pdf::extract_text,
            commands::pdf::extract_images,
            commands::video::trim_video,
            commands::video::strip_audio,
            commands::video::scale_video,
            commands::video::video_to_gif,
            commands::text::convert_case,
            commands::text::replace_all_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
