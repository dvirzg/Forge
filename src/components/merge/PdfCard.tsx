import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, FileText, GripVertical } from 'lucide-react';
import { PdfFile, PdfPage } from './types';
import { DraggablePageList } from './DraggablePageList';

interface PdfCardProps {
  pdf: PdfFile;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onPageReorder: (pdfId: string, newPageOrder: PdfPage[]) => void;
}

export function PdfCard({ pdf, isExpanded, onToggleExpand, onPageReorder }: PdfCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pdf.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass-card rounded-2xl p-4 mb-3"
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white/60"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        <div className="w-12 h-16 bg-white/5 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
          {pdf.pages[0]?.thumbnailUrl ? (
            <img src={pdf.pages[0].thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <FileText className="w-6 h-6 text-white/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{pdf.name}</p>
          <p className="text-white/50 text-xs">{pdf.pageCount} pages</p>
        </div>

        <button
          onClick={() => onToggleExpand(pdf.id)}
          className="text-white/60 hover:text-white transition-colors"
        >
          <ChevronDown
            className={`w-5 h-5 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pl-8">
          <DraggablePageList
            pages={pdf.pages}
            pdfId={pdf.id}
            onReorder={(newPages) => onPageReorder(pdf.id, newPages)}
          />
        </div>
      )}
    </div>
  );
}
