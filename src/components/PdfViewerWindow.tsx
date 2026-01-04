import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PdfData {
  pdfData: string;
  pageNumber: number;
  numPages: number;
  fileName: string;
}

function PdfViewerWindow() {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [fileName, setFileName] = useState('');
  const [showTitleBar, setShowTitleBar] = useState(false);
  const [titleBarClicked, setTitleBarClicked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial PDF data
    const loadPdf = async () => {
      try {
        const data = await invoke<PdfData>('get_pdf_data');
        if (data && data.pdfData) {
          setPdfData(data.pdfData);
          setPageNumber(data.pageNumber || 1);
          setNumPages(data.numPages || null);
          setFileName(data.fileName || 'PDF Viewer');
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load PDF:', error);
        setLoading(false);
      }
    };

    loadPdf();

    // Listen for PDF updates
    const unlistenPromise = listen<PdfData>('pdf-update', (event) => {
      const data = event.payload;
      if (data && data.pdfData) {
        setPdfData(data.pdfData);
        if (data.pageNumber) setPageNumber(data.pageNumber);
        if (data.numPages) setNumPages(data.numPages);
        if (data.fileName) setFileName(data.fileName);
      }
    });

    return () => {
      unlistenPromise.then(fn => fn());
    };
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
  };

  // Calculate page width to fit window
  const calculatePageWidth = () => {
    if (typeof window === 'undefined') return 800;
    const availableWidth = window.innerWidth;
    return Math.min(availableWidth * 0.98, 1400);
  };

  const [pageWidth, setPageWidth] = useState(calculatePageWidth());

  useEffect(() => {
    const handleResize = () => {
      setPageWidth(calculatePageWidth());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      className="w-full h-full overflow-hidden relative"
      onMouseEnter={() => setShowTitleBar(true)}
      onMouseLeave={() => setShowTitleBar(false)}
    >
      {/* Draggable title bar */}
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

      {/* Content */}
      <div className="absolute top-10 left-0 right-0 bottom-0 z-10 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
              <p className="text-white/60 text-sm">Loading PDF...</p>
            </div>
          </div>
        ) : pdfData ? (
          <div className="flex flex-col items-center justify-center min-h-full relative">
            {/* Page Navigation - Floating */}
            {numPages && numPages > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 glass-card px-4 py-2 rounded-full z-20">
                <button
                  onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                  disabled={pageNumber <= 1}
                  className="text-white transition-all duration-300 disabled:opacity-30 hover:scale-110"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white/90 text-sm min-w-[80px] text-center">
                  {pageNumber} / {numPages}
                </span>
                <button
                  onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                  disabled={pageNumber >= numPages}
                  className="text-white transition-all duration-300 disabled:opacity-30 hover:scale-110"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* PDF Viewer */}
            <div className="w-full h-full flex items-center justify-center">
              <Document
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
                    <p className="text-white/60 text-sm">Loading PDF...</p>
                  </div>
                }
                error={
                  <div className="text-center text-white/60 text-sm">
                    Failed to load PDF
                  </div>
                }
              >
                {numPages && (
                  <Page
                    pageNumber={pageNumber}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    width={pageWidth}
                    loading={
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
                        <p className="text-white/60 text-sm">Loading page...</p>
                      </div>
                    }
                    error={
                      <div className="text-center text-white/60 text-sm">
                        Failed to load page
                      </div>
                    }
                  />
                )}
              </Document>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white/60 text-sm">
              No PDF loaded
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfViewerWindow;
