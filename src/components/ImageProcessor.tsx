import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import {
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Sparkles,
  Scissors,
  Trash2,
  Download,
  ArrowLeft,
  Info
} from 'lucide-react';

interface ImageProcessorProps {
  file: {
    path: string;
    name: string;
  };
  onReset: () => void;
}

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  color_type: string;
}

function ImageProcessor({ file, onReset }: ImageProcessorProps) {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [modelAvailable, setModelAvailable] = useState<boolean | null>(null);
  const [downloadingModel, setDownloadingModel] = useState(false);

  const imageSrc = convertFileSrc(file.path);

  // Check if background removal model is available
  const checkModel = async () => {
    try {
      const available = await invoke<boolean>('check_bg_removal_model');
      setModelAvailable(available);
    } catch (error) {
      setModelAvailable(false);
    }
  };

  // Download the background removal model
  const handleDownloadModel = async () => {
    try {
      setDownloadingModel(true);
      setStatus('Downloading AI model... This may take a few minutes.');

      const result = await invoke<string>('download_bg_removal_model');
      setStatus(result);
      setModelAvailable(true);
    } catch (error) {
      setStatus(`Error downloading model: ${error}`);
    } finally {
      setDownloadingModel(false);
    }
  };

  // Check model on component mount
  useEffect(() => {
    checkModel();
  }, []);

  const handleGetMetadata = async () => {
    try {
      setProcessing(true);
      const meta = await invoke<ImageMetadata>('get_image_metadata', {
        inputPath: file.path,
      });
      setMetadata(meta);
      setShowMetadata(true);
      setStatus('Metadata retrieved successfully');
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveBackground = async () => {
    try {
      setProcessing(true);
      setStatus('Removing background...');

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, '_no_bg.png'),
        filters: [{ name: 'Image', extensions: ['png'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('remove_background', {
        inputPath: file.path,
        outputPath,
      });

      setStatus(result);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRotate = async (degrees: number) => {
    try {
      setProcessing(true);
      setStatus(`Rotating ${degrees}°...`);

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, `_rotated${degrees}.png`),
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('rotate_image', {
        inputPath: file.path,
        outputPath,
        degrees,
      });

      setStatus(result);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleFlip = async (direction: 'horizontal' | 'vertical') => {
    try {
      setProcessing(true);
      setStatus(`Flipping ${direction}...`);

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, `_flipped_${direction}.png`),
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('flip_image', {
        inputPath: file.path,
        outputPath,
        direction,
      });

      setStatus(result);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleConvert = async (format: string) => {
    try {
      setProcessing(true);
      setStatus(`Converting to ${format.toUpperCase()}...`);

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, `.${format}`),
        filters: [{ name: 'Image', extensions: [format] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('convert_image', {
        inputPath: file.path,
        outputPath,
        format,
      });

      setStatus(result);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleStripMetadata = async () => {
    try {
      setProcessing(true);
      setStatus('Stripping metadata...');

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, '_no_metadata.png'),
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('strip_metadata', {
        inputPath: file.path,
        outputPath,
      });

      setStatus(result);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onReset}
            className="glass-card p-3 rounded-2xl transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Image Processing</h2>
            <p className="text-sm text-white/60">{file.name}</p>
          </div>
        </div>
        <button
          onClick={handleGetMetadata}
          className="glass-card px-4 py-2 rounded-2xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
        >
          <Info className="w-4 h-4 text-white" />
          <span className="text-white text-sm">Metadata</span>
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Preview */}
        <div className="flex-1 glass-card rounded-3xl p-6 flex items-center justify-center overflow-hidden">
          <img
            src={imageSrc}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-2xl"
          />
        </div>

        {/* Controls */}
        <div className="w-80 flex flex-col gap-4 overflow-y-auto">
          {/* AI Tools */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Tools
            </h3>

            {modelAvailable === false && (
              <div className="mb-3 p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30">
                <p className="text-yellow-200 text-xs mb-2">
                  AI model not installed
                </p>
                <button
                  onClick={handleDownloadModel}
                  disabled={downloadingModel}
                  className="w-full glass-card px-4 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105 disabled:opacity-50 bg-blue-500/30"
                >
                  {downloadingModel ? 'Downloading...' : 'Download AI Model'}
                </button>
              </div>
            )}

            <button
              onClick={handleRemoveBackground}
              disabled={processing || modelAvailable === false || downloadingModel}
              className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
            >
              Remove Background
            </button>
          </div>

          {/* Transform */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <RotateCw className="w-4 h-4" />
              Transform
            </h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={() => handleRotate(90)}
                disabled={processing}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                90°
              </button>
              <button
                onClick={() => handleRotate(180)}
                disabled={processing}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                180°
              </button>
              <button
                onClick={() => handleRotate(270)}
                disabled={processing}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                270°
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleFlip('horizontal')}
                disabled={processing}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FlipHorizontal className="w-3 h-3" />
                Flip H
              </button>
              <button
                onClick={() => handleFlip('vertical')}
                disabled={processing}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FlipVertical className="w-3 h-3" />
                Flip V
              </button>
            </div>
          </div>

          {/* Convert */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Convert Format
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {['png', 'jpg', 'webp', 'gif', 'bmp', 'ico'].map((format) => (
                <button
                  key={format}
                  onClick={() => handleConvert(format)}
                  disabled={processing}
                  className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105 disabled:opacity-50 uppercase"
                >
                  {format}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Privacy
            </h3>
            <button
              onClick={handleStripMetadata}
              disabled={processing}
              className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
            >
              Strip Metadata
            </button>
          </div>

          {/* Status */}
          {status && (
            <div className="glass-card rounded-3xl p-4">
              <p className="text-white/80 text-xs">{status}</p>
            </div>
          )}

          {/* Metadata display */}
          {showMetadata && metadata && (
            <div className="glass-card rounded-3xl p-6">
              <h3 className="text-white font-semibold mb-4">Metadata</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Width:</span>
                  <span className="text-white">{metadata.width}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Height:</span>
                  <span className="text-white">{metadata.height}px</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Format:</span>
                  <span className="text-white">{metadata.format}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Color:</span>
                  <span className="text-white">{metadata.color_type}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageProcessor;
