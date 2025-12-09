// =============================================================================
// SOCIAL SHARE MODAL - Share marketing materials to social media
// =============================================================================
// Version: 1.0.0

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Mail, 
  ExternalLink,
  Download,
  Link2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { PromoItem } from '../design-studio/promoTypes';

// Social platform configurations
const SOCIAL_PLATFORMS = [
  { 
    id: 'facebook', 
    name: 'Facebook', 
    icon: '📘',
    color: '#1877F2',
    shareUrl: (url: string, text: string) => 
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`
  },
  { 
    id: 'twitter', 
    name: 'X (Twitter)', 
    icon: '🐦',
    color: '#000000',
    shareUrl: (url: string, text: string) => 
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  },
  { 
    id: 'instagram', 
    name: 'Instagram', 
    icon: '📸',
    color: '#E4405F',
    shareUrl: null, // Instagram requires app or download
    note: 'Download image and share via Instagram app'
  },
  { 
    id: 'linkedin', 
    name: 'LinkedIn', 
    icon: '💼',
    color: '#0A66C2',
    shareUrl: (url: string, text: string) => 
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  },
  { 
    id: 'whatsapp', 
    name: 'WhatsApp', 
    icon: '💬',
    color: '#25D366',
    shareUrl: (url: string, text: string) => 
      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`
  },
  { 
    id: 'pinterest', 
    name: 'Pinterest', 
    icon: '📌',
    color: '#E60023',
    shareUrl: (url: string, text: string, imageUrl: string) => 
      `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(imageUrl)}&description=${encodeURIComponent(text)}`
  },
];

interface SocialShareModalProps {
  promo: PromoItem;
  onClose: () => void;
}

interface ConnectedAccount {
  platform: string;
  connected: boolean;
  username?: string;
}

const SocialShareModal: React.FC<SocialShareModalProps> = ({ promo, onClose }) => {
  const { userData, teamData } = useAuth();
  const { theme } = useTheme();
  
  const [customMessage, setCustomMessage] = useState(`Check out our latest from ${teamData?.name || 'our team'}! 🏆`);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // Generate shareable URL (would be actual URL in production)
  const shareUrl = promo.isPublic 
    ? `${window.location.origin}/promo/${promo.id}` 
    : window.location.origin;
  
  // Load connected accounts
  useEffect(() => {
    const loadConnectedAccounts = async () => {
      if (!userData?.uid) {
        setLoading(false);
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userData.uid));
        const data = userDoc.data();
        
        if (data?.connectedAccounts) {
          setConnectedAccounts(data.connectedAccounts);
        }
      } catch (err) {
        console.error('Error loading connected accounts:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadConnectedAccounts();
  }, [userData?.uid]);
  
  // Handle share to platform
  const handleShare = (platform: typeof SOCIAL_PLATFORMS[0]) => {
    if (platform.shareUrl) {
      const url = platform.shareUrl(shareUrl, customMessage, promo.thumbnailUrl || '');
      window.open(url, '_blank', 'width=600,height=400');
    }
  };
  
  // Handle copy link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  // Handle email share
  const handleEmailShare = () => {
    const subject = encodeURIComponent(`${promo.name} - ${teamData?.name || 'Team'}`);
    const body = encodeURIComponent(`${customMessage}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  
  // Handle download
  const handleDownload = async () => {
    if (!promo.thumbnailUrl) return;
    
    setDownloading(true);
    try {
      const response = await fetch(promo.thumbnailUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${promo.name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };
  
  // Check if account is connected
  const isConnected = (platformId: string) => {
    return connectedAccounts.some(acc => acc.platform === platformId && acc.connected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className={`absolute inset-0 backdrop-blur-sm ${theme === 'dark' ? 'bg-black/70' : 'bg-black/50'}`} onClick={onClose} />
      
      {/* Modal */}
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden ${
        theme === 'dark'
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Share Design
              </h2>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {promo.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition ${
              theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Preview */}
          <div className={`flex gap-4 p-3 rounded-xl ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
            <div className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
              {promo.thumbnailUrl ? (
                <img src={promo.thumbnailUrl} alt={promo.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: promo.canvas.backgroundColor }}>
                  <Share2 className={`w-6 h-6 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {promo.name}
              </h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {promo.canvas.width} × {promo.canvas.height}
              </p>
              {promo.category && (
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                  theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                }`}>
                  {promo.category}
                </span>
              )}
            </div>
          </div>
          
          {/* Custom Message */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Share Message
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Write a message to share with your post..."
              rows={3}
              className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
          
          {/* Social Platforms */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Share to Social Media
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SOCIAL_PLATFORMS.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => platform.shareUrl ? handleShare(platform) : handleDownload()}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:scale-105 ${
                    theme === 'dark'
                      ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl">{platform.icon}</span>
                  <span className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {platform.name}
                  </span>
                  {isConnected(platform.id) && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              💡 Tip: Connect your accounts in Settings for one-click sharing
            </p>
          </div>
          
          {/* Other Share Options */}
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition ${
                copied
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            
            <button
              onClick={handleEmailShare}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            
            <button
              onClick={handleDownload}
              disabled={downloading || !promo.thumbnailUrl}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition ${
                theme === 'dark'
                  ? 'bg-purple-600 hover:bg-purple-700 text-white disabled:bg-slate-700 disabled:text-slate-500'
                  : 'bg-purple-600 hover:bg-purple-700 text-white disabled:bg-slate-200 disabled:text-slate-400'
              }`}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download
            </button>
          </div>
          
          {/* Not Public Warning */}
          {!promo.isPublic && (
            <div className={`flex items-start gap-3 p-3 rounded-lg ${
              theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'
            }`}>
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>
                  This design is private
                </p>
                <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-amber-400/70' : 'text-amber-600'}`}>
                  Make it public in Design Studio to share a direct link
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialShareModal;
