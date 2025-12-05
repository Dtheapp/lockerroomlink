import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed or dismissed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    const wasDismissed = localStorage.getItem('installPromptDismissed');
    const dismissedTime = wasDismissed ? parseInt(wasDismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    
    // Don't show if installed, or dismissed less than 7 days ago
    if (isStandalone || daysSinceDismissed < 7) {
      return;
    }

    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    if (isIOS && isSafari) {
      // Show iOS prompt after a short delay
      const timer = setTimeout(() => setShowIOSPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Handle Android/Chrome install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show our custom prompt after a delay
      setTimeout(() => setShowAndroidPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleDismiss = () => {
    setShowIOSPrompt(false);
    setShowAndroidPrompt(false);
    setDismissed(true);
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowAndroidPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (dismissed || (!showIOSPrompt && !showAndroidPrompt)) {
    return null;
  }

  // iOS Install Prompt
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-slide-up">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 max-w-md mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-lg">LU</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Install LevelUp</h3>
                <p className="text-zinc-400 text-sm">Add to your home screen</p>
              </div>
            </div>
            <button 
              onClick={handleDismiss}
              className="text-zinc-500 hover:text-zinc-300 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="bg-zinc-800/50 rounded-xl p-3 space-y-3">
            <p className="text-zinc-300 text-sm">To install this app on your iPhone:</p>
            
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Share className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-zinc-300">
                Tap the <strong className="text-blue-400">Share</strong> button in Safari
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <PlusSquare className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-zinc-300">
                Select <strong className="text-green-400">"Add to Home Screen"</strong>
              </span>
            </div>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="w-full mt-3 py-2.5 text-zinc-400 text-sm hover:text-zinc-200 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    );
  }

  // Android Install Prompt
  if (showAndroidPrompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-slide-up">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 max-w-md mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-lg">LU</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Install LevelUp</h3>
                <p className="text-zinc-400 text-sm">Get the full app experience</p>
              </div>
            </div>
            <button 
              onClick={handleDismiss}
              className="text-zinc-500 hover:text-zinc-300 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-zinc-400 text-sm mb-4">
            Install LevelUp for quick access, offline support, and a native app experience.
          </p>
          
          <div className="flex gap-2">
            <button 
              onClick={handleDismiss}
              className="flex-1 py-2.5 rounded-xl text-zinc-400 text-sm hover:bg-zinc-800 transition-colors"
            >
              Not now
            </button>
            <button 
              onClick={handleAndroidInstall}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Install
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default InstallPrompt;
