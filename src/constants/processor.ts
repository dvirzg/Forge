/**
 * Shared constants for file processors
 */
export const PROCESSOR_CONSTANTS = {
  SIDEBAR_WIDTH: 288, // w-72 = 18rem = 288px
  SIDEBAR_WIDTH_LARGE: 320, // w-80 = 20rem = 320px
  PREVIEW_PADDING: 20,
  MAX_PDF_SCALE: 1.5,
  SIGNATURE_WIDTH: 100,
  SIGNATURE_HEIGHT: 50,
  TOAST_DURATION: 3000,
  HIGHLIGHT_OPACITY: 0.4,
  MIN_SELECTION_SIZE: 10, // Minimum size for zoom selection
} as const;
