import { useState, useCallback } from 'react';

export interface ToastState {
  message: string | null;
  variant?: 'success' | 'error' | 'warning' | 'info';
  isVisible: boolean;
}

export const useToast = (duration: number = 2000) => {
  const [toast, setToast] = useState<ToastState>({
    message: null,
    variant: 'info',
    isVisible: false,
  });

  const showToast = useCallback(
    (message: string, variant: ToastState['variant'] = 'info') => {
      setToast({ message, variant, isVisible: true });
      setTimeout(() => {
        setToast(prev => ({ ...prev, isVisible: false }));
      }, duration);
    },
    [duration]
  );

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, isVisible: false }));
  }, []);

  return {
    toast,
    showToast,
    hideToast,
  };
};
