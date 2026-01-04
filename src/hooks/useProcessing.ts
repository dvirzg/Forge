import { useState, useCallback } from 'react';

/**
 * Hook for managing processing state with error handling
 */
export function useProcessing() {
  const [processing, setProcessing] = useState(false);

  const withProcessing = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      onError?: (error: unknown) => void
    ): Promise<T | null> => {
      setProcessing(true);
      try {
        return await fn();
      } catch (error) {
        onError?.(error);
        console.error('Processing error:', error);
        return null;
      } finally {
        setProcessing(false);
      }
    },
    []
  );

  return { processing, setProcessing, withProcessing };
}
