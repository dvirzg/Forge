import { ZoomIn, Highlighter, PenTool, Eraser, Save, ExternalLink } from 'lucide-react';

type MarkupMode = 'none' | 'highlight';

interface PdfToolbarProps {
  pdfData: string | null;
  pdfDocAvailable: boolean;
  markupMode: MarkupMode;
  onMarkupModeChange: (mode: MarkupMode) => void;
  onOpenSignatureModal: () => void;
  onClearMarkups: () => void;
  hasMarkups: boolean;
  markupColor: string;
  onMarkupColorChange: (color: string) => void;
  onSaveAnnotations: () => void;
  processing: boolean;
  isZoomMode: boolean;
  onZoomClick: () => void;
  onOpenPdfWindow: () => void;
}

export function PdfToolbar({
  pdfData,
  pdfDocAvailable,
  markupMode,
  onMarkupModeChange,
  onOpenSignatureModal,
  onClearMarkups,
  hasMarkups,
  markupColor,
  onMarkupColorChange,
  onSaveAnnotations,
  processing,
  isZoomMode,
  onZoomClick,
  onOpenPdfWindow,
}: PdfToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Markup Tools */}
      <button
        onClick={() => onMarkupModeChange(markupMode === 'highlight' ? 'none' : 'highlight')}
        disabled={!pdfData || !pdfDocAvailable}
        className={`glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50 ${
          markupMode === 'highlight' ? 'bg-yellow-500/30' : ''
        }`}
        title={!pdfDocAvailable ? "Annotations unavailable - PDF cannot be modified" : "Highlighter - Select text to highlight"}
      >
        <Highlighter className="w-4 h-4" />
      </button>
      <button
        onClick={onOpenSignatureModal}
        disabled={!pdfData || !pdfDocAvailable}
        className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50"
        title={!pdfDocAvailable ? "Annotations unavailable - PDF cannot be modified" : "Signature - Draw or select signatures and symbols"}
      >
        <PenTool className="w-4 h-4" />
      </button>
      <button
        onClick={onClearMarkups}
        disabled={!pdfData || !hasMarkups}
        className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50"
        title="Clear all markups"
      >
        <Eraser className="w-4 h-4" />
      </button>

      {/* Color Picker */}
      {markupMode === 'highlight' && (
        <input
          type="color"
          value={markupColor}
          onChange={(e) => onMarkupColorChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-2 border-white/20"
          title="Choose highlight color"
        />
      )}

      {/* Save Annotations */}
      {hasMarkups && (
        <button
          onClick={onSaveAnnotations}
          disabled={processing || !pdfDocAvailable}
          className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50 bg-green-500/30"
          title="Save annotations to PDF"
        >
          <Save className="w-4 h-4" />
        </button>
      )}

      <button
        onClick={onZoomClick}
        disabled={!pdfData}
        className={`glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50 ${
          isZoomMode ? 'bg-white/20' : ''
        }`}
        title="Zoom mode - Click and drag to select area"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={onOpenPdfWindow}
        disabled={!pdfData}
        className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50"
        title="Open PDF in separate window"
      >
        <ExternalLink className="w-4 h-4" />
      </button>
    </div>
  );
}
