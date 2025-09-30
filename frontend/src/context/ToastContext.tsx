import { createContext, useContext, useMemo, useState } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
  actions?: { label: string; onClick: () => void }[];
  persistent?: boolean;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (text: string, tone?: ToastMessage['tone'], options?: Partial<ToastMessage>) => number;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      showToast: (text, tone = 'info', options?: Partial<ToastMessage>) => {
        toastId += 1;
        const id = toastId;
        const toast: ToastMessage = {
          id,
          text,
          tone,
          actions: options?.actions,
          persistent: options?.persistent,
        };
        setToasts((prev) => [...prev, toast]);
        if (!toast.persistent) {
          setTimeout(() => {
            setToasts((prev) => prev.filter((entry) => entry.id !== id));
          }, 4000);
        }
        return id;
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
