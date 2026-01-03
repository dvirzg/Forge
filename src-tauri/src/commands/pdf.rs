use lopdf::{Document, Object};
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfInfo {
    pages: u32,
    title: Option<String>,
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
