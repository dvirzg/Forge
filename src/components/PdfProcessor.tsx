import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save, open } from '@tauri-apps/api/dialog';
import { RotateCw, FileText, Download, ArrowLeft, Plus, Trash2, ChevronDown, ExternalLink, X } from 'lucide-react';

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
  const [status, setStatus] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [additionalPdfs, setAdditionalPdfs] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showMetadataDetail, setShowMetadataDetail] = useState(false);

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
      setStatus(`Rotating PDF ${degrees}°...`);

      const outputPath = await save({
        defaultPath: file.name.replace('.pdf', `_rotated${degrees}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('rotate_pdf', {
        inputPath: file.path,
        outputPath,
        degrees,
        pageNumbers: null,
      });

      setStatus(result);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExtractText = async () => {
    try {
      setProcessing(true);
      setStatus('Extracting text...');

      const text = await invoke<string>('extract_text', {
        inputPath: file.path,
      });

      setExtractedText(text);
      setStatus('Text extracted successfully');
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExtractImages = async () => {
    try {
      setProcessing(true);
      setStatus('Extracting images...');

      const outputDir = await open({
        directory: true,
        title: 'Select folder to save images',
      });

      if (!outputDir || Array.isArray(outputDir)) {
        setStatus('Operation cancelled');
        return;
      }

      const imagePaths = await invoke<string[]>('extract_images', {
        inputPath: file.path,
        outputDir,
      });

      setStatus(`Extracted ${imagePaths.length} images`);
    } catch (error) {
      setStatus(`Error: ${error}`);
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
      setStatus(`Error: ${error}`);
    }
  };

  const handleMergePdfs = async () => {
    try {
      setProcessing(true);
      setStatus('Merging PDFs...');

      const outputPath = await save({
        defaultPath: 'merged.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const allPdfs = [file.path, ...additionalPdfs];

      const result = await invoke<string>('merge_pdfs', {
        inputPaths: allPdfs,
        outputPath,
      });

      setStatus(result);
      setAdditionalPdfs([]);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const getMetadataEntries = (): Array<{ key: string; value: string }> => {
    if (!metadata) return [];
    
    const entries: Array<{ key: string; value: string }> = [];
    entries.push({ key: 'Pages', value: metadata.pages.toString() });
    entries.push({ key: 'File Size', value: formatFileSize(metadata.file_size) });
    if (metadata.pdf_version) entries.push({ key: 'PDF Version', value: metadata.pdf_version });
    entries.push({ key: 'Encrypted', value: metadata.encrypted ? 'Yes' : 'No' });
    if (metadata.file_created) entries.push({ key: 'File Created', value: metadata.file_created });
    if (metadata.file_modified) entries.push({ key: 'File Modified', value: metadata.file_modified });
    
    // Dynamically include all PDF metadata
    Object.entries(metadata.all_metadata).forEach(([key, value]) => {
      entries.push({ key, value });
    });
    
    return entries;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleOpenMetadataDetail = () => {
    const entries = getMetadataEntries();
    if (entries.length <= 6) return;
    setShowMetadataDetail(true);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onReset}
          className="glass-card p-3 rounded-2xl transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">PDF Processing</h2>
          <p className="text-sm text-white/60">{file.name}</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        {/* Left column - Controls */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Rotation */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <RotateCw className="w-4 h-4" />
              Rotate Pages
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleRotate(90)}
                disabled={processing}
                className="glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                90°
              </button>
              <button
                onClick={() => handleRotate(180)}
                disabled={processing}
                className="glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                180°
              </button>
              <button
                onClick={() => handleRotate(270)}
                disabled={processing}
                className="glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                270°
              </button>
            </div>
          </div>

          {/* Extract */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Extract
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleExtractText}
                disabled={processing}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                Extract Text
              </button>
              <button
                onClick={handleExtractImages}
                disabled={processing}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                Extract Images
              </button>
            </div>
          </div>

          {/* Merge */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Merge PDFs
            </h3>
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
              <button
                onClick={handleAddPdf}
                disabled={processing}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add More PDFs
              </button>
              {additionalPdfs.length > 0 && (
                <button
                  onClick={handleMergePdfs}
                  disabled={processing}
                  className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50 bg-blue-500/20"
                >
                  Merge All
                </button>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="glass-card rounded-3xl p-6">
            <button
              onClick={() => toggleCard('metadata')}
              className="w-full text-left text-white font-semibold flex items-center justify-between gap-2 py-2 hover:text-white/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Metadata
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
                  expandedCard === 'metadata' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedCard === 'metadata' && (
              <div className="mt-4 space-y-4">
                {metadata && (() => {
                  const entries = getMetadataEntries();
                  const displayEntries = entries.slice(0, 6);
                  const hasMore = entries.length > 6;
                  
                  return (
                    <div className="space-y-2 text-sm">
                      {displayEntries.map((entry, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-white/60">{entry.key}:</span>
                          <span className="text-white text-right max-w-[60%] truncate" title={entry.value}>
                            {entry.value}
                          </span>
                        </div>
                      ))}
                      {hasMore && (
                        <div className="pt-2 border-t border-white/10">
                          <button
                            onClick={handleOpenMetadataDetail}
                            className="w-full glass-card px-3 py-2 rounded-xl text-white/80 text-xs transition-all duration-300 hover:text-white hover:scale-105 flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View All {entries.length} Properties
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Status */}
          {status && (
            <div className="glass-card rounded-3xl p-4">
              <p className="text-white/80 text-sm">{status}</p>
            </div>
          )}
        </div>

        {/* Right column - Preview/Output */}
        <div className="glass-card rounded-3xl p-6 overflow-hidden">
          {extractedText ? (
            <div className="h-full flex flex-col">
              <h3 className="text-white font-semibold mb-4">Extracted Text</h3>
              <div className="flex-1 overflow-y-auto">
                <pre className="text-white/80 text-sm whitespace-pre-wrap">
                  {extractedText}
                </pre>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">
                  PDF operations will appear here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metadata Detail Modal */}
      {showMetadataDetail && metadata && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMetadataDetail(false)}
        >
          <div 
            className="glass-card rounded-3xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Metadata Details</h3>
              <button
                onClick={() => setShowMetadataDetail(false)}
                className="glass-card p-2 rounded-xl text-white hover:scale-105 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {getMetadataEntries().map((entry, idx) => (
                <div key={idx} className="flex justify-between items-start py-2 border-b border-white/10 text-sm">
                  <span className="text-white/60 font-medium min-w-[40%]">{entry.key}:</span>
                  <span className="text-white text-right flex-1 break-words">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PdfProcessor;
