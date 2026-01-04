/**
 * Utility functions for file path operations
 */

/**
 * Gets the file extension from a path
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Changes the file extension in a path
 */
export function changeFileExtension(path: string, newExt: string): string {
  const ext = getFileExtension(path);
  if (ext) {
    return path.replace(new RegExp(`\\.${ext}$`, 'i'), `.${newExt}`);
  }
  return `${path}.${newExt}`;
}

/**
 * Gets the file name from a path
 */
export function getFileName(path: string): string {
  return path.split('/').pop() || path.split('\\').pop() || path;
}

/**
 * Gets the directory name from a path
 */
export function getDirectoryName(path: string): string {
  const parts = path.split('/');
  if (parts.length === 1) {
    const parts2 = path.split('\\');
    return parts2.length > 1 ? parts2.slice(0, -1).join('\\') : '';
  }
  return parts.slice(0, -1).join('/');
}

/**
 * Generates an output filename with a suffix and optional extension
 * @param fileName - Original filename
 * @param suffix - Suffix to add before extension (e.g., '_trimmed', '_no_bg')
 * @param extension - Optional new extension (defaults to original extension)
 * @returns Generated filename with suffix
 */
export function generateOutputFileName(
  fileName: string,
  suffix: string,
  extension?: string
): string {
  const ext = extension || getFileExtension(fileName);
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  return `${baseName}${suffix}.${ext}`;
}
