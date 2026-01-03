import { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { Scissors, Volume2, Maximize2, FileImage, ArrowLeft } from 'lucide-react';

interface VideoProcessorProps {
  file: {
    path: string;
    name: string;
  };
  onReset: () => void;
}

function VideoProcessor({ file, onReset }: VideoProcessorProps) {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:10');
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [fps, setFps] = useState(10);
  const [gifWidth, setGifWidth] = useState(480);

  const handleTrim = async () => {
    try {
      setProcessing(true);
      setStatus('Trimming video...');

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, '_trimmed.mp4'),
        filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('trim_video', {
        inputPath: file.path,
        outputPath,
        startTime,
        endTime,
      });

      setStatus(result);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleStripAudio = async () => {
    try {
      setProcessing(true);
      setStatus('Removing audio...');

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, '_no_audio.mp4'),
        filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('strip_audio', {
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

  const handleScale = async () => {
    try {
      setProcessing(true);
      setStatus(`Scaling to ${width}x${height}...`);

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, `_${width}x${height}.mp4`),
        filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('scale_video', {
        inputPath: file.path,
        outputPath,
        width,
        height,
      });

      setStatus(result);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleVideoToGif = async () => {
    try {
      setProcessing(true);
      setStatus('Converting to GIF...');

      const outputPath = await save({
        defaultPath: file.name.replace(/\.[^/.]+$/, '.gif'),
        filters: [{ name: 'GIF', extensions: ['gif'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('video_to_gif', {
        inputPath: file.path,
        outputPath,
        fps,
        width: gifWidth,
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
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onReset}
          className="glass-card p-3 rounded-2xl transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Video/Audio Processing</h2>
          <p className="text-sm text-white/60">{file.name}</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        {/* Left column - Preview */}
        <div className="glass-card rounded-3xl p-6 flex items-center justify-center">
          <div className="text-center">
            <FileImage className="w-24 h-24 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 mb-2">Video Preview</p>
            <p className="text-white/40 text-sm">
              FFmpeg processing ready
            </p>
          </div>
        </div>

        {/* Right column - Controls */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Trim */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              Trim Video
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-white/60 text-sm mb-1 block">
                  Start Time (HH:MM:SS)
                </label>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
                  placeholder="00:00:00"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm mb-1 block">
                  End Time (HH:MM:SS)
                </label>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
                  placeholder="00:00:10"
                />
              </div>
              <button
                onClick={handleTrim}
                disabled={processing}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                Trim
              </button>
            </div>
          </div>

          {/* Audio */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Audio
            </h3>
            <button
              onClick={handleStripAudio}
              disabled={processing}
              className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
            >
              Remove Audio
            </button>
          </div>

          {/* Scale */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              Scale Resolution
            </h3>
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
                <button
                  onClick={() => {
                    setWidth(1920);
                    setHeight(1080);
                  }}
                  className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
                >
                  1080p
                </button>
                <button
                  onClick={() => {
                    setWidth(1280);
                    setHeight(720);
                  }}
                  className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
                >
                  720p
                </button>
                <button
                  onClick={() => {
                    setWidth(854);
                    setHeight(480);
                  }}
                  className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
                >
                  480p
                </button>
              </div>
              <button
                onClick={handleScale}
                disabled={processing}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                Scale
              </button>
            </div>
          </div>

          {/* GIF Conversion */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FileImage className="w-4 h-4" />
              Convert to GIF
            </h3>
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
              <button
                onClick={handleVideoToGif}
                disabled={processing}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                Convert to GIF
              </button>
            </div>
          </div>

          {/* Status */}
          {status && (
            <div className="glass-card rounded-3xl p-4">
              <p className="text-white/80 text-sm">{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoProcessor;
