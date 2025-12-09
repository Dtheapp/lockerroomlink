// =============================================================================
// PROMO GALLERY - View and manage saved promo items
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderOpen, 
  Building2, 
  User,
  Users,
  Search,
  Filter,
  Grid,
  List,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Calendar,
  Tag,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  loadUserPromoItems, 
  loadTeamPromoItems, 
  loadPlayerPublicPromoItems,
  deletePromoItem,
  duplicatePromoItem,
} from './promoService';
import type { PromoItem, PromoItemLocation } from './promoTypes';

interface PromoGalleryProps {
  onEditDesign?: (promo: PromoItem) => void;
  onClose?: () => void;
}

const PromoGallery: React.FC<PromoGalleryProps> = ({ onEditDesign, onClose }) => {
  const { userData, teamData } = useAuth();
  const { theme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'personal' | 'team' | 'player'>('personal');
  const [promoItems, setPromoItems] = useState<PromoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [contextMenu, setContextMenu] = useState<{ promoId: string; x: number; y: number } | null>(null);
  
  const isCoach = userData?.role === 'Coach' || userData?.role === 'SuperAdmin';
  const isParent = userData?.role === 'Parent';
  
  // Load promo items based on active tab
  const loadPromos = useCallback(async () => {
    if (!userData?.uid) return;
    
    setLoading(true);
    try {
      let items: PromoItem[] = [];
      
      switch (activeTab) {
        case 'personal':
          items = await loadUserPromoItems(userData.uid);
          break;
        case 'team':
          if (teamData?.id) {
            items = await loadTeamPromoItems(teamData.id);
          }
          break;
        case 'player':
          // For parents, show promos from their players
          // For now, load from first player (would need player selection)
          break;
      }
      
      setPromoItems(items);
    } catch (error) {
      console.error('Error loading promo items:', error);
    } finally {
      setLoading(false);
    }
  }, [userData?.uid, teamData?.id, activeTab]);
  
  useEffect(() => {
    loadPromos();
  }, [loadPromos]);
  
  // Filter promos
  const filteredPromos = promoItems.filter(promo => {
    const matchesSearch = !searchQuery || 
      promo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      promo.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || promo.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  const handleDelete = async (promo: PromoItem) => {
    if (!confirm('Are you sure you want to delete this design?')) return;
    
    try {
      let collectionPath: string;
      switch (promo.location) {
        case 'team':
          collectionPath = `teams/${promo.teamId}/promoItems`;
          break;
        case 'player':
          collectionPath = `users/${promo.playerId}/promoItems`;
          break;
        default:
          collectionPath = `users/${userData?.uid}/promoItems`;
      }
      
      await deletePromoItem(promo.id, collectionPath, promo.thumbnailPath);
      setPromoItems(prev => prev.filter(p => p.id !== promo.id));
      setContextMenu(null);
    } catch (error) {
      console.error('Error deleting promo:', error);
    }
  };
  
  const handleDuplicate = async (promo: PromoItem) => {
    if (!userData) return;
    
    try {
      let collectionPath: string;
      switch (promo.location) {
        case 'team':
          collectionPath = `teams/${promo.teamId}/promoItems`;
          break;
        case 'player':
          collectionPath = `users/${promo.playerId}/promoItems`;
          break;
        default:
          collectionPath = `users/${userData.uid}/promoItems`;
      }
      
      await duplicatePromoItem(
        promo.id,
        collectionPath,
        userData.uid,
        userData.name || 'Unknown',
        { location: 'personal', isPublic: false }
      );
      
      loadPromos();
      setContextMenu(null);
    } catch (error) {
      console.error('Error duplicating promo:', error);
    }
  };
  
  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-zinc-950' : 'bg-white'}`}>
      {/* Header */}
      <div className={`p-4 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-violet-600/20' : 'bg-violet-100'}`}>
              <FolderOpen size={20} className={theme === 'dark' ? 'text-violet-400' : 'text-violet-600'} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>My Designs</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>{filteredPromos.length} designs</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 rounded-lg p-1 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'}`}>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' 
                  ? theme === 'dark' ? 'bg-zinc-700 text-white' : 'bg-white text-slate-900 shadow-sm'
                  : theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'
                }`}
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' 
                  ? theme === 'dark' ? 'bg-zinc-700 text-white' : 'bg-white text-slate-900 shadow-sm'
                  : theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'
                }`}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('personal')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === 'personal' 
                ? 'bg-violet-600 text-white' 
                : theme === 'dark' ? 'bg-zinc-800 text-zinc-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }
            `}
          >
            <User size={16} />
            My Promos
          </button>
          
          {isCoach && teamData && (
            <button
              onClick={() => setActiveTab('team')}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === 'team' 
                  ? 'bg-orange-600 text-white' 
                  : theme === 'dark' ? 'bg-zinc-800 text-zinc-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              <Building2 size={16} />
              Team Promos
            </button>
          )}
          
          {isParent && (
            <button
              onClick={() => setActiveTab('player')}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === 'player' 
                  ? 'bg-green-600 text-white' 
                  : theme === 'dark' ? 'bg-zinc-800 text-zinc-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              <Users size={16} />
              Player Promos
            </button>
          )}
        </div>
        
        {/* Search & Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search designs..."
              className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                theme === 'dark'
                  ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
          
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`h-full px-4 pr-8 border rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                theme === 'dark'
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <option value="all">All Categories</option>
              <option value="flyer">Flyers</option>
              <option value="poster">Posters</option>
              <option value="social">Social Media</option>
              <option value="banner">Banners</option>
              <option value="story">Stories</option>
              <option value="uniform">Uniforms</option>
            </select>
            <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`} />
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className={`h-full flex flex-col items-center justify-center ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>
            <FolderOpen size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">No designs found</p>
            <p className="text-sm mt-1">
              {activeTab === 'personal' 
                ? 'Create your first design in the Design Studio' 
                : 'No team designs yet'
              }
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPromos.map(promo => (
              <div
                key={promo.id}
                className={`group rounded-xl overflow-hidden border transition-all ${
                  theme === 'dark'
                    ? 'bg-zinc-900 border-zinc-800 hover:border-violet-500/50'
                    : 'bg-white border-slate-200 hover:border-violet-400 shadow-sm'
                }`}
              >
                {/* Thumbnail */}
                <div className={`aspect-square relative ${theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                  {promo.thumbnailUrl ? (
                    <img
                      src={promo.thumbnailUrl}
                      alt={promo.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      className={`w-full h-full flex items-center justify-center ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-400'}`}
                      style={{ backgroundColor: promo.canvas.backgroundColor }}
                    >
                      <FolderOpen size={32} />
                    </div>
                  )}
                  
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEditDesign?.(promo)}
                      className="p-2 bg-violet-600 rounded-lg text-white hover:bg-violet-700 transition-colors"
                      title="View/Edit"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleDuplicate(promo)}
                      className="p-2 bg-zinc-700 rounded-lg text-white hover:bg-zinc-600 transition-colors"
                      title="Duplicate"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(promo)}
                      className="p-2 bg-red-600/80 rounded-lg text-white hover:bg-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {promo.isPublic && (
                      <span className="px-2 py-0.5 bg-green-600/80 rounded text-[10px] text-white font-medium">
                        Public
                      </span>
                    )}
                    {promo.category && (
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        theme === 'dark' ? 'bg-zinc-800/80 text-zinc-300' : 'bg-slate-700/80 text-white'
                      }`}>
                        {promo.category}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-3">
                  <h3 className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{promo.name}</h3>
                  <div className={`flex items-center gap-2 mt-1 text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
                    <Calendar size={12} />
                    {new Date(promo.createdAt).toLocaleDateString()}
                  </div>
                  {promo.tags && promo.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {promo.tags.slice(0, 3).map(tag => (
                        <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] ${
                          theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {tag}
                        </span>
                      ))}
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
                className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${
                  theme === 'dark'
                    ? 'bg-zinc-900 border-zinc-800 hover:border-violet-500/50'
                    : 'bg-white border-slate-200 hover:border-violet-400 shadow-sm'
                }`}
              >
                {/* Thumbnail */}
                <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                  {promo.thumbnailUrl ? (
                    <img
                      src={promo.thumbnailUrl}
                      alt={promo.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      className={`w-full h-full flex items-center justify-center ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-400'}`}
                      style={{ backgroundColor: promo.canvas.backgroundColor }}
                    >
                      <FolderOpen size={20} />
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{promo.name}</h3>
                  <div className={`flex items-center gap-3 mt-1 text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(promo.createdAt).toLocaleDateString()}
                    </span>
                    {promo.category && (
                      <span className={`px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                        {promo.category}
                      </span>
                    )}
                    {promo.isPublic && (
                      <span className="text-green-400">Public</span>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEditDesign?.(promo)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="View/Edit"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => handleDuplicate(promo)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Duplicate"
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(promo)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800' : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'
                    }`}
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromoGallery;
