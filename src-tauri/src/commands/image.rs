use image::{GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use exif::Reader;
// use rmbg::Rmbg;  // Temporarily disabled - incompatible with current ort versions

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageMetadata {
    width: u32,
    height: u32,
    format: String,
    color_type: String,
    file_size: u64,
    bit_depth: Option<String>,
    has_alpha: bool,
    exif: HashMap<String, String>,
    iptc: HashMap<String, String>,
    xmp: HashMap<String, String>,
    file_created: Option<String>,
    file_modified: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CropParams {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

// Background removal functions temporarily disabled due to rmbg/ort compatibility issues
// #[tauri::command]
// pub async fn check_bg_removal_model() -> Result<bool, String> {
//     tokio::task::spawn_blocking(|| {
//         // Try to initialize rmbg to check if model is available
//         match Rmbg::new() {
//             Ok(_) => Ok(true),
//             Err(_) => Ok(false),
//         }
//     })
//     .await
//     .map_err(|e| format!("Task failed: {}", e))?
// }
//
// #[tauri::command]
// pub async fn download_bg_removal_model() -> Result<String, String> {
//     tokio::task::spawn_blocking(|| {
//         // Initialize rmbg which will download the model if needed
//         Rmbg::new()
//             .map_err(|e| format!("Failed to download model: {}", e))?;
//
//         Ok::<String, String>("Model downloaded and ready!".to_string())
//     })
//     .await
//     .map_err(|e| format!("Task failed: {}", e))?
// }
//
// #[tauri::command]
// pub async fn remove_background(input_path: String, output_path: String) -> Result<String, String> {
//     tokio::task::spawn_blocking(move || {
//         // Load the image
//         let img = image::open(&input_path)
//             .map_err(|e| format!("Failed to open image: {}", e))?;
//
//         // Initialize rmbg with default model
//         let rmbg = Rmbg::new()
//             .map_err(|e| format!("Failed to initialize background removal model: {}. Please download the model first.", e))?;
//
//         // Remove background
//         let result = rmbg.remove(&img)
//             .map_err(|e| format!("Failed to remove background: {}", e))?;
//
//         // Save the result as PNG (to preserve transparency)
//         result.save_with_format(&output_path, ImageFormat::Png)
//             .map_err(|e| format!("Failed to save image: {}", e))?;
//
//         Ok::<String, String>("Background removed successfully".to_string())
//     })
//     .await
//     .map_err(|e| format!("Task failed: {}", e))?
// }

#[tauri::command]
pub async fn rotate_image_preview(input_path: String, degrees: i32) -> Result<Vec<u8>, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let rotated = match degrees {
            90 => img.rotate90(),
            180 => img.rotate180(),
            270 => img.rotate270(),
            _ => return Err("Only 90, 180, and 270 degree rotations are supported".to_string()),
        };

        let mut buffer = Vec::new();
        {
            let mut cursor = std::io::Cursor::new(&mut buffer);
            rotated
                .write_to(&mut cursor, ImageFormat::Png)
                .map_err(|e| format!("Failed to encode image: {}", e))?;
        }

        Ok::<Vec<u8>, String>(buffer)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn rotate_image(input_path: String, output_path: String, degrees: i32) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let rotated = match degrees {
            90 => img.rotate90(),
            180 => img.rotate180(),
            270 => img.rotate270(),
            _ => return Err("Only 90, 180, and 270 degree rotations are supported".to_string()),
        };

        rotated.save(&output_path)
            .map_err(|e| format!("Failed to save rotated image: {}", e))?;

        Ok::<String, String>("Image rotated successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn flip_image_preview(input_path: String, direction: String) -> Result<Vec<u8>, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let flipped = match direction.as_str() {
            "horizontal" => img.fliph(),
            "vertical" => img.flipv(),
            _ => return Err("Direction must be 'horizontal' or 'vertical'".to_string()),
        };

        let mut buffer = Vec::new();
        {
            let mut cursor = std::io::Cursor::new(&mut buffer);
            flipped
                .write_to(&mut cursor, ImageFormat::Png)
                .map_err(|e| format!("Failed to encode image: {}", e))?;
        }

        Ok::<Vec<u8>, String>(buffer)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn flip_image(input_path: String, output_path: String, direction: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let flipped = match direction.as_str() {
            "horizontal" => img.fliph(),
            "vertical" => img.flipv(),
            _ => return Err("Direction must be 'horizontal' or 'vertical'".to_string()),
        };

        flipped.save(&output_path)
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
        let has_alpha = img.color().has_alpha();
        
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

        // Extract bit depth from color type
        let bit_depth = match img.color() {
            image::ColorType::L8 | image::ColorType::Rgb8 | image::ColorType::Rgba8 => Some("8-bit".to_string()),
            image::ColorType::L16 | image::ColorType::Rgb16 | image::ColorType::Rgba16 => Some("16-bit".to_string()),
            _ => None,
        };

        // Extract EXIF data - dynamically get all fields
        let mut exif_data = HashMap::new();
        if let Ok(file) = File::open(&input_path) {
            let mut bufreader = BufReader::new(&file);
            let exif_reader = Reader::new();
            if let Ok(exif) = exif_reader.read_from_container(&mut bufreader) {
                for field in exif.fields() {
                    let value_str = field.display_value().with_unit(&exif).to_string();
                    let display_name = format!("{}", field.tag);
                    exif_data.insert(display_name, value_str);
                }
            }
        }

        let iptc_data = HashMap::new();
        let xmp_data = HashMap::new();

        Ok::<ImageMetadata, String>(ImageMetadata {
            width,
            height,
            format,
            color_type,
            file_size,
            bit_depth,
            has_alpha,
            exif: exif_data,
            iptc: iptc_data,
            xmp: xmp_data,
            file_created,
            file_modified,
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
pub async fn crop_image_preview(
    input_path: String,
    crop: CropParams,
) -> Result<Vec<u8>, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let cropped = img.crop_imm(crop.x, crop.y, crop.width, crop.height);

        let mut buffer = Vec::new();
        {
            let mut cursor = std::io::Cursor::new(&mut buffer);
            cropped
                .write_to(&mut cursor, ImageFormat::Png)
                .map_err(|e| format!("Failed to encode image: {}", e))?;
        }

        Ok::<Vec<u8>, String>(buffer)
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
