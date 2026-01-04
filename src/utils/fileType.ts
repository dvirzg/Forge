/**
 * File type detection utilities
 */

export const FILE_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'tiff'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'mp3', 'wav', 'aac', 'flac'],
  pdf: ['pdf'],
  text: ['txt', 'md', 'json', 'xml', 'csv'],
} as const;

export type FileType = 'image' | 'pdf' | 'video' | 'text' | null;

/**
 * Detects file type from file extension
 */
export function detectFileType(fileName: string): FileType {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (FILE_EXTENSIONS.image.includes(extension as any)) return 'image';
  if (FILE_EXTENSIONS.pdf.includes(extension as any)) return 'pdf';
  if (FILE_EXTENSIONS.video.includes(extension as any)) return 'video';
  if (FILE_EXTENSIONS.text.includes(extension as any)) return 'text';
  
  return null;
}
