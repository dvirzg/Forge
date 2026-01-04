import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { PdfFile, PdfPage } from './types';
import { PdfCard } from './PdfCard';

interface DraggablePdfListProps {
  pdfs: PdfFile[];
  onReorder: (newPdfs: PdfFile[]) => void;
  expandedPdfs: Set<string>;
  onToggleExpand: (id: string) => void;
  onPageReorder: (pdfId: string, newPages: PdfPage[]) => void;
}

export function DraggablePdfList({
  pdfs,
  onReorder,
  expandedPdfs,
  onToggleExpand,
  onPageReorder,
}: DraggablePdfListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pdfs.findIndex((p) => p.id === active.id);
      const newIndex = pdfs.findIndex((p) => p.id === over.id);
      onReorder(arrayMove(pdfs, oldIndex, newIndex));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={pdfs.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        {pdfs.map((pdf) => (
          <PdfCard
            key={pdf.id}
            pdf={pdf}
            isExpanded={expandedPdfs.has(pdf.id)}
            onToggleExpand={onToggleExpand}
            onPageReorder={onPageReorder}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
