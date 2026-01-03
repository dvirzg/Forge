import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { readBinaryFile, writeBinaryFile, removeFile, createDir, renameFile } from '@tauri-apps/api/fs';
import { join, dirname } from '@tauri-apps/api/path';
import { appDataDir } from '@tauri-apps/api/path';
import {
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Sparkles,
  Trash2,
  Download,
  ArrowLeft,
  ChevronDown,
  Save,
  FileDown,
  RotateCcw
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
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  
  // Helper function to show toast
  const showToast = (message: string) => {
    // Clear existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    const id = Date.now();
    setToast({ message, id });
    
    // Auto-dismiss after 3 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };
  const [modelAvailable, setModelAvailable] = useState<boolean | null>(null);
  const [downloadingModel, setDownloadingModel] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [transformedImageData, setTransformedImageData] = useState<Uint8Array | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentWorkingPath, setCurrentWorkingPath] = useState<string | null>(null);
  const [tempFilePath, setTempFilePath] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editedFileName, setEditedFileName] = useState<string>('');
  const [displayFileName, setDisplayFileName] = useState<string>(file.name);
  const [currentFilePath, setCurrentFilePath] = useState<string>(file.path);

  // Load image as base64
  useEffect(() => {
    const loadImage = async () => {
      try {
        const imageData = await readBinaryFile(currentFilePath);
        const blob = new Blob([imageData as BlobPart]);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageSrc(reader.result as string);
        };
        reader.readAsDataURL(blob);
        setImageError(false);
        setTransformedImageData(null);
        setHasUnsavedChanges(false);
        setDisplayFileName(file.name);
        setCurrentFilePath(file.path);
        
        // Clean up any existing temp file
        if (tempFilePath) {
          try {
            await removeFile(tempFilePath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        setCurrentWorkingPath(null);
        setTempFilePath(null);
      } catch (error) {
        console.error('Failed to load image:', error);
        setImageError(true);
      }
    };

    loadImage();
  }, [file.path]);

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
      showToast('Downloading AI model... This may take a few minutes.');

      const result = await invoke<string>('download_bg_removal_model');
      showToast(result);
      setModelAvailable(true);
    } catch (error) {
      showToast(`Error downloading model: ${error}`);
    } finally {
      setDownloadingModel(false);
    }
  };

  // Check model on component mount
  useEffect(() => {
    checkModel();
  }, []);

  // Auto-fetch metadata on component mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const meta = await invoke<ImageMetadata>('get_image_metadata', {
          inputPath: currentFilePath,
        });
        setMetadata(meta);
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      }
    };
    fetchMetadata();
  }, [currentFilePath]);


  const handleRemoveBackground = async () => {
    try {
      setProcessing(true);
      showToast('Removing background...');

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, '_no_bg.png'),
        filters: [{ name: 'Image', extensions: ['png'] }],
      });

      if (!outputPath) {
        return;
      }

      const result = await invoke<string>('remove_background', {
        inputPath: currentFilePath,
        outputPath,
      });

      showToast(result);
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRotate = async (degrees: number) => {
    try {
      setProcessing(true);

      const inputPath = currentWorkingPath || currentFilePath;
      const imageBytes = await invoke<number[]>('rotate_image_preview', {
        inputPath,
        degrees,
      });

      const uint8Array = new Uint8Array(imageBytes);
      setTransformedImageData(uint8Array);
      
      // Save to temp file for next transformation
      const dataDir = await appDataDir();
      
      // Ensure the directory exists
      try {
        await createDir(dataDir, { recursive: true });
      } catch (e) {
        // Directory might already exist, ignore
      }
      
      const tempPath = await join(dataDir, `temp_transform_${Date.now()}.png`);
      
      // Clean up old temp file if it exists
      if (tempFilePath && tempFilePath !== currentFilePath) {
        try {
          await removeFile(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      await writeBinaryFile(tempPath, uint8Array);
      setTempFilePath(tempPath);
      setCurrentWorkingPath(tempPath);
      
      const blob = new Blob([uint8Array.buffer]);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(blob);
      
      setHasUnsavedChanges(true);
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleFlip = async (direction: 'horizontal' | 'vertical') => {
    try {
      setProcessing(true);

      const inputPath = currentWorkingPath || currentFilePath;
      const imageBytes = await invoke<number[]>('flip_image_preview', {
        inputPath,
        direction,
      });

      const uint8Array = new Uint8Array(imageBytes);
      setTransformedImageData(uint8Array);
      
      // Save to temp file for next transformation
      const dataDir = await appDataDir();
      
      // Ensure the directory exists
      try {
        await createDir(dataDir, { recursive: true });
      } catch (e) {
        // Directory might already exist, ignore
      }
      
      const tempPath = await join(dataDir, `temp_transform_${Date.now()}.png`);
      
      // Clean up old temp file if it exists
      if (tempFilePath && tempFilePath !== currentFilePath) {
        try {
          await removeFile(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      await writeBinaryFile(tempPath, uint8Array);
      setTempFilePath(tempPath);
      setCurrentWorkingPath(tempPath);
      
      const blob = new Blob([uint8Array.buffer]);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(blob);
      
      setHasUnsavedChanges(true);
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async (overwriteOriginal: boolean = false) => {
    if (!transformedImageData) return;

    try {
      setProcessing(true);
      showToast('Saving...');

      let outputPath: string | null;

      if (overwriteOriginal) {
        outputPath = currentFilePath;
      } else {
        outputPath = await save({
          defaultPath: file.name.replace(/\.[^/.]+$/, '_transformed.png'),
          filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
        });

        if (!outputPath) {
          // Operation cancelled - no toast needed
          return;
        }
      }

      await writeBinaryFile(outputPath, transformedImageData);
      
      setHasUnsavedChanges(false);
      showToast('Saved successfully');
      
      // Clean up temp file
      if (tempFilePath && tempFilePath !== currentFilePath) {
        try {
          await removeFile(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      if (overwriteOriginal) {
        // Reload the image from the updated file
        const imageData = await readBinaryFile(currentFilePath);
        const blob = new Blob([imageData as BlobPart]);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageSrc(reader.result as string);
        };
        reader.readAsDataURL(blob);
        setTransformedImageData(null);
        setCurrentWorkingPath(null);
        setTempFilePath(null);
      } else {
        // Reset to original for new transformations
        setCurrentWorkingPath(null);
        setTempFilePath(null);
        setTransformedImageData(null);
      }
    } catch (error) {
      showToast(`Error saving: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRevert = async () => {
    try {
      setProcessing(true);
      
      // Clean up temp file
      if (tempFilePath && tempFilePath !== currentFilePath) {
        try {
          await removeFile(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // Reload the original image
      const imageData = await readBinaryFile(file.path);
      const blob = new Blob([imageData as BlobPart]);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(blob);
      
      setTransformedImageData(null);
      setCurrentWorkingPath(null);
      setTempFilePath(null);
      setHasUnsavedChanges(false);
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRenameSave = async () => {
    if (!editedFileName.trim() || editedFileName === displayFileName) {
      setIsRenaming(false);
      setEditedFileName(displayFileName);
      return;
    }

    try {
      const fileDir = await dirname(currentFilePath);
      const newPath = await join(fileDir, editedFileName);
      
      await renameFile(currentFilePath, newPath);
      setDisplayFileName(editedFileName);
      setCurrentFilePath(newPath);
      setIsRenaming(false);
    } catch (error) {
      showToast(`Error renaming file: ${error}`);
      setIsRenaming(false);
      setEditedFileName(displayFileName);
    }
  };

  const handleConvert = async (format: string) => {
    try {
      setProcessing(true);
      showToast(`Converting to ${format.toUpperCase()}...`);

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, `.${format}`),
        filters: [{ name: 'Image', extensions: [format] }],
      });

      if (!outputPath) {
        return;
      }

      const result = await invoke<string>('convert_image', {
        inputPath: currentFilePath,
        outputPath,
        format,
      });

      showToast(result);
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleStripMetadata = async () => {
    try {
      setProcessing(true);
      showToast('Stripping metadata...');

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, '_no_metadata.png'),
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });

      if (!outputPath) {
        return;
      }

      const result = await invoke<string>('strip_metadata', {
        inputPath: currentFilePath,
        outputPath,
      });

      showToast(result);
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onReset}
            className="glass-card p-3 rounded-2xl transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Image Processing</h2>
            {isRenaming ? (
              <input
                type="text"
                value={editedFileName}
                onChange={(e) => setEditedFileName(e.target.value)}
                onBlur={handleRenameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameSave();
                  } else if (e.key === 'Escape') {
                    setIsRenaming(false);
                    setEditedFileName(displayFileName);
                  }
                }}
                className="text-sm text-white/60 bg-transparent border-b border-white/30 focus:border-white/60 focus:outline-none px-1"
                autoFocus
              />
            ) : (
              <p
                className="text-sm text-white/60 cursor-pointer hover:text-white/80 transition-colors"
                onDoubleClick={() => {
                  setIsRenaming(true);
                  setEditedFileName(displayFileName);
                }}
              >
                {displayFileName}
              </p>
            )}
          </div>
        </div>
        
        {/* Save Buttons - appears when there are unsaved changes */}
        {hasUnsavedChanges && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleSave(false)}
              disabled={processing}
              className="glass-card p-2 rounded-lg text-white transition-all duration-300 disabled:opacity-50 hover:scale-105"
              title="Save As New File"
            >
              <FileDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={processing}
              className="glass-card p-2 rounded-lg text-white transition-all duration-300 disabled:opacity-50 hover:scale-105 bg-blue-500/30"
              title="Overwrite Original"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleRevert}
              disabled={processing}
              className="glass-card p-2 rounded-lg text-white transition-all duration-300 disabled:opacity-50 hover:scale-105"
              title="Revert Back To Original"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex gap-6 min-h-0 items-start">
        {/* Preview */}
        <div className="flex-1 rounded-3xl p-6 flex items-start justify-center overflow-hidden min-w-0">
          {imageError ? (
            <div className="text-white/60 text-center">
              <p className="text-sm mb-2">Failed to load image</p>
              <p className="text-xs text-white/40">{file.path}</p>
            </div>
          ) : (
            <img
              src={imageSrc}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-2xl"
              onError={(e) => {
                console.error('Image load error:', e);
                console.error('Failed src:', imageSrc);
                setImageError(true);
              }}
              onLoad={() => {
                console.log('Image loaded successfully');
              }}
            />
          )}
        </div>

        {/* Controls */}
        <div className="w-80 flex flex-col gap-4 overflow-y-auto overflow-x-visible flex-shrink-0 pt-6 pb-6 px-1">
          {/* AI Tools */}
          <div>
            <button
              onClick={() => toggleCard('ai-tools')}
              className="w-full text-left text-white font-semibold flex items-center justify-between gap-2 py-2 hover:text-white/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI Tools
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
                  expandedCard === 'ai-tools' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedCard === 'ai-tools' && (
              <div className="mt-4">
                {modelAvailable === false && (
                  <div className="mb-3 p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30">
                    <p className="text-yellow-200 text-xs mb-2">
                      AI model not installed
                    </p>
                    <button
                      onClick={handleDownloadModel}
                      disabled={downloadingModel}
                      className="w-full glass-card px-4 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50 bg-blue-500/30"
                    >
                      {downloadingModel ? 'Downloading...' : 'Download AI Model'}
                    </button>
                  </div>
                )}

                <button
                  onClick={handleRemoveBackground}
                  disabled={processing || modelAvailable === false || downloadingModel}
                  className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 disabled:opacity-50"
                >
                  Remove Background
                </button>
              </div>
            )}
          </div>

          {/* Transform */}
          <div>
            <button
              onClick={() => toggleCard('transform')}
              className="w-full text-left text-white font-semibold flex items-center justify-between gap-2 py-2 hover:text-white/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4" />
                Transform
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
                  expandedCard === 'transform' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedCard === 'transform' && (
              <div className="mt-4">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    onClick={() => handleRotate(90)}
                    disabled={processing}
                    className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50"
                  >
                    90°
                  </button>
                  <button
                    onClick={() => handleRotate(180)}
                    disabled={processing}
                    className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50"
                  >
                    180°
                  </button>
                  <button
                    onClick={() => handleRotate(270)}
                    disabled={processing}
                    className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50"
                  >
                    270°
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleFlip('horizontal')}
                    disabled={processing}
                    className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FlipHorizontal className="w-3 h-3" />
                    Flip H
                  </button>
                  <button
                    onClick={() => handleFlip('vertical')}
                    disabled={processing}
                    className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FlipVertical className="w-3 h-3" />
                    Flip V
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Convert */}
          <div>
            <button
              onClick={() => toggleCard('convert')}
              className="w-full text-left text-white font-semibold flex items-center justify-between gap-2 py-2 hover:text-white/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Convert Format
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
                  expandedCard === 'convert' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedCard === 'convert' && (
              <div className="mt-4">
                <div className="grid grid-cols-3 gap-2">
                  {['png', 'jpg', 'webp', 'gif', 'bmp', 'ico'].map((format) => (
                    <button
                      key={format}
                      onClick={() => handleConvert(format)}
                      disabled={processing}
                      className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50 uppercase"
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div>
            <button
              onClick={() => toggleCard('privacy-metadata')}
              className="w-full text-left text-white font-semibold flex items-center justify-between gap-2 py-2 hover:text-white/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Metadata
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
                  expandedCard === 'privacy-metadata' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedCard === 'privacy-metadata' && (
              <div className="mt-4 space-y-4">
                {metadata && (
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
                )}
                <button
                  onClick={handleStripMetadata}
                  disabled={processing}
                  className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 disabled:opacity-50"
                >
                  Strip Metadata
                </button>
              </div>
            )}
          </div>

          {/* Toast Notification */}
          {toast && (
            <div 
              className="fixed bottom-6 right-6 z-50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
              key={toast.id}
            >
              <div className="glass-card rounded-xl px-4 py-2 shadow-lg">
                <p className="text-white text-sm whitespace-nowrap">{toast.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageProcessor;
