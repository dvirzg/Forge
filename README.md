# Forge - Minimal Media Utility

A high-performance, single-binary media processing tool for macOS with a beautiful liquid glass UI. 100% local processing - no internet required, complete privacy.

## Features

### Image Processing
- AI-powered background removal (local ONNX model)
- Rotate (90°, 180°, 270°)
- Flip (horizontal/vertical)
- Format conversion (PNG, JPG, WebP, GIF, BMP, ICO, TIFF)
- Metadata viewing and stripping
- Crop functionality

### PDF Operations
- Merge multiple PDFs
- Rotate pages
- Extract text
- Extract images

### Video/Audio Processing
- Trim videos with precise timestamps
- Strip audio tracks
- Scale/resize videos
- Convert video to GIF

### Text Utilities
- Case conversion (upper, lower, title, camel, pascal, snake, kebab)
- Find and replace
- Trim whitespace
- Remove empty lines and duplicates
- Sort lines

## Tech Stack

- **Framework**: Tauri (Rust backend + React frontend)
- **UI**: React 18 + TypeScript + Tailwind CSS
- **Design**: Liquid Glass (macOS-native vibrancy)
- **Image Processing**: `image`, `photon-rs`, `rmbg`
- **PDF**: `lopdf`, `pdf-extract`
- **Video**: FFmpeg (via CLI)
- **Text**: `convert_case`

## Prerequisites

### Required
- Node.js (v18 or later)
- Rust (latest stable)
- Xcode Command Line Tools (macOS)

### Optional
- FFmpeg (for video/audio processing)
  ```bash
  brew install ffmpeg
  ```

Note: AI background removal uses the `rmbg` crate which automatically downloads and manages the ONNX model on first use.

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run tauri dev
   ```

4. Build for production:
   ```bash
   npm run tauri build
   ```

## Project Structure

```
Forge/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── ImageProcessor.tsx
│   │   ├── PdfProcessor.tsx
│   │   ├── VideoProcessor.tsx
│   │   └── TextProcessor.tsx
│   ├── App.tsx            # Main application
│   ├── main.tsx           # Entry point
│   └── index.css          # Styles
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/      # Tauri commands
│   │   │   ├── image.rs
│   │   │   ├── pdf.rs
│   │   │   ├── video.rs
│   │   │   └── text.rs
│   │   └── main.rs        # Tauri setup
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── package.json
└── README.md
```

## Usage

1. Launch the application
2. Drag and drop any supported file onto the window
3. The appropriate processor will automatically open
4. Use the tools in the sidebar to process your file
5. Save the output to your desired location

## Design Philosophy

Forge embraces the "Liquid Glass" design aesthetic popularized by macOS apps like AlDente and Raycast:
- Transparent window with heavy backdrop blur
- Subtle 1px borders
- System-native rounded corners
- Minimalist, distraction-free interface
- Dark mode optimized

## Performance

Built with performance in mind:
- Single binary distribution
- Native Rust backend for heavy processing
- Async operations to prevent UI freezing
- Optimized release builds with LTO

## Privacy

All processing happens locally on your machine:
- No internet connection required
- No data collection
- No telemetry
- Your files never leave your computer

## License

[Your License Here]

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
