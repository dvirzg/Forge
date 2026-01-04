use convert_case::{Case, Casing};
use serde::{Deserialize, Serialize};
use chrono;
use crate::utils::file_metadata::get_file_metadata;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceParams {
    find: String,
    replace: String,
}

/// Convert text case
#[tauri::command]
pub fn convert_case(text: String, case_type: String) -> Result<String, String> {
    let converted = match case_type.to_lowercase().as_str() {
        "upper" | "uppercase" => text.to_case(Case::Upper),
        "lower" | "lowercase" => text.to_case(Case::Lower),
        "title" | "titlecase" => text.to_case(Case::Title),
        "camel" | "camelcase" => text.to_case(Case::Camel),
        "pascal" | "pascalcase" => text.to_case(Case::Pascal),
        "snake" | "snakecase" => text.to_case(Case::Snake),
        "kebab" | "kebabcase" => text.to_case(Case::Kebab),
        "screaming_snake" | "screamingsnake" => text.to_case(Case::ScreamingSnake),
        "sentence" => text.to_case(Case::Title), // Using Title as sentence case
        _ => return Err(format!("Unsupported case type: {}", case_type)),
    };

    Ok(converted)
}

/// Replace all occurrences of a string
#[tauri::command]
pub fn replace_all_text(text: String, find: String, replace: String) -> Result<String, String> {
    if find.is_empty() {
        return Err("Find string cannot be empty".to_string());
    }

    Ok(text.replace(&find, &replace))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TextMetadata {
    file_size: u64,
    line_count: u64,
    character_count: u64,
    word_count: u64,
    encoding: Option<String>,
    line_endings: Option<String>,
    file_created: Option<String>,
    file_modified: Option<String>,
}

#[tauri::command]
pub async fn get_text_metadata(input_path: String) -> Result<TextMetadata, String> {
    tokio::task::spawn_blocking(move || {
        let content = std::fs::read_to_string(&input_path)
            .map_err(|e| format!("Failed to read text file: {}", e))?;

        // Get file metadata
        let file_metadata = get_file_metadata(&input_path)?;

        // Calculate text statistics
        let line_count = content.lines().count() as u64;
        let character_count = content.chars().count() as u64;
        let word_count = content.split_whitespace().count() as u64;

        // Detect line endings
        let line_endings = if content.contains("\r\n") {
            Some("CRLF (Windows)".to_string())
        } else if content.contains('\r') {
            Some("CR (Old Mac)".to_string())
        } else if content.contains('\n') {
            Some("LF (Unix/Mac)".to_string())
        } else {
            None
        };

        // Try to detect encoding (simplified - assume UTF-8 if valid)
        let encoding = if content.is_char_boundary(0) {
            Some("UTF-8".to_string())
        } else {
            Some("Unknown".to_string())
        };

        Ok::<TextMetadata, String>(TextMetadata {
            file_size: file_metadata.size,
            line_count,
            character_count,
            word_count,
            encoding,
            line_endings,
            file_created: file_metadata.created,
            file_modified: file_metadata.modified,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
