import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { readBinaryFile, writeBinaryFile, removeFile, createDir, renameFile } from '@tauri-apps/api/fs';
import { join, dirname } from '@tauri-apps/api/path';
import { appDataDir } from '@tauri-apps/api/path';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
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
  RotateCcw,
  Scissors,
  Check,
  X,
  ExternalLink,
  Gauge
} from 'lucide-react';
import { CompressionSlider } from './shared/CompressionSlider';
import { FileSizeComparison } from './shared/FileSizeComparison';
import { formatFileSize } from '../utils/fileUtils';

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
  file_size: number;
  bit_depth?: string;
  has_alpha: boolean;
  exif: Record<string, string>;
  iptc: Record<string, string>;
  xmp: Record<string, string>;
  file_created?: string;
  file_modified?: string;
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
  const [imageLoading, setImageLoading] = useState(true);
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
  const [isCropping, setIsCropping] = useState(false);
  const cropperRef = useRef<HTMLImageElement>(null);
  const [isEditingCustomFormat, setIsEditingCustomFormat] = useState(false);
  const [customFormat, setCustomFormat] = useState('');

  // Compression state
  const [compressionLevel, setCompressionLevel] = useState(2); // Default: High Quality
  const [compressionFormat, setCompressionFormat] = useState('jpg');
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  // Load image as base64
  useEffect(() => {
    const loadImage = async () => {
      setImageLoading(true);
      setImageError(false);
      try {
        const imageData = await readBinaryFile(currentFilePath);
        const blob = new Blob([imageData as BlobPart]);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageSrc(reader.result as string);
          setImageLoading(false);
        };
        reader.onerror = () => {
          console.error('Failed to read image file');
          setImageError(true);
          setImageLoading(false);
        };
        reader.readAsDataURL(blob);
        setTransformedImageData(null);
        setHasUnsavedChanges(false);
        setDisplayFileName(file.name);
        setCurrentFilePath(file.path);
        setIsCropping(false);
        
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
        setImageLoading(false);
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

  const handleCrop = async () => {
    const imageElement = cropperRef?.current;
    const cropper = (imageElement as any)?.cropper;

    if (!cropper || !metadata) return;

    try {
      setProcessing(true);
      showToast('Cropping image...');

      // Get crop data from cropper.js
      const cropData = cropper.getData(true); // true = rounded values
      const imageData = cropper.getImageData();

      // Calculate actual pixel coordinates
      const scaleX = imageData.naturalWidth / imageData.width;
      const scaleY = imageData.naturalHeight / imageData.height;

      const cropX = Math.round(cropData.x * scaleX);
      const cropY = Math.round(cropData.y * scaleY);
      const cropWidth = Math.round(cropData.width * scaleX);
      const cropHeight = Math.round(cropData.height * scaleY);

      const inputPath = currentWorkingPath || currentFilePath;
      const imageBytes = await invoke<number[]>('crop_image_preview', {
        inputPath,
        crop: {
          x: cropX,
          y: cropY,
          width: cropWidth,
          height: cropHeight,
        },
      });

      const uint8Array = new Uint8Array(imageBytes);
      setTransformedImageData(uint8Array);
      
      // Save to temp file for next transformation
      const dataDir = await appDataDir();
      
      try {
        await createDir(dataDir, { recursive: true });
      } catch (e) {
        // Directory might already exist, ignore
      }
      
      const tempPath = await join(dataDir, `temp_transform_${Date.now()}.png`);
      
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
      setIsCropping(false);
      showToast('Image cropped');
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const cancelCrop = () => {
    setIsCropping(false);
  };

  const initializeCrop = () => {
    setIsCropping(true);
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

      await invoke<string>('convert_image', {
        inputPath: currentFilePath,
        outputPath,
        format,
      });

      showToast(`Converted to ${format.toUpperCase()} successfully`);
    } catch (error) {
      const errorMsg = String(error);
      if (errorMsg.includes('Unsupported format') || errorMsg.includes('incompatible')) {
        showToast(`Incompatible format: ${format.toUpperCase()}`);
      } else {
        showToast(`Error: ${error}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleCustomFormatSubmit = async () => {
    if (!customFormat.trim()) {
      setIsEditingCustomFormat(false);
      return;
    }

    const format = customFormat.trim().toLowerCase();
    setIsEditingCustomFormat(false);
    setCustomFormat('');

    try {
      await handleConvert(format);
    } catch (error) {
      // Error handling is done in handleConvert
    }
  };

  // Compression handlers
  const handleCompressionLevelChange = async (level: number) => {
    setCompressionLevel(level);

    // Estimate size when level changes
    if (metadata) {
      try {
        setIsEstimating(true);
        const inputPath = currentWorkingPath || currentFilePath;
        const estimated = await invoke<number>('estimate_compressed_size', {
          inputPath,
          qualityLevel: level,
          outputFormat: compressionFormat,
        });
        setEstimatedSize(estimated);
      } catch (error) {
        console.error('Size estimation failed:', error);
        setEstimatedSize(null);
      } finally {
        setIsEstimating(false);
      }
    }
  };

  const handleCompressionFormatChange = async (format: string) => {
    setCompressionFormat(format);

    // Re-estimate size with new format
    if (metadata) {
      try {
        setIsEstimating(true);
        const inputPath = currentWorkingPath || currentFilePath;
        const estimated = await invoke<number>('estimate_compressed_size', {
          inputPath,
          qualityLevel: compressionLevel,
          outputFormat: format,
        });
        setEstimatedSize(estimated);
      } catch (error) {
        console.error('Size estimation failed:', error);
        setEstimatedSize(null);
      } finally {
        setIsEstimating(false);
      }
    }
  };

  const handleCompress = async () => {
    try {
      setProcessing(true);
      showToast('Compressing image...');

      const inputPath = currentWorkingPath || currentFilePath;
      const result = await invoke<{ output_path: string; file_size: number }>('compress_image', {
        inputPath,
        qualityLevel: compressionLevel,
        outputFormat: compressionFormat,
      });

      const originalSize = metadata?.file_size || 0;
      const reduction = Math.round(((originalSize - result.file_size) / originalSize) * 100);

      if (reduction > 0) {
        showToast(`Image compressed successfully! Saved ${reduction}% space`);
      } else if (reduction < 0) {
        showToast(`Warning: Compressed file is ${Math.abs(reduction)}% larger`);
      } else {
        showToast('Image compressed (similar size)');
      }

      // Update the current file path to the compressed file
      setCurrentFilePath(result.output_path);
      setCurrentWorkingPath(result.output_path);
      setDisplayFileName(result.output_path.split('/').pop() || displayFileName);

      // Reload metadata for the new file
      const newMetadata = await invoke<ImageMetadata>('get_image_metadata', {
        inputPath: result.output_path,
      });
      setMetadata(newMetadata);

      // Reset estimation
      setEstimatedSize(null);
    } catch (error) {
      showToast(`Compression failed: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleStripMetadata = async () => {
    try {
      setProcessing(true);
      showToast('Stripping metadata...');

      const inputPath = currentWorkingPath || currentFilePath;
      const imageBytes = await invoke<number[]>('strip_metadata_preview', {
        inputPath,
      });

      const uint8Array = new Uint8Array(imageBytes);
      setTransformedImageData(uint8Array);
      
      // Save to temp file for next transformation
      const dataDir = await appDataDir();
      
      try {
        await createDir(dataDir, { recursive: true });
      } catch (e) {
        // Directory might already exist, ignore
      }
      
      const tempPath = await join(dataDir, `temp_strip_metadata_${Date.now()}.png`);
      
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
      
      // Update preview
      const blob = new Blob([uint8Array.buffer]);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(blob);
      
      // Update metadata to show stripped version
      const strippedMetadata = await invoke<ImageMetadata>('get_image_metadata', {
        inputPath: tempPath,
      });
      setMetadata(strippedMetadata);
      
      setHasUnsavedChanges(true);
      showToast('Metadata stripped');
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const getBasicMetadataEntries = (): Array<{ key: string; value: string }> => {
    if (!metadata) return [];
    
    const entries: Array<{ key: string; value: string }> = [];
    entries.push({ key: 'Width', value: `${metadata.width}px` });
    entries.push({ key: 'Height', value: `${metadata.height}px` });
    entries.push({ key: 'Format', value: metadata.format });
    entries.push({ key: 'Color Type', value: metadata.color_type });
    if (metadata.bit_depth) entries.push({ key: 'Bit Depth', value: metadata.bit_depth });
    entries.push({ key: 'Has Alpha', value: metadata.has_alpha ? 'Yes' : 'No' });
    entries.push({ key: 'File Size', value: formatFileSize(metadata.file_size) });
    if (metadata.file_created) entries.push({ key: 'Created', value: metadata.file_created });
    if (metadata.file_modified) entries.push({ key: 'Modified', value: metadata.file_modified });
    
    return entries;
  };

  const getAllMetadataEntries = (): Array<{ key: string; value: string }> => {
    if (!metadata) return [];
    
    const entries = getBasicMetadataEntries();
    Object.entries(metadata.exif).forEach(([key, value]) => entries.push({ key: `EXIF: ${key}`, value }));
    Object.entries(metadata.iptc).forEach(([key, value]) => entries.push({ key: `IPTC: ${key}`, value }));
    Object.entries(metadata.xmp).forEach(([key, value]) => entries.push({ key: `XMP: ${key}`, value }));
    
    return entries;
  };

  const hasExtendedMetadata = (): boolean => {
    if (!metadata) return false;
    return Object.keys(metadata.exif).length > 0 || 
           Object.keys(metadata.iptc).length > 0 || 
           Object.keys(metadata.xmp).length > 0;
  };


  const handleOpenMetadataDetail = async () => {
    const entries = getAllMetadataEntries();
    if (entries.length === 0) return;
    
    try {
      await invoke('open_metadata_window', {
        metadata: entries,
        windowTitle: `Metadata - ${displayFileName}`,
      });
    } catch (error) {
      console.error('Failed to open metadata window:', error);
      showToast(`Error opening metadata window: ${error}`);
    }
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
        <div className="flex-1 rounded-3xl p-6 flex items-center justify-center min-w-0 relative" style={{ overflow: isCropping ? 'visible' : 'hidden' }}>
          {imageLoading ? (
            <div className="text-white/60 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
              <p className="text-sm">Loading image...</p>
            </div>
          ) : imageError ? (
            <div className="text-white/60 text-center">
              <p className="text-sm mb-2">Failed to load image</p>
              <p className="text-xs text-white/40">{file.path}</p>
            </div>
          ) : isCropping ? (
            <div className="flex flex-col items-center justify-center w-full max-w-full max-h-full gap-4">
              <div className="relative w-full max-w-full max-h-full flex items-center justify-center">
                <Cropper
                  ref={cropperRef}
                  src={imageSrc}
                  style={{ height: '100%', width: '100%' }}
                  aspectRatio={NaN}
                  guides={true}
                  viewMode={1}
                  minCropBoxHeight={20}
                  minCropBoxWidth={20}
                  background={false}
                  responsive={true}
                  autoCropArea={0.8}
                  checkOrientation={false}
                  modal={false}
                  ready={() => {
                    const imageElement = cropperRef?.current;
                    const cropper = (imageElement as any)?.cropper;
                    if (cropper) {
                      const imageData = cropper.getImageData();
                      
                      // Calculate minimum canvas size to prevent zooming out beyond image
                      const minCanvasWidth = imageData.naturalWidth;
                      const minCanvasHeight = imageData.naturalHeight;
                      
                      // Set minimum canvas dimensions
                      cropper.setCanvasData({
                        minWidth: minCanvasWidth,
                        minHeight: minCanvasHeight,
                      });
                    }
                  }}
                  zoom={(event) => {
                    const imageElement = cropperRef?.current;
                    const cropper = (imageElement as any)?.cropper;
                    if (cropper && event.detail.ratio !== undefined) {
                      const imageData = cropper.getImageData();
                      const containerData = cropper.getContainerData();
                      
                      // Calculate minimum zoom ratio to fit image in container
                      const minZoomRatio = Math.min(
                        containerData.width / imageData.naturalWidth,
                        containerData.height / imageData.naturalHeight
                      );
                      
                      // Prevent zooming out beyond minimum
                      if (event.detail.ratio < minZoomRatio) {
                        event.preventDefault();
                        cropper.zoomTo(minZoomRatio);
                      }
                    }
                  }}
                />
              </div>
              {/* Crop action buttons - below the image */}
              <div className="flex gap-2 pointer-events-auto">
                <button
                  onClick={handleCrop}
                  disabled={processing}
                  className="glass-card p-2 rounded-lg text-white transition-all duration-300 disabled:opacity-50 hover:scale-105 bg-green-500/30 shadow-lg"
                  title="Apply Crop"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelCrop}
                  disabled={processing}
                  className="glass-card p-2 rounded-lg text-white transition-all duration-300 disabled:opacity-50 hover:scale-105 shadow-lg"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
            />
          )}
        </div>

        {/* Controls */}
        <div className="w-80 flex flex-col gap-4 overflow-y-auto overflow-x-visible flex-shrink-0 pt-6 pb-6 px-1">
          {/* AI Tools */}
          {(!expandedCard || expandedCard === 'ai-tools') && (
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
          )}

          {/* Transform */}
          {(!expandedCard || expandedCard === 'transform') && (
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
                <div className="grid grid-cols-2 gap-2 mb-3">
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
                <button
                  onClick={initializeCrop}
                  disabled={processing || isCropping}
                  className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Scissors className="w-4 h-4" />
                  Crop Image
                </button>
              </div>
            )}
            </div>
          )}

          {/* Convert */}
          {(!expandedCard || expandedCard === 'convert') && (
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
                  {['png', 'jpg', 'webp', 'gif', 'bmp'].map((format) => (
                    <button
                      key={format}
                      onClick={() => handleConvert(format)}
                      disabled={processing}
                      className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50 uppercase"
                    >
                      {format}
                    </button>
                  ))}
                  {isEditingCustomFormat ? (
                    <input
                      type="text"
                      value={customFormat}
                      onChange={(e) => setCustomFormat(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCustomFormatSubmit();
                        } else if (e.key === 'Escape') {
                          setIsEditingCustomFormat(false);
                          setCustomFormat('');
                        }
                      }}
                      onBlur={handleCustomFormatSubmit}
                      className="glass-card px-3 py-2 rounded-xl text-white text-xs bg-transparent border border-white/20 focus:border-white/40 focus:outline-none uppercase"
                      placeholder="EXT"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => setIsEditingCustomFormat(true)}
                      disabled={processing}
                      className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50"
                    >
                      Other
                    </button>
                  )}
                </div>
              </div>
            )}
            </div>
          )}

          {/* Compress & Optimize */}
          {(!expandedCard || expandedCard === 'compress') && (
            <div>
              <button
                onClick={() => toggleCard('compress')}
                className="w-full text-left text-white font-semibold flex items-center justify-between gap-2 py-2 hover:text-white/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Compress & Optimize
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
                    expandedCard === 'compress' ? 'rotate-180' : ''
                  }`}
                />
              </button>

            {expandedCard === 'compress' && (
              <div className="mt-4 space-y-4">
                <CompressionSlider
                  value={compressionLevel}
                  onChange={handleCompressionLevelChange}
                  disabled={processing}
                />

                <div className="space-y-2">
                  <label className="text-xs text-white/70 uppercase tracking-wide">
                    Output Format
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['jpg', 'png', 'webp'].map((format) => (
                      <button
                        key={format}
                        onClick={() => handleCompressionFormatChange(format)}
                        disabled={processing}
                        className={`glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50 uppercase ${
                          compressionFormat === format
                            ? 'bg-blue-500/30 border border-blue-400/50'
                            : ''
                        }`}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>

                <FileSizeComparison
                  originalSize={metadata?.file_size || 0}
                  estimatedSize={estimatedSize}
                  isEstimating={isEstimating}
                />

                <button
                  onClick={handleCompress}
                  disabled={processing || !metadata}
                  className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 disabled:opacity-50 hover:scale-105 bg-blue-500/30"
                >
                  Compress & Save
                </button>
              </div>
            )}
            </div>
          )}

          {/* Metadata */}
          {(!expandedCard || expandedCard === 'privacy-metadata') && (
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
              <div className="mt-4 space-y-3">
                {metadata && (
                  <>
                    <div className="space-y-1 text-xs">
                      {getBasicMetadataEntries().map((entry: { key: string; value: string }, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-white/60">{entry.key}:</span>
                          <span className="text-white text-right max-w-[60%] truncate" title={entry.value}>
                            {entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    {hasExtendedMetadata() && (
                      <button
                        onClick={handleOpenMetadataDetail}
                        className="w-full glass-card px-3 py-2 rounded-xl text-white/80 text-xs transition-all duration-300 hover:text-white hover:scale-105 flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Extended Metadata
                      </button>
                    )}
                    <button
                      onClick={handleStripMetadata}
                      disabled={processing}
                      className="w-full glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50"
                    >
                      Strip Metadata
                    </button>
                  </>
                )}
              </div>
            )}
            </div>
          )}

          {/* Toast Notification */}
          {toast && (
            <div 
              className="fixed bottom-6 left-6 z-50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
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
