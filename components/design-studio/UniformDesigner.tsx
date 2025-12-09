// =============================================================================
// UNIFORM DESIGNER PRO - World-class uniform creation tool
// Multi-piece uniform design with 3D player preview
// =============================================================================

import React, { useState, useCallback } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw,
  Eye,
  Palette,
  Shirt,
  Settings,
  Download,
  Save,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  Plus,
  Trash2
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// =============================================================================
// TYPES
// =============================================================================

type Sport = 'football' | 'basketball' | 'baseball' | 'soccer' | 'volleyball' | 'hockey' | 'lacrosse' | 'track';

type GarmentCategory = 'top' | 'bottom' | 'accessory';

type TopStyle = 
  | 'football-jersey' 
  | 'basketball-jersey' 
  | 'baseball-jersey'
  | 'soccer-jersey'
  | 'tshirt-short'
  | 'tshirt-long'
  | 'tank-top'
  | 'hoodie';

type BottomStyle = 
  | 'football-pants'
  | 'basketball-shorts'
  | 'baseball-pants'
  | 'soccer-shorts'
  | 'athletic-shorts'
  | 'compression-pants';

type AccessoryType = 
  | 'socks-crew'
  | 'socks-knee'
  | 'hat-fitted'
  | 'hat-snapback'
  | 'headband'
  | 'arm-sleeve'
  | 'wristband';

interface GarmentPiece {
  id: string;
  category: GarmentCategory;
  style: TopStyle | BottomStyle | AccessoryType;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: 'solid' | 'stripes' | 'gradient' | 'camo' | 'panels';
  numberFront?: string;
  numberBack?: string;
  numberColor?: string;
  nameBack?: string;
  nameColor?: string;
  logoUrl?: string;
  logoPosition?: 'chest-left' | 'chest-center' | 'chest-right' | 'back';
}

interface UniformSet {
  id: string;
  name: string;
  sport: Sport;
  pieces: GarmentPiece[];
  createdAt: Date;
}

