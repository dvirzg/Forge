import { useState, useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { appWindow } from '@tauri-apps/api/window';
import { X } from 'lucide-react';
import { detectFileType } from './utils/fileType';
import { getProcessorComponent } from './utils/processorRegistry';
import { useWindowResize } from './hooks/useWindowResize';
import { getFileName } from './utils/pathUtils';

type FileType = 'image' | 'pdf' | 'video' | 'text' | null;

interface DroppedFile {
  path: string;
  name: string;
  type: FileType;
  multiplePdfs?: Array<{ path: string; name: string }>;
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
        handleFileDrop(files);
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
  useWindowResize(droppedFile?.type || null, droppedFile?.path);

  const handleFileDrop = useCallback((filePaths: string | string[]) => {
    setIsDragging(false);

    // Normalize to array
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];

    // Filter for PDF files
    const pdfPaths = paths.filter(path => {
      const extension = path.split('.').pop()?.toLowerCase();
      return extension === 'pdf';
    });

    // Multiple PDFs → merge mode
    if (pdfPaths.length > 1) {
      const pdfFiles = pdfPaths.map(path => ({
        path,
        name: getFileName(path),
      }));
      setDroppedFile({
        path: pdfFiles[0].path,
        name: `${pdfFiles.length} PDFs`,
        type: 'pdf',
        multiplePdfs: pdfFiles,
      });
      return;
    }

    // Single file (PDF or other type)
    const filePath = paths[0];
    const fileName = getFileName(filePath);
    const fileType = detectFileType(fileName);

    if (fileType) {
      setDroppedFile({ path: filePath, name: fileName, type: fileType });
    }
  }, []);

  const handleReset = () => {
    setDroppedFile(null);
  };

  const renderProcessor = () => {
    if (!droppedFile) return null;

    const ProcessorComponent = getProcessorComponent(droppedFile.type);
    if (!ProcessorComponent) return null;

    const extraProps = droppedFile.type === 'pdf' && droppedFile.multiplePdfs
      ? { multiplePdfs: droppedFile.multiplePdfs }
      : {};

    return (
      <ProcessorComponent
        file={droppedFile}
        onReset={handleReset}
        {...extraProps}
      />
    );
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

      <div className="absolute top-0 left-0 right-0 bottom-0 z-10">
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
          <div className="pointer-events-auto h-full px-6 pb-6 pt-10">
            {renderProcessor()}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
