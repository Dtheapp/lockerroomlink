/**
 * Toast Container Component
 * Listens to toast service and displays notifications
 */

import React, { useEffect, useState } from 'react';
import { subscribeToToasts, removeToast, Toast } from '../../services/toast';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastIcon: React.FC<{ type: Toast['type'] }> = ({ type }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    case 'info':
    default:
      return <Info className="w-5 h-5 text-blue-400" />;
  }
};

const getToastStyles = (type: Toast['type']): string => {
  switch (type) {
    case 'success':
      return 'bg-green-500/90 border-green-400/50';
    case 'error':
      return 'bg-red-500/90 border-red-400/50';
    case 'warning':
      return 'bg-amber-500/90 border-amber-400/50';
    case 'info':
    default:
      return 'bg-blue-500/90 border-blue-400/50';
  }
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts(setToasts);
    return () => unsubscribe();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl animate-slide-in-right ${getToastStyles(toast.type)}`}
          style={{
            animation: 'slideInRight 0.3s ease-out forwards',
          }}
        >
          <ToastIcon type={toast.type} />
          <p className="flex-1 text-sm font-medium text-white">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      
      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ToastContainer;
