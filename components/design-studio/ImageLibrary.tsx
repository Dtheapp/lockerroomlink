import React, { useState, useCallback } from 'react';
import { 
  Search, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Star,
  Grid,
  List,
  Folder,
} from 'lucide-react';

interface ImageLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  teamLogo?: string;
  teamImages?: string[];
}

interface ImageCategory {
  id: string;
  name: string;
  images: { url: string; thumb: string; name: string }[];
}

// Sample stock images (in production, these would come from an API)
const STOCK_CATEGORIES: ImageCategory[] = [
  {
    id: 'sports',
    name: 'Sports',
    images: [
      { url: '/images/stock/basketball.jpg', thumb: '/images/stock/basketball-thumb.jpg', name: 'Basketball' },
      { url: '/images/stock/football.jpg', thumb: '/images/stock/football-thumb.jpg', name: 'Football' },
      { url: '/images/stock/soccer.jpg', thumb: '/images/stock/soccer-thumb.jpg', name: 'Soccer' },
      { url: '/images/stock/baseball.jpg', thumb: '/images/stock/baseball-thumb.jpg', name: 'Baseball' },
    ],
  },
  {
    id: 'backgrounds',
    name: 'Backgrounds',
    images: [
      { url: '/images/stock/gradient1.jpg', thumb: '/images/stock/gradient1-thumb.jpg', name: 'Blue Gradient' },
      { url: '/images/stock/gradient2.jpg', thumb: '/images/stock/gradient2-thumb.jpg', name: 'Purple Gradient' },
      { url: '/images/stock/dark.jpg', thumb: '/images/stock/dark-thumb.jpg', name: 'Dark Texture' },
      { url: '/images/stock/stadium.jpg', thumb: '/images/stock/stadium-thumb.jpg', name: 'Stadium' },
    ],
  },
  {
    id: 'icons',
    name: 'Icons & Badges',
    images: [
      { url: '/images/stock/trophy.png', thumb: '/images/stock/trophy-thumb.png', name: 'Trophy' },
      { url: '/images/stock/medal.png', thumb: '/images/stock/medal-thumb.png', name: 'Medal' },
      { url: '/images/stock/star.png', thumb: '/images/stock/star-thumb.png', name: 'Star' },
      { url: '/images/stock/ribbon.png', thumb: '/images/stock/ribbon-thumb.png', name: 'Ribbon' },
    ],
  },
];

const ImageLibrary: React.FC<ImageLibraryProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  teamLogo,
  teamImages = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('team');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setUploadedImages(prev => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  }, []);
  
  const handleSelectImage = useCallback((url: string) => {
    onSelectImage(url);
    onClose();
  }, [onSelectImage, onClose]);
  
  if (!isOpen) return null;
  
  // Combine all images for search
  const allImages = [
    ...(teamLogo ? [{ url: teamLogo, thumb: teamLogo, name: 'Team Logo' }] : []),
    ...teamImages.map((url, i) => ({ url, thumb: url, name: `Team Image ${i + 1}` })),
    ...uploadedImages.map((url, i) => ({ url, thumb: url, name: `Upload ${i + 1}` })),
    ...STOCK_CATEGORIES.flatMap(cat => cat.images),
  ];
  
  const filteredImages = searchQuery
    ? allImages.filter(img => img.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : undefined;
  
  const categories = [
    { id: 'team', name: 'Team Assets', icon: <Star size={16} /> },
    { id: 'uploads', name: 'My Uploads', icon: <Upload size={16} /> },
    ...STOCK_CATEGORIES.map(cat => ({ id: cat.id, name: cat.name, icon: <Folder size={16} /> })),
  ];
  
  const getCurrentImages = () => {
    if (filteredImages) return filteredImages;
    
    switch (activeCategory) {
      case 'team':
        return [
          ...(teamLogo ? [{ url: teamLogo, thumb: teamLogo, name: 'Team Logo' }] : []),
          ...teamImages.map((url, i) => ({ url, thumb: url, name: `Team Image ${i + 1}` })),
        ];
      case 'uploads':
        return uploadedImages.map((url, i) => ({ url, thumb: url, name: `Upload ${i + 1}` }));
      default:
        return STOCK_CATEGORIES.find(cat => cat.id === activeCategory)?.images || [];
    }
  };
  
  const currentImages = getCurrentImages();
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 rounded-xl shadow-2xl w-[900px] max-w-[95vw] h-[700px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">Image Library</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Search & Actions */}
        <div className="flex items-center gap-4 p-4 border-b border-zinc-800">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search images..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          
          <label className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg cursor-pointer transition-colors">
            <Upload size={18} />
            <span>Upload</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              className="hidden"
            />
          </label>
          
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-zinc-800 overflow-y-auto">
            <div className="p-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchQuery('');
                  }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors
                    ${activeCategory === cat.id && !searchQuery
                      ? 'bg-violet-600/20 text-violet-400'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }
                  `}
                >
                  {cat.icon}
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Image Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {currentImages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <ImageIcon size={48} className="mb-4 opacity-50" />
                <p>No images found</p>
                {activeCategory === 'uploads' && (
                  <p className="text-sm mt-2">Upload images to get started</p>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-4 gap-3">
                {currentImages.map((img, index) => (
                  <button
                    key={`${img.url}-${index}`}
                    onClick={() => handleSelectImage(img.url)}
                    className="group relative aspect-square bg-zinc-800 rounded-lg overflow-hidden border-2 border-transparent hover:border-violet-500 transition-all"
                  >
                    <img
                      src={img.thumb || img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text fill="%239ca3af" font-family="sans-serif" font-size="12" x="50" y="55" text-anchor="middle">No Image</text></svg>';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <span className="text-xs text-white truncate">{img.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {currentImages.map((img, index) => (
                  <button
                    key={`${img.url}-${index}`}
                    onClick={() => handleSelectImage(img.url)}
                    className="w-full flex items-center gap-4 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <div className="w-16 h-16 bg-zinc-800 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={img.thumb || img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/></svg>';
                        }}
                      />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-medium">{img.name}</p>
                      <p className="text-xs text-zinc-500 truncate max-w-xs">{img.url}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageLibrary;
