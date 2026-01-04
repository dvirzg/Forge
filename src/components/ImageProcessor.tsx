import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { readBinaryFile, writeBinaryFile, renameFile } from '@tauri-apps/api/fs';
import { join, dirname } from '@tauri-apps/api/path';
import {
  Save,
  FileDown,
  RotateCcw,
} from 'lucide-react';
import { Header } from './shared/Header';
import { MetadataDetailModal } from './shared/MetadataDetailModal';
import { MetadataSection } from './shared/MetadataSection';
import { ProcessorLayout } from './shared/ProcessorLayout';
import { Toast } from './shared/Toast';
import { useToast } from '../hooks/useToast';
import { useProcessing } from '../hooks/useProcessing';
import { useFileSave } from '../hooks/useFileSave';
import { useMetadata } from '../hooks/useMetadata';
import { useImageTransform } from '../hooks/useImageTransform';
import { loadImageAsDataUrl } from '../utils/fileLoaders';
import { formatFileSize } from '../utils/fileUtils';
import { generateOutputFileName, getFileName } from '../utils/pathUtils';
import { BaseProcessorProps } from '../types/processor';
import { ImagePreview } from './image/ImagePreview';
import { ImageAITools } from './image/ImageAITools';
import { ImageTransformTools } from './image/ImageTransformTools';
import { ImageConvertTools } from './image/ImageConvertTools';
import { ImageCompressTools } from './image/ImageCompressTools';

interface ImageProcessorProps extends BaseProcessorProps {}

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
  const saveFile = useFileSave();
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

      const outputPath = await saveFile(
        generateOutputFileName(file.name, '_no_bg', 'png'),
        [{ name: 'Image', extensions: ['png'] }]
      );

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
        outputPath = await saveFile(
          generateOutputFileName(file.name, '_transformed', 'png'),
          [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
        );

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

      const outputPath = await saveFile(
        generateOutputFileName(file.name, '', format),
        [{ name: 'Image', extensions: [format] }]
      );

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
      setDisplayFileName(getFileName(result.output_path) || displayFileName);

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

  const { getBasicMetadataEntries, getAllMetadataEntries, hasExtendedMetadata } = useMetadata({
    metadata,
    getBasicEntries: (meta) => {
      const entries = [];
      entries.push({ key: 'Width', value: `${meta.width}px` });
      entries.push({ key: 'Height', value: `${meta.height}px` });
      entries.push({ key: 'Format', value: meta.format });
      entries.push({ key: 'Color Type', value: meta.color_type });
      if (meta.bit_depth) entries.push({ key: 'Bit Depth', value: meta.bit_depth });
      entries.push({ key: 'Has Alpha', value: meta.has_alpha ? 'Yes' : 'No' });
      entries.push({ key: 'File Size', value: formatFileSize(meta.file_size) });
      if (meta.file_created) entries.push({ key: 'Created', value: meta.file_created });
      if (meta.file_modified) entries.push({ key: 'Modified', value: meta.file_modified });
      return entries;
    },
    getExtendedEntries: (meta) => {
      return [
        ...Object.entries(meta.exif).map(([key, value]) => ({ key: `EXIF: ${key}`, value })),
        ...Object.entries(meta.iptc).map(([key, value]) => ({ key: `IPTC: ${key}`, value })),
        ...Object.entries(meta.xmp).map(([key, value]) => ({ key: `XMP: ${key}`, value })),
      ];
    },
  });

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

      <ProcessorLayout
        layout="flex"
        sidebarWidth="large"
        expandedCard={expandedCard}
        preview={
          <div className="rounded-3xl p-6 flex items-center justify-center min-w-0 relative" style={{ overflow: isCropping ? 'visible' : 'hidden' }}>
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
        }
        sidebar={
          <>
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
            <MetadataSection
              sectionId="privacy-metadata"
              isExpanded={expandedCard === 'privacy-metadata'}
              onToggle={toggleCard}
              metadata={metadata ? getBasicMetadataEntries() : null}
              displayFileName={displayFileName}
              getBasicEntries={getBasicMetadataEntries}
              getAllEntries={getAllMetadataEntries}
              hasExtendedMetadata={hasExtendedMetadata}
              onStripMetadata={handleStripMetadata}
              processing={processing}
            />
          </>
        }
      />

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
