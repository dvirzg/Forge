import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { X } from 'lucide-react';

interface MetadataEntry {
  key: string;
  value: string;
}

function MetadataWindow() {
  const [metadata, setMetadata] = useState<MetadataEntry[]>([]);
  const [showTitleBar, setShowTitleBar] = useState(false);
  const [titleBarClicked, setTitleBarClicked] = useState(false);

  useEffect(() => {
    invoke<MetadataEntry[]>('get_metadata')
      .then(data => setMetadata(data))
      .catch(console.error);
  }, []);

  // Split metadata into two columns
  const midPoint = Math.ceil(metadata.length / 2);
  const leftColumn = metadata.slice(0, midPoint);
  const rightColumn = metadata.slice(midPoint);

  return (
    <div
      className="w-full h-full overflow-hidden relative"
      onMouseEnter={() => setShowTitleBar(true)}
      onMouseLeave={() => setShowTitleBar(false)}
    >
      {/* Draggable title bar */}
      <div className="fixed top-0 left-0 right-0 h-10 z-50">
        <div
          data-tauri-drag-region
          className="absolute inset-0 cursor-move"
          onMouseDown={() => setTitleBarClicked(true)}
          onMouseUp={() => setTitleBarClicked(false)}
        />

        {/* Close button */}
        <div className="relative h-full pointer-events-none">
          <button
            onClick={() => appWindow.close()}
            className={`absolute top-3 left-3 w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-all duration-200 flex items-center justify-center group pointer-events-auto ${
              showTitleBar ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <X className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Visual indicator bar */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`h-1 bg-white/20 rounded-full transition-all duration-150 ${
                titleBarClicked ? 'w-32' : 'w-24'
              } ${showTitleBar ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="absolute top-10 left-0 right-0 bottom-0 z-10 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white mb-3">Metadata Details</h3>
          {metadata.length === 0 ? (
            <div className="text-white/40 text-sm text-center py-8">
              Loading metadata...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {/* Left Column */}
              <div className="space-y-1.5">
                {leftColumn.map((entry, idx) => (
                  <div key={idx} className="flex flex-col py-0.5">
                    <span className="text-white/60 text-[10px] font-medium mb-0.5">{entry.key}:</span>
                    <span className="text-white text-[11px] break-words leading-relaxed">{entry.value}</span>
                  </div>
                ))}
              </div>
              {/* Right Column */}
              <div className="space-y-1.5">
                {rightColumn.map((entry, idx) => (
                  <div key={idx} className="flex flex-col py-0.5">
                    <span className="text-white/60 text-[10px] font-medium mb-0.5">{entry.key}:</span>
                    <span className="text-white text-[11px] break-words leading-relaxed">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MetadataWindow;
