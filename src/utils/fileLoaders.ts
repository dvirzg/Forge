import { readBinaryFile, readTextFile } from '@tauri-apps/api/fs';

/**
 * Loads an image file as a data URL
 */
export async function loadImageAsDataUrl(path: string): Promise<string> {
  const imageData = await readBinaryFile(path);
  const blob = new Blob([imageData as BlobPart]);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Loads a PDF file as a blob URL
 */
export async function loadPdfAsBlobUrl(path: string): Promise<string> {
  const fileData = await readBinaryFile(path);
  const blob = new Blob([fileData as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

/**
 * Loads a text file
 */
export async function loadTextFile(path: string): Promise<string> {
  return await readTextFile(path);
}
