import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { migrateFromLocalStorage } from './utils/storage';
import './i18n';
import App from './App';

// Migrate localStorage → IndexedDB before rendering (one-time, fast)
migrateFromLocalStorage().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
});
