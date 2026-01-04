import { RotateCw, FileText, Download, Plus } from 'lucide-react';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { ActionButton } from '../shared/ActionButton';
import { MetadataSection } from '../shared/MetadataSection';
import { PdfNavigation } from './PdfNavigation';
import { getFileName } from '../../utils/pathUtils';

interface PdfToolsProps {
  expandedCard: string | null;
  onToggleCard: (cardId: string) => void;
  processing: boolean;
  onRotate: (degrees: number) => void;
  onExtractText: () => void;
  onExtractImages: () => void;
  additionalPdfs: string[];
  onAddPdf: () => void;
  onMergePdfs: () => void;
  metadata: {
    pages: number;
    file_size: number;
    pdf_version?: string;
    encrypted: boolean;
    file_created?: string;
    file_modified?: string;
    all_metadata: Record<string, string>;
  } | null;
  fileName: string;
  getBasicMetadataEntries: () => Array<{ key: string; value: string }>;
  getAllMetadataEntries: () => Array<{ key: string; value: string }>;
  hasExtendedMetadata: () => boolean;
  pageNumber: number;
  numPages: number | null;
  onPageChange: (page: number) => void;
  onZoomReset: () => void;
}

export function PdfTools({
  expandedCard,
  onToggleCard,
  processing,
  onRotate,
  onExtractText,
  onExtractImages,
  additionalPdfs,
  onAddPdf,
  onMergePdfs,
  metadata,
  fileName,
  getBasicMetadataEntries,
  getAllMetadataEntries,
  hasExtendedMetadata,
  pageNumber,
  numPages,
  onPageChange,
  onZoomReset,
}: PdfToolsProps) {
  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden py-6">
      {/* Rotate Pages */}
      <CollapsibleSection
        id="rotate"
        title="Rotate Pages"
        icon={RotateCw}
        isExpanded={expandedCard === 'rotate'}
        onToggle={onToggleCard}
      >
        <div className="grid grid-cols-3 gap-2">
          <ActionButton
            onClick={() => onRotate(90)}
            disabled={processing}
            className="px-3 py-2 rounded-xl text-xs"
          >
            90°
          </ActionButton>
          <ActionButton
            onClick={() => onRotate(180)}
            disabled={processing}
            className="px-3 py-2 rounded-xl text-xs"
          >
            180°
          </ActionButton>
          <ActionButton
            onClick={() => onRotate(270)}
            disabled={processing}
            className="px-3 py-2 rounded-xl text-xs"
          >
            270°
          </ActionButton>
        </div>
      </CollapsibleSection>

      {/* Extract */}
      <CollapsibleSection
        id="extract"
        title="Extract"
        icon={FileText}
        isExpanded={expandedCard === 'extract'}
        onToggle={onToggleCard}
      >
        <div className="space-y-2">
          <ActionButton
            onClick={onExtractText}
            disabled={processing}
            className="w-full"
          >
            Extract Text
          </ActionButton>
          <ActionButton
            onClick={onExtractImages}
            disabled={processing}
            className="w-full"
          >
            Extract Images
          </ActionButton>
        </div>
      </CollapsibleSection>

      {/* Merge PDFs */}
      <CollapsibleSection
        id="merge"
        title="Merge PDFs"
        icon={Download}
        isExpanded={expandedCard === 'merge'}
        onToggle={onToggleCard}
      >
        <div className="space-y-2 mb-3">
          <div className="text-sm text-white/60">
            Selected: {additionalPdfs.length + 1} PDF(s)
          </div>
          {additionalPdfs.map((pdf, idx) => (
            <div key={idx} className="text-xs text-white/80 truncate">
              {getFileName(pdf)}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <ActionButton
            onClick={onAddPdf}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add More PDFs
          </ActionButton>
          {additionalPdfs.length > 0 && (
            <ActionButton
              onClick={onMergePdfs}
              disabled={processing}
              variant="primary"
              className="w-full"
            >
              Merge All
            </ActionButton>
          )}
        </div>
      </CollapsibleSection>

      {/* Metadata */}
      <MetadataSection
        sectionId="metadata"
        isExpanded={expandedCard === 'metadata'}
        onToggle={onToggleCard}
        metadata={metadata ? getBasicMetadataEntries() : null}
        displayFileName={fileName}
        processing={processing}
        getBasicEntries={getBasicMetadataEntries}
        getAllEntries={getAllMetadataEntries}
        hasExtendedMetadata={hasExtendedMetadata}
      />

      {/* Page Navigation */}
      <PdfNavigation
        pageNumber={pageNumber}
        numPages={numPages}
        onPageChange={onPageChange}
        onZoomReset={onZoomReset}
      />
    </div>
  );
}
