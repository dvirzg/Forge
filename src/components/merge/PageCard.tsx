import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText } from 'lucide-react';
import { PdfPage } from './types';

interface PageCardProps {
  page: PdfPage;
}

export function PageCard({ page }: PageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing flex flex-col items-center"
    >
      <div className="w-20 h-28 bg-white/10 rounded flex items-center justify-center overflow-hidden mb-2 shadow-lg">
        {page.thumbnailUrl ? (
          <img src={page.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <FileText className="w-8 h-8 text-white/40" />
        )}
      </div>

      <p className="text-white/70 text-xs">Page {page.pageNumber}</p>
    </div>
  );
}
