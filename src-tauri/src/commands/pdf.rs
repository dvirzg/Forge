use lopdf::{Document, Object};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use chrono;
use std::collections::HashMap;
use crate::utils::file_metadata::get_file_metadata;
use crate::utils::compression::CompressionLevel;
use crate::utils::path_utils::generate_output_path;
use crate::utils::command_executor::{GhostscriptExecutor, CommandExecutor, validate_output};

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfInfo {
    pages: u32,
    title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfMetadata {
    pages: u32,
    file_size: u64,
    pdf_version: Option<String>,
    encrypted: bool,
    file_created: Option<String>,
    file_modified: Option<String>,
    all_metadata: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageSelection {
    pdf_path: String,
    page_numbers: Vec<u32>,
}

#[tauri::command]
pub async fn merge_pdfs(input_paths: Vec<String>, output_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut merged_doc = Document::with_version("1.5");
        let mut max_id = 1;

        // Merge all PDF documents
        for path in input_paths {
            let doc = Document::load(&path)
                .map_err(|e| format!("Failed to load PDF {}: {}", path, e))?;

            // Get the page count
            let pages = doc.get_pages();

            // Add pages from this document
            for (_, page_id) in pages.iter() {
                let page_object = doc.get_object(*page_id)
                    .map_err(|e| format!("Failed to get page object: {}", e))?;

                // Clone and add the page to merged document
                let new_page_id = merged_doc.add_object(page_object.clone());
                max_id = max_id.max(new_page_id.0);
            }
        }

        // Save the merged document
        merged_doc.save(&output_path)
            .map_err(|e| format!("Failed to save merged PDF: {}", e))?;

        Ok::<String, String>("PDFs merged successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn merge_pdfs_with_pages(
    page_selections: Vec<PageSelection>,
    output_path: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut merged_doc = Document::with_version("1.5");

        for selection in page_selections {
            let doc = Document::load(&selection.pdf_path)
                .map_err(|e| format!("Failed to load PDF {}: {}", selection.pdf_path, e))?;

            let all_pages = doc.get_pages();

            for page_num in selection.page_numbers {
                if let Some((_, page_id)) = all_pages.iter().find(|(num, _)| **num == page_num) {
                    let page_object = doc.get_object(*page_id)
                        .map_err(|e| format!("Failed to get page object: {}", e))?;
                    merged_doc.add_object(page_object.clone());
                }
            }
        }

        merged_doc.save(&output_path)
            .map_err(|e| format!("Failed to save merged PDF: {}", e))?;

        Ok::<String, String>("PDFs merged successfully with page selection".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn rotate_pdf(
    input_path: String,
    output_path: String,
    degrees: i32,
    page_numbers: Option<Vec<u32>>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut doc = Document::load(&input_path)
            .map_err(|e| format!("Failed to load PDF: {}", e))?;

        let pages = doc.get_pages();
        let rotation = degrees % 360;

        // Determine which pages to rotate
        let pages_to_rotate: Vec<u32> = if let Some(page_nums) = page_numbers {
            page_nums
        } else {
            // Rotate all pages
            (1..=pages.len() as u32).collect()
        };

        for (page_num, page_id) in pages.iter() {
            if pages_to_rotate.contains(page_num) {
                if let Ok(page_obj) = doc.get_object_mut(*page_id) {
                    if let Object::Dictionary(ref mut dict) = page_obj {
                        // Set or update the Rotate entry
                        dict.set("Rotate", Object::Integer(rotation as i64));
                    }
                }
            }
        }

        doc.save(&output_path)
            .map_err(|e| format!("Failed to save rotated PDF: {}", e))?;

        Ok::<String, String>("PDF rotated successfully".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn extract_text(input_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        // Use pdf-extract crate for text extraction
        let bytes = std::fs::read(&input_path)
            .map_err(|e| format!("Failed to read PDF file: {}", e))?;

        let text = pdf_extract::extract_text_from_mem(&bytes)
            .map_err(|e| format!("Failed to extract text: {}", e))?;

        Ok::<String, String>(text)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn extract_images(input_path: String, output_dir: String) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let doc = Document::load(&input_path)
            .map_err(|e| format!("Failed to load PDF: {}", e))?;

        let mut image_paths = Vec::new();
        let mut image_counter = 0;

        // Create output directory if it doesn't exist
        std::fs::create_dir_all(&output_dir)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;

        // Iterate through all objects in the PDF
        for (_object_id, object) in doc.objects.iter() {
            if let Object::Stream(stream) = object {
                if let Ok(dict) = stream.dict.get(b"Subtype") {
                    if let Object::Name(name) = dict {
                        if name == b"Image" {
                            // Extract image data
                            if let Ok(content) = stream.decompressed_content() {
                                image_counter += 1;
                                let image_path = format!("{}/image_{}.bin", output_dir, image_counter);
                                std::fs::write(&image_path, content)
                                    .map_err(|e| format!("Failed to write image: {}", e))?;
                                image_paths.push(image_path);
                            }
                        }
                    }
                }
            }
        }

        Ok::<Vec<String>, String>(image_paths)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn get_pdf_metadata(input_path: String) -> Result<PdfMetadata, String> {
    tokio::task::spawn_blocking(move || {
        let doc = Document::load(&input_path)
            .map_err(|e| format!("Failed to load PDF: {}", e))?;

        let pages = doc.get_pages();
        let page_count = pages.len() as u32;
        let pdf_version = Some(doc.version.clone());

        // Get file metadata
        let file_metadata = get_file_metadata(&input_path)?;

        // Extract PDF document info - dynamically get all fields
        let mut pdf_metadata = HashMap::new();
        let encrypted = doc.trailer.get(b"Encrypt").is_ok();

        if let Ok(&Object::Reference(ref_id)) = doc.trailer.get(b"Info") {
            if let Ok(Object::Dictionary(ref dict)) = doc.get_object(ref_id) {
                for (key, value) in dict.iter() {
                    if let Ok(key_str) = String::from_utf8(key.to_vec()) {
                        let value_str = match value {
                            Object::String(bytes, _) => String::from_utf8(bytes.clone()).unwrap_or_default(),
                            Object::Integer(i) => i.to_string(),
                            Object::Real(f) => f.to_string(),
                            Object::Boolean(b) => b.to_string(),
                            _ => format!("{:?}", value),
                        };
                        pdf_metadata.insert(key_str, value_str);
                    }
                }
            }
        }

        Ok::<PdfMetadata, String>(PdfMetadata {
            pages: page_count,
            file_size: file_metadata.size,
            pdf_version,
            encrypted,
            file_created: file_metadata.created,
            file_modified: file_metadata.modified,
            all_metadata: pdf_metadata,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfCompressionResult {
    output_path: String,
    file_size: u64,
}


#[tauri::command]
pub async fn compress_pdf(
    input_path: String,
    quality_level: u8,
) -> Result<PdfCompressionResult, String> {
    tokio::task::spawn_blocking(move || {
        let output_path = generate_output_path(&input_path, "compressed", "pdf");
        let compression = CompressionLevel::from_u8(quality_level);
        let pdf_settings = compression.ghostscript_settings();

        // Use ghostscript for PDF compression
        let executor = GhostscriptExecutor;
        let output = executor.execute_strings(vec![
            "-sDEVICE=pdfwrite".to_string(),
            "-dCompatibilityLevel=1.4".to_string(),
            format!("-dPDFSETTINGS={}", pdf_settings),
            "-dNOPAUSE".to_string(),
            "-dQUIET".to_string(),
            "-dBATCH".to_string(),
            format!("-sOutputFile={}", output_path),
            input_path,
        ])?;
        validate_output(&output)?;

        // Get output file size
        let file_size = get_file_metadata(&output_path)?.size;

        Ok::<PdfCompressionResult, String>(PdfCompressionResult {
            output_path,
            file_size,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn estimate_pdf_compressed_size(
    input_path: String,
    quality_level: u8,
) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || {
        let file_metadata = get_file_metadata(&input_path)?;
        let compression = CompressionLevel::from_u8(quality_level);
        let estimated_size = (file_metadata.size as f64 * compression.size_reduction_factor()) as u64;

        Ok::<u64, String>(estimated_size)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
