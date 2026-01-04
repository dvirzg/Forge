import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save, open } from '@tauri-apps/api/dialog';
import { readBinaryFile } from '@tauri-apps/api/fs';
import { RotateCw, FileText, Download, Plus, ChevronLeft, ChevronRight, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { Header } from './shared/Header';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
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
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'text'>('preview');
  const [viewModeLayout, setViewModeLayout] = useState<'default' | 'minimal'>('default');
  const [pageThumbnails, setPageThumbnails] = useState<Map<number, string>>(new Map());
  const [isEditingPageNumber, setIsEditingPageNumber] = useState(false);
  const [editedPageNumber, setEditedPageNumber] = useState('');

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

  // Set up PDF.js worker
  useEffect(() => {
    const setupWorker = async () => {
      try {
        // Try to load worker as a blob URL for Tauri compatibility
        const response = await fetch('/pdf.worker.min.js');
        if (response.ok) {
          const workerBlob = await response.blob();
          const workerUrl = URL.createObjectURL(workerBlob);
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          console.log('PDF worker configured from blob URL');
        } else {
          // Fallback to direct path
          pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
          console.log('PDF worker configured from path:', pdfjs.GlobalWorkerOptions.workerSrc);
        }
      } catch (error) {
        console.error('Failed to set up PDF worker:', error);
        // Fallback
        pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
      }
    };
    setupWorker();
  }, []);

  // Load PDF file
  useEffect(() => {
    const loadPdf = async () => {
      setPdfLoading(true);
      setPdfError(false);
      try {
        const fileData = await readBinaryFile(file.path);
        const blob = new Blob([fileData as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfData(url);
        setPageNumber(1);
        setViewMode('preview');
        setExtractedText('');
      } catch (error) {
        console.error('Failed to load PDF:', error);
        setPdfError(true);
      } finally {
        setPdfLoading(false);
      }
    };
    loadPdf();
  }, [file.path]);

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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDF loaded successfully, pages:', numPages);
    setNumPages(numPages);
    setPdfLoading(false);
    
    // Generate thumbnails for all pages
    if (pdfData && numPages) {
      const loadThumbnails = async () => {
        const thumbnails = new Map<number, string>();
        for (let i = 1; i <= Math.min(numPages, 10); i++) {
          try {
            // Load first 10 pages as thumbnails
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx && pdfData) {
              const pdf = await pdfjs.getDocument(pdfData).promise;
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 0.2 });
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: ctx, viewport, canvas }).promise;
              thumbnails.set(i, canvas.toDataURL());
            }
          } catch (error) {
            console.error(`Failed to load thumbnail for page ${i}:`, error);
          }
        }
        setPageThumbnails(thumbnails);
      };
      loadThumbnails();
    }
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setPdfError(true);
    setPdfLoading(false);
    showToast(`Failed to load PDF: ${error.message}`);
  };

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
      
      // Reload PDF from the new rotated file to show changes
      try {
        const fileData = await readBinaryFile(outputPath);
        const blob = new Blob([fileData as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfData(url);
        // Update PDF window if open
        await invoke('update_pdf_window', {
          pdfData: {
            pdfData: url,
            pageNumber,
            numPages,
            fileName: file.name,
          },
        });
      } catch (error) {
        console.error('Failed to reload rotated PDF:', error);
      }
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
      setViewMode('text');
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

  const handleOpenPdfWindow = async () => {
    if (!pdfData) return;
    
    try {
      await invoke('open_pdf_window', {
        pdfData: {
          pdfData,
          pageNumber,
          numPages,
          fileName: file.name,
        },
        windowTitle: `PDF Viewer - ${file.name}`,
      });
    } catch (error) {
      console.error('Failed to open PDF window:', error);
      showToast(`Error opening PDF window: ${error}`);
    }
  };

  // Update PDF window when page changes or PDF data changes
  useEffect(() => {
    if (pdfData) {
      invoke('update_pdf_window', {
        pdfData: {
          pdfData,
          pageNumber,
          numPages,
          fileName: file.name,
        },
      }).catch(console.error);
    }
  }, [pdfData, pageNumber, numPages, file.name]);

  // Calculate page width to fit window (for minimal view)
  const calculatePageWidth = () => {
    if (typeof window === 'undefined') return 800;
    const sidebarWidth = 200; // Page navigation sidebar
    const availableWidth = window.innerWidth - sidebarWidth;
    return Math.min(availableWidth * 0.98, 1400);
  };

  const [pageWidth, setPageWidth] = useState(calculatePageWidth());

  useEffect(() => {
    if (viewModeLayout === 'minimal') {
      const handleResize = () => {
        setPageWidth(calculatePageWidth());
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [viewModeLayout]);

  return (
    <div className="h-full flex flex-col">
      <Header
        title="PDF Processing"
        fileName={file.name}
        onBack={onReset}
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPdfWindow}
              disabled={!pdfData}
              className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50"
              title="Open PDF in separate window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewModeLayout(viewModeLayout === 'default' ? 'minimal' : 'default')}
              className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105"
              title={viewModeLayout === 'default' ? 'Switch to minimal view' : 'Switch to default view'}
            >
              {viewModeLayout === 'default' ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        }
      />

      {viewModeLayout === 'minimal' ? (
        // Minimal Layout
        <div className="flex-1 flex gap-2 min-h-0 overflow-hidden">
          {/* Page Navigation Sidebar */}
          {numPages && (
            <div className="w-48 flex-shrink-0 overflow-y-auto p-3 glass-card border-r border-white/10">
              <div className="text-white/60 text-xs font-semibold mb-3 px-2">Pages</div>
              <div className="space-y-2">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPageNumber(pageNum)}
                    className={`w-full p-2 rounded-lg text-left transition-all duration-200 ${
                      pageNumber === pageNum
                        ? 'glass-card bg-white/10 border border-white/20'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-10 bg-white/5 rounded flex items-center justify-center text-white/60 text-xs flex-shrink-0">
                        {pageThumbnails.has(pageNum) ? (
                          <img
                            src={pageThumbnails.get(pageNum)}
                            alt={`Page ${pageNum}`}
                            className="w-full h-full object-contain rounded"
                          />
                        ) : (
                          pageNum
                        )}
                      </div>
                      <span className="text-white/80 text-xs">Page {pageNum}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PDF Viewer - Center */}
          <div className="flex-1 flex items-center justify-center min-w-0 overflow-hidden">
            {viewMode === 'text' && extractedText ? (
              <div className="h-full w-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Extracted Text</h3>
                  <button
                    onClick={() => setViewMode('preview')}
                    className="glass-card px-3 py-1.5 rounded-lg text-white text-xs transition-all duration-300 hover:scale-105"
                  >
                    Back to Preview
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <pre className="text-white/80 text-sm whitespace-pre-wrap">
                    {extractedText}
                  </pre>
                </div>
              </div>
            ) : pdfLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
                  <p className="text-white/60 text-sm">Loading PDF...</p>
                </div>
              </div>
            ) : pdfError ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60 text-sm mb-2">Failed to load PDF</p>
                  <p className="text-white/40 text-xs">{file.name}</p>
                </div>
              </div>
            ) : pdfData ? (
              <div className="h-full w-full flex flex-col items-center justify-center relative">
                {/* Minimal Page Navigation - Floating */}
                {numPages && numPages > 1 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 glass-card px-4 py-2 rounded-full">
                    <button
                      onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                      disabled={pageNumber <= 1}
                      className="text-white transition-all duration-300 disabled:opacity-30 hover:scale-110"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-white/90 text-sm min-w-[80px] text-center">
                      {pageNumber} / {numPages}
                    </span>
                    <button
                      onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                      disabled={pageNumber >= numPages}
                      className="text-white transition-all duration-300 disabled:opacity-30 hover:scale-110"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
                
                {/* PDF Viewer - Fitted to Window */}
                <div className="w-full h-full overflow-auto flex items-center justify-center">
                  <Document
                    file={pdfData}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
                        <p className="text-white/60 text-sm">Loading PDF...</p>
                      </div>
                    }
                    error={
                      <div className="text-center text-white/60 text-sm">
                        Failed to load PDF
                      </div>
                    }
                  >
                    {numPages && (
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      width={pageWidth}
                        loading={
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
                            <p className="text-white/60 text-sm">Loading page...</p>
                          </div>
                        }
                        error={
                          <div className="text-center text-white/60 text-sm">
                            Failed to load page
                          </div>
                        }
                      />
                    )}
                  </Document>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
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
      ) : (
        // Default Layout
        <div className="flex-1 flex gap-6 min-h-0 items-start">
          {/* Preview - Left Side */}
          <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
            {viewMode === 'text' && extractedText ? (
              <div className="h-full w-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Extracted Text</h3>
                  <button
                    onClick={() => setViewMode('preview')}
                    className="glass-card px-3 py-1.5 rounded-lg text-white text-xs transition-all duration-300 hover:scale-105"
                  >
                    Back to Preview
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <pre className="text-white/80 text-sm whitespace-pre-wrap">
                    {extractedText}
                  </pre>
                </div>
              </div>
            ) : pdfLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
                  <p className="text-white/60 text-sm">Loading PDF...</p>
                </div>
              </div>
            ) : pdfError ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60 text-sm mb-2">Failed to load PDF</p>
                  <p className="text-white/40 text-xs">{file.name}</p>
                </div>
              </div>
            ) : pdfData ? (
              <div className="h-full w-full flex flex-col">
                {/* PDF Viewer */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-0">
                  <Document
                    file={pdfData}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
                        <p className="text-white/60 text-sm">Loading PDF document...</p>
                      </div>
                    }
                    error={
                      <div className="text-center text-white/60 text-sm">
                        Failed to load PDF document
                      </div>
                    }
                  >
                    {numPages && (
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      width={Math.min(window.innerWidth * 0.65, 1000)}
                        loading={
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
                            <p className="text-white/60 text-sm">Loading page...</p>
                          </div>
                        }
                        error={
                          <div className="text-center text-white/60 text-sm">
                            Failed to load page
                          </div>
                        }
                      />
                    )}
                  </Document>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60">
                    PDF operations will appear here
                  </p>
                </div>
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

          {/* Page Navigation */}
          {numPages && numPages > 1 && (
            <div>
              <div className="w-full text-left text-white font-semibold flex items-center gap-2 py-2">
                <span className="text-sm">Navigation</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                  disabled={pageNumber <= 1}
                  className="text-white/60 hover:text-white text-xs transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4 mx-auto" />
                </button>
                <div className="flex items-center justify-center">
                  {isEditingPageNumber ? (
                    <input
                      type="number"
                      min="1"
                      max={numPages}
                      value={editedPageNumber}
                      onChange={(e) => setEditedPageNumber(e.target.value)}
                      onBlur={() => {
                        const page = parseInt(editedPageNumber);
                        if (!isNaN(page) && page >= 1 && page <= numPages) {
                          setPageNumber(page);
                        }
                        setIsEditingPageNumber(false);
                        setEditedPageNumber('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const page = parseInt(editedPageNumber);
                          if (!isNaN(page) && page >= 1 && page <= numPages) {
                            setPageNumber(page);
                          }
                          setIsEditingPageNumber(false);
                          setEditedPageNumber('');
                        } else if (e.key === 'Escape') {
                          setIsEditingPageNumber(false);
                          setEditedPageNumber('');
                        }
                      }}
                      className="w-12 text-white/80 text-xs text-center bg-transparent border-none focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setIsEditingPageNumber(true);
                        setEditedPageNumber(pageNumber.toString());
                      }}
                      className="text-white/80 text-xs cursor-pointer hover:text-white transition-colors"
                    >
                      {pageNumber} / {numPages}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                  disabled={pageNumber >= numPages}
                  className="text-white/60 hover:text-white text-xs transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} id={toast.id} />}
    </div>
  );
}

export default PdfProcessor;
