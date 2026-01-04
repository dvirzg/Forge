import { RotateCw, FlipHorizontal, FlipVertical, Scissors } from 'lucide-react';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { ActionButton } from '../shared/ActionButton';

interface ImageTransformToolsProps {
  expandedCard: string | null;
  onToggleCard: (cardId: string) => void;
  processing: boolean;
  isCropping: boolean;
  onRotate: (degrees: number) => void;
  onFlip: (direction: 'horizontal' | 'vertical') => void;
  onInitializeCrop: () => void;
}

export function ImageTransformTools({
  expandedCard,
  onToggleCard,
  processing,
  isCropping,
  onRotate,
  onFlip,
  onInitializeCrop,
}: ImageTransformToolsProps) {
  return (
    <CollapsibleSection
      id="transform"
      title="Transform"
      icon={RotateCw}
      isExpanded={expandedCard === 'transform'}
      onToggle={onToggleCard}
    >
      <div className="grid grid-cols-3 gap-2 mb-3">
        <ActionButton onClick={() => onRotate(90)} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
          90°
        </ActionButton>
        <ActionButton onClick={() => onRotate(180)} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
          180°
        </ActionButton>
        <ActionButton onClick={() => onRotate(270)} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
          270°
        </ActionButton>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <ActionButton
          onClick={() => onFlip('horizontal')}
          disabled={processing}
          className="px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-2"
        >
          <FlipHorizontal className="w-3 h-3" />
          Flip H
        </ActionButton>
        <ActionButton
          onClick={() => onFlip('vertical')}
          disabled={processing}
          className="px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-2"
        >
          <FlipVertical className="w-3 h-3" />
          Flip V
        </ActionButton>
      </div>
      <ActionButton
        onClick={onInitializeCrop}
        disabled={processing || isCropping}
        className="w-full flex items-center justify-center gap-2"
      >
        <Scissors className="w-4 h-4" />
        Crop Image
      </ActionButton>
    </CollapsibleSection>
  );
}