interface UniformDesignerProps {
  onClose: () => void;
  onSave?: (uniform: UniformSet) => void;
  teamData?: {
    name: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SPORTS: { id: Sport; label: string; icon: string }[] = [
  { id: 'football', label: 'Football', icon: '🏈' },
  { id: 'basketball', label: 'Basketball', icon: '🏀' },
  { id: 'baseball', label: 'Baseball', icon: '⚾' },
  { id: 'soccer', label: 'Soccer', icon: '⚽' },
  { id: 'volleyball', label: 'Volleyball', icon: '🏐' },
  { id: 'hockey', label: 'Hockey', icon: '🏒' },
  { id: 'lacrosse', label: 'Lacrosse', icon: '🥍' },
  { id: 'track', label: 'Track & Field', icon: '🏃' },
];

const TOP_STYLES: { id: TopStyle; label: string; sports: Sport[]; icon: string }[] = [
  { id: 'football-jersey', label: 'Football Jersey', sports: ['football'], icon: '🏈' },
  { id: 'basketball-jersey', label: 'Basketball Jersey', sports: ['basketball'], icon: '🏀' },
  { id: 'baseball-jersey', label: 'Baseball Jersey', sports: ['baseball'], icon: '⚾' },
  { id: 'soccer-jersey', label: 'Soccer Jersey', sports: ['soccer'], icon: '⚽' },
  { id: 'tank-top', label: 'Tank Top', sports: ['basketball', 'volleyball', 'track'], icon: '👕' },
  { id: 'tshirt-short', label: 'T-Shirt (Short Sleeve)', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '👕' },
  { id: 'tshirt-long', label: 'T-Shirt (Long Sleeve)', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '👔' },
  { id: 'hoodie', label: 'Hoodie', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '🧥' },
];

const BOTTOM_STYLES: { id: BottomStyle; label: string; sports: Sport[]; icon: string }[] = [
  { id: 'football-pants', label: 'Football Pants', sports: ['football'], icon: '👖' },
  { id: 'basketball-shorts', label: 'Basketball Shorts', sports: ['basketball'], icon: '🩳' },
  { id: 'baseball-pants', label: 'Baseball Pants', sports: ['baseball'], icon: '👖' },
  { id: 'soccer-shorts', label: 'Soccer Shorts', sports: ['soccer'], icon: '🩳' },
  { id: 'athletic-shorts', label: 'Athletic Shorts', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '🩳' },
  { id: 'compression-pants', label: 'Compression Pants', sports: ['football', 'basketball', 'baseball', 'soccer', 'volleyball', 'hockey', 'lacrosse', 'track'], icon: '👖' },
];

const ACCESSORY_STYLES: { id: AccessoryType; label: string; icon: string }[] = [
  { id: 'socks-crew', label: 'Crew Socks', icon: '🧦' },
  { id: 'socks-knee', label: 'Knee-High Socks', icon: '🧦' },
  { id: 'hat-fitted', label: 'Fitted Cap', icon: '🧢' },
  { id: 'hat-snapback', label: 'Snapback Cap', icon: '🧢' },
  { id: 'headband', label: 'Headband', icon: '🎀' },
  { id: 'arm-sleeve', label: 'Arm Sleeve', icon: '💪' },
  { id: 'wristband', label: 'Wristband', icon: '⌚' },
];

const PATTERNS = [
  { id: 'solid', label: 'Solid', preview: '■' },
  { id: 'stripes', label: 'Stripes', preview: '≡' },
  { id: 'gradient', label: 'Gradient', preview: '▓' },
  { id: 'camo', label: 'Camo', preview: '◈' },
  { id: 'panels', label: 'Panels', preview: '▤' },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const generateId = () => `piece_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getAvailableTops = (sport: Sport) => TOP_STYLES.filter(s => s.sports.includes(sport));
const getAvailableBottoms = (sport: Sport) => BOTTOM_STYLES.filter(s => s.sports.includes(sport));

// =============================================================================
// COMPONENT
// =============================================================================

const UniformDesigner: React.FC<UniformDesignerProps> = ({
  onClose,
  onSave,
  teamData
}) => {
  const { theme } = useTheme();
  
  // Wizard step
  const [currentStep, setCurrentStep] = useState<'sport' | 'pieces' | 'customize' | 'preview'>('sport');
  
  // Selected sport
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  
  // Uniform pieces
  const [pieces, setPieces] = useState<GarmentPiece[]>([]);
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  
  // 3D Preview state
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  
  // Uniform name
  const [uniformName, setUniformName] = useState(teamData?.name ? `${teamData.name} Uniform` : 'New Uniform');
  
  // Get the active piece for editing
  const activePiece = pieces.find(p => p.id === activePieceId);
  
  // Add a new piece
  const addPiece = useCallback((category: GarmentCategory, style: TopStyle | BottomStyle | AccessoryType, label: string) => {
    const newPiece: GarmentPiece = {
      id: generateId(),
      category,
      style,
      label,
      primaryColor: teamData?.primaryColor || '#f97316',
      secondaryColor: teamData?.secondaryColor || '#ffffff',
      accentColor: '#000000',
      pattern: 'solid',
      numberFront: '',
      numberBack: '00',
      numberColor: '#ffffff',
      nameBack: 'PLAYER',
      nameColor: '#ffffff',
      logoUrl: teamData?.logoUrl,
      logoPosition: 'chest-left',
    };
    setPieces(prev => [...prev, newPiece]);
    setActivePieceId(newPiece.id);
  }, [teamData]);
  
  // Remove a piece
  const removePiece = useCallback((pieceId: string) => {
    setPieces(prev => prev.filter(p => p.id !== pieceId));
    if (activePieceId === pieceId) {
      setActivePieceId(pieces.length > 1 ? pieces[0].id : null);
    }
  }, [activePieceId, pieces]);
  
  // Update a piece
  const updatePiece = useCallback((pieceId: string, updates: Partial<GarmentPiece>) => {
    setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, ...updates } : p));
  }, []);

  // ==========================================================================
  // RENDER: Sport Selection
  // ==========================================================================
  const renderSportSelection = () => (
    <div className="p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Your Sport</h2>
        <p className="text-slate-400">Select the sport to see available uniform options</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SPORTS.map(sport => (
          <button
            key={sport.id}
            onClick={() => setSelectedSport(sport.id)}
            className={`p-6 rounded-xl border-2 transition-all ${
              selectedSport === sport.id
                ? 'border-orange-500 bg-orange-500/20 shadow-lg shadow-orange-500/20'
                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
            }`}
          >
            <div className="text-4xl mb-3">{sport.icon}</div>
            <div className="font-semibold text-white">{sport.label}</div>
          </button>
        ))}
      </div>
      
      <div className="flex justify-end mt-8">
        <button
          onClick={() => selectedSport && setCurrentStep('pieces')}
          disabled={!selectedSport}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
        >
          Continue <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDER: Piece Selection  
  // ==========================================================================
  const renderPieceSelection = () => {
    const availableTops = selectedSport ? getAvailableTops(selectedSport) : [];
    const availableBottoms = selectedSport ? getAvailableBottoms(selectedSport) : [];
    
    return (
      <div className="p-6 space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Build Your Uniform</h2>
          <p className="text-slate-400">Select the pieces you want to include</p>
        </div>
        
        {/* Selected pieces */}
        {pieces.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Selected Pieces ({pieces.length})</h3>
            <div className="flex flex-wrap gap-2">
              {pieces.map(piece => (
                <div 
                  key={piece.id}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/50 rounded-lg"
                >
                  <span className="text-white text-sm">{piece.label}</span>
                  <button 
                    onClick={() => removePiece(piece.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Tops */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Shirt className="w-4 h-4" /> Tops
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {availableTops.map(top => {
              const isAdded = pieces.some(p => p.style === top.id);
              return (
                <button
                  key={top.id}
                  onClick={() => !isAdded && addPiece('top', top.id, top.label)}
                  disabled={isAdded}
                  className={`p-4 rounded-lg border transition-all ${
                    isAdded
                      ? 'border-green-500/50 bg-green-500/10 cursor-not-allowed'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-orange-500/50 hover:bg-orange-500/10'
                  }`}
                >
                  <div className="text-2xl mb-2">{top.icon}</div>
                  <div className="text-sm text-white">{top.label}</div>
                  {isAdded && <Check className="w-4 h-4 text-green-400 mx-auto mt-2" />}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Bottoms */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            👖 Bottoms
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {availableBottoms.map(bottom => {
              const isAdded = pieces.some(p => p.style === bottom.id);
              return (
                <button
                  key={bottom.id}
                  onClick={() => !isAdded && addPiece('bottom', bottom.id, bottom.label)}
                  disabled={isAdded}
                  className={`p-4 rounded-lg border transition-all ${
                    isAdded
                      ? 'border-green-500/50 bg-green-500/10 cursor-not-allowed'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-orange-500/50 hover:bg-orange-500/10'
                  }`}
                >
                  <div className="text-2xl mb-2">{bottom.icon}</div>
                  <div className="text-sm text-white">{bottom.label}</div>
                  {isAdded && <Check className="w-4 h-4 text-green-400 mx-auto mt-2" />}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Accessories */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            🎽 Accessories
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ACCESSORY_STYLES.map(acc => {
              const isAdded = pieces.some(p => p.style === acc.id);
              return (
                <button
                  key={acc.id}
                  onClick={() => !isAdded && addPiece('accessory', acc.id, acc.label)}
                  disabled={isAdded}
                  className={`p-4 rounded-lg border transition-all ${
                    isAdded
                      ? 'border-green-500/50 bg-green-500/10 cursor-not-allowed'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-orange-500/50 hover:bg-orange-500/10'
                  }`}
                >
                  <div className="text-2xl mb-2">{acc.icon}</div>
                  <div className="text-sm text-white">{acc.label}</div>
                  {isAdded && <Check className="w-4 h-4 text-green-400 mx-auto mt-2" />}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setCurrentStep('sport')}
            className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <button
            onClick={() => pieces.length > 0 && setCurrentStep('customize')}
            disabled={pieces.length === 0}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
          >
            Customize Pieces <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDER: Customization Panel
  // ==========================================================================
  const renderCustomization = () => {
    if (!activePiece && pieces.length > 0) {
      setActivePieceId(pieces[0].id);
    }
    
    return (
      <div className="flex h-[600px]">
        {/* Piece tabs - left sidebar */}
        <div className="w-48 border-r border-zinc-700 p-3 space-y-2 overflow-y-auto">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Pieces</h3>
          {pieces.map(piece => (
            <button
              key={piece.id}
              onClick={() => setActivePieceId(piece.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                activePieceId === piece.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-slate-300 hover:bg-zinc-700'
              }`}
            >
              {piece.label}
            </button>
          ))}
        </div>
        
        {/* Editor panel - center */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activePiece ? (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Customize: {activePiece.label}
              </h2>
              
              {/* Colors */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activePiece.primaryColor}
                      onChange={(e) => updatePiece(activePiece.id, { primaryColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={activePiece.primaryColor}
                      onChange={(e) => updatePiece(activePiece.id, { primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activePiece.secondaryColor}
                      onChange={(e) => updatePiece(activePiece.id, { secondaryColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={activePiece.secondaryColor}
                      onChange={(e) => updatePiece(activePiece.id, { secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activePiece.accentColor}
                      onChange={(e) => updatePiece(activePiece.id, { accentColor: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={activePiece.accentColor}
                      onChange={(e) => updatePiece(activePiece.id, { accentColor: e.target.value })}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
              </div>
              
              {/* Pattern */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Pattern Style</label>
                <div className="flex gap-2 flex-wrap">
                  {PATTERNS.map(pattern => (
                    <button
                      key={pattern.id}
                      onClick={() => updatePiece(activePiece.id, { pattern: pattern.id as GarmentPiece['pattern'] })}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        activePiece.pattern === pattern.id
                          ? 'border-orange-500 bg-orange-500/20 text-white'
                          : 'border-zinc-700 bg-zinc-800 text-slate-400 hover:border-zinc-600'
                      }`}
                    >
                      <span className="mr-2">{pattern.preview}</span>
                      {pattern.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Numbers - only for tops */}
              {activePiece.category === 'top' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Front Number</label>
                    <input
                      type="text"
                      value={activePiece.numberFront || ''}
                      onChange={(e) => updatePiece(activePiece.id, { numberFront: e.target.value.slice(0, 2) })}
                      placeholder="e.g. 23"
                      maxLength={2}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Back Number</label>
                    <input
                      type="text"
                      value={activePiece.numberBack || ''}
                      onChange={(e) => updatePiece(activePiece.id, { numberBack: e.target.value.slice(0, 2) })}
                      placeholder="e.g. 23"
                      maxLength={2}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Number Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activePiece.numberColor || '#ffffff'}
                        onChange={(e) => updatePiece(activePiece.id, { numberColor: e.target.value })}
                        className="w-12 h-10 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={activePiece.numberColor || '#ffffff'}
                        onChange={(e) => updatePiece(activePiece.id, { numberColor: e.target.value })}
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Player Name (Back)</label>
                    <input
                      type="text"
                      value={activePiece.nameBack || ''}
                      onChange={(e) => updatePiece(activePiece.id, { nameBack: e.target.value.toUpperCase() })}
                      placeholder="PLAYER"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white uppercase"
                    />
                  </div>
                </div>
              )}
              
              {/* Logo */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Team Logo Position</label>
                <div className="flex gap-2 flex-wrap">
                  {['chest-left', 'chest-center', 'chest-right', 'back'].map(pos => (
                    <button
                      key={pos}
                      onClick={() => updatePiece(activePiece.id, { logoPosition: pos as GarmentPiece['logoPosition'] })}
                      className={`px-4 py-2 rounded-lg border transition-all capitalize ${
                        activePiece.logoPosition === pos
                          ? 'border-orange-500 bg-orange-500/20 text-white'
                          : 'border-zinc-700 bg-zinc-800 text-slate-400 hover:border-zinc-600'
                      }`}
                    >
                      {pos.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 py-12">
              <p>Select a piece to customize</p>
            </div>
          )}
        </div>
        
        {/* Mini preview - right sidebar */}
        <div className="w-64 border-l border-zinc-700 p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Preview</h3>
          {activePiece && (
            <div 
              className="aspect-square rounded-xl border border-zinc-700 flex items-center justify-center"
              style={{ 
                background: activePiece.pattern === 'gradient' 
                  ? `linear-gradient(135deg, ${activePiece.primaryColor}, ${activePiece.secondaryColor})`
                  : activePiece.primaryColor 
              }}
            >
              <div className="text-center">
                <div 
                  className="text-4xl font-bold"
                  style={{ color: activePiece.numberColor }}
                >
                  {activePiece.numberFront || activePiece.numberBack || '00'}
                </div>
                {activePiece.nameBack && (
                  <div 
                    className="text-sm font-semibold mt-1"
                    style={{ color: activePiece.nameColor }}
                  >
                    {activePiece.nameBack}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Navigation for customize step - rendered separately
  const renderCustomizeNav = () => (
    <div className="flex justify-between p-4 border-t border-zinc-700">
      <button
        onClick={() => setCurrentStep('pieces')}
        className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
      >
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      <button
        onClick={() => setCurrentStep('preview')}
        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg flex items-center gap-2"
      >
        View on Player <Eye className="w-5 h-5" />
      </button>
    </div>
  );

  // ==========================================================================
  // RENDER: 3D Player Preview
  // ==========================================================================
  const renderPreview = () => {
    const topPiece = pieces.find(p => p.category === 'top');
    const bottomPiece = pieces.find(p => p.category === 'bottom');
    const socksPiece = pieces.find(p => p.style.includes('socks'));
    
    // Calculate rotation for 3D effect
    const getTransform = () => {
      const rotateY = previewRotation;
      return `perspective(1000px) rotateY(${rotateY}deg) scale(${previewZoom})`;
    };
    
    // Get pattern CSS
    const getPatternStyle = (piece: GarmentPiece) => {
      switch (piece.pattern) {
        case 'gradient':
          return { background: `linear-gradient(135deg, ${piece.primaryColor}, ${piece.secondaryColor})` };
        case 'stripes':
          return { background: `repeating-linear-gradient(90deg, ${piece.primaryColor}, ${piece.primaryColor} 20px, ${piece.secondaryColor} 20px, ${piece.secondaryColor} 40px)` };
        case 'panels':
          return { background: `linear-gradient(90deg, ${piece.secondaryColor} 0%, ${piece.secondaryColor} 20%, ${piece.primaryColor} 20%, ${piece.primaryColor} 80%, ${piece.secondaryColor} 80%)` };
        default:
          return { backgroundColor: piece.primaryColor };
      }
    };
    
    return (
      <div className="flex h-[600px]">
        {/* Controls sidebar */}
        <div className="w-64 border-r border-zinc-700 p-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <RotateCw className="w-4 h-4" /> Rotation
            </h3>
            <input
              type="range"
              min="-180"
              max="180"
              value={previewRotation}
              onChange={(e) => setPreviewRotation(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Back</span>
              <span>Front</span>
              <span>Back</span>
            </div>
            <button
              onClick={() => setPreviewRotation(0)}
              className="mt-2 w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-sm rounded-lg flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reset View
            </button>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <ZoomIn className="w-4 h-4" /> Zoom
            </h3>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={previewZoom}
              onChange={(e) => setPreviewZoom(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between mt-2">
              <button
                onClick={() => setPreviewZoom(Math.max(0.5, previewZoom - 0.1))}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-slate-400 text-sm">{Math.round(previewZoom * 100)}%</span>
              <button
                onClick={() => setPreviewZoom(Math.min(1.5, previewZoom + 0.1))}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Uniform name */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Uniform Name</h3>
            <input
              type="text"
              value={uniformName}
              onChange={(e) => setUniformName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
            />
          </div>
          
          {/* Pieces list */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Included Pieces</h3>
            <div className="space-y-1">
              {pieces.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: p.primaryColor }} />
                  {p.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 3D Preview area */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-900 relative overflow-hidden">
          {/* Grid floor effect */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950/50 to-transparent" />
          
          {/* Player mannequin */}
          <div 
            className="relative transition-transform duration-200"
            style={{ transform: getTransform() }}
          >
            {/* Head */}
            <div className="w-16 h-20 mx-auto bg-gradient-to-b from-amber-200 to-amber-300 rounded-full mb-1" />
            
            {/* Top (Jersey/Shirt) */}
            {topPiece ? (
              <div 
                className="relative w-40 h-48 mx-auto rounded-lg mb-1 flex flex-col items-center justify-center transition-colors"
                style={getPatternStyle(topPiece)}
              >
                {/* Collar */}
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-6 rounded-b-full"
                  style={{ backgroundColor: topPiece.accentColor }}
                />
                {/* Number */}
                {(previewRotation >= -90 && previewRotation <= 90) ? (
                  // Front view
                  <div className="text-center mt-4">
                    {topPiece.numberFront && (
                      <div className="text-4xl font-bold" style={{ color: topPiece.numberColor }}>
                        {topPiece.numberFront}
                      </div>
                    )}
                  </div>
                ) : (
                  // Back view
                  <div className="text-center mt-4">
                    {topPiece.nameBack && (
                      <div className="text-sm font-bold tracking-wider mb-1" style={{ color: topPiece.nameColor }}>
                        {topPiece.nameBack}
                      </div>
                    )}
                    {topPiece.numberBack && (
                      <div className="text-5xl font-bold" style={{ color: topPiece.numberColor }}>
                        {topPiece.numberBack}
                      </div>
                    )}
                  </div>
                )}
                {/* Sleeves */}
                <div 
                  className="absolute -left-8 top-4 w-10 h-24 rounded-lg"
                  style={getPatternStyle(topPiece)}
                />
                <div 
                  className="absolute -right-8 top-4 w-10 h-24 rounded-lg"
                  style={getPatternStyle(topPiece)}
                />
              </div>
            ) : (
              <div className="w-40 h-48 mx-auto rounded-lg mb-1 bg-zinc-700 border-2 border-dashed border-zinc-600 flex items-center justify-center">
                <span className="text-zinc-500 text-sm">No Top</span>
              </div>
            )}
            
            {/* Bottom (Pants/Shorts) */}
            {bottomPiece ? (
              <div 
                className="relative w-36 h-32 mx-auto rounded-b-lg flex"
                style={getPatternStyle(bottomPiece)}
              >
                {/* Left leg */}
                <div 
                  className="flex-1 rounded-bl-lg"
                  style={getPatternStyle(bottomPiece)}
                />
                {/* Right leg */}
                <div 
                  className="flex-1 rounded-br-lg"
                  style={getPatternStyle(bottomPiece)}
                />
                {/* Side stripe */}
                <div 
                  className="absolute left-0 top-0 w-2 h-full rounded-l-lg"
                  style={{ backgroundColor: bottomPiece.accentColor }}
                />
                <div 
                  className="absolute right-0 top-0 w-2 h-full rounded-r-lg"
                  style={{ backgroundColor: bottomPiece.accentColor }}
                />
              </div>
            ) : (
              <div className="w-36 h-32 mx-auto rounded-b-lg bg-zinc-700 border-2 border-dashed border-zinc-600 flex items-center justify-center">
                <span className="text-zinc-500 text-sm">No Bottom</span>
              </div>
            )}
            
            {/* Socks */}
            {socksPiece ? (
              <div className="flex justify-center gap-4 mt-1">
                <div 
                  className="w-8 h-16 rounded-b-lg"
                  style={getPatternStyle(socksPiece)}
                />
                <div 
                  className="w-8 h-16 rounded-b-lg"
                  style={getPatternStyle(socksPiece)}
                />
              </div>
            ) : (
              <div className="flex justify-center gap-4 mt-1">
                <div className="w-8 h-16 rounded-b-lg bg-zinc-600" />
                <div className="w-8 h-16 rounded-b-lg bg-zinc-600" />
              </div>
            )}
          </div>
          
          {/* Rotation indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-500 text-sm">
            {previewRotation >= -45 && previewRotation <= 45 ? 'Front View' : 
             previewRotation > 45 && previewRotation <= 135 ? 'Side View' :
             previewRotation < -45 && previewRotation >= -135 ? 'Side View' : 'Back View'}
          </div>
        </div>
      </div>
    );
  };

  // Navigation for preview step
  const renderPreviewNav = () => (
    <div className="flex justify-between p-4 border-t border-zinc-700">
      <button
        onClick={() => setCurrentStep('customize')}
        className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
      >
        <ChevronLeft className="w-5 h-5" /> Edit Pieces
      </button>
      <div className="flex gap-3">
        <button
          onClick={() => {/* TODO: Export */}}
          className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
        >
          <Download className="w-5 h-5" /> Export
        </button>
        <button
          onClick={() => {
            if (onSave && selectedSport) {
              onSave({
                id: generateId(),
                name: uniformName,
                sport: selectedSport,
                pieces,
                createdAt: new Date()
              });
            }
            onClose();
          }}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg flex items-center gap-2"
        >
          <Save className="w-5 h-5" /> Save Uniform
        </button>
      </div>
    </div>
  );

  // ==========================================================================
  // RENDER: Main Modal
  // ==========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Shirt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Uniform Designer Pro</h1>
              <p className="text-sm text-slate-400">Create world-class team uniforms</p>
            </div>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {['sport', 'pieces', 'customize', 'preview'].map((step, idx) => (
              <div
                key={step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  currentStep === step
                    ? 'bg-orange-500 text-white'
                    : idx < ['sport', 'pieces', 'customize', 'preview'].indexOf(currentStep)
                      ? 'bg-green-500 text-white'
                      : 'bg-zinc-700 text-zinc-400'
                }`}
              >
                {idx + 1}
              </div>
            ))}
          </div>
          
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 'sport' && renderSportSelection()}
          {currentStep === 'pieces' && renderPieceSelection()}
          {currentStep === 'customize' && renderCustomization()}
          {currentStep === 'preview' && renderPreview()}
        </div>
        
        {/* Footer nav for customize */}
        {currentStep === 'customize' && renderCustomizeNav()}
        {currentStep === 'preview' && renderPreviewNav()}
      </div>
    </div>
  );
};

export default UniformDesigner;
