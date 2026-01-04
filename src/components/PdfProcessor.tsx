import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save, open } from '@tauri-apps/api/dialog';
import { readBinaryFile, writeBinaryFile } from '@tauri-apps/api/fs';
import { RotateCw, FileText, Download, Plus, ChevronLeft, ChevronRight, ExternalLink, ZoomIn, Highlighter, PenTool, Eraser, Save, Check, X } from 'lucide-react';
import { Header } from './shared/Header';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { CollapsibleSection } from './shared/CollapsibleSection';
import { ActionButton } from './shared/ActionButton';
import { Toast } from './shared/Toast';
import { MetadataSection } from './shared/MetadataSection';
import { PDFDocument, rgb } from 'pdf-lib';
import { MergePdfView } from './merge/MergePdfView';
import { formatFileSize } from '../utils/fileUtils';


interface PdfProcessorProps {
  file: {
    path: string;
    name: string;
  };
  multiplePdfs?: Array<{ path: string; name: string }>;
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

interface ZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface Highlight {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  page: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
}

type MarkupMode = 'none' | 'highlight';

interface Signature {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
}

function PdfProcessor({ file, multiplePdfs, onReset }: PdfProcessorProps) {
  // If merge mode, render MergePdfView instead
  const isMergeMode = !!multiplePdfs && multiplePdfs.length > 1;

  if (isMergeMode) {
    return <MergePdfView initialPdfs={multiplePdfs!} onReset={onReset} />;
  }

  // Existing single-PDF functionality continues below
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
  const [pageWidth, setPageWidth] = useState(800);
  const [isZoomMode, setIsZoomMode] = useState(false);
  const [zoomHistory, setZoomHistory] = useState<ZoomState[]>([]);
  const [currentZoom, setCurrentZoom] = useState<ZoomState>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const pageElementRef = useRef<HTMLDivElement>(null);

  // Markup state
  const [markupMode, setMarkupMode] = useState<MarkupMode>('none');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [markupColor, setMarkupColor] = useState('#FFFF00');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showTextPopup, setShowTextPopup] = useState(false);
  const [textPopupPosition, setTextPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const pdfDocRef = useRef<PDFDocument | null>(null);
  const pageDimensionsRef = useRef<Map<number, { width: number; height: number }>>(new Map());

  // Signature modal state
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [savedSignatures, setSavedSignatures] = useState<string[]>([]);
  const [signatureColor, setSignatureColor] = useState('#000000');
  const [selectedSignatureToPlace, setSelectedSignatureToPlace] = useState<string | null>(null);
  const [isDraggingSignature, setIsDraggingSignature] = useState(false);
  const [draggedSignatureId, setDraggedSignatureId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
        
        // Try to load PDF with pdf-lib for annotation support (non-blocking)
        // Some encrypted or corrupted PDFs may not load with pdf-lib
        try {
          const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
          const pdfDoc = await PDFDocument.load(arrayBuffer as ArrayBuffer, { ignoreEncryption: true });
          pdfDocRef.current = pdfDoc;
          
          // Store page dimensions for coordinate conversion
          const dimensions = new Map<number, { width: number; height: number }>();
          const pageCount = pdfDoc.getPageCount();
          for (let i = 0; i < pageCount; i++) {
            const page = pdfDoc.getPage(i);
            const { width, height } = page.getSize();
            dimensions.set(i + 1, { width, height });
          }
          pageDimensionsRef.current = dimensions;
        } catch (pdfLibError) {
          // If pdf-lib fails, log but don't block PDF display
          // The PDF can still be viewed, but annotations won't work
          console.warn('Failed to load PDF with pdf-lib (annotations disabled):', pdfLibError);
          pdfDocRef.current = null;
          pageDimensionsRef.current = new Map();
          // Clear any existing annotations since they can't be saved
          setHighlights([]);
          setSignatures([]);
        }

        // Clear previous annotations
        setHighlights([]);
        setSignatures([]);
        
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

  // Calculate page size to fit viewport (both width and height)
  const calculatePageSize = useCallback(async () => {
    if (typeof window === 'undefined' || !pdfData || !numPages || !pageContainerRef.current) return;

    try {
      const pdf = await pdfjs.getDocument(pdfData).promise;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.0 });

      // Get actual container dimensions
      const containerRect = pageContainerRef.current.getBoundingClientRect();
      const padding = 20; // Minimal padding around the page
      const availableWidth = containerRect.width - padding * 2;
      const availableHeight = containerRect.height - padding * 2;

      // Calculate scale to fit both dimensions, allow up to 150% for readability
      const scaleX = availableWidth / viewport.width;
      const scaleY = availableHeight / viewport.height;
      const scale = Math.min(scaleX, scaleY, 1.5);

      setPageWidth(viewport.width * scale);
    } catch (error) {
      console.error('Failed to calculate page size:', error);
    }
  }, [pdfData, pageNumber, numPages]);

