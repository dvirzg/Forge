import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
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

interface ZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function PdfViewerWindow() {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [showTitleBar, setShowTitleBar] = useState(false);
  const [titleBarClicked, setTitleBarClicked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageWidth, setPageWidth] = useState(800);
  const [isZoomMode, setIsZoomMode] = useState(false);
  const [zoomHistory, setZoomHistory] = useState<ZoomState[]>([]);
  const [currentZoom, setCurrentZoom] = useState<ZoomState>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const pageElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load initial PDF data
    const loadPdf = async () => {
      try {
        const data = await invoke<PdfData>('get_pdf_data');
        if (data && data.pdfData) {
          setPdfData(data.pdfData);
          setPageNumber(data.pageNumber || 1);
          setNumPages(data.numPages || null);
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

  // Calculate page size to fit viewport (both width and height)
  const calculatePageSize = useCallback(async () => {
    if (typeof window === 'undefined' || !pdfData || !numPages) return;
    
    try {
      const pdf = await pdfjs.getDocument(pdfData).promise;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.0 });
      
      const titleBarHeight = 40;
      const navHeight = 60;
      const padding = 20;
      const availableWidth = window.innerWidth - padding * 2;
      const availableHeight = window.innerHeight - titleBarHeight - navHeight - padding * 2;
      
      const scaleX = availableWidth / viewport.width;
      const scaleY = availableHeight / viewport.height;
      const scale = Math.min(scaleX, scaleY, 1.0);
      
      setPageWidth(viewport.width * scale);
    } catch (error) {
      console.error('Failed to calculate page size:', error);
    }
  }, [pdfData, pageNumber, numPages]);

  useEffect(() => {
    calculatePageSize();
  }, [calculatePageSize]);

  useEffect(() => {
    const handleResize = () => {
      calculatePageSize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePageSize]);

  // Reset zoom when page changes
  useEffect(() => {
    setCurrentZoom({ scale: 1, offsetX: 0, offsetY: 0 });
    setZoomHistory([]);
    setIsZoomMode(false);
  }, [pageNumber]);

  // Handle ESC key to exit zoom mode or go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSelecting) {
          setIsSelecting(false);
          setSelectionStart(null);
          setSelectionEnd(null);
        } else if (zoomHistory.length > 0) {
          const previousZoom = zoomHistory[zoomHistory.length - 1];
          setZoomHistory(zoomHistory.slice(0, -1));
          setCurrentZoom(previousZoom);
        } else if (currentZoom.scale !== 1) {
          setCurrentZoom({ scale: 1, offsetX: 0, offsetY: 0 });
          setZoomHistory([]);
        } else if (isZoomMode) {
          setIsZoomMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomMode, isSelecting, zoomHistory, currentZoom]);

