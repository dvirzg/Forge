use image::{GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use exif::Reader;
use crate::utils::file_metadata::get_file_metadata;
use crate::utils::compression::CompressionLevel;
use crate::utils::path_utils::generate_output_path;
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
        let file_metadata = get_file_metadata(&input_path)?;

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
            file_size: file_metadata.size,
            bit_depth,
            has_alpha,
            exif: exif_data,
            iptc: iptc_data,
            xmp: xmp_data,
            file_created: file_metadata.created,
            file_modified: file_metadata.modified,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn strip_metadata_preview(input_path: String) -> Result<Vec<u8>, String> {
    tokio::task::spawn_blocking(move || {
        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        // Re-encode the image to strip metadata
        let mut buffer = Vec::new();
        {
            let mut cursor = std::io::Cursor::new(&mut buffer);
            img.write_to(&mut cursor, ImageFormat::Png)
                .map_err(|e| format!("Failed to encode image: {}", e))?;
        }

        Ok::<Vec<u8>, String>(buffer)
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

#[derive(Debug, Serialize, Deserialize)]
pub struct CompressionResult {
    output_path: String,
    file_size: u64,
}


#[tauri::command]
pub async fn compress_image(
    input_path: String,
    quality_level: u8,
    output_format: String,
) -> Result<CompressionResult, String> {
    tokio::task::spawn_blocking(move || {
        use image::codecs::jpeg::JpegEncoder;

        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        let extension = match output_format.to_lowercase().as_str() {
            "jpg" | "jpeg" => "jpg",
            "png" => "png",
            "webp" => "webp",
            _ => return Err(format!("Unsupported format: {}", output_format)),
        };

        let output_path = generate_output_path(&input_path, "compressed", extension);
        let compression = CompressionLevel::from_u8(quality_level);

        // Encode with quality settings
        match output_format.to_lowercase().as_str() {
            "jpg" | "jpeg" => {
                let quality = compression.jpeg_quality();
                let file = std::fs::File::create(&output_path)
                    .map_err(|e| format!("Failed to create output file: {}", e))?;
                let mut encoder = JpegEncoder::new_with_quality(file, quality);
                let rgb_img = img.to_rgb8();
                encoder.encode(
                    rgb_img.as_raw(),
                    rgb_img.width(),
                    rgb_img.height(),
                    image::ColorType::Rgb8.into(),
                )
                .map_err(|e| format!("Failed to encode JPEG: {}", e))?;
            }
            "webp" => {
                // WebP encoding - save_with_format handles quality automatically
                img.save_with_format(&output_path, ImageFormat::WebP)
                    .map_err(|e| format!("Failed to encode WebP: {}", e))?;
            }
            "png" => {
                // PNG encoding in image 0.25 - use save_with_format
                // Compression is handled automatically by the format
                img.save_with_format(&output_path, ImageFormat::Png)
                    .map_err(|e| format!("Failed to encode PNG: {}", e))?;
            }
            _ => return Err(format!("Unsupported format: {}", output_format)),
        }

        // Get output file size
        let file_size = get_file_metadata(&output_path)?.size;

        Ok::<CompressionResult, String>(CompressionResult {
            output_path,
            file_size,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn estimate_compressed_size(
    input_path: String,
    quality_level: u8,
    output_format: String,
) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        use image::codecs::jpeg::JpegEncoder;

        let img = image::open(&input_path)
            .map_err(|e| format!("Failed to open image: {}", e))?;

        // Encode to memory buffer
        let mut buffer = Vec::new();

        let compression = CompressionLevel::from_u8(quality_level);
        
        match output_format.to_lowercase().as_str() {
            "jpg" | "jpeg" => {
                let quality = compression.jpeg_quality();
                let mut cursor = std::io::Cursor::new(&mut buffer);
                let mut encoder = JpegEncoder::new_with_quality(&mut cursor, quality);
                let rgb_img = img.to_rgb8();
                encoder.encode(
                    rgb_img.as_raw(),
                    rgb_img.width(),
                    rgb_img.height(),
                    image::ColorType::Rgb8.into(),
                )
                .map_err(|e| format!("Failed to encode JPEG: {}", e))?;
            }
            "webp" => {
                // WebP encoding in image 0.25 - encode to memory buffer
                let mut cursor = std::io::Cursor::new(&mut buffer);
                img.write_to(&mut cursor, ImageFormat::WebP)
                    .map_err(|e| format!("Failed to encode WebP: {}", e))?;
            }
            "png" => {
                // PNG encoding in image 0.25 - encode to memory buffer
                let mut cursor = std::io::Cursor::new(&mut buffer);
                img.write_to(&mut cursor, ImageFormat::Png)
                    .map_err(|e| format!("Failed to encode PNG: {}", e))?;
            }
            _ => return Err(format!("Unsupported format: {}", output_format)),
        }

        Ok::<u64, String>(buffer.len() as u64)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
