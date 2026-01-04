import { X } from 'lucide-react';

interface MetadataEntry {
  key: string;
  value: string;
}

interface MetadataDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: MetadataEntry[];
  title?: string;
}

export function MetadataDetailModal({
  isOpen,
  onClose,
  entries,
  title = 'Metadata Details',
}: MetadataDetailModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card rounded-3xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="glass-card p-2 rounded-xl text-white hover:scale-105 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {entries.map((entry, idx) => (
            <div
              key={idx}
              className="flex justify-between items-start py-2 border-b border-white/10 text-sm"
            >
              <span className="text-white/60 font-medium min-w-[40%]">{entry.key}:</span>
              <span className="text-white text-right flex-1 break-words">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
