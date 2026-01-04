use serde::{Deserialize, Serialize};
use std::process::Command;
use anyhow::Result;
use std::collections::HashMap;
use crate::utils::compression::CompressionLevel;
use crate::utils::path_utils::generate_output_path;
use crate::utils::file_metadata::get_file_metadata;
use crate::utils::command_executor::{FfmpegExecutor, FfprobeExecutor, CommandExecutor, validate_output};

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
        let executor = FfmpegExecutor;
        let output = executor.execute(&[
            "-i", &input_path,
            "-ss", &start_time,
            "-to", &end_time,
            "-c", "copy",
            "-y",
            &output_path,
        ])?;
        validate_output(&output)?;
        Ok::<String, String>("Video trimmed successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

/// Strip audio from a video
#[tauri::command]
pub async fn strip_audio(input_path: String, output_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let executor = FfmpegExecutor;
        let output = executor.execute(&[
            "-i", &input_path,
            "-c", "copy",
            "-an",
            "-y",
            &output_path,
        ])?;
        validate_output(&output)?;
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
        let executor = FfmpegExecutor;
        let output = executor.execute(&[
            "-i", &input_path,
            "-vf", &scale_filter,
            "-c:a", "copy",
            "-y",
            &output_path,
        ])?;
        validate_output(&output)?;
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
        use crate::utils::path_utils::get_temp_path;
        let palette_path = get_temp_path("palette", "png");
        let executor = FfmpegExecutor;
        
        let palette_output = executor.execute_strings(vec![
            "-i".to_string(), input_path.clone(),
            "-vf".to_string(), palette_filter,
            "-y".to_string(),
            palette_path.clone(),
        ])?;
        validate_output(&palette_output)?;

        // Then create GIF using the palette
        let gif_output = executor.execute_strings(vec![
            "-i".to_string(), input_path,
            "-i".to_string(), palette_path.clone(),
            "-lavfi".to_string(), gif_filter,
            "-y".to_string(),
            output_path.clone(),
        ])?;
        validate_output(&gif_output)?;

        // Clean up palette file
        let _ = std::fs::remove_file(palette_path);

        Ok::<String, String>("Video converted to GIF successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoMetadata {
    file_size: u64,
    file_created: Option<String>,
    file_modified: Option<String>,
    all_metadata: HashMap<String, String>,
}

#[tauri::command]
pub async fn get_video_metadata(input_path: String) -> Result<VideoMetadata, String> {
    tokio::task::spawn_blocking(move || {
        // Get file metadata
        let file_metadata = get_file_metadata(&input_path)?;

        // Use ffprobe to get video metadata
        let executor = FfprobeExecutor;
        let output = executor.execute(&[
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            &input_path,
        ]);

        let mut all_metadata = HashMap::new();

        if let Ok(output) = output {
            if output.status.success() {
                if let Ok(json_str) = String::from_utf8(output.stdout) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
                        fn extract_value(val: &serde_json::Value) -> String {
                            match val {
                                serde_json::Value::String(s) => s.clone(),
                                serde_json::Value::Number(n) => n.to_string(),
                                serde_json::Value::Bool(b) => b.to_string(),
                                serde_json::Value::Null => "null".to_string(),
                                _ => val.to_string(),
                            }
                        }

                        fn flatten_json(prefix: &str, obj: &serde_json::Value, map: &mut HashMap<String, String>) {
                            match obj {
                                serde_json::Value::Object(map_obj) => {
                                    for (key, val) in map_obj {
                                        let new_key = if prefix.is_empty() {
                                            key.clone()
                                        } else {
                                            format!("{}.{}", prefix, key)
                                        };
                                        if val.is_object() || val.is_array() {
                                            flatten_json(&new_key, val, map);
                                        } else {
                                            map.insert(new_key, extract_value(val));
                                        }
                                    }
                                }
                                serde_json::Value::Array(arr) => {
                                    for (idx, val) in arr.iter().enumerate() {
                                        let new_key = format!("{}[{}]", prefix, idx);
                                        if val.is_object() || val.is_array() {
                                            flatten_json(&new_key, val, map);
                                        } else {
                                            map.insert(new_key, extract_value(val));
                                        }
                                    }
                                }
                                _ => {
                                    map.insert(prefix.to_string(), extract_value(obj));
                                }
                            }
                        }

                        flatten_json("", &json, &mut all_metadata);
                    }
                }
            }
        }

        Ok::<VideoMetadata, String>(VideoMetadata {
            file_size: file_metadata.size,
            file_created: file_metadata.created,
            file_modified: file_metadata.modified,
            all_metadata,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoCompressionResult {
    output_path: String,
    file_size: u64,
}


#[tauri::command]
pub async fn compress_video(
    input_path: String,
    quality_level: u8,
) -> Result<VideoCompressionResult, String> {
    tokio::task::spawn_blocking(move || {
        // Get file extension
        let extension = std::path::Path::new(&input_path)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("mp4");

        let output_path = generate_output_path(&input_path, "compressed", extension);
        let compression = CompressionLevel::from_u8(quality_level);
        let video_settings = compression.video_crf();

        // Build FFmpeg arguments
        let args: Vec<String> = if quality_level == 0 {
            // Lossless settings
            vec![
                "-i".to_string(), input_path.clone(),
                "-c:v".to_string(), "libx264".to_string(),
                "-preset".to_string(), "veryslow".to_string(),
                "-qp".to_string(), "0".to_string(),
                "-c:a".to_string(), "copy".to_string(),
                "-y".to_string(),
                output_path.clone(),
            ]
        } else {
            // Lossy settings
            vec![
                "-i".to_string(), input_path.clone(),
                "-c:v".to_string(), "libx264".to_string(),
                "-crf".to_string(), video_settings.crf.to_string(),
                "-preset".to_string(), video_settings.preset.to_string(),
                "-c:a".to_string(), "aac".to_string(),
                "-b:a".to_string(), "128k".to_string(),
                "-y".to_string(),
                output_path.clone(),
            ]
        };

        // Execute FFmpeg
        let executor = FfmpegExecutor;
        let output = executor.execute_strings(args)?;
        validate_output(&output)?;

        // Get output file size
        let file_size = get_file_metadata(&output_path)?.size;

        Ok::<VideoCompressionResult, String>(VideoCompressionResult {
            output_path,
            file_size,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn estimate_video_compressed_size(
    input_path: String,
    quality_level: u8,
) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        let metadata = get_file_metadata(&input_path)?;
        let compression = CompressionLevel::from_u8(quality_level);
        
        // Lossless might be slightly larger, others use reduction factor
        let reduction_factor = if quality_level == 0 {
            1.10
        } else {
            compression.size_reduction_factor()
        };

        let estimated_size = (metadata.size as f64 * reduction_factor) as u64;
        Ok::<u64, String>(estimated_size)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
