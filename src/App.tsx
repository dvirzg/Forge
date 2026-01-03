import { useState, useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { appWindow, LogicalSize, LogicalPosition, currentMonitor } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/tauri';
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
  Download,
  X
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
  const [showTitleBar, setShowTitleBar] = useState(false);
  const [titleBarClicked, setTitleBarClicked] = useState(false);

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

  // Resize window dynamically when file is dropped or reset
  useEffect(() => {
    const resizeWindow = async () => {
      try {
        if (droppedFile) {
          // Minimum window size to fit all expanded cards
          const minWidth = 800;
          const minHeight = 600;

          // Set minimum window size
          await appWindow.setMinSize(new LogicalSize(minWidth, minHeight));

          // Just resize, don't reposition for now
          let newWidth = 1000;
          let newHeight = 600;

          try {
            if (droppedFile.type === 'image') {
              // Get image dimensions
              const metadata = await invoke<{ width: number; height: number }>('get_image_metadata', {
                inputPath: droppedFile.path,
              });

              // Calculate window size (add padding for UI controls ~400px width)
              // Cap height to reasonable maximum and ensure minimum
              newWidth = Math.max(Math.min(metadata.width + 400, 1600), minWidth);
              newHeight = Math.max(Math.min(metadata.height + 100, 700), minHeight);
            } else if (droppedFile.type === 'video' || droppedFile.type === 'pdf') {
              newWidth = Math.max(1000, minWidth);
              newHeight = Math.max(600, minHeight);
            } else {
              // For text/audio, use fixed size
              newWidth = Math.max(1000, minWidth);
              newHeight = Math.max(600, minHeight);
            }
          } catch (error) {
            console.error('Error getting file metadata:', error);
            newWidth = Math.max(1000, minWidth);
            newHeight = Math.max(600, minHeight);
          }

          // Resize window
          await appWindow.setSize(new LogicalSize(newWidth, newHeight));
          // Center on screen
          await appWindow.center();
        } else {
          // Reset minimum size to default
          await appWindow.setMinSize(new LogicalSize(200, 150));
          // Shrink to small default size
          await appWindow.setSize(new LogicalSize(300, 200));
          // Center on screen
          await appWindow.center();
        }
      } catch (error) {
        console.error('Error resizing window:', error);
      }
    };

    resizeWindow();
  }, [droppedFile]);

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
    <div
      className="w-full h-full overflow-hidden relative"
      onMouseEnter={() => setShowTitleBar(true)}
      onMouseLeave={() => setShowTitleBar(false)}
    >
      {/* Draggable title bar - always on top */}
      <div className="fixed top-0 left-0 right-0 h-10 z-50">
        <div
          data-tauri-drag-region
          className="absolute inset-0 cursor-move"
          onMouseDown={() => setTitleBarClicked(true)}
          onMouseUp={() => setTitleBarClicked(false)}
        />

        {/* Close button */}
        <div className="relative h-full pointer-events-none">
          <button
            onClick={() => appWindow.close()}
            className={`absolute top-3 left-3 w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-all duration-200 flex items-center justify-center group pointer-events-auto ${
              showTitleBar ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <X className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Visual indicator bar */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`h-1 bg-white/20 rounded-full transition-all duration-150 ${
                titleBarClicked ? 'w-32' : 'w-24'
              } ${showTitleBar ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
        </div>
      </div>

      <div className="absolute top-10 left-0 right-0 bottom-0 z-10">
        {!droppedFile ? (
          <div className="h-full flex items-center justify-center pointer-events-none">
            {/* Drop zone */}
            <div
              className={`w-full h-full flex items-center justify-center transition-all duration-200 ${
                isDragging ? 'bg-white/5' : ''
              }`}
            >
              <p className="text-sm text-white/50 font-medium select-none">
                Drop files here
              </p>
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto h-full px-6 pb-6">
            {renderProcessor()}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
