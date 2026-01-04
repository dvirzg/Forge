import { useEffect, useRef, useState, useCallback } from 'react';
import { appWindow, LogicalSize, currentMonitor, primaryMonitor } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/tauri';
import { pdfjs } from 'react-pdf';
import { PROCESSOR_CONSTANTS } from '../constants/processor';

type FileType = 'image' | 'pdf' | 'video' | 'text' | null;

export const LAYOUT_CONSTANTS = {
  HEADER_HEIGHT: 40,
  TOOLBAR_WIDTH: 256,
  TOOLBAR_MIN_HEIGHT: 400,
  APP_PADDING_X: 48, // px-6 * 2
  APP_PADDING_Y: 64, // pt-10 + pb-6
  LAYOUT_GAP: 16, // gap-4
  MIN_PREVIEW_WIDTH: 480,
  MAX_PREVIEW_WIDTH: 1400, // Safe max width for laptop screens
  MAX_PREVIEW_HEIGHT: 1000,
} as const;

export function useWindowResize(fileType: FileType, filePath?: string) {
  const resizeWindow = useCallback(async () => {
    const monitor = (await currentMonitor()) || (await primaryMonitor());
    if (!monitor) return;

    if (!fileType || !filePath) {
      const size = Math.min(monitor.size.width, monitor.size.height) * 0.2;
      await appWindow.setMinSize(new LogicalSize(400, 400));
      await appWindow.setSize(new LogicalSize(size, size));
      await appWindow.center();
    } else {
      // Calculate file dimensions and aspect ratio
      let fileWidth = 1280;
      let fileHeight = 720;

      try {
        if (fileType === 'image') {
          const meta = await invoke<any>('get_image_metadata', { inputPath: filePath });
          fileWidth = meta.width;
          fileHeight = meta.height;

          // Check EXIF orientation to see if dimensions should be swapped (90 or 270 deg rotation)
          // We consciously avoid just checking for 'left'/'right' to avoid false positives like "column 0 at left"
          const orientation = (meta.exif?.Orientation || '').toLowerCase();
          if (
            orientation.includes('row 0 at left') ||
            orientation.includes('row 0 at right') ||
            orientation.startsWith('left') ||
            orientation.startsWith('right')
          ) {
            [fileWidth, fileHeight] = [fileHeight, fileWidth];
          }
        } else if (fileType === 'video') {
          const meta = await invoke<any>('get_video_metadata', { inputPath: filePath });
          fileWidth = meta.width || 1280;
          fileHeight = meta.height || 720;
        } else if (fileType === 'pdf') {
          fileWidth = 595; // A4 width
          fileHeight = 842; // A4 height
        }
      } catch (e) {
        console.error('Failed to get file dimensions:', e);
      }

      const fileAspectRatio = fileWidth / fileHeight;

      // Convert physical monitor dimensions to logical dimensions to handle High DPI (Retina) correctly
      const scaleFactor = monitor.scaleFactor;
      const logicalDisplayWidth = monitor.size.width / scaleFactor;
      const logicalDisplayHeight = monitor.size.height / scaleFactor;

      // Default preview size targets (50% of logical screen size)
      const targetPreviewWidthBox = logicalDisplayWidth * 0.5;
      const targetPreviewHeightBox = logicalDisplayHeight * 0.5;

      let previewWidth, previewHeight;
      if (fileAspectRatio > targetPreviewWidthBox / targetPreviewHeightBox) {
        previewWidth = targetPreviewWidthBox;
        previewHeight = targetPreviewWidthBox / fileAspectRatio;
      } else {
        previewHeight = targetPreviewHeightBox;
        previewWidth = targetPreviewHeightBox * fileAspectRatio;
      }

      // Apply minimum preview width to avoid "too thin" windows for portrait images
      if (previewWidth < LAYOUT_CONSTANTS.MIN_PREVIEW_WIDTH) {
        previewWidth = LAYOUT_CONSTANTS.MIN_PREVIEW_WIDTH;
        previewHeight = previewWidth / fileAspectRatio;

        // Ensure preview height doesn't exceed 60% of logical display height
        const maxHeight = logicalDisplayHeight * 0.6;
        if (previewHeight > maxHeight) {
          previewHeight = maxHeight;
          previewWidth = previewHeight * fileAspectRatio;
        }
      }

      // Apply safe maximums to ensure portability between screens (Large -> Small Monitor)
      // Cap Width
      if (previewWidth > LAYOUT_CONSTANTS.MAX_PREVIEW_WIDTH) {
        previewWidth = LAYOUT_CONSTANTS.MAX_PREVIEW_WIDTH;
        previewHeight = previewWidth / fileAspectRatio;
      }
      // Cap Height (global safe max)
      if (previewHeight > LAYOUT_CONSTANTS.MAX_PREVIEW_HEIGHT) {
        previewHeight = LAYOUT_CONSTANTS.MAX_PREVIEW_HEIGHT;
        previewWidth = previewHeight * fileAspectRatio;
      }

      // Add the constant side paddings and add them around the preview
      const totalWidth = previewWidth + LAYOUT_CONSTANTS.TOOLBAR_WIDTH + LAYOUT_CONSTANTS.LAYOUT_GAP + LAYOUT_CONSTANTS.APP_PADDING_X;
      const totalHeight = Math.max(
        previewHeight + LAYOUT_CONSTANTS.HEADER_HEIGHT + LAYOUT_CONSTANTS.APP_PADDING_Y,
        LAYOUT_CONSTANTS.TOOLBAR_MIN_HEIGHT + LAYOUT_CONSTANTS.APP_PADDING_Y
      );

      await appWindow.setMinSize(new LogicalSize(400, 400));
      await appWindow.setSize(new LogicalSize(Math.ceil(totalWidth), Math.ceil(totalHeight)));
      await appWindow.center();
    }
  }, [fileType, filePath]);

  useEffect(() => {
    resizeWindow();
  }, [resizeWindow]);
}

