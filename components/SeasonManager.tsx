import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Season, SeasonRegistration, SeasonStatus, SportType } from '../types';
import { Calendar, Users, DollarSign, Play, Square, CheckCircle, Clock, AlertCircle, ChevronRight, Plus, X, FileText, Palette, Trophy, UserPlus, Settings, CalendarDays } from 'lucide-react';
import { GlassCard } from './ui/OSYSComponents';
import { GameScheduleManager } from './season/GameScheduleManager';

interface SeasonManagerProps {
  teamId: string;
  teamName: string;
  sport: SportType;
  currentSeasonId?: string | null;
  rosterCount?: number; // Number of players currently on the roster
  onSeasonChange?: (seasonId: string | null) => void;
  onNavigateToDesignStudio?: () => void; // Callback to navigate to Design Studio
}

const SeasonManager: React.FC<SeasonManagerProps> = ({ 
  teamId, 
  teamName, 
  sport, 
  currentSeasonId,
  rosterCount = 0,
  onSeasonChange,
  onNavigateToDesignStudio
}) => {
  const { userData } = useAuth();
  const { theme } = useTheme();
  
  // State
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [registrations, setRegistrations] = useState<{ [seasonId: string]: SeasonRegistration[] }>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEndSeasonModal, setShowEndSeasonModal] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [showRegistrationsModal, setShowRegistrationsModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [creatingLegacy, setCreatingLegacy] = useState(false);
  
  // Form state for new season
  const [newSeason, setNewSeason] = useState({
    name: '',
    startDate: '',
    registrationOpenDate: '',
    registrationCloseDate: '',
    registrationFee: 0,
    maxRosterSize: 25,
    description: '',
    includedItems: [''],
    requireMedicalInfo: true,
    requireEmergencyContact: true,
    requireUniformSizes: true,
    requireWaiver: true,
    waiverText: '',
  });
  
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Fetch seasons
  useEffect(() => {
    if (!teamId) return;
    
    const q = query(
      collection(db, 'teams', teamId, 'seasons'),
      orderBy('createdAt', 'desc')
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const seasonData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Season));
      setSeasons(seasonData);
      setLoading(false);
    });
    
    return () => unsub();
  }, [teamId]);
  
  // Fetch registrations for active/registration seasons
  useEffect(() => {
    const activeSeasons = seasons.filter(s => s.status === 'registration' || s.status === 'active');
    
    activeSeasons.forEach(season => {
      const q = query(collection(db, 'teams', teamId, 'seasons', season.id, 'registrations'));
      
      onSnapshot(q, (snapshot) => {
        const regs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SeasonRegistration));
        setRegistrations(prev => ({ ...prev, [season.id]: regs }));
      });
    });
  }, [teamId, seasons]);
  
  // Get current season
  const currentSeason = seasons.find(s => s.id === currentSeasonId);
  const activeSeason = seasons.find(s => s.status === 'active');
  const registrationSeason = seasons.find(s => s.status === 'registration');
  
  // Check if registration is open
  const isRegistrationOpen = (season: Season) => {
    const now = new Date().toISOString().split('T')[0];
    return season.status === 'registration' && 
           now >= season.registrationOpenDate && 
           now <= season.registrationCloseDate;
  };
  
  // Create new season
  const handleCreateSeason = async () => {
    if (!userData || creating) return;
    
    setCreating(true);
    setActionError(null);
    
    try {
      // Validate
      if (!newSeason.name.trim()) throw new Error('Season name is required');
      if (!newSeason.startDate) throw new Error('Start date is required');
      if (!newSeason.registrationOpenDate) throw new Error('Registration open date is required');
      if (!newSeason.registrationCloseDate) throw new Error('Registration close date is required');
      
      // Create season document
      const seasonData: Omit<Season, 'id'> = {
        teamId,
        name: newSeason.name.trim(),
        sport,
        year: new Date(newSeason.startDate).getFullYear(),
        status: 'registration',
        startDate: newSeason.startDate,
        registrationOpenDate: newSeason.registrationOpenDate,
        registrationCloseDate: newSeason.registrationCloseDate,
        registrationFee: Math.round(newSeason.registrationFee * 100), // Convert to cents
        maxRosterSize: newSeason.maxRosterSize || undefined,
        description: newSeason.description.trim(),
        includedItems: newSeason.includedItems.filter(i => i.trim()),
        requireMedicalInfo: newSeason.requireMedicalInfo,
        requireEmergencyContact: newSeason.requireEmergencyContact,
        requireUniformSizes: newSeason.requireUniformSizes,
        requireWaiver: newSeason.requireWaiver,
        waiverText: newSeason.waiverText.trim() || undefined,
        playerCount: 0,
        gamesPlayed: 0,
        createdAt: serverTimestamp(),
        createdBy: userData.uid,
      };
      
      const docRef = await addDoc(collection(db, 'teams', teamId, 'seasons'), seasonData);
      
      // Update team's current season
      await updateDoc(doc(db, 'teams', teamId), {
        currentSeasonId: docRef.id,
      });
      
      onSeasonChange?.(docRef.id);
      
      // Reset form
      setNewSeason({
        name: '',
        startDate: '',
        registrationOpenDate: '',
        registrationCloseDate: '',
        registrationFee: 0,
        maxRosterSize: 25,
        description: '',
        includedItems: [''],
        requireMedicalInfo: true,
        requireEmergencyContact: true,
        requireUniformSizes: true,
        requireWaiver: true,
        waiverText: '',
      });
      setShowCreateModal(false);
      
    } catch (error: any) {
      console.error('Error creating season:', error);
      setActionError(error.message || 'Failed to create season');
    } finally {
      setCreating(false);
    }
  };
  
  // Start season (move from registration to active)
  const handleStartSeason = async (season: Season) => {
    if (!userData) return;
    
    try {
      await updateDoc(doc(db, 'teams', teamId, 'seasons', season.id), {
        status: 'active',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error starting season:', error);
      alert('Failed to start season');
    }
  };
  
  // End season
  const handleEndSeason = async () => {
    if (!selectedSeason || !userData || ending) return;
    
    setEnding(true);
    setActionError(null);
    
    try {
      const batch = writeBatch(db);
      
      // Update season status
      batch.update(doc(db, 'teams', teamId, 'seasons', selectedSeason.id), {
        status: 'completed',
        endedAt: serverTimestamp(),
        endedBy: userData.uid,
        updatedAt: serverTimestamp(),
      });
      
      // Release all players (clear teamId from players in this team)
      const playersSnapshot = await getDocs(collection(db, 'teams', teamId, 'players'));
      playersSnapshot.docs.forEach(playerDoc => {
        batch.update(playerDoc.ref, {
          teamId: null,
          seasonId: null,
          releasedAt: serverTimestamp(),
        });
      });
      
      // Clear current season from team
      batch.update(doc(db, 'teams', teamId), {
        currentSeasonId: null,
      });
      
      await batch.commit();
      
      onSeasonChange?.(null);
      setShowEndSeasonModal(false);
      setSelectedSeason(null);
      
    } catch (error: any) {
      console.error('Error ending season:', error);
      setActionError(error.message || 'Failed to end season');
    } finally {
      setEnding(false);
    }
  };
  
  // Approve registration
  const handleApproveRegistration = async (seasonId: string, registration: SeasonRegistration) => {
    try {
      await updateDoc(
        doc(db, 'teams', teamId, 'seasons', seasonId, 'registrations', registration.id),
        {
          status: 'approved',
          approvedAt: serverTimestamp(),
          approvedBy: userData?.uid,
        }
      );
      
      // Add player to team roster
      // This should also update the player's teamId
      const season = seasons.find(s => s.id === seasonId);
      if (season) {
        await updateDoc(doc(db, 'teams', teamId, 'seasons', seasonId), {
          playerCount: (season.playerCount || 0) + 1,
        });
      }
    } catch (error) {
      console.error('Error approving registration:', error);
      alert('Failed to approve registration');
    }
  };
  
  // Create legacy/activate current season (for teams with existing players but no season)
  const handleActivateCurrentSeason = async () => {
    if (!userData || creatingLegacy) return;
    
    setCreatingLegacy(true);
    setActionError(null);
    
    try {
      const now = new Date();
      const year = now.getFullYear();
      const seasonId = `season_${teamId}_${year}_${Date.now()}`;
      
      // Create the season document
      const seasonData: Omit<Season, 'id'> = {
        teamId,
        name: `Fall ${year} Season`,
        sport,
        year,
        status: 'active',
        startDate: `${year}-08-01`,
        registrationOpenDate: `${year}-07-01`,
        registrationCloseDate: `${year}-08-31`,
        registrationFee: 0,
        description: 'Current season (activated from existing roster)',
        includedItems: [],
        requireMedicalInfo: false,
        requireEmergencyContact: true,
        requireUniformSizes: false,
        requireWaiver: false,
        playerCount: rosterCount,
        gamesPlayed: 0,
        createdAt: serverTimestamp(),
        createdBy: userData.uid,
      };
      
      // Add season document
      await addDoc(collection(db, 'teams', teamId, 'seasons'), seasonData).then(async (docRef) => {
        // Update team with currentSeasonId
        await updateDoc(doc(db, 'teams', teamId), {
          currentSeasonId: docRef.id,
        });
        
        onSeasonChange?.(docRef.id);
      });
      
    } catch (error: any) {
      console.error('Error activating season:', error);
      setActionError(error.message || 'Failed to activate season');
    } finally {
      setCreatingLegacy(false);
    }
  };
  
  // Status badge component
  const StatusBadge: React.FC<{ status: SeasonStatus }> = ({ status }) => {
    const configs: Record<SeasonStatus, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Draft' },
      registration: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Registration Open' },
      active: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Active' },
      completed: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Completed' },
    };
    const config = configs[status];
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };
  
  // Format currency
  const formatFee = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Current Season Status */}
      {currentSeason ? (
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                {currentSeason.name}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <StatusBadge status={currentSeason.status} />
                <span className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {currentSeason.playerCount || 0} players registered
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {currentSeason.status === 'registration' && (
                <button
                  onClick={() => handleStartSeason(currentSeason)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Season
                </button>
              )}
              
              {currentSeason.status === 'active' && (
                <button
                  onClick={() => {
                    setSelectedSeason(currentSeason);
                    setShowEndSeasonModal(true);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  End Season
                </button>
              )}
              
              {(currentSeason.status === 'registration' || currentSeason.status === 'active') && (
                <button
                  onClick={() => {
                    setSelectedSeason(currentSeason);
                    setShowRegistrationsModal(true);
                  }}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  Registrations
                </button>
              )}
              
              {/* Schedule Button */}
              {(currentSeason.status === 'registration' || currentSeason.status === 'active') && (
                <button
                  onClick={() => {
                    setSelectedSeason(currentSeason);
                    setShowScheduleModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <CalendarDays className="w-4 h-4" />
                  Schedule
                </button>
              )}
            </div>
          </div>
          
          {/* Season Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/30' : 'bg-zinc-100'}`}>
              <div className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Start Date</div>
              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                {new Date(currentSeason.startDate + 'T00:00').toLocaleDateString()}
              </div>
            </div>
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/30' : 'bg-zinc-100'}`}>
              <div className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Registration Fee</div>
              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                {formatFee(currentSeason.registrationFee)}
              </div>
            </div>
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/30' : 'bg-zinc-100'}`}>
              <div className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Registration Closes</div>
              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                {new Date(currentSeason.registrationCloseDate + 'T00:00').toLocaleDateString()}
              </div>
            </div>
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/30' : 'bg-zinc-100'}`}>
              <div className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Max Roster</div>
              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                {currentSeason.maxRosterSize || 'Unlimited'}
              </div>
            </div>
          </div>
          
          {/* What's Included */}
          {currentSeason.description && (
            <div className={`mt-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-black/20' : 'bg-zinc-50'}`}>
              <div className={`text-xs mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>What's Included</div>
              <p className={`text-sm ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {currentSeason.description}
              </p>
              {currentSeason.includedItems && currentSeason.includedItems.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentSeason.includedItems.map((item, idx) => (
                    <span key={idx} className="px-2 py-1 text-xs rounded-full bg-orange-500/20 text-orange-400">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Flyer Status */}
          {!currentSeason.flyerId && (
            <button
              onClick={onNavigateToDesignStudio}
              className={`mt-4 p-3 rounded-lg border-2 border-dashed w-full text-left transition-all hover:scale-[1.01] ${
                theme === 'dark' 
                  ? 'border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50 hover:bg-orange-500/10' 
                  : 'border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100'
              } ${onNavigateToDesignStudio ? 'cursor-pointer' : 'cursor-default'}`}
              disabled={!onNavigateToDesignStudio}
            >
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-orange-500" />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                    No Flyer Created
                  </p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Visit Design Studio to create a registration flyer
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-orange-500" />
              </div>
            </button>
          )}
        </GlassCard>
      ) : (
        // No active season
        <GlassCard className="p-8 text-center">
          <Trophy className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`} />
          <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            No Active Season
          </h3>
          <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
            {rosterCount > 0 
              ? 'You have players on your roster. Activate the current season to start tracking.'
              : 'Create a new season to open registration and start tracking stats'
            }
          </p>
          
          {actionError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {actionError}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {/* Activate Current Season - show if there are players */}
            {rosterCount > 0 && (
              <button
                onClick={handleActivateCurrentSeason}
                disabled={creatingLegacy}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2 justify-center transition-colors"
              >
                {creatingLegacy ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                Activate Current Season
              </button>
            )}
            
            {/* Start New Season */}
            <button
              onClick={() => setShowCreateModal(true)}
              className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 justify-center transition-colors ${
                rosterCount > 0
                  ? theme === 'dark' 
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              <Plus className="w-5 h-5" />
              Start New Season
            </button>
          </div>
        </GlassCard>
      )}
      
      {/* Past Seasons */}
      {seasons.filter(s => s.status === 'completed').length > 0 && (
        <div>
          <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Past Seasons
          </h4>
          <div className="space-y-2">
            {seasons.filter(s => s.status === 'completed').map(season => (
              <div
                key={season.id}
                className={`p-4 rounded-lg border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div>
                  <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                    {season.name}
                  </div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {season.playerCount} players • {season.gamesPlayed} games
                  </div>
                </div>
                <StatusBadge status={season.status} />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Create Season Button (if has current season) */}
      {currentSeason && currentSeason.status === 'completed' && (
        <button
          onClick={() => setShowCreateModal(true)}
          className={`w-full p-4 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors ${
            theme === 'dark' 
              ? 'border-white/20 text-zinc-400 hover:border-orange-500/50 hover:text-orange-400'
              : 'border-zinc-300 text-zinc-500 hover:border-orange-500 hover:text-orange-600'
          }`}
        >
          <Plus className="w-5 h-5" />
          Start New Season
        </button>
      )}
      
      {/* Create Season Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900/95 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className={`sticky top-0 p-6 border-b ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  Start New Season
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {actionError && (
                <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {actionError}
                </div>
              )}
              
              {/* Season Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Season Name *
                </label>
                <input
                  type="text"
                  value={newSeason.name}
                  onChange={(e) => setNewSeason(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Fall 2025, Spring League"
                  className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none ${
                    theme === 'dark'
                      ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                  }`}
                />
              </div>
              
              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Season Start Date *
                  </label>
                  <input
                    type="date"
                    value={newSeason.startDate}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, startDate: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none ${
                      theme === 'dark'
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Registration Opens *
                  </label>
                  <input
                    type="date"
                    value={newSeason.registrationOpenDate}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, registrationOpenDate: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none ${
                      theme === 'dark'
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Registration Closes *
                  </label>
                  <input
                    type="date"
                    value={newSeason.registrationCloseDate}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, registrationCloseDate: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none ${
                      theme === 'dark'
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
              </div>
              
              {/* Fee and Roster Size */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Registration Fee ($)
                  </label>
                  <div className="relative">
                    <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                    }`} />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newSeason.registrationFee}
                      onChange={(e) => setNewSeason(prev => ({ ...prev, registrationFee: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none ${
                        theme === 'dark'
                          ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500'
                          : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                      }`}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Set to 0 for free registration
                  </p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Max Roster Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newSeason.maxRosterSize}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, maxRosterSize: parseInt(e.target.value) || 0 }))}
                    placeholder="25"
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none ${
                      theme === 'dark'
                        ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Leave empty for unlimited
                  </p>
                </div>
              </div>
              
              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  What's Included (Description)
                </label>
                <textarea
                  value={newSeason.description}
                  onChange={(e) => setNewSeason(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what's included with registration (uniform, equipment, etc.)"
                  rows={3}
                  className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none resize-none ${
                    theme === 'dark'
                      ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                  }`}
                />
              </div>
              
              {/* Included Items Tags */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Included Items (Tags)
                </label>
                <div className="space-y-2">
                  {newSeason.includedItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const newItems = [...newSeason.includedItems];
                          newItems[idx] = e.target.value;
                          setNewSeason(prev => ({ ...prev, includedItems: newItems }));
                        }}
                        placeholder="e.g., Jersey, Helmet, Practice shorts"
                        className={`flex-1 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none ${
                          theme === 'dark'
                            ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500'
                            : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                        }`}
                      />
                      {idx > 0 && (
                        <button
                          onClick={() => {
                            const newItems = newSeason.includedItems.filter((_, i) => i !== idx);
                            setNewSeason(prev => ({ ...prev, includedItems: newItems }));
                          }}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setNewSeason(prev => ({ ...prev, includedItems: [...prev.includedItems, ''] }))}
                    className="text-sm text-orange-500 hover:text-orange-400 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
              </div>
              
              {/* Requirements */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Registration Requirements
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'requireMedicalInfo', label: 'Medical Information' },
                    { key: 'requireEmergencyContact', label: 'Emergency Contact' },
                    { key: 'requireUniformSizes', label: 'Uniform Sizes' },
                    { key: 'requireWaiver', label: 'Waiver/Liability Release' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(newSeason as any)[key]}
                        onChange={(e) => setNewSeason(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-5 h-5 rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className={theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Waiver Text */}
              {newSeason.requireWaiver && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Custom Waiver Text
                  </label>
                  <textarea
                    value={newSeason.waiverText}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, waiverText: e.target.value }))}
                    placeholder="Enter custom waiver/liability release text (or leave blank for default)"
                    rows={4}
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none resize-none ${
                      theme === 'dark'
                        ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                    }`}
                  />
                </div>
              )}
            </div>
            
            <div className={`sticky bottom-0 p-6 border-t flex gap-3 ${
              theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'
            }`}>
              <button
                onClick={() => setShowCreateModal(false)}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/10 text-zinc-300 hover:bg-white/20'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSeason}
                disabled={creating}
                className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {creating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Season
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* End Season Confirmation Modal */}
      {showEndSeasonModal && selectedSeason && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900/95 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                    End Season?
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {selectedSeason.name}
                  </p>
                </div>
              </div>
              
              <div className={`p-4 rounded-lg mb-4 ${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  This will:
                </p>
                <ul className={`text-sm mt-2 space-y-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  <li>• Lock all season stats (read-only)</li>
                  <li>• Release all players from the roster</li>
                  <li>• Close registration permanently</li>
                  <li>• Move season to "Past Seasons"</li>
                </ul>
              </div>
              
              {actionError && (
                <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm mb-4">
                  {actionError}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowEndSeasonModal(false);
                    setSelectedSeason(null);
                    setActionError(null);
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-white/10 text-zinc-300 hover:bg-white/20'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndSeason}
                  disabled={ending}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {ending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Ending...
                    </>
                  ) : (
                    <>
                      <Square className="w-5 h-5" />
                      End Season
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Registrations Modal */}
      {showRegistrationsModal && selectedSeason && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900/95 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className={`sticky top-0 p-6 border-b ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                    Registrations
                  </h2>
                  <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {selectedSeason.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRegistrationsModal(false);
                    setSelectedSeason(null);
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {(registrations[selectedSeason.id] || []).length === 0 ? (
                <div className="text-center py-12">
                  <Users className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`} />
                  <p className={`font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    No registrations yet
                  </p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    Share your team registration link with parents
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(registrations[selectedSeason.id] || []).map(reg => (
                    <div
                      key={reg.id}
                      className={`p-4 rounded-lg border ${
                        theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                            {reg.playerName}
                          </div>
                          <div className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            Parent: {reg.parentName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {reg.status === 'pending' ? (
                            <button
                              onClick={() => handleApproveRegistration(selectedSeason.id, reg)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reg.status === 'approved' 
                                ? 'bg-green-500/20 text-green-400'
                                : reg.status === 'waitlist'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-red-500/20 text-red-400'
                            }`}>
                              {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                            </span>
                          )}
                          {reg.feePaid && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                              Paid
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Schedule Modal */}
      {showScheduleModal && selectedSeason && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900/95 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className={`sticky top-0 p-6 border-b flex items-center justify-between ${
              theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'
            } z-10`}>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                Game Schedule
              </h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <GameScheduleManager
                teamId={teamId}
                teamName={teamName}
                seasonId={selectedSeason.id}
                seasonName={selectedSeason.name}
                onNavigateToDesignStudio={onNavigateToDesignStudio ? (gameId) => {
                  setShowScheduleModal(false);
                  onNavigateToDesignStudio();
                } : undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeasonManager;
