// =============================================================================
// MARKETING HUB - Personal designs & Team marketing materials
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Share2, 
  Download, 
  Eye, 
  Calendar, 
  FolderOpen, 
  Plus,
  Search,
  Filter,
  Grid,
  List,
  ExternalLink,
  Mail,
  Copy,
  Check,
  Link2,
  Settings,
  X,
  Pencil,
  ZoomIn,
  ZoomOut,
  Upload,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { loadTeamPromoItems, loadUserPromoItems, deletePromoItem } from './design-studio/promoService';
import type { PromoItem } from './design-studio/promoTypes';
import SocialShareModal from './ui/SocialShareModal';

interface MarketingHubProps {
  isTeamMode?: boolean;
}

const MarketingHub: React.FC<MarketingHubProps> = ({ isTeamMode = false }) => {
  const navigate = useNavigate();
  const { userData, teamData } = useAuth();
  const { theme } = useTheme();
  
  const [promos, setPromos] = useState<PromoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<PromoItem | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewPromo, setViewPromo] = useState<PromoItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PromoItem | null>(null);
  
  // Page title and description based on mode
  const pageTitle = isTeamMode ? 'Team Marketing' : 'My Designs';
  const pageIcon = isTeamMode ? '📢' : '📁';
  const pageDescription = isTeamMode 
    ? `Shared marketing materials for ${teamData?.name || 'your team'}`
    : 'Your saved designs from the Design Studio. Create flyers, posters, and more!';
  
  // Load promo items based on mode
  useEffect(() => {
    const loadPromos = async () => {
      if (!userData?.uid) {
        setLoading(false);
        return;
      }
      
      // Team mode requires a team
      if (isTeamMode && !teamData?.id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        if (isTeamMode) {
          // Team mode: Only load team-shared promos
          const teamPromos = await loadTeamPromoItems(teamData!.id);
          setPromos(teamPromos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } else {
          // Personal mode: Load user's personal promos
          const userPromos = await loadUserPromoItems(userData.uid);
          setPromos(userPromos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }
      } catch (err) {
        console.error('Error loading promos:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadPromos();
  }, [userData?.uid, teamData?.id, isTeamMode]);
  
  // Filter promos
  const filteredPromos = promos.filter(promo => {
    const matchesSearch = promo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (promo.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || promo.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  // Handle share
  const handleShare = (promo: PromoItem) => {
    setSelectedPromo(promo);
    setShareModalOpen(true);
  };
  
  // Handle view (fullscreen preview)
  const handleView = (promo: PromoItem) => {
    setViewPromo(promo);
    setViewModalOpen(true);
  };
  
  // Handle edit (go to design studio)
  const handleEdit = (promo: PromoItem) => {
    navigate('/design', { state: { editPromo: promo } });
  };
  
  // Handle delete request
  const handleDelete = (promo: PromoItem) => {
    setDeleteConfirm(promo);
  };
  
  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteConfirm || !userData?.uid) return;
    
    try {
      const collectionPath = isTeamMode && teamData?.id
        ? `teams/${teamData.id}/promoItems`
        : `users/${userData.uid}/promoItems`;
      
      await deletePromoItem(deleteConfirm.id, collectionPath, deleteConfirm.thumbnailPath);
      setPromos(prev => prev.filter(p => p.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting promo:', error);
      setDeleteConfirm(null);
    }
  };
  
  // Categories
  const categories = ['all', 'flyer', 'poster', 'social', 'banner', 'story'];

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'border-white/10 bg-slate-900/50' : 'border-slate-200 bg-white/50'} backdrop-blur-xl sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`text-2xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <span className="text-3xl">{pageIcon}</span>
                {pageTitle}
              </h1>
              <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {pageDescription}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {!isTeamMode && (
                <button
                  onClick={() => navigate('/profile', { state: { openTab: 'social' } })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    theme === 'dark'
                      ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Connected Accounts</span>
                </button>
              )}
              
              <button
                onClick={() => navigate('/design')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition shadow-lg shadow-purple-500/25"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Create New</span>
              </button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search designs..."
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Category Filter */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-purple-600 text-white'
                        : theme === 'dark'
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
              
              {/* View Toggle */}
              <div className={`flex items-center gap-1 p-1 rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' 
                    ? theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900'
                    : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list'
                    ? theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900'
                    : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className={`text-center py-20 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              {isTeamMode ? 'No team marketing materials yet' : 'No designs yet'}
            </h3>
            <p className="mb-6">
              {isTeamMode 
                ? 'Share designs from My Designs to your team\'s marketing folder'
                : 'Create your first design to share with your team and fans'
              }
            </p>
            <button
              onClick={() => navigate('/design')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition"
            >
              <Plus className="w-5 h-5" />
              Create Your First Design
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPromos.map(promo => (
              <div
                key={promo.id}
                className={`group rounded-xl overflow-hidden border transition-all hover:shadow-lg ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-800 hover:border-purple-500/50'
                    : 'bg-white border-slate-200 hover:border-purple-400'
                }`}
              >
                {/* Thumbnail */}
                <div className={`aspect-square relative overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  {promo.thumbnailUrl ? (
                    <img
                      src={promo.thumbnailUrl}
                      alt={promo.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: promo.canvas.backgroundColor }}
                    >
                      <CanvasPreview promo={promo} className="w-full h-full object-contain" />
                    </div>
                  )}
                  
                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleView(promo)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
                      title="View Fullscreen"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEdit(promo)}
                      className="p-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-white transition"
                      title="Edit in Design Studio"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleShare(promo)}
                      className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
                      title="Share"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(promo)}
                      className="p-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Category Badge */}
                  <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                    {promo.isTeamCopy && (
                      <span className="px-2 py-0.5 bg-orange-600/80 rounded text-xs font-medium text-white">
                        Team
                      </span>
                    )}
                    {promo.category && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        theme === 'dark' ? 'bg-slate-900/80 text-slate-300' : 'bg-white/90 text-slate-700'
                      }`}>
                        {promo.category}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-3">
                  <h3 className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {promo.name}
                  </h3>
                  <div className={`flex items-center gap-2 mt-1 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                    <Calendar className="w-3 h-3" />
                    {new Date(promo.createdAt).toLocaleDateString()}
                  </div>
                  {isTeamMode && promo.createdByName && (
                    <div className={`mt-1 text-xs ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                      Created by {promo.createdByName}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPromos.map(promo => (
              <div
                key={promo.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-800 hover:border-purple-500/50'
                    : 'bg-white border-slate-200 hover:border-purple-400'
                }`}
              >
                {/* Thumbnail */}
                <div className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  {promo.thumbnailUrl ? (
                    <img
                      src={promo.thumbnailUrl}
                      alt={promo.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: promo.canvas.backgroundColor }}
                    >
                      <CanvasPreview promo={promo} className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {promo.name}
                  </h3>
                  <div className={`flex items-center gap-4 mt-1 text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(promo.createdAt).toLocaleDateString()}
                    </span>
                    {promo.category && (
                      <span className={`px-2 py-0.5 rounded text-xs ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        {promo.category}
                      </span>
                    )}
                    {isTeamMode && promo.createdByName && (
                      <span className={`text-xs ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                        by {promo.createdByName}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(promo)}
                    className={`p-2 rounded-lg transition ${
                      theme === 'dark' 
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="View Fullscreen"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(promo)}
                    className={`p-2 rounded-lg transition ${
                      theme === 'dark' 
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Edit in Design Studio"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleShare(promo)}
                    className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
                    title="Share"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(promo)}
                    className={`p-2 rounded-lg transition ${
                      theme === 'dark' 
                        ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800' 
                        : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'
                    }`}
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Share Modal */}
      {shareModalOpen && selectedPromo && (
        <SocialShareModal
          promo={selectedPromo}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedPromo(null);
          }}
        />
      )}
      
      {/* Fullscreen View Modal */}
      {viewModalOpen && viewPromo && (
        <FullscreenViewModal
          promo={viewPromo}
          onClose={() => {
            setViewModalOpen(false);
            setViewPromo(null);
          }}
          onEdit={() => {
            setViewModalOpen(false);
            handleEdit(viewPromo);
          }}
          onShare={() => {
            setViewModalOpen(false);
            handleShare(viewPromo);
          }}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <DeleteConfirmModal
          promo={deleteConfirm}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          theme={theme}
        />
      )}
    </div>
  );
};

// =============================================================================
// FULLSCREEN VIEW MODAL - Shows the full design preview
// =============================================================================

interface FullscreenViewModalProps {
  promo: PromoItem;
  onClose: () => void;
  onEdit: () => void;
  onShare: () => void;
}

const FullscreenViewModal: React.FC<FullscreenViewModalProps> = ({ promo, onClose, onEdit, onShare }) => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  
  // Render the design to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !promo) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height, backgroundColor } = promo.canvas;
    canvas.width = width;
    canvas.height = height;
    
    // Clear and fill background
    ctx.fillStyle = backgroundColor || '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Sort elements by zIndex
    const sortedElements = [...promo.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    
    // Render each element
    sortedElements.forEach(element => {
      if (!element.visible) return;
      
      ctx.save();
      ctx.globalAlpha = (element.opacity ?? 100) / 100;
      
      const { x, y } = element.position;
      const { width: w, height: h } = element.size;
      
      // Handle rotation
      if (element.rotation) {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate((element.rotation * Math.PI) / 180);
        ctx.translate(-(x + w / 2), -(y + h / 2));
      }
      
      if (element.type === 'shape') {
        ctx.fillStyle = element.backgroundColor || element.color || '#6366f1';
        
        const radius = element.borderRadius || 0;
        if (radius > 0) {
          // Rounded rectangle
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, Math.min(radius, Math.min(w, h) / 2));
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
      } else if (element.type === 'text') {
        // Draw text background if set
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
          ctx.fillStyle = element.backgroundColor;
          ctx.fillRect(x, y, w, h);
        }
        
        // Draw text
        const fontSize = element.fontSize || 24;
        const fontFamily = element.fontFamily || 'Arial';
        const fontWeight = element.fontWeight || 'normal';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = element.color || '#ffffff';
        ctx.textAlign = (element.textAlign as CanvasTextAlign) || 'left';
        ctx.textBaseline = 'top';
        
        // Calculate text position based on alignment
        let textX = x;
        if (element.textAlign === 'center') textX = x + w / 2;
        else if (element.textAlign === 'right') textX = x + w;
        
        // Simple word wrap
        const words = (element.content || '').split(' ');
        let line = '';
        let lineY = y + (fontSize * 0.2);
        const lineHeight = fontSize * (element.lineHeight || 1.2);
        
        words.forEach((word: string) => {
          const testLine = line + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > w && line !== '') {
            ctx.fillText(line.trim(), textX, lineY);
            line = word + ' ';
            lineY += lineHeight;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line.trim(), textX, lineY);
      } else if (element.type === 'image' && element.src) {
        // Draw image placeholder (actual image loading would be async)
        ctx.fillStyle = '#374151';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📷 Image', x + w / 2, y + h / 2);
      }
      
      ctx.restore();
    });
  }, [promo]);
  
  // Download handler
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `${promo.name.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold text-lg">{promo.name}</h2>
          {promo.category && (
            <span className="px-2 py-0.5 bg-white/10 rounded text-white/70 text-sm">
              {promo.category}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.25, z - 0.25)); }}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white/70 text-sm min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(3, z + 0.25)); }}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-white/20 mx-2" />
          
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
            title="Share"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-medium transition"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
          
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Canvas Container */}
      <div 
        className="flex items-center justify-center overflow-auto max-w-full max-h-full p-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="shadow-2xl"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          {/* Prefer highResUrl, then thumbnailUrl, then fallback to canvas rendering */}
          {(promo.highResUrl || promo.thumbnailUrl) ? (
            <img 
              src={promo.highResUrl || promo.thumbnailUrl} 
              alt={promo.name}
              className="max-w-none"
              style={{ 
                maxWidth: '80vw',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          ) : (
            <canvas
              ref={canvasRef}
              className="max-w-none"
              style={{ 
                width: promo.canvas.width,
                height: promo.canvas.height
              }}
            />
          )}
        </div>
      </div>
      
      {/* Footer info */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center px-6 py-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="text-white/60 text-sm">
          {promo.canvas.width} × {promo.canvas.height}px • Created {new Date(promo.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// CANVAS PREVIEW - Renders a small preview of the design
// =============================================================================

interface CanvasPreviewProps {
  promo: PromoItem;
  className?: string;
}

const CanvasPreview: React.FC<CanvasPreviewProps> = ({ promo, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !promo) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Scale to fit container while maintaining aspect ratio
    const containerSize = 300;
    const scale = containerSize / Math.max(promo.canvas.width, promo.canvas.height);
    const width = promo.canvas.width * scale;
    const height = promo.canvas.height * scale;
    
    canvas.width = width;
    canvas.height = height;
    
    // Clear and apply scale
    ctx.clearRect(0, 0, width, height);
    ctx.scale(scale, scale);
    
    // Fill background
    ctx.fillStyle = promo.canvas.backgroundColor || '#1a1a2e';
    ctx.fillRect(0, 0, promo.canvas.width, promo.canvas.height);
    
    // Sort and render elements
    const sortedElements = [...promo.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    
    sortedElements.forEach(element => {
      if (!element.visible) return;
      
      ctx.save();
      ctx.globalAlpha = (element.opacity ?? 100) / 100;
      
      const { x, y } = element.position;
      const { width: w, height: h } = element.size;
      
      // Handle rotation
      if (element.rotation) {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate((element.rotation * Math.PI) / 180);
        ctx.translate(-(x + w / 2), -(y + h / 2));
      }
      
      if (element.type === 'shape') {
        ctx.fillStyle = element.backgroundColor || element.color || '#6366f1';
        const radius = element.borderRadius || 0;
        if (radius > 0 && ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, Math.min(radius, Math.min(w, h) / 2));
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
      } else if (element.type === 'text') {
        // Draw text background
        if (element.backgroundColor && element.backgroundColor !== 'transparent') {
          ctx.fillStyle = element.backgroundColor;
          ctx.fillRect(x, y, w, h);
        }
        
        // Draw text
        const fontSize = element.fontSize || 24;
        const fontFamily = element.fontFamily || 'Arial';
        const fontWeight = element.fontWeight || 'normal';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = element.color || '#ffffff';
        ctx.textAlign = (element.textAlign as CanvasTextAlign) || 'left';
        ctx.textBaseline = 'top';
        
        let textX = x;
        if (element.textAlign === 'center') textX = x + w / 2;
        else if (element.textAlign === 'right') textX = x + w;
        
        // Word wrap
        const words = (element.content || '').split(' ');
        let line = '';
        let lineY = y + fontSize * 0.2;
        const lineHeight = fontSize * (element.lineHeight || 1.2);
        
        words.forEach((word: string) => {
          const testLine = line + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > w && line !== '') {
            ctx.fillText(line.trim(), textX, lineY);
            line = word + ' ';
            lineY += lineHeight;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line.trim(), textX, lineY);
      }
      
      ctx.restore();
    });
  }, [promo]);
  
  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
};

// Delete Confirmation Modal Component
const DeleteConfirmModal: React.FC<{
  promo: PromoItem;
  onConfirm: () => void;
  onCancel: () => void;
  theme: string;
}> = ({ promo, onConfirm, onCancel, theme }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className={`p-6 rounded-xl shadow-2xl max-w-md w-full mx-4 ${
      theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'
    }`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-red-500/20 rounded-full">
          <Trash2 size={24} className="text-red-500" />
        </div>
        <div>
          <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Delete Design?
          </h3>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            This action cannot be undone.
          </p>
        </div>
      </div>
      
      <div className={`p-3 rounded-lg mb-4 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          "{promo.name}"
        </p>
      </div>
      
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-800 text-white hover:bg-slate-700' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

export default MarketingHub;
