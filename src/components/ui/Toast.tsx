import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// Global toast state
let toasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener([...toasts]);
  }
}

export function toast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type }];
  emitChange();

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emitChange();
  }, 4000);
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emitChange();
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
};

const colorClasses: Record<ToastType, string> = {
  success: 'bg-success-50 border-success-300 text-success-800',
  error: 'bg-danger-50 border-danger-300 text-danger-800',
  info: 'bg-primary-50 border-primary-300 text-primary-800',
  warning: 'bg-warning-50 border-warning-300 text-warning-800',
};

export function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setCurrentToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setCurrentToasts);
    };
  }, []);

  if (currentToasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {currentToasts.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl border-2
            shadow-lg animate-slide-up
            ${colorClasses[t.type]}
          `}
        >
          <span className="flex-shrink-0">{icons[t.type]}</span>
          <p className="text-sm font-medium flex-1">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
