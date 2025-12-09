// =============================================================================
// SAVE PROMO MODAL - Choose where to save your design
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Save, 
  FolderOpen, 
  Users, 
  User, 
  Building2,
  Check,
  AlertCircle,
  ChevronDown,
  Link,
  Globe,
  Lock,
  Tag,
  Crown,
  Sparkles,
} from 'lucide-react';
import type { 
  SavePromoOptions, 
  PromoItemLocation, 
  PlayerOption, 
  TeamOption 
} from './promoTypes';
import { HIGH_QUALITY_EXPORT_CREDITS, type ExportQuality } from './ExportUtils';

interface SavePromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (options: SavePromoOptions) => Promise<void>;
  designName: string;
  onNameChange: (name: string) => void;
  // User context
  userRole: 'Coach' | 'Parent' | 'Fan' | 'SuperAdmin' | 'Athlete';
  userId: string;
  // Available options based on role
  teams?: TeamOption[]; // For coaches
  players?: PlayerOption[]; // For parents
  // Current team context (if any)
  currentTeamId?: string;
  currentTeamName?: string;
  // Season options for linking
  seasons?: { id: string; name: string }[];
  events?: { id: string; name: string; type: 'registration' | 'game' | 'event' | 'fundraiser' }[];
  // User credits for high quality export
  userCredits?: number;
  // Canvas size for resolution info
  canvasSize?: { width: number; height: number };
}

const CATEGORIES = [
  { value: 'flyer', label: 'Flyer', icon: '📄' },
  { value: 'poster', label: 'Poster', icon: '🖼️' },
  { value: 'social', label: 'Social Media', icon: '📱' },
  { value: 'banner', label: 'Banner', icon: '🏷️' },
  { value: 'story', label: 'Story', icon: '📲' },
];

