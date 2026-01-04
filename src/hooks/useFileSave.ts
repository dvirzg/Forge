import { useCallback } from 'react';
import { save } from '@tauri-apps/api/dialog';
import { useToast } from './useToast';

interface FileFilter {
  name: string;
  extensions: string[];
}

/**
 * Hook for handling file save dialogs with consistent error handling
 */
export function useFileSave() {
  const { showToast } = useToast();

  return useCallback(
    async (
      defaultFileName: string,
      filters: FileFilter[],
      onCancel?: () => void
    ): Promise<string | null> => {
      try {
        const outputPath = await save({
          defaultPath: defaultFileName,
          filters,
        });

        if (!outputPath) {
          if (onCancel) {
            onCancel();
          } else {
            showToast('Operation cancelled');
          }
          return null;
        }

        return outputPath;
      } catch (error) {
        console.error('File save dialog error:', error);
        showToast(`Error: ${error}`);
        return null;
      }
    },
    [showToast]
  );
}
