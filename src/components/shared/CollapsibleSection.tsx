import { ChevronDown, LucideIcon } from 'lucide-react';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div data-collapsible-id={id}>
      <button
        onClick={() => onToggle(id)}
        className="w-full text-left text-white font-semibold flex items-center justify-between gap-2 py-2 hover:text-white/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isExpanded && <div className="mt-4">{children}</div>}
    </div>
  );
}
