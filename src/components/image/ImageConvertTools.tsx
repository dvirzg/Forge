import { Download, ChevronDown } from 'lucide-react';
import { CollapsibleSection } from '../shared/CollapsibleSection';

interface ImageConvertToolsProps {
  expandedCard: string | null;
  onToggleCard: (cardId: string) => void;
  processing: boolean;
  isEditingCustomFormat: boolean;
  customFormat: string;
  onFormatChange: (format: string) => void;
  onCustomFormatChange: (format: string) => void;
  onCustomFormatSubmit: () => void;
  onStartEditingCustomFormat: () => void;
  onCancelEditingCustomFormat: () => void;
}

export function ImageConvertTools({
  expandedCard,
  onToggleCard,
  processing,
  isEditingCustomFormat,
  customFormat,
  onFormatChange,
  onCustomFormatChange,
  onCustomFormatSubmit,
  onStartEditingCustomFormat,
  onCancelEditingCustomFormat,
}: ImageConvertToolsProps) {
  return (
    <CollapsibleSection
      id="convert"
      title="Convert Format"
      icon={Download}
      isExpanded={expandedCard === 'convert'}
      onToggle={onToggleCard}
    >
      <div className="mt-4">
        <div className="grid grid-cols-3 gap-2">
          {['png', 'jpg', 'webp', 'gif', 'bmp'].map((format) => (
            <button
              key={format}
              onClick={() => onFormatChange(format)}
              disabled={processing}
              className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50 uppercase"
            >
              {format}
            </button>
          ))}
          {isEditingCustomFormat ? (
            <input
              type="text"
              value={customFormat}
              onChange={(e) => onCustomFormatChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onCustomFormatSubmit();
                } else if (e.key === 'Escape') {
                  onCancelEditingCustomFormat();
                }
              }}
              onBlur={onCustomFormatSubmit}
              className="glass-card px-3 py-2 rounded-xl text-white text-xs bg-transparent border border-white/20 focus:border-white/40 focus:outline-none uppercase"
              placeholder="EXT"
              autoFocus
            />
          ) : (
            <button
              onClick={onStartEditingCustomFormat}
              disabled={processing}
              className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 disabled:opacity-50"
            >
              Other
            </button>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}
