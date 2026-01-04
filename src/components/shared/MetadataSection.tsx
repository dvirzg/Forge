import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Trash2, ExternalLink } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { ActionButton } from './ActionButton';

interface MetadataEntry {
  key: string;
  value: string;
}

interface MetadataSectionProps {
  sectionId: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  metadata: MetadataEntry[] | null;
  displayFileName: string;
  onStripMetadata?: () => void;
  processing?: boolean;
  getBasicEntries?: () => MetadataEntry[];
  getAllEntries?: () => MetadataEntry[];
  hasExtendedMetadata?: () => boolean;
}

export function MetadataSection({
  sectionId,
  isExpanded,
  onToggle,
  metadata,
  displayFileName,
  onStripMetadata,
  processing = false,
  getBasicEntries,
  getAllEntries,
  hasExtendedMetadata,
}: MetadataSectionProps) {
  const handleOpenMetadataDetail = async () => {
    if (!getAllEntries) return;
    
    const entries = getAllEntries();
    if (entries.length === 0) return;

    try {
      await invoke('open_metadata_window', {
        metadata: entries,
        windowTitle: `Metadata - ${displayFileName}`,
      });
    } catch (error) {
      console.error('Failed to open metadata window:', error);
    }
  };

  return (
    <CollapsibleSection
      id={sectionId}
      title="Metadata"
      icon={Trash2}
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      <div className="space-y-3">
        {metadata && getBasicEntries && (
          <>
            <div className="space-y-1 text-xs">
              {getBasicEntries().map((entry, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-white/60">{entry.key}:</span>
                  <span className="text-white text-right max-w-[60%] truncate" title={entry.value}>
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
            {hasExtendedMetadata && hasExtendedMetadata() && (
              <ActionButton
                onClick={handleOpenMetadataDetail}
                className="w-full px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-2 text-white/80 hover:text-white"
              >
                <ExternalLink className="w-3 h-3" />
                View Extended Metadata
              </ActionButton>
            )}
            {onStripMetadata && (
              <ActionButton
                onClick={onStripMetadata}
                disabled={processing}
                className="w-full px-3 py-2 rounded-xl text-xs"
              >
                Strip Metadata
              </ActionButton>
            )}
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
