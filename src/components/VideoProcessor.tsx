import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { FileImage } from 'lucide-react';
import { Header } from './shared/Header';
import { MetadataDetailModal } from './shared/MetadataDetailModal';
import { Toast } from './shared/Toast';
import { ProcessorLayout } from './shared/ProcessorLayout';
import { VideoTools } from './video/VideoTools';
import { useToast } from '../hooks/useToast';
import { useProcessing } from '../hooks/useProcessing';
import { useMetadata } from '../hooks/useMetadata';
import { formatFileSize } from '../utils/fileUtils';
import { generateOutputFileName } from '../utils/pathUtils';
import { useFileSave } from '../hooks/useFileSave';
import { VIDEO_DEFAULTS } from '../constants/processor';
import { BaseProcessorProps } from '../types/processor';

interface VideoProcessorProps extends BaseProcessorProps {}

interface VideoMetadata {
  file_size: number;
  file_created?: string;
  file_modified?: string;
  all_metadata: Record<string, string>;
}

function VideoProcessor({ file, onReset }: VideoProcessorProps) {
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:10');
  const [width, setWidth] = useState(VIDEO_DEFAULTS.WIDTH);
  const [height, setHeight] = useState(VIDEO_DEFAULTS.HEIGHT);
  const [fps, setFps] = useState(VIDEO_DEFAULTS.FPS);
  const [gifWidth, setGifWidth] = useState(VIDEO_DEFAULTS.GIF_WIDTH);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showMetadataDetail, setShowMetadataDetail] = useState(false);
  const { toast, showToast } = useToast();
  const { processing, withProcessing } = useProcessing();
  const saveFile = useFileSave();

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
        const outputPath = await saveFile(
          generateOutputFileName(file.name, '_trimmed', 'mp4'),
          [{ name: 'Video', extensions: ['mp4', 'mov', 'avi'] }]
        );

        if (!outputPath) {
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
        const outputPath = await saveFile(
          generateOutputFileName(file.name, '_no_audio', 'mp4'),
          [{ name: 'Video', extensions: ['mp4', 'mov', 'avi'] }]
        );

        if (!outputPath) {
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
        const outputPath = await saveFile(
          generateOutputFileName(file.name, `_${width}x${height}`, 'mp4'),
          [{ name: 'Video', extensions: ['mp4', 'mov', 'avi'] }]
        );

        if (!outputPath) {
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
        const outputPath = await saveFile(
          generateOutputFileName(file.name, '', 'gif'),
          [{ name: 'GIF', extensions: ['gif'] }]
        );

        if (!outputPath) {
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

  const { getBasicMetadataEntries, getAllMetadataEntries, hasExtendedMetadata } = useMetadata({
    metadata,
    getBasicEntries: (meta) => {
      const entries = [];
      entries.push({ key: 'File Size', value: formatFileSize(meta.file_size) });
      if (meta.file_created) entries.push({ key: 'File Created', value: meta.file_created });
      if (meta.file_modified) entries.push({ key: 'File Modified', value: meta.file_modified });
      return entries;
    },
    getExtendedEntries: (meta) => {
      return Object.entries(meta.all_metadata).map(([key, value]) => ({ key, value }));
    },
  });

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Video/Audio Processing"
        fileName={file.name}
        onBack={onReset}
      />

      <ProcessorLayout
        layout="grid-2"
        expandedCard={expandedCard}
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
          <VideoTools
            expandedCard={expandedCard}
            onToggleCard={toggleCard}
            processing={processing}
            startTime={startTime}
            endTime={endTime}
            width={width}
            height={height}
            fps={fps}
            gifWidth={gifWidth}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            onWidthChange={setWidth}
            onHeightChange={setHeight}
            onFpsChange={setFps}
            onGifWidthChange={setGifWidth}
            onTrim={handleTrim}
            onStripAudio={handleStripAudio}
            onScale={handleScale}
            onVideoToGif={handleVideoToGif}
            metadata={metadata}
            fileName={file.name}
            getBasicMetadataEntries={getBasicMetadataEntries}
            getAllMetadataEntries={getAllMetadataEntries}
            hasExtendedMetadata={hasExtendedMetadata}
          />
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
