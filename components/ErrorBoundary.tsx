import * as React from 'react';
import { AlertTriangle, RefreshCw, Home, Download } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

// Error Boundary component to catch and handle React errors gracefully
// Using a class component as Error Boundaries require lifecycle methods
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a chunk load error (stale cache after deployment)
    const isChunkError = 
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Loading CSS chunk') ||
      error?.message?.includes('text/html') ||
      error?.name === 'ChunkLoadError';
    
    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = async () => {
    // Unregister service worker first
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    
    // Clear all caches
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
    
    // Force hard refresh (bypass cache)
    window.location.href = window.location.href.split('?')[0] + '?nocache=' + Date.now();
  };

  handleGoHome = () => {
    window.location.href = '/#/dashboard';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Special UI for chunk load errors (usually from stale cache)
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                App Updated!
              </h1>
              
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                A new version of OSYS is available. Please refresh to load the latest version.
              </p>

              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Now
              </button>
            </div>
          </div>
        );
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
              Something went wrong
            </h1>
            
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm text-zinc-500 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-red-600 dark:text-red-400 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white py-3 px-4 rounded-lg font-semibold transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
