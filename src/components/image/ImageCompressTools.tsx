import { Gauge } from 'lucide-react';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { CompressionSlider } from '../shared/CompressionSlider';
import { FileSizeComparison } from '../shared/FileSizeComparison';

interface ImageCompressToolsProps {
  expandedCard: string | null;
  onToggleCard: (cardId: string) => void;
  processing: boolean;
  compressionLevel: number;
  compressionFormat: string;
  estimatedSize: number | null;
  isEstimating: boolean;
  originalSize: number;
  metadataAvailable: boolean;
  onCompressionLevelChange: (level: number) => void;
  onCompressionFormatChange: (format: string) => void;
  onCompress: () => void;
}

export function ImageCompressTools({
  expandedCard,
  onToggleCard,
  processing,
  compressionLevel,
  compressionFormat,
  estimatedSize,
  isEstimating,
  originalSize,
  metadataAvailable,
  onCompressionLevelChange,
  onCompressionFormatChange,
  onCompress,
}: ImageCompressToolsProps) {
  return (
    <CollapsibleSection
      id="compress"
      title="Compress & Optimize"
      icon={Gauge}
      isExpanded={expandedCard === 'compress'}
      onToggle={onToggleCard}
    >
      <div className="mt-4 space-y-4">
        <CompressionSlider
          value={compressionLevel}
          onChange={onCompressionLevelChange}
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
                onClick={() => onCompressionFormatChange(format)}
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
          originalSize={originalSize}
          estimatedSize={estimatedSize}
          isEstimating={isEstimating}
        />

        <button
          onClick={onCompress}
          disabled={processing || !metadataAvailable}
          className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 disabled:opacity-50 hover:scale-105 bg-blue-500/30"
        >
          Compress & Save
        </button>
      </div>
    </CollapsibleSection>
  );
}
