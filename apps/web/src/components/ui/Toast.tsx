// Global toast notification system. ToastProvider should wrap the entire app
// (it's mounted in the root layout). Any component can call useToast().showToast
// to surface an in-app notification. Toasts auto-dismiss after 5 seconds.
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react';

type ToastType = 'info' | 'warning' | 'critical' | 'success';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}

interface ToastCtx {
  showToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const icons: Record<ToastType, ReactNode> = {
    info: <Info size={18} className="text-[#4285F4]" />,
    warning: <AlertTriangle size={18} className="text-[#FBBC04]" />,
    critical: <AlertTriangle size={18} className="text-[#EA4335]" />,
    success: <CheckCircle size={18} className="text-[#34A853]" />,
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'glass-card flex w-80 items-start gap-3 p-4 shadow-2xl animate-fade-up',
              t.type === 'critical' && 'border-red-500/30',
              t.type === 'warning' && 'border-yellow-500/30',
            )}
          >
            <span className="mt-0.5 shrink-0">{icons[t.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{t.title}</p>
              <p className="mt-0.5 text-xs text-white/60 leading-snug">{t.message}</p>
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