export function useToolsContainerResize(expandedCard: string | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [originalHeight, setOriginalHeight] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = async () => {
      if (!containerRef.current) return;

      const expandedElement = containerRef.current.querySelector(
        `[data-collapsible-id="${expandedCard}"]`
      ) as HTMLElement | null;

      if (!expandedCard || !expandedElement) {
        if (originalHeight !== null) {
          const currentSize = await appWindow.innerSize();
          await appWindow.setSize(new LogicalSize(currentSize.width, originalHeight));
          setOriginalHeight(null);
        }
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const expandedBottom = expandedElement.getBoundingClientRect().bottom;
      const viewportHeight = window.innerHeight;

      if (expandedBottom > viewportHeight) {
        const currentSize = await appWindow.innerSize();
        if (originalHeight === null) {
          setOriginalHeight(currentSize.height);
        }

        const neededHeight = Math.ceil(expandedBottom - viewportHeight + 40);
        const newHeight = currentSize.height + neededHeight;

        if (newHeight > currentSize.height) {
          await appWindow.setSize(new LogicalSize(currentSize.width, newHeight));
        }
      }
    };

    const timeoutId = setTimeout(handleResize, 150);
    return () => clearTimeout(timeoutId);
  }, [expandedCard, originalHeight]);

  return containerRef;
}

interface UsePreviewSizeOptions {
  pdfData: string | null;
  pageNumber: number;
  numPages: number | null;
  pageContainerRef: React.RefObject<HTMLDivElement>;
  pdfAspectRatio: number | null;
  setPdfAspectRatio: (ratio: number | null) => void;
  setPageWidth: (width: number) => void;
  padding?: number;
  maxScale?: number;
}

export function usePreviewSize({
  pdfData,
  pageNumber,
  numPages,
  pageContainerRef,
  pdfAspectRatio,
  setPdfAspectRatio,
  setPageWidth,
  padding = PROCESSOR_CONSTANTS.PREVIEW_PADDING,
  maxScale,
}: UsePreviewSizeOptions) {
  const calculateSize = useCallback(async () => {
    if (!pdfData || !numPages || !pageContainerRef.current) return;

    try {
      const pdf = await pdfjs.getDocument(pdfData).promise;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.0 });
      const aspectRatio = viewport.height / viewport.width;

      if (pdfAspectRatio === null) {
        setPdfAspectRatio(aspectRatio);
      }

      const containerRect = pageContainerRef.current.getBoundingClientRect();
      const availableWidth = containerRect.width - padding * 2;
      const availableHeight = containerRect.height - padding * 2;

      const scaleX = availableWidth / viewport.width;
      const scaleY = availableHeight / viewport.height;
      const scale = maxScale !== undefined
        ? Math.min(scaleX, scaleY, maxScale)
        : Math.min(scaleX, scaleY);

      setPageWidth(viewport.width * scale);
    } catch (error) {
      console.error('Failed to calculate preview size:', error);
    }
  }, [pdfData, pageNumber, numPages, pdfAspectRatio, padding, maxScale, pageContainerRef, setPdfAspectRatio, setPageWidth]);

  useEffect(() => {
    calculateSize();
  }, [calculateSize]);

  useEffect(() => {
    if (!pageContainerRef.current) return;

    const resizeObserver = new ResizeObserver(calculateSize);
    resizeObserver.observe(pageContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [calculateSize, pageContainerRef]);
}
