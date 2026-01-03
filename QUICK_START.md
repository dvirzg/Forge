# Forge - Quick Start Guide

## Prerequisites Installation

### 1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. Install Node.js (if not installed)
```bash
# Using Homebrew
brew install node

# Or download from https://nodejs.org
```

### 3. Install FFmpeg (for video processing)
```bash
brew install ffmpeg
```

## Development Setup

### 1. Install Dependencies
```bash
# Install npm dependencies
npm install
```

### 2. Run Development Server
```bash
# This will start both the Vite dev server and Tauri
npm run tauri dev
```

The first build will take several minutes as it compiles all Rust dependencies.

## Building for Production

```bash
npm run tauri build
```

The compiled app will be in `src-tauri/target/release/bundle/`

## Background Removal

The AI-powered background removal feature uses the `rmbg` crate, which automatically downloads and manages the required ONNX model on first use. No manual setup required!

## Troubleshooting

### FFmpeg not found
If video processing fails, ensure FFmpeg is in your PATH:
```bash
ffmpeg -version
```

### Rust compilation errors
Make sure you have the latest stable Rust:
```bash
rustup update stable
```

### Node/npm issues
Clear cache and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## File Support

- **Images**: JPG, PNG, GIF, WebP, BMP, ICO, TIFF
- **PDFs**: .pdf
- **Videos**: MP4, MOV, AVI, MKV, WebM, FLV, WMV
- **Audio**: MP3, WAV, AAC, FLAC
- **Text**: TXT, MD, JSON, XML, CSV

## Tips

1. **Drag and Drop**: Simply drag any supported file onto the window
2. **Fast Processing**: All operations happen locally - no internet needed
3. **Privacy**: Your files never leave your computer
4. **Performance**: First launch may be slow, subsequent operations are fast

## Next Steps

- Try dragging an image to test background removal
- Merge some PDFs together
- Convert a video to GIF
- Experiment with text case conversions

Enjoy using Forge!
