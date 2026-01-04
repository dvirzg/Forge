import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  title: string;
  fileName: string;
  onBack: () => void;
  isRenaming?: boolean;
  editedFileName?: string;
  onFileNameChange?: (name: string) => void;
  onRenameSave?: () => void;
  onRenameCancel?: () => void;
  onFileNameDoubleClick?: () => void;
  rightContent?: React.ReactNode;
}

export function Header({
  title,
  fileName,
  onBack,
  isRenaming = false,
  editedFileName = '',
  onFileNameChange,
  onRenameSave,
  onRenameCancel,
  onFileNameDoubleClick,
  rightContent,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="glass-card p-3 rounded-2xl transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {isRenaming ? (
            <input
              type="text"
              value={editedFileName}
              onChange={(e) => onFileNameChange?.(e.target.value)}
              onBlur={onRenameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRenameSave?.();
                } else if (e.key === 'Escape') {
                  onRenameCancel?.();
                }
              }}
              className="text-sm text-white/60 bg-transparent border-b border-white/30 focus:border-white/60 focus:outline-none px-1"
              autoFocus
            />
          ) : (
            <p
              className="text-sm text-white/60 cursor-pointer hover:text-white/80 transition-colors"
              onDoubleClick={onFileNameDoubleClick}
            >
              {fileName}
            </p>
          )}
        </div>
      </div>
      {rightContent}
    </div>
  );
}
