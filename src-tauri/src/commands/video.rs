use serde::{Deserialize, Serialize};
use std::process::Command;
use anyhow::Result;
use std::collections::HashMap;
use chrono;

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
        let file_metadata = std::fs::metadata(&input_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;
        let file_size = file_metadata.len();

        let file_created = file_metadata.created()
            .ok()
            .map(|t| {
                chrono::DateTime::<chrono::Local>::from(t)
                    .format("%Y-%m-%d %H:%M:%S")
                    .to_string()
            });

        let file_modified = file_metadata.modified()
            .ok()
            .map(|t| {
                chrono::DateTime::<chrono::Local>::from(t)
                    .format("%Y-%m-%d %H:%M:%S")
                    .to_string()
            });

        // Use ffprobe to get video metadata
        let output = Command::new("ffprobe")
            .args(&[
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                &input_path,
            ])
            .output();

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
            file_size,
            file_created,
            file_modified,
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

fn get_crf_value(level: u8) -> u8 {
    match level {
        0 => 0,   // Lossless
        1 => 17,  // Near Lossless (visually identical)
        2 => 23,  // High Quality (FFmpeg default)
        3 => 28,  // Medium Quality
        4 => 35,  // Low Quality
        _ => 23,
    }
}

#[tauri::command]
pub async fn compress_video(
    input_path: String,
    quality_level: u8,
) -> Result<VideoCompressionResult, String> {
    tokio::task::spawn_blocking(move || {
        // Create output path
        let input_path_obj = std::path::Path::new(&input_path);
        let stem = input_path_obj.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("compressed");
        let extension = input_path_obj.extension()
            .and_then(|s| s.to_str())
            .unwrap_or("mp4");
        let parent = input_path_obj.parent()
            .map(|p| p.to_str().unwrap_or(""))
            .unwrap_or("");

        let output_path = format!("{}/{}_compressed.{}", parent, stem, extension);

        let crf = get_crf_value(quality_level);
        let crf_str = crf.to_string();

        // Use FFmpeg with CRF for quality control
        let mut args = vec![
            "-i", &input_path,
            "-c:v", "libx264",
            "-crf", &crf_str,
            "-preset", "medium",
            "-c:a", "aac",
            "-b:a", "128k",
            "-y",
            &output_path,
        ];

        // For lossless, use different settings
        if quality_level == 0 {
            args = vec![
                "-i", &input_path,
                "-c:v", "libx264",
                "-preset", "veryslow",
                "-qp", "0",
                "-c:a", "copy",
                "-y",
                &output_path,
            ];
        }

        let output = Command::new("ffmpeg")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute ffmpeg. Is it installed? Error: {}", e))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg compression failed: {}", error_msg));
        }

        // Get output file size
        let file_size = std::fs::metadata(&output_path)
            .map_err(|e| format!("Failed to get output file size: {}", e))?
            .len();

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
        // Get original file size
        let original_size = std::fs::metadata(&input_path)
            .map_err(|e| format!("Failed to get file size: {}", e))?
            .len();

        // Use heuristic reduction factors based on CRF quality level
        let reduction_factor = match quality_level {
            0 => 1.10,  // Lossless - might be slightly larger
            1 => 0.80,  // Near Lossless - small compression (20%)
            2 => 0.50,  // High Quality - moderate compression (50%)
            3 => 0.30,  // Medium Quality - significant compression (70%)
            4 => 0.15,  // Low Quality - aggressive compression (85%)
            _ => 0.50,
        };

        let estimated_size = (original_size as f64 * reduction_factor) as u64;

        Ok::<u64, String>(estimated_size)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
