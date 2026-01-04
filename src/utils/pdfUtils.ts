/**
 * PDF coordinate conversion utilities
 */

export interface ZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface PageDimensions {
  width: number;
  height: number;
}

/**
 * Converts screen coordinates to PDF coordinates
 */
export function screenToPdfCoords(
  screenX: number,
  screenY: number,
  pageNum: number,
  pageContainerRef: React.RefObject<HTMLDivElement>,
  pageElementRef: React.RefObject<HTMLDivElement>,
  pageDimensions: Map<number, PageDimensions>,
  currentZoom: ZoomState,
  pageWidth: number
): { pdfX: number; pdfY: number } | null {
  if (!pageContainerRef.current || !pageElementRef.current) return null;
  
  const pageDims = pageDimensions.get(pageNum);
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
}

/**
 * Converts hex color to RGB values (0-1 range)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 1, g: 1, b: 0 }; // Default to yellow
}
