import { useEffect } from 'react';
import { appWindow, LogicalSize } from '@tauri-apps/api/window';
import { currentMonitor, primaryMonitor } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/tauri';

type FileType = 'image' | 'pdf' | 'video' | 'text' | null;

/**
 * Hook for managing window resizing based on file type
 */
export function useWindowResize(fileType: FileType, filePath?: string) {
  useEffect(() => {
    const resizeWindow = async () => {
      try {
        if (fileType && filePath) {
          const primary = await primaryMonitor();
          const current = await currentMonitor();
          const monitor = primary || current;
          const maxWidth = monitor ? monitor.size.width * 0.5 : 1920;
          const maxHeight = monitor ? monitor.size.height * 0.5 : 1080;

          const minWidth = 800;
          const minHeight = 600;

          await appWindow.setMinSize(new LogicalSize(minWidth, minHeight));

          let newWidth = 1000;
          let newHeight = 600;

          try {
            if (fileType === 'image') {
              const metadata = await invoke<{ width: number; height: number }>(
                'get_image_metadata',
                {
                  inputPath: filePath,
                }
              );

              newWidth = Math.max(Math.min(metadata.width + 400, maxWidth), minWidth);
              newHeight = Math.max(Math.min(metadata.height + 100, maxHeight), minHeight);
            } else if (fileType === 'video' || fileType === 'pdf') {
              newWidth = Math.max(Math.min(1000, maxWidth), minWidth);
              newHeight = Math.max(Math.min(600, maxHeight), minHeight);
            } else {
              newWidth = Math.max(Math.min(1000, maxWidth), minWidth);
              newHeight = Math.max(Math.min(600, maxHeight), minHeight);
            }
          } catch (error) {
            console.error('Error getting file metadata:', error);
            newWidth = Math.max(Math.min(1000, maxWidth), minWidth);
            newHeight = Math.max(Math.min(600, maxHeight), minHeight);
          }

          await appWindow.setSize(new LogicalSize(newWidth, newHeight));
          await appWindow.center();
        } else {
          await appWindow.setMinSize(new LogicalSize(200, 150));
          await appWindow.setSize(new LogicalSize(300, 200));
          await appWindow.center();
        }
      } catch (error) {
        console.error('Error resizing window:', error);
      }
    };

    resizeWindow();
  }, [fileType, filePath]);
}
