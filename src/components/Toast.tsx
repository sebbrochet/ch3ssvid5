import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import './Toast.css';

interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}

/** Standalone showToast for use outside React components (e.g., in hooks) */
let globalShowToast: (message: string) => void = (msg) => {
  // Fallback before provider mounts
  console.warn('[Toast fallback]', msg);
};

// eslint-disable-next-line react-refresh/only-export-components
export function showToast(message: string) {
  globalShowToast(message);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  const show = useCallback((message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Register global access
  globalShowToast = show;

  return (
    <ToastContext.Provider value={{ showToast: show }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
