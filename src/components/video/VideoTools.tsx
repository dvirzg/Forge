import { Scissors, Volume2, Maximize2, FileImage } from 'lucide-react';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { ActionButton } from '../shared/ActionButton';
import { MetadataSection } from '../shared/MetadataSection';
import { VIDEO_RESOLUTIONS } from '../../constants/processor';

interface VideoToolsProps {
  expandedCard: string | null;
  onToggleCard: (cardId: string) => void;
  processing: boolean;
  startTime: string;
  endTime: string;
  width: number;
  height: number;
  fps: number;
  gifWidth: number;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
  onFpsChange: (fps: number) => void;
  onGifWidthChange: (width: number) => void;
  onTrim: () => void;
  onStripAudio: () => void;
  onScale: () => void;
  onVideoToGif: () => void;
  metadata: {
    file_size: number;
    file_created?: string;
    file_modified?: string;
    all_metadata: Record<string, string>;
  } | null;
  fileName: string;
  getBasicMetadataEntries: () => Array<{ key: string; value: string }>;
  getAllMetadataEntries: () => Array<{ key: string; value: string }>;
  hasExtendedMetadata: () => boolean;
}

export function VideoTools({
  expandedCard,
  onToggleCard,
  processing,
  startTime,
  endTime,
  width,
  height,
  fps,
  gifWidth,
  onStartTimeChange,
  onEndTimeChange,
  onWidthChange,
  onHeightChange,
  onFpsChange,
  onGifWidthChange,
  onTrim,
  onStripAudio,
  onScale,
  onVideoToGif,
  metadata,
  fileName,
  getBasicMetadataEntries,
  getAllMetadataEntries,
  hasExtendedMetadata,
}: VideoToolsProps) {
  return (
    <>
      {/* Trim */}
      <CollapsibleSection
        id="trim"
        title="Trim Video"
        icon={Scissors}
        isExpanded={expandedCard === 'trim'}
        onToggle={onToggleCard}
      >
        <div className="space-y-3">
          <div>
            <label className="text-white/60 text-sm mb-1 block">Start Time (HH:MM:SS)</label>
            <input
              type="text"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
              placeholder="00:00:00"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm mb-1 block">End Time (HH:MM:SS)</label>
            <input
              type="text"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
              className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
              placeholder="00:00:10"
            />
          </div>
          <ActionButton onClick={onTrim} disabled={processing} className="w-full">
            Trim
          </ActionButton>
        </div>
      </CollapsibleSection>

      {/* Audio */}
      <CollapsibleSection
        id="audio"
        title="Audio"
        icon={Volume2}
        isExpanded={expandedCard === 'audio'}
        onToggle={onToggleCard}
      >
        <ActionButton onClick={onStripAudio} disabled={processing} className="w-full">
          Remove Audio
        </ActionButton>
      </CollapsibleSection>

      {/* Scale */}
      <CollapsibleSection
        id="scale"
        title="Scale Resolution"
        icon={Maximize2}
        isExpanded={expandedCard === 'scale'}
        onToggle={onToggleCard}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/60 text-sm mb-1 block">Width</label>
              <input
                type="number"
                value={width}
                onChange={(e) => onWidthChange(parseInt(e.target.value))}
                className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
              />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Height</label>
              <input
                type="number"
                value={height}
                onChange={(e) => onHeightChange(parseInt(e.target.value))}
                className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ActionButton
              onClick={() => {
                onWidthChange(VIDEO_RESOLUTIONS['1080p'].width);
                onHeightChange(VIDEO_RESOLUTIONS['1080p'].height);
              }}
              className="px-3 py-2 rounded-xl text-xs"
            >
              1080p
            </ActionButton>
            <ActionButton
              onClick={() => {
                onWidthChange(VIDEO_RESOLUTIONS['720p'].width);
                onHeightChange(VIDEO_RESOLUTIONS['720p'].height);
              }}
              className="px-3 py-2 rounded-xl text-xs"
            >
              720p
            </ActionButton>
            <ActionButton
              onClick={() => {
                onWidthChange(VIDEO_RESOLUTIONS['480p'].width);
                onHeightChange(VIDEO_RESOLUTIONS['480p'].height);
              }}
              className="px-3 py-2 rounded-xl text-xs"
            >
              480p
            </ActionButton>
          </div>
          <ActionButton onClick={onScale} disabled={processing} className="w-full">
            Scale
          </ActionButton>
        </div>
      </CollapsibleSection>

      {/* GIF Conversion */}
      <CollapsibleSection
        id="gif"
        title="Convert to GIF"
        icon={FileImage}
        isExpanded={expandedCard === 'gif'}
        onToggle={onToggleCard}
      >
        <div className="space-y-3">
          <div>
            <label className="text-white/60 text-sm mb-1 block">FPS</label>
            <input
              type="number"
              value={fps}
              onChange={(e) => onFpsChange(parseInt(e.target.value))}
              className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
              min="1"
              max="30"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm mb-1 block">Width</label>
            <input
              type="number"
              value={gifWidth}
              onChange={(e) => onGifWidthChange(parseInt(e.target.value))}
              className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
            />
          </div>
          <ActionButton onClick={onVideoToGif} disabled={processing} className="w-full">
            Convert to GIF
          </ActionButton>
        </div>
      </CollapsibleSection>

      {/* Metadata */}
      <MetadataSection
        sectionId="metadata"
        isExpanded={expandedCard === 'metadata'}
        onToggle={onToggleCard}
        metadata={metadata ? getBasicMetadataEntries() : null}
        displayFileName={fileName}
        getBasicEntries={getBasicMetadataEntries}
        getAllEntries={getAllMetadataEntries}
        hasExtendedMetadata={hasExtendedMetadata}
      />
    </>
  );
}
