import { createContext, useContext, useMemo, useState } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (text: string, tone?: ToastMessage['tone']) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      showToast: (text, tone = 'info') => {
        toastId += 1;
        const id = toastId;
        setToasts((prev) => [...prev, { id, text, tone }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 4000);
      },
      dismissToast: (id) => setToasts((prev) => prev.filter((toast) => toast.id !== id)),
    }),
    [toasts],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
