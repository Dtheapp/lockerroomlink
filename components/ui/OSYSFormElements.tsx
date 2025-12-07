import React from 'react';
import { X, Search, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

// ============================================
// OSYS TEXT INPUT
// ============================================
interface OSYSInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  wrapperClassName?: string;
}

export const OSYSInput: React.FC<OSYSInputProps> = ({
  label,
  error,
  icon,
  className = '',
  wrapperClassName = '',
  ...props
}) => {
  return (
    <div className={wrapperClassName}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full bg-white/5 border border-white/10 rounded-lg 
            px-4 py-2.5 text-white placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
            transition-all duration-200
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};

// ============================================
// OSYS TEXTAREA
// ============================================
interface OSYSTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export const OSYSTextarea: React.FC<OSYSTextareaProps> = ({
  label,
  error,
  className = '',
  wrapperClassName = '',
  ...props
}) => {
  return (
    <div className={wrapperClassName}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      )}
      <textarea
        className={`
          w-full bg-white/5 border border-white/10 rounded-lg 
          px-4 py-2.5 text-white placeholder-slate-500
          focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
          transition-all duration-200 resize-none
          ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};

// ============================================
// OSYS SELECT
// ============================================
interface OSYSSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  wrapperClassName?: string;
}

export const OSYSSelect: React.FC<OSYSSelectProps> = ({
  label,
  error,
  options,
  className = '',
  wrapperClassName = '',
  ...props
}) => {
  return (
    <div className={wrapperClassName}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      )}
      <select
        className={`
          w-full bg-white/5 border border-white/10 rounded-lg 
          px-4 py-2.5 text-white
          focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
          transition-all duration-200
          ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
          ${className}
        `}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};

// ============================================
// OSYS SEARCH INPUT
// ============================================
interface OSYSSearchProps extends Omit<OSYSInputProps, 'icon'> {
  onClear?: () => void;
}

export const OSYSSearch: React.FC<OSYSSearchProps> = ({
  value,
  onClear,
  ...props
}) => {
  return (
    <div className="relative">
      <OSYSInput
        icon={<Search className="w-4 h-4" />}
        value={value}
        {...props}
      />
      {value && onClear && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ============================================
// OSYS MODAL
// ============================================
interface OSYSModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export const OSYSModal: React.FC<OSYSModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`
        relative w-full ${sizeClasses[size]}
        bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950
        border border-white/10 rounded-2xl shadow-2xl
        max-h-[90vh] overflow-hidden flex flex-col
      `}>
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            {title && (
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors ml-auto"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================
// OSYS CONFIRM DIALOG
// ============================================
interface OSYSConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export const OSYSConfirm: React.FC<OSYSConfirmProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-amber-500 hover:bg-amber-600',
    info: 'bg-purple-500 hover:bg-purple-600'
  };

  const variantIcons = {
    danger: <AlertTriangle className="w-6 h-6 text-red-400" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-400" />,
    info: <Info className="w-6 h-6 text-purple-400" />
  };

  return (
    <OSYSModal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-white/5">
            {variantIcons[variant]}
          </div>
        </div>
        <h4 className="text-lg font-semibold text-white mb-2">{title}</h4>
        <p className="text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 ${variantStyles[variant]} text-white rounded-lg font-medium transition-colors disabled:opacity-50`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </OSYSModal>
  );
};

// ============================================
// OSYS ALERT
// ============================================
interface OSYSAlertProps {
  variant?: 'error' | 'warning' | 'success' | 'info';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export const OSYSAlert: React.FC<OSYSAlertProps> = ({
  variant = 'info',
  title,
  children,
  onDismiss,
  className = ''
}) => {
  const variantStyles = {
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    info: 'bg-purple-500/10 border-purple-500/30 text-purple-300'
  };

  const icons = {
    error: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    success: <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-purple-400 flex-shrink-0" />
  };

  return (
    <div className={`
      flex items-start gap-3 p-4 rounded-lg border
      ${variantStyles[variant]}
      ${className}
    `}>
      {icons[variant]}
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium mb-1">{title}</p>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ============================================
// OSYS TABS
// ============================================
interface OSYSTabsProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const OSYSTabs: React.FC<OSYSTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex gap-1 p-1 bg-white/5 rounded-lg ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
            transition-all duration-200
            ${activeTab === tab.id 
              ? 'bg-purple-500 text-white shadow-lg' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
            }
          `}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// ============================================
// OSYS EMPTY STATE
// ============================================
interface OSYSEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const OSYSEmptyState: React.FC<OSYSEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {icon && (
        <div className="p-4 bg-white/5 rounded-full mb-4 text-slate-500">
          {icon}
        </div>
      )}
      <h4 className="text-lg font-medium text-white mb-2">{title}</h4>
      {description && (
        <p className="text-slate-400 mb-4 max-w-sm">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

// ============================================
// OSYS LOADING SPINNER
// ============================================
interface OSYSSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const OSYSSpinner: React.FC<OSYSSpinnerProps> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="w-full h-full border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );
};

// ============================================
// OSYS LOADING STATE
// ============================================
interface OSYSLoadingProps {
  message?: string;
  className?: string;
}

export const OSYSLoading: React.FC<OSYSLoadingProps> = ({
  message = 'Loading...',
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <OSYSSpinner size="lg" className="mb-4" />
      <p className="text-slate-400">{message}</p>
    </div>
  );
};

// ============================================
// OSYS ICON BUTTON
// ============================================
interface OSYSIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'ghost' | 'filled' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
}

export const OSYSIconButton: React.FC<OSYSIconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  tooltip,
  className = '',
  ...props
}) => {
  const variantClasses = {
    ghost: 'hover:bg-white/10 text-slate-400 hover:text-white',
    filled: 'bg-white/10 hover:bg-white/20 text-white',
    danger: 'hover:bg-red-500/20 text-slate-400 hover:text-red-400'
  };

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5'
  };

  return (
    <button
      className={`
        rounded-lg transition-colors
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      title={tooltip}
      {...props}
    >
      {icon}
    </button>
  );
};

export default {
  OSYSInput,
  OSYSTextarea,
  OSYSSelect,
  OSYSSearch,
  OSYSModal,
  OSYSConfirm,
  OSYSAlert,
  OSYSTabs,
  OSYSEmptyState,
  OSYSSpinner,
  OSYSLoading,
  OSYSIconButton
};