  const handleZoomClick = () => {
    setIsZoomMode(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isZoomMode || !pageContainerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectionStart || !pageContainerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSelectionEnd({ x, y });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selectionStart || !selectionEnd || !pageContainerRef.current || !pageElementRef.current) return;

    const containerRect = pageContainerRef.current.getBoundingClientRect();
    const pageCanvas = pageElementRef.current.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
    if (!pageCanvas) return;

    // Get the canvas position relative to the container
    const canvasRect = pageCanvas.getBoundingClientRect();
    const canvasLeft = canvasRect.left - containerRect.left;
    const canvasTop = canvasRect.top - containerRect.top;

    // Selection bounds in container coordinates
    const sx = Math.min(selectionStart.x, selectionEnd.x);
    const sy = Math.min(selectionStart.y, selectionEnd.y);
    const ex = Math.max(selectionStart.x, selectionEnd.x);
    const ey = Math.max(selectionStart.y, selectionEnd.y);
    const sw = ex - sx;
    const sh = ey - sy;

    if (sw > 10 && sh > 10) {
      // Selection center in container coordinates
      const scx = (sx + ex) / 2;
      const scy = (sy + ey) / 2;

      // Convert selection to canvas-relative coordinates
      const canvasCenterX = scx - canvasLeft;
      const canvasCenterY = scy - canvasTop;

      // Canvas dimensions and center
      const canvasWidth = canvasRect.width;
      const canvasHeight = canvasRect.height;
      const canvasCX = canvasWidth / 2;
      const canvasCY = canvasHeight / 2;

      // Selection center relative to canvas center (in current canvas pixels)
      const relX = canvasCenterX - canvasCX;
      const relY = canvasCenterY - canvasCY;

      // Convert to base page coordinates (at scale 1)
      const px = relX / currentZoom.scale;
      const py = relY / currentZoom.scale;
      const psw = sw / currentZoom.scale;
      const psh = sh / currentZoom.scale;

      // New scale to fill viewport
      const newScale = Math.min(containerRect.width / psw, containerRect.height / psh);

      // New offset to center selection: container_center - canvas_center - px * newScale
      // We want the selection point to be at the container center
      // Canvas will be at: container_center - canvas_size/2 + offset
      // Point on canvas at px,py will be at: container_center - canvas_size/2 + offset + (canvas_size/2 + px*scale)
      // Simplifies to: container_center + offset + px*scale
      // We want this to equal container_center, so: offset = -px*scale
      const newOffsetX = -px * newScale;
      const newOffsetY = -py * newScale;

      setZoomHistory([...zoomHistory, currentZoom]);
      setCurrentZoom({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsZoomMode(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Only allow panning when zoomed in (scale > 1)
    if (currentZoom.scale <= 1) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Use deltaX and deltaY for trackpad/scroll wheel panning
    const deltaX = e.deltaX;
    const deltaY = e.deltaY;
    
    // Update offset to pan the view
    const newOffsetX = currentZoom.offsetX - deltaX;
    const newOffsetY = currentZoom.offsetY - deltaY;
    
    setCurrentZoom({ ...currentZoom, offsetX: newOffsetX, offsetY: newOffsetY });
  };

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

        {/* Close button and Zoom button */}
        <div className="relative h-full pointer-events-none">
          <button
            onClick={() => appWindow.close()}
            className={`absolute top-3 left-3 w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-all duration-200 flex items-center justify-center group pointer-events-auto ${
              showTitleBar ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <X className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={handleZoomClick}
            disabled={!pdfData}
            className={`absolute top-2.5 right-3 glass-card p-1.5 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50 pointer-events-auto ${
              isZoomMode ? 'bg-white/20' : ''
            } ${showTitleBar ? 'opacity-100' : 'opacity-0'}`}
            title="Zoom mode - Click and drag to select area"
          >
            <ZoomIn className="w-3.5 h-3.5" />
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
                  onClick={() => {
                    setPageNumber(Math.max(1, pageNumber - 1));
                    setCurrentZoom({ scale: 1, offsetX: 0, offsetY: 0 });
                    setZoomHistory([]);
                  }}
                  disabled={pageNumber <= 1}
                  className="text-white transition-all duration-300 disabled:opacity-30 hover:scale-110"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white/90 text-sm min-w-[80px] text-center">
                  {pageNumber} / {numPages}
                </span>
                <button
                  onClick={() => {
                    setPageNumber(Math.min(numPages, pageNumber + 1));
                    setCurrentZoom({ scale: 1, offsetX: 0, offsetY: 0 });
                    setZoomHistory([]);
                  }}
                  disabled={pageNumber >= numPages}
                  className="text-white transition-all duration-300 disabled:opacity-30 hover:scale-110"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* PDF Viewer */}
            <div 
              ref={pageContainerRef}
              className={`w-full h-full relative overflow-hidden flex items-center justify-center ${isZoomMode || isSelecting ? 'zoom-mode-active' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              style={{ 
                cursor: isZoomMode ? 'crosshair' : currentZoom.scale > 1 ? 'grab' : 'default',
                userSelect: isZoomMode || isSelecting ? 'none' : 'auto',
                WebkitUserSelect: isZoomMode || isSelecting ? 'none' : 'auto',
              }}
            >
              <div
                ref={pageElementRef}
                style={{
                  transform: `translate(${currentZoom.offsetX}px, ${currentZoom.offsetY}px)`,
                  transition: isSelecting ? 'none' : 'transform 0.2s ease-out',
                }}
              >
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
                      width={pageWidth * currentZoom.scale}
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

              {/* Selection Box */}
              {isSelecting && selectionStart && selectionEnd && (
                <div
                  className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none z-40"
                  style={{
                    left: `${Math.min(selectionStart.x, selectionEnd.x)}px`,
                    top: `${Math.min(selectionStart.y, selectionEnd.y)}px`,
                    width: `${Math.abs(selectionEnd.x - selectionStart.x)}px`,
                    height: `${Math.abs(selectionEnd.y - selectionStart.y)}px`,
                  }}
                />
              )}

              {/* Zoom Mode Indicator */}
              {isZoomMode && !isSelecting && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 glass-card px-4 py-2 rounded-lg z-30 pointer-events-none">
                  <p className="text-white/90 text-sm">Click and drag to select area to zoom</p>
                </div>
              )}
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
