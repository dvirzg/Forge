import { Type, Search } from 'lucide-react';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { ActionButton } from '../shared/ActionButton';
import { MetadataSection } from '../shared/MetadataSection';

interface TextToolsProps {
  expandedCard: string | null;
  onToggleCard: (cardId: string) => void;
  processing: boolean;
  findText: string;
  replaceText: string;
  text: string;
  onFindTextChange: (text: string) => void;
  onReplaceTextChange: (text: string) => void;
  onConvertCase: (caseType: string) => void;
  onReplaceAll: () => void;
  onTrimWhitespace: () => void;
  onRemoveEmptyLines: () => void;
  onRemoveDuplicates: () => void;
  onSortLines: () => void;
  metadata: {
    file_size: number;
    line_count: number;
    character_count: number;
    word_count: number;
    encoding?: string;
    line_endings?: string;
    file_created?: string;
    file_modified?: string;
  } | null;
  fileName: string;
  getBasicMetadataEntries: () => Array<{ key: string; value: string }>;
  getAllMetadataEntries: () => Array<{ key: string; value: string }>;
  hasExtendedMetadata: () => boolean;
}

export function TextTools({
  expandedCard,
  onToggleCard,
  processing,
  findText,
  replaceText,
  text,
  onFindTextChange,
  onReplaceTextChange,
  onConvertCase,
  onReplaceAll,
  onTrimWhitespace,
  onRemoveEmptyLines,
  onRemoveDuplicates,
  onSortLines,
  metadata,
  fileName,
  getBasicMetadataEntries,
  getAllMetadataEntries,
  hasExtendedMetadata,
}: TextToolsProps) {
  return (
    <>
      {/* Case Conversion */}
      <CollapsibleSection
        id="case-conversion"
        title="Case Conversion"
        icon={Type}
        isExpanded={expandedCard === 'case-conversion'}
        onToggle={onToggleCard}
      >
        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={() => onConvertCase('upper')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
            UPPER
          </ActionButton>
          <ActionButton onClick={() => onConvertCase('lower')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
            lower
          </ActionButton>
          <ActionButton onClick={() => onConvertCase('title')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
            Title Case
          </ActionButton>
          <ActionButton onClick={() => onConvertCase('camel')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
            camelCase
          </ActionButton>
          <ActionButton onClick={() => onConvertCase('pascal')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
            PascalCase
          </ActionButton>
          <ActionButton onClick={() => onConvertCase('snake')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
            snake_case
          </ActionButton>
          <ActionButton onClick={() => onConvertCase('kebab')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
            kebab-case
          </ActionButton>
          <ActionButton onClick={() => onConvertCase('screaming_snake')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
            SCREAMING
          </ActionButton>
        </div>
      </CollapsibleSection>

      {/* Find & Replace */}
      <CollapsibleSection
        id="find-replace"
        title="Find & Replace"
        icon={Search}
        isExpanded={expandedCard === 'find-replace'}
        onToggle={onToggleCard}
      >
        <div className="space-y-3">
          <div>
            <label className="text-white/60 text-sm mb-1 block">Find</label>
            <input
              type="text"
              value={findText}
              onChange={(e) => onFindTextChange(e.target.value)}
              className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
              placeholder="Text to find..."
            />
          </div>
          <div>
            <label className="text-white/60 text-sm mb-1 block">Replace</label>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => onReplaceTextChange(e.target.value)}
              className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
              placeholder="Replace with..."
            />
          </div>
          <ActionButton onClick={onReplaceAll} disabled={processing} className="w-full">
            Replace All
          </ActionButton>
        </div>
      </CollapsibleSection>

      {/* Quick Actions */}
      <CollapsibleSection
        id="quick-actions"
        title="Quick Actions"
        icon={Type}
        isExpanded={expandedCard === 'quick-actions'}
        onToggle={onToggleCard}
      >
        <div className="space-y-2">
          <ActionButton onClick={onTrimWhitespace} className="w-full px-4 py-2 rounded-xl text-sm">
            Trim Whitespace
          </ActionButton>
          <ActionButton onClick={onRemoveEmptyLines} className="w-full px-4 py-2 rounded-xl text-sm">
            Remove Empty Lines
          </ActionButton>
          <ActionButton onClick={onRemoveDuplicates} className="w-full px-4 py-2 rounded-xl text-sm">
            Remove Duplicates
          </ActionButton>
          <ActionButton onClick={onSortLines} className="w-full px-4 py-2 rounded-xl text-sm">
            Sort Lines
          </ActionButton>
        </div>
      </CollapsibleSection>

      {/* Metadata */}
      <MetadataSection
        sectionId="metadata"
        isExpanded={expandedCard === 'metadata'}
        onToggle={onToggleCard}
        metadata={metadata ? getBasicMetadataEntries() : null}
        displayFileName={fileName}
        getBasicEntries={getBasicMetadataEntries}
        getAllEntries={getAllMetadataEntries}
        hasExtendedMetadata={hasExtendedMetadata}
      />
    </>
  );
}
