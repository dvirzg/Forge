import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open, save } from '@tauri-apps/api/dialog';
import { readBinaryFile, writeBinaryFile } from '@tauri-apps/api/fs';
import { Header } from './shared/Header';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Toast } from './shared/Toast';
import { PDFDocument, rgb } from 'pdf-lib';
import { MergePdfView } from './merge/MergePdfView';
import { formatFileSize } from '../utils/fileUtils';
import { useToast } from '../hooks/useToast';
import { useProcessing } from '../hooks/useProcessing';
import { useFileSave } from '../hooks/useFileSave';
import { generateOutputFileName } from '../utils/pathUtils';
import { useMetadata } from '../hooks/useMetadata';
import { loadPdfAsBlobUrl } from '../utils/fileLoaders';
import { screenToPdfCoords, hexToRgb, ZoomState, PageDimensions } from '../utils/pdfUtils';
import { PdfViewer } from './pdf/PdfViewer';
import { PdfToolbar } from './pdf/PdfToolbar';
import { PdfTools } from './pdf/PdfTools';
import { SignatureModal } from './pdf/SignatureModal';
import { ProcessorLayout } from './shared/ProcessorLayout';
import { BaseProcessorProps } from '../types/processor';
import { PROCESSOR_CONSTANTS } from '../constants/processor';
import { usePreviewSize } from '../hooks/useWindowResize';

interface PdfProcessorProps extends BaseProcessorProps {
  multiplePdfs?: Array<{ path: string; name: string }>;
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
  const [pdfAspectRatio, setPdfAspectRatio] = useState<number | null>(null);
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
  const pageDimensionsRef = useRef<Map<number, PageDimensions>>(new Map());

