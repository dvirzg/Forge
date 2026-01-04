use std::process::{Command, Output};

/// Trait for executing external commands
pub trait CommandExecutor {
    fn execute(&self, args: &[&str]) -> Result<Output, String>;
    fn execute_strings(&self, args: Vec<String>) -> Result<Output, String>;
    fn check_available(&self) -> bool;
}

/// FFmpeg command executor
pub struct FfmpegExecutor;

impl CommandExecutor for FfmpegExecutor {
    fn execute(&self, args: &[&str]) -> Result<Output, String> {
        Command::new("ffmpeg")
            .args(args)
            .output()
            .map_err(|e| format!("Failed to execute ffmpeg: {}. Make sure ffmpeg is installed.", e))
    }

    fn execute_strings(&self, args: Vec<String>) -> Result<Output, String> {
        Command::new("ffmpeg")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute ffmpeg: {}. Make sure ffmpeg is installed.", e))
    }

    fn check_available(&self) -> bool {
        Command::new("ffmpeg")
            .arg("-version")
            .output()
            .is_ok()
    }
}

/// FFprobe command executor
pub struct FfprobeExecutor;

impl CommandExecutor for FfprobeExecutor {
    fn execute(&self, args: &[&str]) -> Result<Output, String> {
        Command::new("ffprobe")
            .args(args)
            .output()
            .map_err(|e| format!("Failed to execute ffprobe: {}. Make sure ffmpeg is installed.", e))
    }

    fn execute_strings(&self, args: Vec<String>) -> Result<Output, String> {
        Command::new("ffprobe")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute ffprobe: {}. Make sure ffmpeg is installed.", e))
    }

    fn check_available(&self) -> bool {
        Command::new("ffprobe")
            .arg("-version")
            .output()
            .is_ok()
    }
}

/// Ghostscript command executor
pub struct GhostscriptExecutor;

impl CommandExecutor for GhostscriptExecutor {
    fn execute(&self, args: &[&str]) -> Result<Output, String> {
        Command::new("gs")
            .args(args)
            .output()
            .map_err(|e| format!("Failed to execute ghostscript: {}. Is it installed? Error: {}", e, e))
    }

    fn execute_strings(&self, args: Vec<String>) -> Result<Output, String> {
        Command::new("gs")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute ghostscript: {}. Is it installed? Error: {}", e, e))
    }

    fn check_available(&self) -> bool {
        Command::new("gs")
            .arg("--version")
            .output()
            .is_ok()
    }
}

/// Validates command output and returns error message if failed
pub fn validate_output(output: &Output) -> Result<(), String> {
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Command failed: {}", error));
    }
    Ok(())
}
