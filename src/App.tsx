import { useState, useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  Image,
  FileText,
  Video,
  Type,
  Sparkles,
  RotateCw,
  FlipHorizontal,
  Scissors,
  Trash2,
  Download
} from 'lucide-react';
import ImageProcessor from './components/ImageProcessor';
import PdfProcessor from './components/PdfProcessor';
import VideoProcessor from './components/VideoProcessor';
import TextProcessor from './components/TextProcessor';

type FileType = 'image' | 'pdf' | 'video' | 'text' | null;

interface DroppedFile {
  path: string;
  name: string;
  type: FileType;
}

function App() {
  const [droppedFile, setDroppedFile] = useState<DroppedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const unlisten = listen('tauri://file-drop', (event: any) => {
      const files = event.payload as string[];
      if (files.length > 0) {
        handleFileDrop(files[0]);
      }
    });

    const dragUnlisten = listen('tauri://file-drop-hover', () => {
      setIsDragging(true);
    });

    const dragCancelUnlisten = listen('tauri://file-drop-cancelled', () => {
      setIsDragging(false);
    });

    return () => {
      unlisten.then(fn => fn());
      dragUnlisten.then(fn => fn());
      dragCancelUnlisten.then(fn => fn());
    };
  }, []);

  const handleFileDrop = useCallback((filePath: string) => {
    setIsDragging(false);
    const fileName = filePath.split('/').pop() || '';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    let fileType: FileType = null;

    // Determine file type
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'tiff'].includes(extension)) {
      fileType = 'image';
    } else if (extension === 'pdf') {
      fileType = 'pdf';
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'mp3', 'wav', 'aac', 'flac'].includes(extension)) {
      fileType = 'video';
    } else if (['txt', 'md', 'json', 'xml', 'csv'].includes(extension)) {
      fileType = 'text';
    }

    if (fileType) {
      setDroppedFile({ path: filePath, name: fileName, type: fileType });
    }
  }, []);

  const handleReset = () => {
    setDroppedFile(null);
  };

  const renderProcessor = () => {
    if (!droppedFile) return null;

    switch (droppedFile.type) {
      case 'image':
        return <ImageProcessor file={droppedFile} onReset={handleReset} />;
      case 'pdf':
        return <PdfProcessor file={droppedFile} onReset={handleReset} />;
      case 'video':
        return <VideoProcessor file={droppedFile} onReset={handleReset} />;
      case 'text':
        return <TextProcessor file={droppedFile} onReset={handleReset} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Window titlebar for drag */}
      <div className="window-titlebar" />

      <div className="w-full h-full flex">
        {/* Sidebar */}
        <div className="w-20 h-full flex flex-col items-center py-20 gap-6 border-r border-white/10">
          <button className="glass-card p-4 rounded-2xl transition-all duration-300">
            <Image className="w-6 h-6 text-white" />
          </button>
          <button className="glass-card p-4 rounded-2xl transition-all duration-300">
            <FileText className="w-6 h-6 text-white" />
          </button>
          <button className="glass-card p-4 rounded-2xl transition-all duration-300">
            <Video className="w-6 h-6 text-white" />
          </button>
          <button className="glass-card p-4 rounded-2xl transition-all duration-300">
            <Type className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 h-full overflow-auto p-8">
          {!droppedFile ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
                  Forge
                </h1>
                <p className="text-lg text-white/60">
                  Minimal Media Utility - 100% Local & Private
                </p>
              </div>

              {/* Feature cards */}
              <div className="grid grid-cols-2 gap-6 max-w-4xl mb-12">
                <div className="glass-card p-6 rounded-3xl transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-3 mb-3">
                    <Image className="w-5 h-5 text-blue-400" />
                    <h3 className="text-white font-semibold">Images</h3>
                  </div>
                  <p className="text-sm text-white/60">
                    BG removal, rotate, flip, crop, convert formats
                  </p>
                </div>

                <div className="glass-card p-6 rounded-3xl transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-5 h-5 text-green-400" />
                    <h3 className="text-white font-semibold">PDFs</h3>
                  </div>
                  <p className="text-sm text-white/60">
                    Merge, rotate, extract text and images
                  </p>
                </div>

                <div className="glass-card p-6 rounded-3xl transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-3 mb-3">
                    <Video className="w-5 h-5 text-purple-400" />
                    <h3 className="text-white font-semibold">Video/Audio</h3>
                  </div>
                  <p className="text-sm text-white/60">
                    Trim, strip audio, scale, convert to GIF
                  </p>
                </div>

                <div className="glass-card p-6 rounded-3xl transition-all duration-300 cursor-pointer">
                  <div className="flex items-center gap-3 mb-3">
                    <Type className="w-5 h-5 text-pink-400" />
                    <h3 className="text-white font-semibold">Text</h3>
                  </div>
                  <p className="text-sm text-white/60">
                    Case conversion, find & replace
                  </p>
                </div>
              </div>

              {/* Drop zone */}
              <div
                className={`drop-zone glass-card rounded-3xl p-16 transition-all duration-300 ${
                  isDragging ? 'drag-over' : ''
                }`}
              >
                <div className="text-center">
                  <Sparkles className="w-16 h-16 text-white/40 mx-auto mb-4" />
                  <p className="text-xl text-white/80 mb-2">
                    {isDragging ? 'Drop your file here' : 'Drop any file to begin'}
                  </p>
                  <p className="text-sm text-white/50">
                    Supports images, PDFs, videos, and text files
                  </p>
                </div>
              </div>
            </div>
          ) : (
            renderProcessor()
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
