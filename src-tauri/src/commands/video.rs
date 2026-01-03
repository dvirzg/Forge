use serde::{Deserialize, Serialize};
use std::process::Command;
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct TrimParams {
    start_time: String, // Format: HH:MM:SS
    end_time: String,   // Format: HH:MM:SS
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScaleParams {
    width: u32,
    height: u32,
}

/// Trim a video using ffmpeg command-line tool
#[tauri::command]
pub async fn trim_video(
    input_path: String,
    output_path: String,
    start_time: String,
    end_time: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        // Calculate duration from start and end time
        let output = Command::new("ffmpeg")
            .args(&[
                "-i", &input_path,
                "-ss", &start_time,
                "-to", &end_time,
                "-c", "copy",
                "-y",
                &output_path,
            ])
            .output()
            .map_err(|e| format!("Failed to execute ffmpeg: {}. Make sure ffmpeg is installed.", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg error: {}", error));
        }

        Ok::<String, String>("Video trimmed successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

/// Strip audio from a video
#[tauri::command]
pub async fn strip_audio(input_path: String, output_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let output = Command::new("ffmpeg")
            .args(&[
                "-i", &input_path,
                "-c", "copy",
                "-an", // Remove audio
                "-y",
                &output_path,
            ])
            .output()
            .map_err(|e| format!("Failed to execute ffmpeg: {}. Make sure ffmpeg is installed.", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg error: {}", error));
        }

        Ok::<String, String>("Audio stripped successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

/// Scale/resize a video
#[tauri::command]
pub async fn scale_video(
    input_path: String,
    output_path: String,
    width: u32,
    height: u32,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let scale_filter = format!("scale={}:{}", width, height);

        let output = Command::new("ffmpeg")
            .args(&[
                "-i", &input_path,
                "-vf", &scale_filter,
                "-c:a", "copy",
                "-y",
                &output_path,
            ])
            .output()
            .map_err(|e| format!("Failed to execute ffmpeg: {}. Make sure ffmpeg is installed.", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg error: {}", error));
        }

        Ok::<String, String>(format!("Video scaled to {}x{} successfully", width, height))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

/// Convert video to GIF
#[tauri::command]
pub async fn video_to_gif(
    input_path: String,
    output_path: String,
    fps: Option<u32>,
    width: Option<u32>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let fps_value = fps.unwrap_or(10);
        let width_value = width.unwrap_or(480);

        // Build filter for palette generation and gif creation
        let palette_filter = format!("fps={},scale={}:-1:flags=lanczos,palettegen", fps_value, width_value);
        let gif_filter = format!("fps={},scale={}:-1:flags=lanczos[x];[x][1:v]paletteuse", fps_value, width_value);

        // First, generate palette
        let palette_path = "/tmp/palette.png";
        let palette_output = Command::new("ffmpeg")
            .args(&[
                "-i", &input_path,
                "-vf", &palette_filter,
                "-y",
                palette_path,
            ])
            .output()
            .map_err(|e| format!("Failed to generate palette: {}", e))?;

        if !palette_output.status.success() {
            let error = String::from_utf8_lossy(&palette_output.stderr);
            return Err(format!("Palette generation error: {}", error));
        }

        // Then create GIF using the palette
        let gif_output = Command::new("ffmpeg")
            .args(&[
                "-i", &input_path,
                "-i", palette_path,
                "-lavfi", &gif_filter,
                "-y",
                &output_path,
            ])
            .output()
            .map_err(|e| format!("Failed to create GIF: {}", e))?;

        if !gif_output.status.success() {
            let error = String::from_utf8_lossy(&gif_output.stderr);
            return Err(format!("GIF creation error: {}", error));
        }

        // Clean up palette file
        let _ = std::fs::remove_file(palette_path);

        Ok::<String, String>("Video converted to GIF successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
