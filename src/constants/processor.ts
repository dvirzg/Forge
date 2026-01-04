/**
 * Shared constants for file processors
 */
export const PROCESSOR_CONSTANTS = {
  SIDEBAR_WIDTH: 288, // w-72 = 18rem = 288px
  SIDEBAR_WIDTH_LARGE: 320, // w-80 = 20rem = 320px
  PREVIEW_PADDING: 20,
  SIGNATURE_WIDTH: 100,
  SIGNATURE_HEIGHT: 50,
  TOAST_DURATION: 3000,
  HIGHLIGHT_OPACITY: 0.4,
  MIN_SELECTION_SIZE: 10, // Minimum size for zoom selection
} as const;

/**
 * Video resolution presets
 */
export const VIDEO_RESOLUTIONS = {
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
} as const;

/**
 * Default video processing values
 */
export const VIDEO_DEFAULTS = {
  WIDTH: 1280,
  HEIGHT: 720,
  GIF_WIDTH: 480,
  FPS: 10,
} as const;
