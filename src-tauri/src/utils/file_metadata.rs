use chrono;

/// File metadata extracted from filesystem
pub struct FileMetadata {
    pub size: u64,
    pub created: Option<String>,
    pub modified: Option<String>,
}

/// Extracts file metadata (size, created, modified timestamps)
pub fn get_file_metadata(path: &str) -> Result<FileMetadata, String> {
    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    Ok(FileMetadata {
        size: metadata.len(),
        created: metadata.created().ok().map(|t| {
            chrono::DateTime::<chrono::Local>::from(t)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        }),
        modified: metadata.modified().ok().map(|t| {
            chrono::DateTime::<chrono::Local>::from(t)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        }),
    })
}