  // Signature modal state
  const [savedSignatures, setSavedSignatures] = useState<string[]>([]);
  const [selectedSignatureToPlace, setSelectedSignatureToPlace] = useState<string | null>(null);
  const [isDraggingSignature, setIsDraggingSignature] = useState(false);
  const [draggedSignatureId, setDraggedSignatureId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const { toast, showToast } = useToast();
  const { processing, withProcessing } = useProcessing();
  const saveFile = useFileSave();

  // Set up PDF.js worker
  useEffect(() => {
    const setupWorker = async () => {
      try {
        const response = await fetch('/pdf.worker.min.js');
        if (response.ok) {
          const workerBlob = await response.blob();
          const workerUrl = URL.createObjectURL(workerBlob);
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          console.log('PDF worker configured from blob URL');
        } else {
          pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
          console.log('PDF worker configured from path:', pdfjs.GlobalWorkerOptions.workerSrc);
        }
      } catch (error) {
        console.error('Failed to set up PDF worker:', error);
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
        const url = await loadPdfAsBlobUrl(file.path);
        setPdfData(url);
        
        // Try to load PDF with pdf-lib for annotation support (non-blocking)
        try {
          const fileData = await readBinaryFile(file.path);
          const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
          const pdfDoc = await PDFDocument.load(arrayBuffer as ArrayBuffer, { ignoreEncryption: true });
          pdfDocRef.current = pdfDoc;
          
          // Store page dimensions for coordinate conversion
          const dimensions = new Map<number, PageDimensions>();
          const pageCount = pdfDoc.getPageCount();
          for (let i = 0; i < pageCount; i++) {
            const page = pdfDoc.getPage(i);
            const { width, height } = page.getSize();
            dimensions.set(i + 1, { width, height });
          }
          pageDimensionsRef.current = dimensions;
        } catch (pdfLibError) {
          console.warn('Failed to load PDF with pdf-lib (annotations disabled):', pdfLibError);
          pdfDocRef.current = null;
          pageDimensionsRef.current = new Map();
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
    await withProcessing(async () => {
      showToast(`Rotating PDF ${degrees}°...`);

      const outputPath = await saveFile(
        generateOutputFileName(file.name, `_rotated${degrees}`, 'pdf'),
        [{ name: 'PDF', extensions: ['pdf'] }]
      );

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
    }, (error) => {
      showToast(`Error: ${error}`);
    });
  };

  const handleExtractText = async () => {
    await withProcessing(async () => {
      showToast('Extracting text...');

      const text = await invoke<string>('extract_text', {
        inputPath: file.path,
      });

      setExtractedText(text);
      setViewMode('text');
      showToast('Text extracted successfully');
    }, (error) => {
      showToast(`Error: ${error}`);
    });
  };

  const handleExtractImages = async () => {
    await withProcessing(async () => {
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
    }, (error) => {
      showToast(`Error: ${error}`);
    });
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
    await withProcessing(async () => {
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
    }, (error) => {
      showToast(`Error: ${error}`);
    });
  };

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const { getBasicMetadataEntries, getAllMetadataEntries, hasExtendedMetadata } = useMetadata({
    metadata,
    getBasicEntries: (meta) => {
      const entries = [];
      entries.push({ key: 'Pages', value: meta.pages.toString() });
      entries.push({ key: 'File Size', value: formatFileSize(meta.file_size) });
      if (meta.pdf_version) entries.push({ key: 'PDF Version', value: meta.pdf_version });
      entries.push({ key: 'Encrypted', value: meta.encrypted ? 'Yes' : 'No' });
      if (meta.file_created) entries.push({ key: 'File Created', value: meta.file_created });
      if (meta.file_modified) entries.push({ key: 'File Modified', value: meta.file_modified });
      return entries;
    },
    getExtendedEntries: (meta) => {
      return Object.entries(meta.all_metadata).map(([key, value]) => ({ key, value }));
    },
  });

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

  // Reset aspect ratio when PDF or page changes
  useEffect(() => {
    setPdfAspectRatio(null);
  }, [pdfData, pageNumber]);

  // Calculate page size to fit viewport
  usePreviewSize({
    pdfData,
    pageNumber,
    numPages,
    pageContainerRef,
    pdfAspectRatio,
    setPdfAspectRatio,
    setPageWidth,
  });

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

  // Convert screen coordinates to PDF coordinates using utility
  const convertScreenToPdf = (screenX: number, screenY: number, pageNum: number): { pdfX: number; pdfY: number } | null => {
    return screenToPdfCoords(
      screenX,
      screenY,
      pageNum,
      pageContainerRef,
      pageElementRef,
      pageDimensionsRef.current,
      currentZoom,
      pageWidth
    );
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
      const pdfCoords = convertScreenToPdf(x, y, pageNumber);
      if (pdfCoords) {
        const sigWidth = PROCESSOR_CONSTANTS.SIGNATURE_WIDTH;
        const sigHeight = PROCESSOR_CONSTANTS.SIGNATURE_HEIGHT;
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

    // Handle highlight mode
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
          const pdfCoords = convertScreenToPdf(newX, newY, pageNumber);
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

      if (sw > PROCESSOR_CONSTANTS.MIN_SELECTION_SIZE && sh > PROCESSOR_CONSTANTS.MIN_SELECTION_SIZE) {
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
        const range = selection?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          const containerRect = pageContainerRef.current.getBoundingClientRect();
          const popupX = rect.left - containerRect.left + (rect.width / 2);
          const popupY = rect.top - containerRect.top - 10;

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
    if (currentZoom.scale <= 1) return;

    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.deltaX;
    const deltaY = e.deltaY;

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

        const startPdf = convertScreenToPdf(sx, sy, pageNumber);
        const endPdf = convertScreenToPdf(ex, ey, pageNumber);

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

    setShowTextPopup(false);
    setTextPopupPosition(null);
    selection?.removeAllRanges();
  };

  const handleSaveAnnotations = async () => {
    if (!pdfDocRef.current || (highlights.length === 0 && signatures.length === 0)) {
      showToast('No annotations to save');
      return;
    }

    await withProcessing(async () => {
      showToast('Saving annotations to PDF...');

      const pdfDoc = pdfDocRef.current!;

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
            opacity: PROCESSOR_CONSTANTS.HIGHLIGHT_OPACITY,
          });
        } catch (error) {
          console.error('Error adding highlight:', error);
        }
      });

      // Add signatures
      for (const signature of signatures) {
        try {
          const page = pdfDoc.getPage(signature.page - 1);
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

      const modifiedPdfBytes = await pdfDoc.save();

      const outputPath = await saveFile(
        generateOutputFileName(file.name, '_annotated', 'pdf'),
        [{ name: 'PDF', extensions: ['pdf'] }]
      );

      if (!outputPath) {
        return;
      }

      await writeBinaryFile(outputPath, modifiedPdfBytes);
      showToast('Annotations saved successfully!');
    }, (error) => {
      console.error('Error saving annotations:', error);
      showToast(`Error: ${error}`);
    });
  };

  const handleSaveSignature = (signature: string) => {
    setSavedSignatures([...savedSignatures, signature]);
  };

  const handleSelectSignature = (signature: string) => {
    setSelectedSignatureToPlace(signature);
  };

  const handlePageChange = (page: number) => {
    setPageNumber(page);
  };

  const handleZoomReset = () => {
    setCurrentZoom({ scale: 1, offsetX: 0, offsetY: 0 });
    setZoomHistory([]);
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        title="PDF Processing"
        fileName={file.name}
        onBack={onReset}
        rightContent={
          <PdfToolbar
            pdfData={pdfData}
            pdfDocAvailable={!!pdfDocRef.current}
            markupMode={markupMode}
            onMarkupModeChange={setMarkupMode}
            onOpenSignatureModal={() => setShowSignatureModal(true)}
            onClearMarkups={() => {
              setHighlights([]);
              setSignatures([]);
              setMarkupMode('none');
            }}
            hasMarkups={highlights.length > 0 || signatures.length > 0}
            markupColor={markupColor}
            onMarkupColorChange={setMarkupColor}
            onSaveAnnotations={handleSaveAnnotations}
            processing={processing}
            isZoomMode={isZoomMode}
            onZoomClick={handleZoomClick}
            onOpenPdfWindow={handleOpenPdfWindow}
          />
        }
      />

      <ProcessorLayout
        layout="flex"
        expandedCard={expandedCard}
        preview={
          <div className="flex-1 min-w-0 flex flex-col">
            {viewMode === 'text' && extractedText ? (
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
            ) : (
              <PdfViewer
                pdfData={pdfData}
                pdfLoading={pdfLoading}
                pdfError={pdfError}
                fileName={file.name}
                pageNumber={pageNumber}
                numPages={numPages}
                onDocumentLoadSuccess={onDocumentLoadSuccess}
                onDocumentLoadError={onDocumentLoadError}
                currentZoom={currentZoom}
                isZoomMode={isZoomMode}
                isSelecting={isSelecting}
                selectionStart={selectionStart}
                selectionEnd={selectionEnd}
                markupMode={markupMode}
                highlights={highlights}
                signatures={signatures}
                isDraggingSignature={isDraggingSignature}
                draggedSignatureId={draggedSignatureId}
                selectedSignatureToPlace={selectedSignatureToPlace}
                showTextPopup={showTextPopup}
                textPopupPosition={textPopupPosition}
                markupColor={markupColor}
                pageWidth={pageWidth}
                pageContainerRef={pageContainerRef}
                pageElementRef={pageElementRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                onHighlightSelection={handleHighlightSelection}
                onMarkupColorChange={setMarkupColor}
                onTextPopupClose={() => {
                  setShowTextPopup(false);
                  setTextPopupPosition(null);
                }}
              />
            )}
          </div>
        }
        sidebar={
          <PdfTools
            expandedCard={expandedCard}
            onToggleCard={toggleCard}
            processing={processing}
            onRotate={handleRotate}
            onExtractText={handleExtractText}
            onExtractImages={handleExtractImages}
            additionalPdfs={additionalPdfs}
            onAddPdf={handleAddPdf}
            onMergePdfs={handleMergePdfs}
            metadata={metadata}
            fileName={file.name}
            getBasicMetadataEntries={getBasicMetadataEntries}
            getAllMetadataEntries={getAllMetadataEntries}
            hasExtendedMetadata={hasExtendedMetadata}
            pageNumber={pageNumber}
            numPages={numPages}
            onPageChange={handlePageChange}
            onZoomReset={handleZoomReset}
          />
        }
      />

      {/* Signature Modal */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        savedSignatures={savedSignatures}
        onSelectSignature={handleSelectSignature}
        onSaveSignature={handleSaveSignature}
        showToast={showToast}
      />

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} id={toast.id} />}
    </div>
  );
}

export default PdfProcessor;
