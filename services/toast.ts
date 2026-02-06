// =============================================================================
// TOAST SERVICE
// =============================================================================
// Global toast notification system

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom';
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  options?: ToastOptions;
}

// Toast queue and listeners
let toasts: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener([...toasts]));
};

/**
 * Show a toast notification
 */
export const showToast = (
  message: string, 
  type: ToastType = 'info', 
  options?: ToastOptions
): string => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const duration = options?.duration ?? 3000;
  
  const toast: Toast = { id, message, type, options };
  toasts.push(toast);
  
  // Cap at 5 toasts max — remove oldest when exceeded
  const MAX_TOASTS = 5;
  while (toasts.length > MAX_TOASTS) {
    toasts.shift();
  }
  
  notifyListeners();
  
  // Auto-remove after duration
  setTimeout(() => {
    removeToast(id);
  }, duration);
  
  return id;
};

/**
 * Remove a specific toast
 */
export const removeToast = (id: string): void => {
  toasts = toasts.filter(t => t.id !== id);
  notifyListeners();
};

/**
 * Clear all toasts
 */
export const clearAllToasts = (): void => {
  toasts = [];
  notifyListeners();
};

/**
 * Subscribe to toast changes
 */
export const subscribeToToasts = (listener: (toasts: Toast[]) => void): (() => void) => {
  listeners.push(listener);
  // Immediately call with current toasts
  listener([...toasts]);
  
  // Return unsubscribe function
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

/**
 * Get current toasts (for initial render)
 */
export const getToasts = (): Toast[] => [...toasts];

// Convenience methods
export const toastSuccess = (message: string, options?: ToastOptions) => 
  showToast(message, 'success', options);

export const toastError = (message: string, options?: ToastOptions) => 
  showToast(message, 'error', options);

export const toastInfo = (message: string, options?: ToastOptions) => 
  showToast(message, 'info', options);

export const toastWarning = (message: string, options?: ToastOptions) => 
  showToast(message, 'warning', options);

export type { Toast, ToastType, ToastOptions };
