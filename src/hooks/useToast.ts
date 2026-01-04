import { useState, useRef, useCallback } from 'react';

interface Toast {
  message: string;
  id: number;
}

const TOAST_DURATION = 3000;

/**
 * Hook for managing toast notifications
 */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    const id = Date.now();
    setToast({ message, id });

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION);
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast(null);
  }, []);

  return { toast, showToast, clearToast };
}