  useEffect(() => {
    calculatePageSize();
  }, [calculatePageSize]);

  // Recalculate page size when container size changes
  useEffect(() => {
    if (!pageContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      calculatePageSize();
    });

    resizeObserver.observe(pageContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculatePageSize]);

  // Reset zoom when page changes
  useEffect(() => {
    setCurrentZoom({ scale: 1, offsetX: 0, offsetY: 0 });
    setZoomHistory([]);
    setIsZoomMode(false);
  }, [pageNumber]);

  // Handle ESC key to exit modes or go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSignatureModal) {
          setShowSignatureModal(false);
        } else if (selectedSignatureToPlace) {
          setSelectedSignatureToPlace(null);
        } else if (showTextPopup) {
          setShowTextPopup(false);
          setTextPopupPosition(null);
        } else if (isSelecting) {
          setIsSelecting(false);
          setSelectionStart(null);
          setSelectionEnd(null);
        } else if (markupMode !== 'none') {
          setMarkupMode('none');
        } else if (zoomHistory.length > 0) {
          const previousZoom = zoomHistory[zoomHistory.length - 1];
          setZoomHistory(zoomHistory.slice(0, -1));
          setCurrentZoom(previousZoom);
        } else if (currentZoom.scale !== 1) {
          setCurrentZoom({ scale: 1, offsetX: 0, offsetY: 0 });
          setZoomHistory([]);
        } else if (isZoomMode) {
          setIsZoomMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomMode, isSelecting, markupMode, showSignatureModal, showTextPopup, selectedSignatureToPlace, zoomHistory, currentZoom]);

  const handleZoomClick = () => {
    setIsZoomMode(true);
  };

  // Convert screen coordinates to PDF coordinates
  const screenToPdfCoords = (screenX: number, screenY: number, pageNum: number): { pdfX: number; pdfY: number } | null => {
    if (!pageContainerRef.current || !pageElementRef.current) return null;
    
    const pageDims = pageDimensionsRef.current.get(pageNum);
    if (!pageDims) return null;
    
    const containerRect = pageContainerRef.current.getBoundingClientRect();
    const pageCenterX = containerRect.width / 2;
    const pageCenterY = containerRect.height / 2;
    
    // Get position relative to page center (accounting for zoom and offset)
    const relativeX = (screenX - pageCenterX - currentZoom.offsetX) / currentZoom.scale;
    const relativeY = (screenY - pageCenterY - currentZoom.offsetY) / currentZoom.scale;
    
    // Convert to PDF coordinates (scale based on page width)
    const scale = pageDims.width / pageWidth;
    const pdfX = relativeX * scale;
    // PDF has origin at bottom-left, so flip Y coordinate
    const pdfY = pageDims.height - (relativeY * scale);
    
    return { pdfX, pdfY };
  };

  // Convert hex color to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : { r: 1, g: 1, b: 0 }; // Default to yellow
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!pageContainerRef.current) return;

    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Hide text popup when clicking
    if (showTextPopup) {
      setShowTextPopup(false);
      setTextPopupPosition(null);
    }

    // Check if clicking on an existing signature to drag it
    const clickedSignature = signatures
      .filter(sig => sig.page === pageNumber)
      .find(sig => {
        return x >= sig.x && x <= sig.x + sig.width &&
               y >= sig.y && y <= sig.y + sig.height;
      });

    if (clickedSignature) {
      setIsDraggingSignature(true);
      setDraggedSignatureId(clickedSignature.id);
      setDragOffset({
        x: x - clickedSignature.x,
        y: y - clickedSignature.y,
      });
      return;
    }

    // Handle placing a selected signature
    if (selectedSignatureToPlace) {
      const pdfCoords = screenToPdfCoords(x, y, pageNumber);
      if (pdfCoords) {
        // Create signature with default size (100x50px)
        const sigWidth = 100;
        const sigHeight = 50;
        const pdfWidth = (pdfCoords.pdfX / pageWidth) * sigWidth;
        const pdfHeight = (pdfCoords.pdfY / pageWidth) * sigHeight;

        const newSignature: Signature = {
          id: Date.now().toString(),
          dataUrl: selectedSignatureToPlace,
          x,
          y,
          width: sigWidth,
          height: sigHeight,
          page: pageNumber,
          pdfX: pdfCoords.pdfX,
          pdfY: pdfCoords.pdfY,
          pdfWidth,
          pdfHeight,
        };
        setSignatures([...signatures, newSignature]);
        setSelectedSignatureToPlace(null);
        showToast('Signature placed! Click and drag to reposition.');
      }
      return;
    }

    // Handle zoom mode
    if (isZoomMode) {
      e.preventDefault();
      e.stopPropagation();
      setIsSelecting(true);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });
      return;
    }

    // Handle highlight mode (let text selection happen naturally)
    if (markupMode === 'highlight') {
      setIsSelecting(true);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!pageContainerRef.current) return;

    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Handle signature dragging
    if (isDraggingSignature && draggedSignatureId) {
      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;

      setSignatures(signatures.map(sig => {
        if (sig.id === draggedSignatureId) {
          const pdfCoords = screenToPdfCoords(newX, newY, pageNumber);
          if (pdfCoords) {
            return {
              ...sig,
              x: newX,
              y: newY,
              pdfX: pdfCoords.pdfX,
              pdfY: pdfCoords.pdfY,
            };
          }
        }
        return sig;
      }));
      return;
    }

    // Handle zoom selection
    if (isSelecting && selectionStart && isZoomMode) {
      e.preventDefault();
      e.stopPropagation();
      setSelectionEnd({ x, y });
      return;
    }

    // Handle highlight selection
    if (isSelecting && selectionStart && markupMode === 'highlight') {
      setSelectionEnd({ x, y });
    }
  };

  const handleMouseUp = () => {
    // Handle signature dragging
    if (isDraggingSignature) {
      setIsDraggingSignature(false);
      setDraggedSignatureId(null);
      return;
    }

    // Handle zoom mode
    if (isSelecting && selectionStart && selectionEnd && isZoomMode && pageContainerRef.current) {
      const containerRect = pageContainerRef.current.getBoundingClientRect();
      const sx = Math.min(selectionStart.x, selectionEnd.x);
      const sy = Math.min(selectionStart.y, selectionEnd.y);
      const ex = Math.max(selectionStart.x, selectionEnd.x);
      const ey = Math.max(selectionStart.y, selectionEnd.y);
      const sw = ex - sx;
      const sh = ey - sy;

      if (sw > 10 && sh > 10) {
        const selCenterX = (sx + ex) / 2 - containerRect.width / 2;
        const selCenterY = (sy + ey) / 2 - containerRect.height / 2;
        const pagePointX = (selCenterX - currentZoom.offsetX) / currentZoom.scale;
        const pagePointY = (selCenterY - currentZoom.offsetY) / currentZoom.scale;
        const newScale = Math.min(containerRect.width / sw, containerRect.height / sh) * currentZoom.scale;
        const newOffsetX = -pagePointX * newScale;
        const newOffsetY = -pagePointY * newScale;

        setZoomHistory([...zoomHistory, currentZoom]);
        setCurrentZoom({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
      }

      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      setIsZoomMode(false);
      return;
    }

    // Handle text selection for highlight mode - show popup
    if (markupMode === 'highlight') {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '';

      if (selectedText && selectedText.trim() && pageContainerRef.current) {
        // Show popup at selection position
        const range = selection?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          const containerRect = pageContainerRef.current.getBoundingClientRect();
          const popupX = rect.left - containerRect.left + (rect.width / 2);
          const popupY = rect.top - containerRect.top - 10; // Slightly above selection

          setTextPopupPosition({ x: popupX, y: popupY });
          setShowTextPopup(true);
        }
      }
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Only allow panning when zoomed in (scale > 1)
    if (currentZoom.scale <= 1) return;

    e.preventDefault();
    e.stopPropagation();

    // Use deltaX and deltaY for trackpad/scroll wheel panning
    const deltaX = e.deltaX;
    const deltaY = e.deltaY;

    // Update offset to pan the view
    const newOffsetX = currentZoom.offsetX - deltaX;
    const newOffsetY = currentZoom.offsetY - deltaY;

    setCurrentZoom({ ...currentZoom, offsetX: newOffsetX, offsetY: newOffsetY });
  };

  const handleHighlightSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';

    if (selectedText && selectedText.trim() && pageContainerRef.current) {
      const range = selection?.getRangeAt(0);
      if (range) {
        const rect = range.getBoundingClientRect();
        const containerRect = pageContainerRef.current.getBoundingClientRect();
        const sx = rect.left - containerRect.left;
        const sy = rect.top - containerRect.top;
        const ex = rect.right - containerRect.left;
        const ey = rect.bottom - containerRect.top;

        // Convert to PDF coordinates
        const startPdf = screenToPdfCoords(sx, sy, pageNumber);
        const endPdf = screenToPdfCoords(ex, ey, pageNumber);

        if (startPdf && endPdf) {
          const pdfWidth = Math.abs(endPdf.pdfX - startPdf.pdfX);
          const pdfHeight = Math.abs(endPdf.pdfY - startPdf.pdfY);
          const pdfX = Math.min(startPdf.pdfX, endPdf.pdfX);
          const pdfY = Math.min(startPdf.pdfY, endPdf.pdfY);

          const newHighlight: Highlight = {
            id: Date.now().toString(),
            x: sx,
            y: sy,
            width: ex - sx,
            height: ey - sy,
            color: markupColor,
            text: selectedText,
            page: pageNumber,
            pdfX,
            pdfY,
            pdfWidth,
            pdfHeight,
          };
          setHighlights([...highlights, newHighlight]);
        }
      }
    }

    // Clear popup and selection
    setShowTextPopup(false);
    setTextPopupPosition(null);
    selection?.removeAllRanges();
  };

  const handleSaveAnnotations = async () => {
    if (!pdfDocRef.current || (highlights.length === 0 && signatures.length === 0)) {
      showToast('No annotations to save');
      return;
    }

    try {
      setProcessing(true);
      showToast('Saving annotations to PDF...');

      const pdfDoc = pdfDocRef.current;

      // Add highlights
      highlights.forEach((highlight) => {
        try {
          const page = pdfDoc.getPage(highlight.page - 1);
          const highlightColor = hexToRgb(highlight.color);
          page.drawRectangle({
            x: highlight.pdfX,
            y: highlight.pdfY,
            width: highlight.pdfWidth,
            height: highlight.pdfHeight,
            color: rgb(highlightColor.r, highlightColor.g, highlightColor.b),
            opacity: 0.4,
          });
        } catch (error) {
          console.error('Error adding highlight:', error);
        }
      });

      // Add signatures
      for (const signature of signatures) {
        try {
          const page = pdfDoc.getPage(signature.page - 1);
          // Convert data URL to image bytes
          const imageBytes = await fetch(signature.dataUrl).then(res => res.arrayBuffer());
          const image = await pdfDoc.embedPng(imageBytes);
          page.drawImage(image, {
            x: signature.pdfX,
            y: signature.pdfY,
            width: signature.pdfWidth,
            height: signature.pdfHeight,
          });
        } catch (error) {
          console.error('Error adding signature:', error);
        }
      }

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();

      // Prompt user to save
      const outputPath = await save({
        defaultPath: file.name.replace('.pdf', '_annotated.pdf'),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!outputPath) {
        return;
      }

      await writeBinaryFile(outputPath, modifiedPdfBytes);
      showToast('Annotations saved successfully!');
    } catch (error) {
      console.error('Error saving annotations:', error);
      showToast(`Error saving annotations: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  // Signature canvas functions
  const startDrawingSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    setIsDrawingSignature(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = signatureColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawingSignature = () => {
    setIsDrawingSignature(false);
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const saveSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setSavedSignatures([...savedSignatures, dataUrl]);
      clearSignatureCanvas();
      showToast('Signature saved!');
    }
  };

  const createSymbol = (symbol: 'check' | 'x') => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearSignatureCanvas();
    ctx.strokeStyle = signatureColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (symbol === 'check') {
      // Draw checkmark
      ctx.beginPath();
      ctx.moveTo(50, 100);
      ctx.lineTo(100, 150);
      ctx.lineTo(250, 50);
      ctx.stroke();
    } else if (symbol === 'x') {
      // Draw X
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.lineTo(250, 150);
      ctx.moveTo(250, 50);
      ctx.lineTo(50, 150);
      ctx.stroke();
    }

    // Auto-save symbol
    const dataUrl = canvas.toDataURL('image/png');
    setSavedSignatures([...savedSignatures, dataUrl]);
    clearSignatureCanvas();
    showToast(`${symbol === 'check' ? 'Checkmark' : 'X'} symbol saved!`);
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        title="PDF Processing"
        fileName={file.name}
        onBack={onReset}
        rightContent={
          <div className="flex items-center gap-2">
            {/* Markup Tools */}
            <button
              onClick={() => setMarkupMode(markupMode === 'highlight' ? 'none' : 'highlight')}
              disabled={!pdfData || !pdfDocRef.current}
              className={`glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50 ${
                markupMode === 'highlight' ? 'bg-yellow-500/30' : ''
              }`}
              title={!pdfDocRef.current ? "Annotations unavailable - PDF cannot be modified" : "Highlighter - Select text to highlight"}
            >
              <Highlighter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSignatureModal(true)}
              disabled={!pdfData || !pdfDocRef.current}
              className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50"
              title={!pdfDocRef.current ? "Annotations unavailable - PDF cannot be modified" : "Signature - Draw or select signatures and symbols"}
            >
              <PenTool className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setHighlights([]);
                setSignatures([]);
                setMarkupMode('none');
              }}
              disabled={!pdfData || (highlights.length === 0 && signatures.length === 0)}
              className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50"
              title="Clear all markups"
            >
              <Eraser className="w-4 h-4" />
            </button>

            {/* Color Picker */}
            {markupMode === 'highlight' && (
              <input
                type="color"
                value={markupColor}
                onChange={(e) => setMarkupColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-2 border-white/20"
                title="Choose highlight color"
              />
            )}

            {/* Save Annotations */}
            {(highlights.length > 0 || signatures.length > 0) && (
              <button
                onClick={handleSaveAnnotations}
                disabled={processing || !pdfDocRef.current}
                className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50 bg-green-500/30"
                title="Save annotations to PDF"
              >
                <Save className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleZoomClick}
              disabled={!pdfData}
              className={`glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50 ${
                isZoomMode ? 'bg-white/20' : ''
              }`}
              title="Zoom mode - Click and drag to select area"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenPdfWindow}
              disabled={!pdfData}
              className="glass-card p-2 rounded-lg text-white transition-all duration-300 hover:scale-105 disabled:opacity-50"
              title="Open PDF in separate window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Simple unified layout: Preview left, Tools right */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* PDF Preview Section */}
        <div className="flex-1 min-w-0 flex flex-col">
          {viewMode === 'text' && extractedText ? (
            /* Text View */
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Extracted Text</h3>
                <button
                  onClick={() => setViewMode('preview')}
                  className="glass-card px-3 py-1.5 rounded-lg text-white text-xs hover:scale-105 transition-all"
                >
                  Back to Preview
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <pre className="text-white/80 text-sm whitespace-pre-wrap">{extractedText}</pre>
              </div>
            </div>
          ) : pdfLoading ? (
            /* Loading */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div>
                <p className="text-white/60 text-sm">Loading PDF...</p>
              </div>
            </div>
          ) : pdfError ? (
            /* Error */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/60 text-sm mb-2">Failed to load PDF</p>
                <p className="text-white/40 text-xs">{file.name}</p>
              </div>
            </div>
          ) : pdfData ? (
            /* PDF Viewer */
            <div
              ref={pageContainerRef}
              className={`flex-1 relative overflow-hidden ${isZoomMode || isSelecting ? 'zoom-mode-active' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              style={{
                cursor: isZoomMode ? 'crosshair' :
                        selectedSignatureToPlace ? 'crosshair' :
                        isDraggingSignature ? 'grabbing' :
                        markupMode === 'highlight' ? 'text' :
                        currentZoom.scale > 1 ? 'grab' : 'default',
                userSelect: isZoomMode || isSelecting ? 'none' : 'auto',
                WebkitUserSelect: isZoomMode || isSelecting ? 'none' : 'auto',
              }}
            >
              {/* Page Element - Centered and transformed */}
              <div
                ref={pageElementRef}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${currentZoom.offsetX}px), calc(-50% + ${currentZoom.offsetY}px))`,
                  transformOrigin: 'center',
                  transition: isSelecting ? 'none' : 'transform 0.2s ease-out',
                }}
              >
                <Document
                  file={pdfData}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={<div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div><p className="text-white/60 text-sm">Loading PDF...</p></div>}
                  error={<div className="text-center text-white/60 text-sm">Failed to load PDF</div>}
                >
                  {numPages && (
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      width={pageWidth * currentZoom.scale}
                      loading={<div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto mb-2"></div><p className="text-white/60 text-sm">Loading page...</p></div>}
                      error={<div className="text-center text-white/60 text-sm">Failed to load page</div>}
                    />
                  )}
                </Document>
              </div>

              {/* Markup Layer - Highlights */}
              {highlights.filter(h => h.page === pageNumber).map((highlight) => (
                <div
                  key={highlight.id}
                  className="absolute pointer-events-none z-30"
                  style={{
                    left: `${highlight.x}px`,
                    top: `${highlight.y}px`,
                    width: `${highlight.width}px`,
                    height: `${highlight.height}px`,
                    backgroundColor: highlight.color,
                    opacity: 0.4,
                  }}
                  title={highlight.text}
                />
              ))}

              {/* Markup Layer - Signatures */}
              {signatures.filter(s => s.page === pageNumber).map((signature) => (
                <div
                  key={signature.id}
                  className="absolute z-30 cursor-move"
                  style={{
                    left: `${signature.x}px`,
                    top: `${signature.y}px`,
                    width: `${signature.width}px`,
                    height: `${signature.height}px`,
                    pointerEvents: isDraggingSignature && draggedSignatureId === signature.id ? 'none' : 'auto',
                  }}
                >
                  <img
                    src={signature.dataUrl}
                    alt="Signature"
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                </div>
              ))}

              {/* Selection Overlay */}
              {isSelecting && selectionStart && selectionEnd && (
                <div
                  className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none z-40"
                  style={{
                    left: `${Math.min(selectionStart.x, selectionEnd.x)}px`,
                    top: `${Math.min(selectionStart.y, selectionEnd.y)}px`,
                    width: `${Math.abs(selectionEnd.x - selectionStart.x)}px`,
                    height: `${Math.abs(selectionEnd.y - selectionStart.y)}px`,
                  }}
                />
              )}

              {/* Mode Indicators */}
              {isZoomMode && !isSelecting && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-card px-4 py-2 rounded-lg z-30 pointer-events-none">
                  <p className="text-white/90 text-sm">Click and drag to select area to zoom</p>
                </div>
              )}
              {markupMode === 'highlight' && !showTextPopup && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-card px-4 py-2 rounded-lg z-30 pointer-events-none">
                  <p className="text-white/90 text-sm">Select text to highlight</p>
                </div>
              )}
              {selectedSignatureToPlace && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-card px-4 py-2 rounded-lg z-30 pointer-events-none">
                  <p className="text-white/90 text-sm">Click to place signature (ESC to cancel)</p>
                </div>
              )}

              {/* Text Selection Popup */}
              {showTextPopup && textPopupPosition && (
                <div
                  className="absolute z-50"
                  style={{
                    left: `${textPopupPosition.x}px`,
                    top: `${textPopupPosition.y}px`,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <div className="glass-card px-3 py-2 rounded-lg flex items-center gap-2 shadow-lg">
                    <button
                      onClick={handleHighlightSelection}
                      className="px-3 py-1.5 rounded bg-yellow-500/30 text-white text-sm hover:bg-yellow-500/50 transition-colors"
                    >
                      Highlight
                    </button>
                    <input
                      type="color"
                      value={markupColor}
                      onChange={(e) => setMarkupColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border border-white/20"
                      title="Choose highlight color"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* No PDF */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">PDF operations will appear here</p>
              </div>
            </div>
          )}
        </div>

        {/* Tools Section */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden py-6">
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
                  onClick={() => {
                    setPageNumber(Math.max(1, pageNumber - 1));
                    setCurrentZoom({ scale: 1, offsetX: 0, offsetY: 0 });
                    setZoomHistory([]);
                  }}
                  disabled={pageNumber <= 1}
                  className="text-white/60 hover:text-white text-xs transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4 mx-auto" />
                </button>
                <div className="flex items-center justify-center">
                  <span className="text-white/80 text-xs">
                    {pageNumber} / {numPages}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setPageNumber(Math.min(numPages, pageNumber + 1));
                    setCurrentZoom({ scale: 1, offsetX: 0, offsetY: 0 });
                    setZoomHistory([]);
                  }}
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

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-semibold">Signature & Symbols</h3>
              <button
                onClick={() => setShowSignatureModal(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawing Canvas */}
            <div className="mb-4">
              <div className="bg-white rounded-lg overflow-hidden border-2 border-white/20">
                <canvas
                  ref={signatureCanvasRef}
                  width={600}
                  height={200}
                  onMouseDown={startDrawingSignature}
                  onMouseMove={drawSignature}
                  onMouseUp={stopDrawingSignature}
                  onMouseLeave={stopDrawingSignature}
                  className="w-full cursor-crosshair"
                  style={{ touchAction: 'none' }}
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={clearSignatureCanvas}
                  className="glass-card px-3 py-1.5 rounded-lg text-white text-sm hover:bg-white/10 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={saveSignature}
                  className="glass-card px-3 py-1.5 rounded-lg text-white text-sm bg-green-500/30 hover:bg-green-500/50 transition-colors"
                >
                  Save Signature
                </button>
                <input
                  type="color"
                  value={signatureColor}
                  onChange={(e) => setSignatureColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-2 border-white/20"
                  title="Choose signature color"
                />
              </div>
            </div>

            {/* Quick Symbols */}
            <div className="mb-4">
              <h4 className="text-white text-sm font-semibold mb-2">Quick Symbols</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => createSymbol('check')}
                  className="glass-card px-4 py-2 rounded-lg text-white hover:bg-green-500/30 transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Checkmark
                </button>
                <button
                  onClick={() => createSymbol('x')}
                  className="glass-card px-4 py-2 rounded-lg text-white hover:bg-red-500/30 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  X Mark
                </button>
              </div>
            </div>

            {/* Saved Signatures */}
            {savedSignatures.length > 0 && (
              <div>
                <h4 className="text-white text-sm font-semibold mb-2">Saved Signatures</h4>
                <div className="grid grid-cols-3 gap-2">
                  {savedSignatures.map((sig, idx) => (
                    <div
                      key={idx}
                      className="glass-card rounded-lg p-2 cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={() => {
                        setSelectedSignatureToPlace(sig);
                        setShowSignatureModal(false);
                        showToast('Click on the PDF to place the signature. After placing, you can click and drag to reposition it.');
                      }}
                    >
                      <img
                        src={sig}
                        alt={`Signature ${idx + 1}`}
                        className="w-full h-16 object-contain bg-white rounded"
                      />
                    </div>
                  ))}
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
