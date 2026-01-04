import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save, open } from '@tauri-apps/api/dialog';
import { RotateCw, FileText, Download, Plus } from 'lucide-react';
import { Header } from './shared/Header';
import { CollapsibleSection } from './shared/CollapsibleSection';
import { ActionButton } from './shared/ActionButton';
import { Toast } from './shared/Toast';
import { MetadataSection } from './shared/MetadataSection';

interface PdfProcessorProps {
  file: {
    path: string;
    name: string;
  };
  onReset: () => void;
}

interface PdfMetadata {
  pages: number;
  file_size: number;
  pdf_version?: string;
  encrypted: boolean;
  file_created?: string;
  file_modified?: string;
  all_metadata: Record<string, string>;
}

function PdfProcessor({ file, onReset }: PdfProcessorProps) {
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [additionalPdfs, setAdditionalPdfs] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    const id = Date.now();
    setToast({ message, id });
    
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const meta = await invoke<PdfMetadata>('get_pdf_metadata', {
          inputPath: file.path,
        });
        setMetadata(meta);
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      }
    };
    fetchMetadata();
  }, [file.path]);

  const handleRotate = async (degrees: number) => {
    try {
      setProcessing(true);
      showToast(`Rotating PDF ${degrees}°...`);

      const outputPath = await save({
        defaultPath: file.name.replace('.pdf', `_rotated${degrees}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!outputPath) {
        return;
      }

      const result = await invoke<string>('rotate_pdf', {
        inputPath: file.path,
        outputPath,
        degrees,
        pageNumbers: null,
      });

      showToast(result);
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExtractText = async () => {
    try {
      setProcessing(true);
      showToast('Extracting text...');

      const text = await invoke<string>('extract_text', {
        inputPath: file.path,
      });

      setExtractedText(text);
      showToast('Text extracted successfully');
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExtractImages = async () => {
    try {
      setProcessing(true);
      showToast('Extracting images...');

      const outputDir = await open({
        directory: true,
        title: 'Select folder to save images',
      });

      if (!outputDir || Array.isArray(outputDir)) {
        return;
      }

      const imagePaths = await invoke<string[]>('extract_images', {
        inputPath: file.path,
        outputDir,
      });

      showToast(`Extracted ${imagePaths.length} images`);
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddPdf = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (selected && !Array.isArray(selected)) {
        setAdditionalPdfs([...additionalPdfs, selected]);
      } else if (Array.isArray(selected)) {
        setAdditionalPdfs([...additionalPdfs, ...selected]);
      }
    } catch (error) {
      showToast(`Error: ${error}`);
    }
  };

  const handleMergePdfs = async () => {
    try {
      setProcessing(true);
      showToast('Merging PDFs...');

      const outputPath = await save({
        defaultPath: 'merged.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!outputPath) {
        return;
      }

      const allPdfs = [file.path, ...additionalPdfs];

      const result = await invoke<string>('merge_pdfs', {
        inputPaths: allPdfs,
        outputPath,
      });

      showToast(result);
      setAdditionalPdfs([]);
    } catch (error) {
      showToast(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const getBasicMetadataEntries = (): Array<{ key: string; value: string }> => {
    if (!metadata) return [];
    
    const entries: Array<{ key: string; value: string }> = [];
    entries.push({ key: 'Pages', value: metadata.pages.toString() });
    entries.push({ key: 'File Size', value: formatFileSize(metadata.file_size) });
    if (metadata.pdf_version) entries.push({ key: 'PDF Version', value: metadata.pdf_version });
    entries.push({ key: 'Encrypted', value: metadata.encrypted ? 'Yes' : 'No' });
    if (metadata.file_created) entries.push({ key: 'File Created', value: metadata.file_created });
    if (metadata.file_modified) entries.push({ key: 'File Modified', value: metadata.file_modified });
    
    return entries;
  };

  const getAllMetadataEntries = (): Array<{ key: string; value: string }> => {
    if (!metadata) return [];
    
    const entries = getBasicMetadataEntries();
    Object.entries(metadata.all_metadata).forEach(([key, value]) => {
      entries.push({ key, value });
    });
    
    return entries;
  };

  const hasExtendedMetadata = (): boolean => {
    if (!metadata) return false;
    return Object.keys(metadata.all_metadata).length > 0;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        title="PDF Processing"
        fileName={file.name}
        onBack={onReset}
      />

      <div className="flex-1 flex gap-6 min-h-0 items-start">
        {/* Preview - Left Side */}
        <div className="flex-1 rounded-3xl p-6 flex items-center justify-center min-w-0 relative glass-card">
          {extractedText ? (
            <div className="h-full w-full flex flex-col">
              <h3 className="text-white font-semibold mb-4">Extracted Text</h3>
              <div className="flex-1 overflow-y-auto">
                <pre className="text-white/80 text-sm whitespace-pre-wrap">
                  {extractedText}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/60">
                PDF operations will appear here
              </p>
            </div>
          )}
        </div>

        {/* Controls - Right Side */}
        <div className="w-80 flex flex-col gap-4 overflow-y-auto overflow-x-visible flex-shrink-0 pt-6 pb-6 px-1">
          {/* Rotate Pages */}
          <CollapsibleSection
            id="rotate"
            title="Rotate Pages"
            icon={RotateCw}
            isExpanded={expandedCard === 'rotate'}
            onToggle={toggleCard}
          >
            <div className="grid grid-cols-3 gap-2">
              <ActionButton
                onClick={() => handleRotate(90)}
                disabled={processing}
                className="px-3 py-2 rounded-xl text-xs"
              >
                90°
              </ActionButton>
              <ActionButton
                onClick={() => handleRotate(180)}
                disabled={processing}
                className="px-3 py-2 rounded-xl text-xs"
              >
                180°
              </ActionButton>
              <ActionButton
                onClick={() => handleRotate(270)}
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
            onToggle={toggleCard}
          >
            <div className="space-y-2">
              <ActionButton
                onClick={handleExtractText}
                disabled={processing}
                className="w-full"
              >
                Extract Text
              </ActionButton>
              <ActionButton
                onClick={handleExtractImages}
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
            onToggle={toggleCard}
          >
            <div className="space-y-2 mb-3">
              <div className="text-sm text-white/60">
                Selected: {additionalPdfs.length + 1} PDF(s)
              </div>
              {additionalPdfs.map((pdf, idx) => (
                <div key={idx} className="text-xs text-white/80 truncate">
                  {pdf.split('/').pop()}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <ActionButton
                onClick={handleAddPdf}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add More PDFs
              </ActionButton>
              {additionalPdfs.length > 0 && (
                <ActionButton
                  onClick={handleMergePdfs}
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
            onToggle={toggleCard}
            metadata={metadata ? getBasicMetadataEntries() : null}
            displayFileName={file.name}
            processing={processing}
            getBasicEntries={getBasicMetadataEntries}
            getAllEntries={getAllMetadataEntries}
            hasExtendedMetadata={hasExtendedMetadata}
          />
        </div>
      </div>

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} id={toast.id} />}
    </div>
  );
}

export default PdfProcessor;
