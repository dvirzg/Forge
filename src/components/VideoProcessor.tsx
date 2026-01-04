import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { Scissors, Volume2, Maximize2, FileImage, Trash2, ExternalLink } from 'lucide-react';
import { Header } from './shared/Header';
import { CollapsibleSection } from './shared/CollapsibleSection';
import { ActionButton } from './shared/ActionButton';
import { MetadataDetailModal } from './shared/MetadataDetailModal';
import { Toast } from './shared/Toast';
import { useToast } from '../hooks/useToast';
import { useProcessing } from '../hooks/useProcessing';
import { formatFileSize } from '../utils/fileUtils';
import { ProcessorLayout } from './shared/ProcessorLayout';

interface VideoProcessorProps {
  file: {
    path: string;
    name: string;
  };
  onReset: () => void;
}

interface VideoMetadata {
  file_size: number;
  file_created?: string;
  file_modified?: string;
  all_metadata: Record<string, string>;
}

function VideoProcessor({ file, onReset }: VideoProcessorProps) {
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:10');
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [fps, setFps] = useState(10);
  const [gifWidth, setGifWidth] = useState(480);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showMetadataDetail, setShowMetadataDetail] = useState(false);
  const { toast, showToast } = useToast();
  const { processing, withProcessing } = useProcessing();

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const meta = await invoke<VideoMetadata>('get_video_metadata', {
          inputPath: file.path,
        });
        setMetadata(meta);
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      }
    };
    fetchMetadata();
  }, [file.path]);

  const handleTrim = async () => {
    await withProcessing(
      async () => {
        showToast('Trimming video...');
        const outputPath = await save({
          defaultPath: file.name.replace(/\.[^/.]+$/, '_trimmed.mp4'),
          filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi'] }],
        });

        if (!outputPath) {
          showToast('Operation cancelled');
          return;
        }

        const result = await invoke<string>('trim_video', {
          inputPath: file.path,
          outputPath,
          startTime,
          endTime,
        });

        showToast(result);
      },
      (error) => showToast(`Error: ${error}`)
    );
  };

  const handleStripAudio = async () => {
    await withProcessing(
      async () => {
        showToast('Removing audio...');
        const outputPath = await save({
          defaultPath: file.name.replace(/\.[^/.]+$/, '_no_audio.mp4'),
          filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi'] }],
        });

        if (!outputPath) {
          showToast('Operation cancelled');
          return;
        }

        const result = await invoke<string>('strip_audio', {
          inputPath: file.path,
          outputPath,
        });

        showToast(result);
      },
      (error) => showToast(`Error: ${error}`)
    );
  };

  const handleScale = async () => {
    await withProcessing(
      async () => {
        showToast(`Scaling to ${width}x${height}...`);
        const outputPath = await save({
          defaultPath: file.name.replace(/\.[^/.]+$/, `_${width}x${height}.mp4`),
          filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi'] }],
        });

        if (!outputPath) {
          showToast('Operation cancelled');
          return;
        }

        const result = await invoke<string>('scale_video', {
          inputPath: file.path,
          outputPath,
          width,
          height,
        });

        showToast(result);
      },
      (error) => showToast(`Error: ${error}`)
    );
  };

  const handleVideoToGif = async () => {
    await withProcessing(
      async () => {
        showToast('Converting to GIF...');
        const outputPath = await save({
          defaultPath: file.name.replace(/\.[^/.]+$/, '.gif'),
          filters: [{ name: 'GIF', extensions: ['gif'] }],
        });

        if (!outputPath) {
          showToast('Operation cancelled');
          return;
        }

        const result = await invoke<string>('video_to_gif', {
          inputPath: file.path,
          outputPath,
          fps,
          width: gifWidth,
        });

        showToast(result);
      },
      (error) => showToast(`Error: ${error}`)
    );
  };

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const getBasicMetadataEntries = (): Array<{ key: string; value: string }> => {
    if (!metadata) return [];
    
    const entries: Array<{ key: string; value: string }> = [];
    entries.push({ key: 'File Size', value: formatFileSize(metadata.file_size) });
    if (metadata.file_created) entries.push({ key: 'File Created', value: metadata.file_created });
    if (metadata.file_modified) entries.push({ key: 'File Modified', value: metadata.file_modified });
    
    return entries;
  };

  const getAllMetadataEntries = (): Array<{ key: string; value: string }> => {
    if (!metadata) return [];
    
    const entries = getBasicMetadataEntries();
    // Dynamically include all video metadata from FFprobe
    Object.entries(metadata.all_metadata).forEach(([key, value]) => {
      entries.push({ key, value });
    });
    
    return entries;
  };

  const hasExtendedMetadata = (): boolean => {
    if (!metadata) return false;
    return Object.keys(metadata.all_metadata).length > 0;
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Video/Audio Processing"
        fileName={file.name}
        onBack={onReset}
      />

      <ProcessorLayout
        layout="grid-2"
        preview={
          <div className="glass-card rounded-3xl p-6 flex items-center justify-center w-full h-full">
            <div className="text-center">
              <FileImage className="w-24 h-24 text-white/20 mx-auto mb-4" />
              <p className="text-white/60 mb-2">Video Preview</p>
              <p className="text-white/40 text-sm">FFmpeg processing ready</p>
            </div>
          </div>
        }
        sidebar={
          <>
            {/* Trim */}
            <CollapsibleSection
              id="trim"
              title="Trim Video"
              icon={Scissors}
              isExpanded={expandedCard === 'trim'}
              onToggle={toggleCard}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Start Time (HH:MM:SS)</label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
                    placeholder="00:00:00"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">End Time (HH:MM:SS)</label>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
                    placeholder="00:00:10"
                  />
                </div>
                <ActionButton onClick={handleTrim} disabled={processing} className="w-full">
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
              onToggle={toggleCard}
            >
              <ActionButton onClick={handleStripAudio} disabled={processing} className="w-full">
                Remove Audio
              </ActionButton>
            </CollapsibleSection>

            {/* Scale */}
            <CollapsibleSection
              id="scale"
              title="Scale Resolution"
              icon={Maximize2}
              isExpanded={expandedCard === 'scale'}
              onToggle={toggleCard}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/60 text-sm mb-1 block">Width</label>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(parseInt(e.target.value))}
                      className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm mb-1 block">Height</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(parseInt(e.target.value))}
                      className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ActionButton
                    onClick={() => {
                      setWidth(1920);
                      setHeight(1080);
                    }}
                    className="px-3 py-2 rounded-xl text-xs"
                  >
                    1080p
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      setWidth(1280);
                      setHeight(720);
                    }}
                    className="px-3 py-2 rounded-xl text-xs"
                  >
                    720p
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      setWidth(854);
                      setHeight(480);
                    }}
                    className="px-3 py-2 rounded-xl text-xs"
                  >
                    480p
                  </ActionButton>
                </div>
                <ActionButton onClick={handleScale} disabled={processing} className="w-full">
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
              onToggle={toggleCard}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-white/60 text-sm mb-1 block">FPS</label>
                  <input
                    type="number"
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value))}
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
                    onChange={(e) => setGifWidth(parseInt(e.target.value))}
                    className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
                  />
                </div>
                <ActionButton onClick={handleVideoToGif} disabled={processing} className="w-full">
                  Convert to GIF
                </ActionButton>
              </div>
            </CollapsibleSection>

            {/* Metadata */}
            <CollapsibleSection
              id="metadata"
              title="Metadata"
              icon={Trash2}
              isExpanded={expandedCard === 'metadata'}
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
                        View All {getAllMetadataEntries().length} Properties
                      </ActionButton>
                    )}
                  </>
                )}
              </div>
            </CollapsibleSection>
          </>
        }
      />

      {/* Metadata Detail Modal */}
      <MetadataDetailModal
        isOpen={showMetadataDetail}
        onClose={() => setShowMetadataDetail(false)}
        entries={getAllMetadataEntries()}
        title={`Metadata - ${file.name}`}
      />

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} id={toast.id} />}
    </div>
  );
}

export default VideoProcessor;
