import { useRef } from 'react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { Check, X } from 'lucide-react';

interface ImagePreviewProps {
  imageSrc: string;
  imageLoading: boolean;
  imageError: boolean;
  filePath: string;
  isCropping: boolean;
  cropperRef: React.RefObject<HTMLImageElement>;
  processing: boolean;
  onCrop: () => void;
  onCancelCrop: () => void;
  onImageError: () => void;
}

export function ImagePreview({
  imageSrc,
  imageLoading,
  imageError,
  filePath,
  isCropping,
  cropperRef,
  processing,
  onCrop,
  onCancelCrop,
  onImageError,
}: ImagePreviewProps) {
  if (imageLoading) {
    return (
      <div className="text-white/60 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
        <p className="text-sm">Loading image...</p>
      </div>
    );
  }

  if (imageError) {
    return (
      <div className="text-white/60 text-center">
        <p className="text-sm mb-2">Failed to load image</p>
        <p className="text-xs text-white/40">{filePath}</p>
      </div>
    );
  }

  if (isCropping) {
    return (
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
                
                const minCanvasWidth = imageData.naturalWidth;
                const minCanvasHeight = imageData.naturalHeight;
                
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
                
                const minZoomRatio = Math.min(
                  containerData.width / imageData.naturalWidth,
                  containerData.height / imageData.naturalHeight
                );
                
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
            onClick={onCrop}
            disabled={processing}
            className="glass-card p-2 rounded-lg text-white transition-all duration-300 disabled:opacity-50 hover:scale-105 bg-green-500/30 shadow-lg"
            title="Apply Crop"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onCancelCrop}
            disabled={processing}
            className="glass-card p-2 rounded-lg text-white transition-all duration-300 disabled:opacity-50 hover:scale-105 shadow-lg"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt="Preview"
      className="max-w-full max-h-full object-contain rounded-2xl"
      onError={onImageError}
    />
  );
}
