use image::{DynamicImage, GenericImageView, ImageFormat, ImageOutputFormat};
use photon_rs::native::{open_image, save_image};
use photon_rs::{transform, effects};
use serde::{Deserialize, Serialize};
use std::path::Path;
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageMetadata {
    width: u32,
    height: u32,
    format: String,
    color_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CropParams {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

#[tauri::command]
pub async fn remove_background(input_path: String, output_path: String) -> Result<String, String> {
    // Using rmbg crate for local AI background removal
    // Note: You'll need to download the ONNX model file and provide its path
    let model_path = "models/u2net.onnx"; // Placeholder - update with actual model path

    tokio::task::spawn_blocking(move || {
        // Load the image
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        // For now, return a placeholder message
        // Actual implementation would use rmbg::remove() with the model
        // let result = rmbg::remove(&img, model_path)?;

        // Save the result
        // result.save(&output_path).map_err(|e| format!("Failed to save: {}", e))?;

        Ok::<String, String>(format!(
            "Background removal requires ONNX model at: {}. Image processing ready.",
            model_path
        ))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn rotate_image(input_path: String, output_path: String, degrees: i32) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut img = open_image(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let rotated = match degrees {
            90 => transform::rotate90(&img),
            180 => transform::rotate180(&img),
            270 => transform::rotate270(&img),
            _ => return Err("Only 90, 180, and 270 degree rotations are supported".to_string()),
        };

        save_image(rotated, &output_path)
            .map_err(|e| format!("Failed to save rotated image: {}", e))?;

        Ok::<String, String>("Image rotated successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn flip_image(input_path: String, output_path: String, direction: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut img = open_image(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let flipped = match direction.as_str() {
            "horizontal" => transform::fliph(&img),
            "vertical" => transform::flipv(&img),
            _ => return Err("Direction must be 'horizontal' or 'vertical'".to_string()),
        };

        save_image(flipped, &output_path)
            .map_err(|e| format!("Failed to save flipped image: {}", e))?;

        Ok::<String, String>("Image flipped successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn convert_image(
    input_path: String,
    output_path: String,
    format: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let output_format = match format.to_lowercase().as_str() {
            "png" => ImageFormat::Png,
            "jpg" | "jpeg" => ImageFormat::Jpeg,
            "webp" => ImageFormat::WebP,
            "gif" => ImageFormat::Gif,
            "bmp" => ImageFormat::Bmp,
            "ico" => ImageFormat::Ico,
            "tiff" => ImageFormat::Tiff,
            _ => return Err(format!("Unsupported format: {}", format)),
        };

        img.save_with_format(&output_path, output_format)
            .map_err(|e| format!("Failed to save image: {}", e))?;

        Ok::<String, String>(format!("Image converted to {} successfully", format))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn get_image_metadata(input_path: String) -> Result<ImageMetadata, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let (width, height) = img.dimensions();
        let format = image::ImageFormat::from_path(&input_path)
            .ok()
            .map(|f| format!("{:?}", f))
            .unwrap_or_else(|| "Unknown".to_string());

        let color_type = format!("{:?}", img.color());

        Ok::<ImageMetadata, String>(ImageMetadata {
            width,
            height,
            format,
            color_type,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn strip_metadata(input_path: String, output_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        // Simply re-save the image, which strips EXIF and other metadata
        img.save(&output_path)
            .map_err(|e| format!("Failed to save image: {}", e))?;

        Ok::<String, String>("Metadata stripped successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn crop_image(
    input_path: String,
    output_path: String,
    crop: CropParams,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let cropped = img.crop_imm(crop.x, crop.y, crop.width, crop.height);

        cropped.save(&output_path)
            .map_err(|e| format!("Failed to save cropped image: {}", e))?;

        Ok::<String, String>("Image cropped successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
