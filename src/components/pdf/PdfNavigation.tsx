import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PdfNavigationProps {
  pageNumber: number;
  numPages: number | null;
  onPageChange: (page: number) => void;
  onZoomReset: () => void;
}

export function PdfNavigation({
  pageNumber,
  numPages,
  onPageChange,
  onZoomReset,
}: PdfNavigationProps) {
  if (!numPages || numPages <= 1) return null;

  const handlePrevious = () => {
    onPageChange(Math.max(1, pageNumber - 1));
    onZoomReset();
  };

  const handleNext = () => {
    onPageChange(Math.min(numPages, pageNumber + 1));
    onZoomReset();
  };

  return (
    <div>
      <div className="w-full text-left text-white font-semibold flex items-center gap-2 py-2">
        <span className="text-sm">Navigation</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          onClick={handlePrevious}
          disabled={pageNumber <= 1}
          className="text-white/60 hover:text-white text-xs transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4 mx-auto" />
        </button>
        <div className="flex items-center justify-center">
          <span className="text-white/80 text-xs">
            {pageNumber} / {numPages}
          </span>
        </div>
        <button
          onClick={handleNext}
          disabled={pageNumber >= numPages}
          className="text-white/60 hover:text-white text-xs transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 mx-auto" />
        </button>
      </div>
    </div>
  );
}
