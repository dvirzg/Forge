use std::path::Path;

/// Generates an output path for compressed/modified files
/// 
/// # Arguments
/// * `input_path` - Original file path
/// * `suffix` - Suffix to add before extension (e.g., "compressed", "rotated")
/// * `extension` - Output file extension (e.g., "pdf", "jpg")
pub fn generate_output_path(input_path: &str, suffix: &str, extension: &str) -> String {
    let path = Path::new(input_path);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let parent = path
        .parent()
        .and_then(|p| p.to_str())
        .unwrap_or("");

    format!("{}/{}_{}.{}", parent, stem, suffix, extension)
}

/// Gets a temporary file path for intermediate processing
pub fn get_temp_path(prefix: &str, extension: &str) -> String {
    let temp_dir = std::env::temp_dir();
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let file_name = format!("{}_{}.{}", prefix, timestamp, extension);
    temp_dir.join(file_name).to_string_lossy().to_string()
}
