import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { readBinaryFile, writeBinaryFile, renameFile } from '@tauri-apps/api/fs';
import { join, dirname } from '@tauri-apps/api/path';
import {
  Save,
  FileDown,
  RotateCcw,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Header } from './shared/Header';
import { CollapsibleSection } from './shared/CollapsibleSection';
import { ActionButton } from './shared/ActionButton';
import { MetadataDetailModal } from './shared/MetadataDetailModal';
import { Toast } from './shared/Toast';
import { useToast } from '../hooks/useToast';
import { useProcessing } from '../hooks/useProcessing';
import { useImageTransform } from '../hooks/useImageTransform';
import { loadImageAsDataUrl } from '../utils/fileLoaders';
import { formatFileSize } from '../utils/fileUtils';
import { ImagePreview } from './image/ImagePreview';
import { ImageAITools } from './image/ImageAITools';
import { ImageTransformTools } from './image/ImageTransformTools';
import { ImageConvertTools } from './image/ImageConvertTools';
import { ImageCompressTools } from './image/ImageCompressTools';

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
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const { toast, showToast } = useToast();
  const { processing, withProcessing } = useProcessing();
  const {
    transformedImageData,
    currentWorkingPath,
    tempFilePath,
    hasUnsavedChanges,
    setTransformedImageData,
    setHasUnsavedChanges,
    setCurrentWorkingPath,
    applyTransformation,
    cleanup,
    reset: resetTransform,
  } = useImageTransform();

  const [modelAvailable, setModelAvailable] = useState<boolean | null>(null);
  const [downloadingModel, setDownloadingModel] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editedFileName, setEditedFileName] = useState<string>('');
  const [displayFileName, setDisplayFileName] = useState<string>(file.name);
  const [currentFilePath, setCurrentFilePath] = useState<string>(file.path);
  const [isCropping, setIsCropping] = useState(false);
  const cropperRef = useRef<HTMLImageElement>(null);
  const [isEditingCustomFormat, setIsEditingCustomFormat] = useState(false);
  const [customFormat, setCustomFormat] = useState('');

  // Compression state
  const [compressionLevel, setCompressionLevel] = useState(2);
  const [compressionFormat, setCompressionFormat] = useState('jpg');
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [showMetadataDetail, setShowMetadataDetail] = useState(false);

  // Load image as base64
  useEffect(() => {
    const loadImage = async () => {
      setImageLoading(true);
      setImageError(false);
      try {
        const dataUrl = await loadImageAsDataUrl(currentFilePath);
        setImageSrc(dataUrl);
        setImageLoading(false);
        setTransformedImageData(null);
        setHasUnsavedChanges(false);
        setDisplayFileName(file.name);
        setCurrentFilePath(file.path);
        setIsCropping(false);
        
        // Clean up any existing temp file
        await cleanup(tempFilePath, currentFilePath);
        resetTransform();
      } catch (error) {
        console.error('Failed to load image:', error);
        setImageError(true);
        setImageLoading(false);
      }
    };

    loadImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    await withProcessing(async () => {
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
    }, (error) => {
      showToast(`Error: ${error}`);
    });
  };

  const handleRotate = async (degrees: number) => {
    await withProcessing(async () => {
      const inputPath = currentWorkingPath || currentFilePath;
      const imageBytes = await invoke<number[]>('rotate_image_preview', {
        inputPath,
        degrees,
      });

      const { dataUrl } = await applyTransformation(imageBytes, currentFilePath, tempFilePath);
      setImageSrc(dataUrl);
    }, (error) => {
      showToast(`Error: ${error}`);
    });
  };

  const handleFlip = async (direction: 'horizontal' | 'vertical') => {
    await withProcessing(async () => {
      const inputPath = currentWorkingPath || currentFilePath;
      const imageBytes = await invoke<number[]>('flip_image_preview', {
        inputPath,
        direction,
      });

      const { dataUrl } = await applyTransformation(imageBytes, currentFilePath, tempFilePath);
      setImageSrc(dataUrl);
    }, (error) => {
      showToast(`Error: ${error}`);
    });
  };

  const handleCrop = async () => {
    const imageElement = cropperRef?.current;
    const cropper = (imageElement as any)?.cropper;

    if (!cropper || !metadata) return;

    await withProcessing(async () => {
      showToast('Cropping image...');

      const cropData = cropper.getData(true);
      const imageData = cropper.getImageData();

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

      const { dataUrl } = await applyTransformation(imageBytes, currentFilePath, tempFilePath);
      setImageSrc(dataUrl);
      setIsCropping(false);
      showToast('Image cropped');
    }, (error) => {
      showToast(`Error: ${error}`);
    });
  };

  const cancelCrop = () => {
    setIsCropping(false);
  };

  const initializeCrop = () => {
    setIsCropping(true);
  };

  const handleSave = async (overwriteOriginal: boolean = false) => {
    if (!transformedImageData) return;

    await withProcessing(async () => {
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
          return;
        }
      }

      await writeBinaryFile(outputPath, transformedImageData);
      
      setHasUnsavedChanges(false);
      showToast('Saved successfully');
      
      await cleanup(tempFilePath, currentFilePath);
      
      if (overwriteOriginal) {
        const imageData = await readBinaryFile(currentFilePath);
        const blob = new Blob([imageData as BlobPart]);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageSrc(reader.result as string);
        };
        reader.readAsDataURL(blob);
        setTransformedImageData(null);
        resetTransform();
      } else {
        resetTransform();
      }
    }, (error) => {
      showToast(`Error saving: ${error}`);
    });
  };

  const handleRevert = async () => {
    await withProcessing(async () => {
      await cleanup(tempFilePath, currentFilePath);
      
      const imageData = await readBinaryFile(file.path);
      const blob = new Blob([imageData as BlobPart]);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(blob);
      
      resetTransform();
    }, (error) => {
      showToast(`Error: ${error}`);
    });
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
    await withProcessing(async () => {
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
    }, (error) => {
      const errorMsg = String(error);
      if (errorMsg.includes('Unsupported format') || errorMsg.includes('incompatible')) {
        showToast(`Incompatible format: ${format.toUpperCase()}`);
      } else {
        showToast(`Error: ${error}`);
      }
    });
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
    await withProcessing(async () => {
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

      setCurrentFilePath(result.output_path);
      setCurrentWorkingPath(result.output_path);
      setDisplayFileName(result.output_path.split('/').pop() || displayFileName);

      const newMetadata = await invoke<ImageMetadata>('get_image_metadata', {
        inputPath: result.output_path,
      });
      setMetadata(newMetadata);

      setEstimatedSize(null);
    }, (error) => {
      showToast(`Compression failed: ${error}`);
    });
  };

  const handleStripMetadata = async () => {
    await withProcessing(async () => {
      showToast('Stripping metadata...');

      const inputPath = currentWorkingPath || currentFilePath;
      const imageBytes = await invoke<number[]>('strip_metadata_preview', {
        inputPath,
      });

      const { dataUrl, tempPath } = await applyTransformation(imageBytes, currentFilePath, tempFilePath);
      setImageSrc(dataUrl);
      
      const strippedMetadata = await invoke<ImageMetadata>('get_image_metadata', {
        inputPath: tempPath,
      });
      setMetadata(strippedMetadata);
      
      showToast('Metadata stripped');
    }, (error) => {
      showToast(`Error: ${error}`);
    });
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

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Image Processing"
        fileName={displayFileName}
        onBack={onReset}
        isRenaming={isRenaming}
        editedFileName={editedFileName}
        onFileNameChange={setEditedFileName}
        onRenameSave={handleRenameSave}
        onRenameCancel={() => {
          setIsRenaming(false);
          setEditedFileName(displayFileName);
        }}
        onFileNameDoubleClick={() => {
          setIsRenaming(true);
          setEditedFileName(displayFileName);
        }}
        rightContent={
          hasUnsavedChanges && (
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
          )
        }
      />

      <div className="flex-1 flex gap-6 min-h-0 items-start">
        {/* Preview */}
        <div className="flex-1 rounded-3xl p-6 flex items-center justify-center min-w-0 relative" style={{ overflow: isCropping ? 'visible' : 'hidden' }}>
          <ImagePreview
            imageSrc={imageSrc}
            imageLoading={imageLoading}
            imageError={imageError}
            filePath={file.path}
            isCropping={isCropping}
            cropperRef={cropperRef}
            processing={processing}
            onCrop={handleCrop}
            onCancelCrop={cancelCrop}
            onImageError={() => setImageError(true)}
          />
        </div>

        {/* Controls */}
        <div className="w-80 flex flex-col gap-4 overflow-y-auto overflow-x-visible flex-shrink-0 pt-6 pb-6 px-1">
          {/* AI Tools */}
          <ImageAITools
            expandedCard={expandedCard}
            onToggleCard={toggleCard}
            modelAvailable={modelAvailable}
            downloadingModel={downloadingModel}
            processing={processing}
            onDownloadModel={handleDownloadModel}
            onRemoveBackground={handleRemoveBackground}
          />

          {/* Transform */}
          <ImageTransformTools
            expandedCard={expandedCard}
            onToggleCard={toggleCard}
            processing={processing}
            isCropping={isCropping}
            onRotate={handleRotate}
            onFlip={handleFlip}
            onInitializeCrop={initializeCrop}
          />

          {/* Convert */}
          <ImageConvertTools
            expandedCard={expandedCard}
            onToggleCard={toggleCard}
            processing={processing}
            isEditingCustomFormat={isEditingCustomFormat}
            customFormat={customFormat}
            onFormatChange={handleConvert}
            onCustomFormatChange={setCustomFormat}
            onCustomFormatSubmit={handleCustomFormatSubmit}
            onStartEditingCustomFormat={() => setIsEditingCustomFormat(true)}
            onCancelEditingCustomFormat={() => {
              setIsEditingCustomFormat(false);
              setCustomFormat('');
            }}
          />

          {/* Compress & Optimize */}
          <ImageCompressTools
            expandedCard={expandedCard}
            onToggleCard={toggleCard}
            processing={processing}
            compressionLevel={compressionLevel}
            compressionFormat={compressionFormat}
            estimatedSize={estimatedSize}
            isEstimating={isEstimating}
            originalSize={metadata?.file_size || 0}
            metadataAvailable={!!metadata}
            onCompressionLevelChange={handleCompressionLevelChange}
            onCompressionFormatChange={handleCompressionFormatChange}
            onCompress={handleCompress}
          />

          {/* Metadata */}
          <CollapsibleSection
            id="privacy-metadata"
            title="Metadata"
            icon={Trash2}
            isExpanded={expandedCard === 'privacy-metadata'}
            onToggle={toggleCard}
          >
            <div className="space-y-3">
              {metadata && (
                <>
                  <div className="space-y-1 text-xs">
                    {getBasicMetadataEntries().map((entry, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-white/60">{entry.key}:</span>
                        <span className="text-white text-right max-w-[60%] truncate" title={entry.value}>
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {hasExtendedMetadata() && (
                    <ActionButton
                      onClick={() => setShowMetadataDetail(true)}
                      className="w-full px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-2 text-white/80 hover:text-white"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Extended Metadata
                    </ActionButton>
                  )}
                  <ActionButton
                    onClick={handleStripMetadata}
                    disabled={processing}
                    className="w-full px-3 py-2 rounded-xl text-xs"
                  >
                    Strip Metadata
                  </ActionButton>
                </>
              )}
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* Metadata Detail Modal */}
      <MetadataDetailModal
        isOpen={showMetadataDetail}
        onClose={() => setShowMetadataDetail(false)}
        entries={getAllMetadataEntries()}
        title={`Metadata - ${displayFileName}`}
      />

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} id={toast.id} />}
    </div>
  );
}

export default ImageProcessor;