const SavePromoModal: React.FC<SavePromoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  designName,
  onNameChange,
  userRole,
  userId,
  teams = [],
  players = [],
  currentTeamId,
  currentTeamName,
  seasons = [],
  events = [],
  userCredits = 0,
  canvasSize = { width: 1080, height: 1080 },
}) => {
  const [location, setLocation] = useState<PromoItemLocation>('personal');
  const [selectedTeamId, setSelectedTeamId] = useState(currentTeamId || '');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [linkedEventId, setLinkedEventId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [category, setCategory] = useState<string>('flyer');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Export quality selection
  const [exportQuality, setExportQuality] = useState<ExportQuality>('standard');
  
  const isCoach = userRole === 'Coach' || userRole === 'SuperAdmin';
  const isParent = userRole === 'Parent';
  const canSaveToTeam = isCoach && teams.length > 0;
  const canSaveToPlayer = isParent && players.length > 0;
  const canAffordHighQuality = userCredits >= HIGH_QUALITY_EXPORT_CREDITS;
  
  // Calculate resolutions for display
  const standardRes = `${canvasSize.width} × ${canvasSize.height}px`;
  const highRes = `${canvasSize.width * 2} × ${canvasSize.height * 2}px`;
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocation('personal');
      setSelectedTeamId(currentTeamId || '');
      setSelectedPlayerId('');
      setSelectedSeasonId('');
      setLinkedEventId('');
      setIsPublic(false);
      setExportQuality('standard');
      setError(null);
    }
  }, [isOpen, currentTeamId]);
  
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };
  
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };
  
  const handleSave = async () => {
    if (!designName.trim()) {
      setError('Please enter a name for your design');
      return;
    }
    
    if (location === 'team' && !selectedTeamId) {
      setError('Please select a team');
      return;
    }
    
    if (location === 'player' && !selectedPlayerId) {
      setError('Please select a player');
      return;
    }
    
    // Check credits for high quality
    if (exportQuality === 'high' && !canAffordHighQuality) {
      setError(`High quality export requires ${HIGH_QUALITY_EXPORT_CREDITS} credits. You have ${userCredits}.`);
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const selectedPlayer = players.find(p => p.id === selectedPlayerId);
      const linkedEvent = events.find(e => e.id === linkedEventId);
      
      await onSave({
        location,
        teamId: location === 'team' ? selectedTeamId : undefined,
        playerId: location === 'player' ? selectedPlayerId : undefined,
        playerName: selectedPlayer?.name,
        seasonId: selectedSeasonId || undefined,
        linkedEventId: linkedEventId || undefined,
        linkedEventType: linkedEvent?.type,
        isPublic,
        category: category as SavePromoOptions['category'],
        tags,
        exportQuality,
      });
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save design');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-xl shadow-2xl w-[500px] max-w-[95vw] overflow-hidden border border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-600/20 rounded-lg">
              <Save size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Save Design</h2>
              <p className="text-xs text-zinc-500">Choose where to save your creation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Design Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Design Name</label>
            <input
              type="text"
              value={designName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter a name for your design..."
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          
          {/* Save Location */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Save To</label>
            <div className="space-y-2">
              {/* Personal - Always available */}
              <button
                onClick={() => setLocation('personal')}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                  ${location === 'personal' 
                    ? 'border-violet-500 bg-violet-600/10' 
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }
                `}
              >
                <div className={`p-2 rounded-lg ${location === 'personal' ? 'bg-violet-600/20' : 'bg-zinc-700'}`}>
                  <User size={20} className={location === 'personal' ? 'text-violet-400' : 'text-zinc-400'} />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-white">My Promo Folder</p>
                  <p className="text-xs text-zinc-500">Save to your personal designs</p>
                </div>
                {location === 'personal' && <Check size={18} className="text-violet-400" />}
              </button>
              
              {/* Team - Only for coaches */}
              {canSaveToTeam && (
                <button
                  onClick={() => setLocation('team')}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                    ${location === 'team' 
                      ? 'border-orange-500 bg-orange-600/10' 
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    }
                  `}
                >
                  <div className={`p-2 rounded-lg ${location === 'team' ? 'bg-orange-600/20' : 'bg-zinc-700'}`}>
                    <Building2 size={20} className={location === 'team' ? 'text-orange-400' : 'text-zinc-400'} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium text-white">Team Promo Folder</p>
                    <p className="text-xs text-zinc-500">Save to team's shared designs (resets with season)</p>
                  </div>
                  {location === 'team' && <Check size={18} className="text-orange-400" />}
                </button>
              )}
              
              {/* Player - Only for parents */}
              {canSaveToPlayer && (
                <button
                  onClick={() => setLocation('player')}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                    ${location === 'player' 
                      ? 'border-green-500 bg-green-600/10' 
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    }
                  `}
                >
                  <div className={`p-2 rounded-lg ${location === 'player' ? 'bg-green-600/20' : 'bg-zinc-700'}`}>
                    <Users size={20} className={location === 'player' ? 'text-green-400' : 'text-zinc-400'} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium text-white">Player's Public Promo</p>
                    <p className="text-xs text-zinc-500">Add to your player's public profile</p>
                  </div>
                  {location === 'player' && <Check size={18} className="text-green-400" />}
                </button>
              )}
            </div>
          </div>
          
          {/* Team Selector - When saving to team */}
          {location === 'team' && teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Select Team</label>
              <div className="relative">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Choose a team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>
          )}
          
          {/* Player Selector - When saving to player */}
          {location === 'player' && players.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Select Player</label>
              <div className="relative">
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Choose a player...</option>
                  {players.map(player => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.teamName})
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>
          )}
          
          {/* Season Link - When saving to team */}
          {location === 'team' && seasons.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Link size={14} />
                  Link to Season (Optional)
                </span>
              </label>
              <div className="relative">
                <select
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">No season link</option>
                  {seasons.map(season => (
                    <option key={season.id} value={season.id}>{season.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
              <p className="text-xs text-zinc-500 mt-1">Linked designs will be archived when the season ends</p>
            </div>
          )}
          
          {/* Event Link */}
          {events.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Link size={14} />
                  Link to Event (Optional)
                </span>
              </label>
              <div className="relative">
                <select
                  value={linkedEventId}
                  onChange={(e) => setLinkedEventId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">No event link</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>
          )}
          
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all
                    ${category === cat.value 
                      ? 'bg-violet-600 text-white' 
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }
                  `}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Export Quality Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Export Quality</label>
            <div className="space-y-2">
              {/* Standard - Free */}
              <button
                onClick={() => setExportQuality('standard')}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left
                  ${exportQuality === 'standard' 
                    ? 'border-green-500 bg-green-600/10' 
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }
                `}
              >
                <div className={`p-2 rounded-lg ${exportQuality === 'standard' ? 'bg-green-600/20' : 'bg-zinc-700'}`}>
                  <Save size={18} className={exportQuality === 'standard' ? 'text-green-400' : 'text-zinc-400'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white text-sm">Standard Quality</p>
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">FREE</span>
                  </div>
                  <p className="text-xs text-zinc-500">{standardRes} • Good for digital sharing</p>
                </div>
                {exportQuality === 'standard' && <Check size={18} className="text-green-400" />}
              </button>
              
              {/* High Quality - Costs credits */}
              <button
                onClick={() => canAffordHighQuality && setExportQuality('high')}
                disabled={!canAffordHighQuality}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left
                  ${exportQuality === 'high' 
                    ? 'border-orange-500 bg-orange-600/10' 
                    : canAffordHighQuality
                      ? 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                      : 'border-zinc-700/50 bg-zinc-800/30 opacity-60 cursor-not-allowed'
                  }
                `}
              >
                <div className={`p-2 rounded-lg ${exportQuality === 'high' ? 'bg-orange-600/20' : 'bg-zinc-700'}`}>
                  <Crown size={18} className={exportQuality === 'high' ? 'text-orange-400' : 'text-zinc-400'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white text-sm">High Quality (4K)</p>
                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">
                      {HIGH_QUALITY_EXPORT_CREDITS} Credits
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">{highRes} • Print-ready resolution</p>
                  {!canAffordHighQuality && (
                    <p className="text-xs text-red-400 mt-0.5">
                      Need {HIGH_QUALITY_EXPORT_CREDITS - userCredits} more credits
                    </p>
                  )}
                </div>
                {exportQuality === 'high' && <Check size={18} className="text-orange-400" />}
              </button>
            </div>
            
            {/* Credits display */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-700/50 text-xs">
              <span className="text-zinc-500">Your credits:</span>
              <span className="font-semibold text-orange-400">{userCredits}</span>
            </div>
          </div>
          
          {/* Visibility Toggle */}
          {(location === 'team' || location === 'player') && (
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <Globe size={20} className="text-green-400" />
                ) : (
                  <Lock size={20} className="text-zinc-400" />
                )}
                <div>
                  <p className="font-medium text-white text-sm">
                    {isPublic ? 'Public' : 'Private'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {isPublic 
                      ? 'Visible on public team/player page' 
                      : 'Only visible to team members'
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPublic(!isPublic)}
                className={`
                  w-12 h-6 rounded-full transition-colors relative
                  ${isPublic ? 'bg-green-600' : 'bg-zinc-700'}
                `}
              >
                <div className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                  ${isPublic ? 'left-7' : 'left-1'}
                `} />
              </button>
            </div>
          )}
          
          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Tag size={14} />
                Tags (Optional)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-violet-600/20 text-violet-300 rounded text-xs flex items-center gap-1"
                  >
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-white">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="break-words overflow-hidden">{error}</span>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all
              ${isSaving 
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
                : 'bg-violet-600 hover:bg-violet-700 text-white'
              }
            `}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Design
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavePromoModal;
