use image::codecs::png::CompressionType;

/// Compression quality levels (0-4)
#[derive(Debug, Clone, Copy)]
pub enum CompressionLevel {
    Lossless = 0,
    NearLossless = 1,
    HighQuality = 2,
    MediumQuality = 3,
    LowQuality = 4,
}

impl CompressionLevel {
    pub fn from_u8(level: u8) -> Self {
        match level {
            0 => CompressionLevel::Lossless,
            1 => CompressionLevel::NearLossless,
            2 => CompressionLevel::HighQuality,
            3 => CompressionLevel::MediumQuality,
            4 => CompressionLevel::LowQuality,
            _ => CompressionLevel::HighQuality,
        }
    }
}

/// Video compression settings (CRF values for libx264)
pub struct VideoCompression {
    pub crf: u8,
    pub preset: &'static str,
}

impl CompressionLevel {
    pub fn video_crf(&self) -> VideoCompression {
        match self {
            CompressionLevel::Lossless => VideoCompression {
                crf: 0,
                preset: "veryslow",
            },
            CompressionLevel::NearLossless => VideoCompression {
                crf: 17,
                preset: "slow",
            },
            CompressionLevel::HighQuality => VideoCompression {
                crf: 23,
                preset: "medium",
            },
            CompressionLevel::MediumQuality => VideoCompression {
                crf: 28,
                preset: "medium",
            },
            CompressionLevel::LowQuality => VideoCompression {
                crf: 35,
                preset: "fast",
            },
        }
    }

    pub fn jpeg_quality(&self) -> u8 {
        match self {
            CompressionLevel::Lossless => 100,
            CompressionLevel::NearLossless => 95,
            CompressionLevel::HighQuality => 85,
            CompressionLevel::MediumQuality => 70,
            CompressionLevel::LowQuality => 50,
        }
    }

    pub fn webp_quality(&self) -> f32 {
        match self {
            CompressionLevel::Lossless => 100.0,
            CompressionLevel::NearLossless => 95.0,
            CompressionLevel::HighQuality => 85.0,
            CompressionLevel::MediumQuality => 70.0,
            CompressionLevel::LowQuality => 50.0,
        }
    }

    pub fn png_compression(&self) -> CompressionType {
        match self {
            CompressionLevel::Lossless => CompressionType::Default,
            CompressionLevel::NearLossless => CompressionType::Fast,
            CompressionLevel::HighQuality => CompressionType::Default,
            CompressionLevel::MediumQuality => CompressionType::Best,
            CompressionLevel::LowQuality => CompressionType::Best,
        }
    }

    pub fn ghostscript_settings(&self) -> &'static str {
        match self {
            CompressionLevel::Lossless => "/default",
            CompressionLevel::NearLossless => "/prepress",
            CompressionLevel::HighQuality => "/printer",
            CompressionLevel::MediumQuality => "/ebook",
            CompressionLevel::LowQuality => "/screen",
        }
    }

    /// Estimates size reduction factor (0.0 - 1.0)
    pub fn size_reduction_factor(&self) -> f64 {
        match self {
            CompressionLevel::Lossless => 0.95,  // 5% reduction
            CompressionLevel::NearLossless => 0.70,  // 30% reduction
            CompressionLevel::HighQuality => 0.50,  // 50% reduction
            CompressionLevel::MediumQuality => 0.30,  // 70% reduction
            CompressionLevel::LowQuality => 0.15,  // 85% reduction
        }
    }
}
