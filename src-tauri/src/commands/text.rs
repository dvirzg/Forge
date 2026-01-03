use convert_case::{Case, Casing};
use serde::{Deserialize, Serialize};

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
