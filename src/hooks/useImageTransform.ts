import { useState } from 'react';
import { writeBinaryFile, removeFile, createDir } from '@tauri-apps/api/fs';
import { join } from '@tauri-apps/api/path';
import { appDataDir } from '@tauri-apps/api/path';

interface UseImageTransformReturn {
  transformedImageData: Uint8Array | null;
  currentWorkingPath: string | null;
  tempFilePath: string | null;
  hasUnsavedChanges: boolean;
  setTransformedImageData: (data: Uint8Array | null) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  setCurrentWorkingPath: (path: string | null) => void;
  applyTransformation: (imageBytes: number[], currentFilePath: string, existingTempPath: string | null) => Promise<{ dataUrl: string; tempPath: string }>;
  cleanup: (tempPath: string | null, currentFilePath: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for managing image transformations and temp files
 */
export function useImageTransform(): UseImageTransformReturn {
  const [transformedImageData, setTransformedImageData] = useState<Uint8Array | null>(null);
  const [currentWorkingPath, setCurrentWorkingPath] = useState<string | null>(null);
  const [tempFilePath, setTempFilePath] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const applyTransformation = async (
    imageBytes: number[],
    currentFilePath: string,
    existingTempPath: string | null
  ): Promise<{ dataUrl: string; tempPath: string }> => {
    const uint8Array = new Uint8Array(imageBytes);
    setTransformedImageData(uint8Array);
    
    // Save to temp file for next transformation
    const dataDir = await appDataDir();
    
    try {
      await createDir(dataDir, { recursive: true });
    } catch (e) {
      // Directory might already exist, ignore
    }
    
    const tempPath = await join(dataDir, `temp_transform_${Date.now()}.png`);
    
    // Clean up old temp file if it exists
    if (existingTempPath && existingTempPath !== currentFilePath) {
      try {
        await removeFile(existingTempPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    await writeBinaryFile(tempPath, uint8Array);
    setTempFilePath(tempPath);
    setCurrentWorkingPath(tempPath);
    
    // Convert to data URL for preview
    const blob = new Blob([uint8Array.buffer]);
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    setHasUnsavedChanges(true);
    
    return { dataUrl, tempPath };
  };

  const cleanup = async (tempPath: string | null, currentFilePath: string) => {
    if (tempPath && tempPath !== currentFilePath) {
      try {
        await removeFile(tempPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  };

  const reset = () => {
    setTransformedImageData(null);
    setCurrentWorkingPath(null);
    setTempFilePath(null);
    setHasUnsavedChanges(false);
  };

  return {
    transformedImageData,
    currentWorkingPath,
    tempFilePath,
    hasUnsavedChanges,
    setTransformedImageData,
    setHasUnsavedChanges,
    setCurrentWorkingPath,
    applyTransformation,
    cleanup,
    reset,
  };
}
