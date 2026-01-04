import { useRef, useEffect, useCallback } from 'react';
import { Document, Page } from 'react-pdf';
import { FileText } from 'lucide-react';
import { ZoomState } from '../../utils/pdfUtils';

interface Highlight {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  page: number;
}

interface Signature {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

type MarkupMode = 'none' | 'highlight';

interface PdfViewerProps {
  pdfData: string | null;
  pdfLoading: boolean;
  pdfError: boolean;
  fileName: string;
  pageNumber: number;
  numPages: number | null;
  onDocumentLoadSuccess: (data: { numPages: number }) => void;
  onDocumentLoadError: (error: Error) => void;
  currentZoom: ZoomState;
  isZoomMode: boolean;
  isSelecting: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionEnd: { x: number; y: number } | null;
  markupMode: MarkupMode;
  highlights: Highlight[];
  signatures: Signature[];
  isDraggingSignature: boolean;
  draggedSignatureId: string | null;
  selectedSignatureToPlace: string | null;
  showTextPopup: boolean;
  textPopupPosition: { x: number; y: number } | null;
  markupColor: string;
  pageWidth: number;
  pageContainerRef?: React.RefObject<HTMLDivElement>;
  pageElementRef?: React.RefObject<HTMLDivElement>;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onHighlightSelection: () => void;
  onMarkupColorChange: (color: string) => void;
  onTextPopupClose: () => void;
}

export function PdfViewer({
  pdfData,
  pdfLoading,
  pdfError,
  fileName,
  pageNumber,
  numPages,
  onDocumentLoadSuccess,
  onDocumentLoadError,
  currentZoom,
  isZoomMode,
  isSelecting,
  selectionStart,
  selectionEnd,
  markupMode,
  highlights,
  signatures,
  isDraggingSignature,
  draggedSignatureId,
  selectedSignatureToPlace,
  showTextPopup,
  textPopupPosition,
  markupColor,
  pageWidth,
  pageContainerRef: externalPageContainerRef,
  pageElementRef: externalPageElementRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  onHighlightSelection,
  onMarkupColorChange,
  onTextPopupClose,
}: PdfViewerProps) {
  const internalPageContainerRef = useRef<HTMLDivElement>(null);
  const internalPageElementRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = externalPageContainerRef || internalPageContainerRef;
  const pageElementRef = externalPageElementRef || internalPageElementRef;

  // Calculate page size to fit viewport
  const calculatePageSize = useCallback(async () => {
    if (typeof window === 'undefined' || !pdfData || !numPages || !pageContainerRef.current) return;

    try {
      // Page size calculation is handled in parent component
      // This effect is kept for ResizeObserver setup
      // The refs are used by the parent for coordinate conversion
    } catch (error) {
      console.error('Failed to calculate page size:', error);
    }
  }, [pdfData, pageNumber, numPages]);

  useEffect(() => {
    calculatePageSize();
  }, [calculatePageSize]);

  useEffect(() => {
    if (!pageContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      calculatePageSize();
    });

    resizeObserver.observe(pageContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculatePageSize]);

  if (pdfLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
          <p className="text-white/60 text-sm">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (pdfError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 text-sm mb-2">Failed to load PDF</p>
          <p className="text-white/40 text-xs">{fileName}</p>
        </div>
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60">PDF operations will appear here</p>
        </div>
      </div>
    );
  }

  const currentPageHighlights = highlights.filter(h => h.page === pageNumber);
  const currentPageSignatures = signatures.filter(s => s.page === pageNumber);

  return (
    <div
      ref={pageContainerRef}
      className={`flex-1 relative overflow-hidden ${isZoomMode || isSelecting ? 'zoom-mode-active' : ''}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      style={{
        cursor: isZoomMode ? 'crosshair' :
                selectedSignatureToPlace ? 'crosshair' :
                isDraggingSignature ? 'grabbing' :
                markupMode === 'highlight' ? 'text' :
                currentZoom.scale > 1 ? 'grab' : 'default',
        userSelect: isZoomMode || isSelecting ? 'none' : 'auto',
        WebkitUserSelect: isZoomMode || isSelecting ? 'none' : 'auto',
      }}
    >
      {/* Page Element - Centered and transformed */}
      <div
        ref={pageElementRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${currentZoom.offsetX}px), calc(-50% + ${currentZoom.offsetY}px))`,
          transformOrigin: 'center',
          transition: isSelecting ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <Document
          file={pdfData}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div><p className="text-white/60 text-sm">Loading PDF...</p></div>}
          error={<div className="text-center text-white/60 text-sm">Failed to load PDF</div>}
        >
          {numPages && (
            <Page
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              width={pageWidth * currentZoom.scale}
              loading={<div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div><p className="text-white/60 text-sm">Loading page...</p></div>}
              error={<div className="text-center text-white/60 text-sm">Failed to load page</div>}
            />
          )}
        </Document>
      </div>

      {/* Markup Layer - Highlights */}
      {currentPageHighlights.map((highlight) => (
        <div
          key={highlight.id}
          className="absolute pointer-events-none z-30"
          style={{
            left: `${highlight.x}px`,
            top: `${highlight.y}px`,
            width: `${highlight.width}px`,
            height: `${highlight.height}px`,
            backgroundColor: highlight.color,
            opacity: 0.4,
          }}
          title={highlight.text}
        />
      ))}

      {/* Markup Layer - Signatures */}
      {currentPageSignatures.map((signature) => (
        <div
          key={signature.id}
          className="absolute z-30 cursor-move"
          style={{
            left: `${signature.x}px`,
            top: `${signature.y}px`,
            width: `${signature.width}px`,
            height: `${signature.height}px`,
            pointerEvents: isDraggingSignature && draggedSignatureId === signature.id ? 'none' : 'auto',
          }}
        >
          <img
            src={signature.dataUrl}
            alt="Signature"
            className="w-full h-full object-contain"
            draggable={false}
          />
        </div>
      ))}

      {/* Selection Overlay */}
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

      {/* Mode Indicators */}
      {isZoomMode && !isSelecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-card px-4 py-2 rounded-lg z-30 pointer-events-none">
          <p className="text-white/90 text-sm">Click and drag to select area to zoom</p>
        </div>
      )}
      {markupMode === 'highlight' && !showTextPopup && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-card px-4 py-2 rounded-lg z-30 pointer-events-none">
          <p className="text-white/90 text-sm">Select text to highlight</p>
        </div>
      )}
      {selectedSignatureToPlace && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-card px-4 py-2 rounded-lg z-30 pointer-events-none">
          <p className="text-white/90 text-sm">Click to place signature (ESC to cancel)</p>
        </div>
      )}

      {/* Text Selection Popup */}
      {showTextPopup && textPopupPosition && (
        <div
          className="absolute z-50"
          style={{
            left: `${textPopupPosition.x}px`,
            top: `${textPopupPosition.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="glass-card px-3 py-2 rounded-lg flex items-center gap-2 shadow-lg">
            <button
              onClick={onHighlightSelection}
              className="px-3 py-1.5 rounded bg-yellow-500/30 text-white text-sm hover:bg-yellow-500/50 transition-colors"
            >
              Highlight
            </button>
            <input
              type="color"
              value={markupColor}
              onChange={(e) => onMarkupColorChange(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-white/20"
              title="Choose highlight color"
            />
            <button
              onClick={onTextPopupClose}
              className="px-2 py-1 text-white/60 hover:text-white transition-colors"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
