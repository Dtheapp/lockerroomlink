import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Season, SeasonRegistration, SeasonStatus, SportType } from '../types';
import { Calendar, Users, DollarSign, Play, Square, CheckCircle, Clock, AlertCircle, ChevronRight, Plus, X, FileText, Palette, Trophy, UserPlus, Settings, CalendarDays, Info, Link2, Copy, Check, Trash2, Edit3 } from 'lucide-react';
import { GlassCard } from './ui/OSYSComponents';
import { GameScheduleManager } from './season/GameScheduleManager';

// Data to prefill registration flyer template
export interface RegistrationFlyerData {
  seasonId: string;
  seasonName: string;
  teamName: string;
  sport: SportType;
  registrationFee?: number;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  ageGroup?: string;
  description?: string;
  registrationLink?: string; // URL to include in QR code
}

interface SeasonManagerProps {
  teamId: string;
  teamName: string;
  sport: SportType;
  ageGroup?: string; // Team's age group (e.g., "9U", "10U")
  currentSeasonId?: string | null;
  rosterCount?: number; // Number of players currently on the roster
  // League membership info - if team is in active league, they cannot create seasons
  leagueId?: string | null;
  leagueStatus?: 'none' | 'pending' | 'active' | 'left' | 'kicked';
  leagueName?: string;
  // If true, team has a league-created season and can create registration event
  hasLeagueSeason?: boolean;
  onSeasonChange?: (seasonId: string | null) => void;
  onNavigateToDesignStudio?: (data?: RegistrationFlyerData) => void; // Callback to navigate to Design Studio with optional season data
}

const SeasonManager: React.FC<SeasonManagerProps> = ({ 
  teamId, 
  teamName, 
  sport, 
  ageGroup,
  currentSeasonId,
  rosterCount = 0,
  leagueId,
  leagueStatus,
  leagueName,
  hasLeagueSeason,
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
  
  // Edit Season Modal state
  const [showEditSeasonModal, setShowEditSeasonModal] = useState(false);
  const [editSeasonData, setEditSeasonData] = useState<Partial<Season>>({});
  const [savingSeasonEdit, setSavingSeasonEdit] = useState(false);
  const [showDeleteSeasonConfirm, setShowDeleteSeasonConfirm] = useState(false);
  const [deletingSeason, setDeletingSeason] = useState(false);
  
  // Payment details popup state
  const [selectedRegistrationForPayment, setSelectedRegistrationForPayment] = useState<SeasonRegistration | null>(null);
  
  // Edit/Delete registration state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null); // registration ID to delete
  const [deletingRegistration, setDeletingRegistration] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<SeasonRegistration | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<SeasonRegistration>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  
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
    // Payment method options
    allowPayInFull: true,
    allowPaymentPlan: false,
    allowInPersonPayment: false,
  });
  
  // Track if we need to create flyer after season creation
  const [pendingFlyerSeasonId, setPendingFlyerSeasonId] = useState<string | null>(null);
  
  // Track copied link state for UI feedback
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Check if team is in an active league (cannot create own seasons)
  const isInActiveLeague = Boolean(leagueId && leagueStatus === 'active');
  
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
  
  // Copy registration link to clipboard
  const handleCopyRegistrationLink = async (season: Season) => {
    // Use the public event ID if available, otherwise use team ID and season ID
    const registrationUrl = season.publicEventId 
      ? `${window.location.origin}/event/${season.publicEventId}`
      : `${window.location.origin}/team/${teamId}/register?season=${season.id}`;
    
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopiedLink(season.id);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
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
      
      // Validate at least one payment method is enabled (if fee > 0)
      if (newSeason.registrationFee > 0 && 
          !newSeason.allowPayInFull && 
          !newSeason.allowPaymentPlan && 
          !newSeason.allowInPersonPayment) {
        throw new Error('Please enable at least one payment method');
      }
      
      // Create season document - use null for empty optional fields to avoid Firebase undefined error
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
        maxRosterSize: newSeason.maxRosterSize || 0, // 0 = unlimited
        description: newSeason.description.trim(),
        includedItems: newSeason.includedItems.filter(i => i.trim()),
        requireMedicalInfo: newSeason.requireMedicalInfo,
        requireEmergencyContact: newSeason.requireEmergencyContact,
        requireUniformSizes: newSeason.requireUniformSizes,
        requireWaiver: newSeason.requireWaiver,
        // Use empty string instead of undefined to avoid Firebase error
        waiverText: newSeason.waiverText.trim() || '',
        // Payment method options
        allowPayInFull: newSeason.allowPayInFull,
        allowPaymentPlan: newSeason.allowPaymentPlan,
        allowInPersonPayment: newSeason.allowInPersonPayment,
        playerCount: 0,
        gamesPlayed: 0,
        createdAt: serverTimestamp(),
        createdBy: userData.uid,
      };
      
      const docRef = await addDoc(collection(db, 'teams', teamId, 'seasons'), seasonData);
      
      // Create a registration event linked to this season
      // Create in BOTH team subcollection AND top-level events collection for public discoverability
      const eventData = {
        teamId,
        teamName, // Include team name for public search
        ageGroup: ageGroup || null, // Include team's age group for filtering
        sport, // Include sport for filtering
        title: `${newSeason.name.trim()} Registration`,
        description: newSeason.description.trim() || `Registration for ${teamName} ${newSeason.name.trim()}`,
        type: 'registration',
        startDate: newSeason.registrationOpenDate,
        endDate: newSeason.registrationCloseDate,
        location: 'Online Registration',
        isPublic: true,
        requiresRegistration: true,
        registrationFee: Math.round(newSeason.registrationFee * 100),
        maxAttendees: newSeason.maxRosterSize || 0,
        seasonId: docRef.id, // Link to the season
        status: 'active', // Set to active so it appears in public search
        flyerNeeded: true, // Flag that flyer needs to be created
        // Registration requirements - controls what fields are shown in form
        requireMedicalInfo: newSeason.requireMedicalInfo,
        requireEmergencyContact: newSeason.requireEmergencyContact,
        requireUniformSizes: newSeason.requireUniformSizes,
        requireWaiver: newSeason.requireWaiver,
        waiverText: newSeason.waiverText?.trim() || '',
        createdAt: serverTimestamp(),
        createdBy: userData.uid,
      };
      
      // Create in team subcollection (for team-specific queries)
      const eventRef = await addDoc(collection(db, 'teams', teamId, 'events'), eventData);
      
      // ALSO create in top-level events collection (for public discovery)
      const publicEventData = {
        ...eventData,
        teamEventId: eventRef.id, // Reference to team subcollection event
      };
      const publicEventRef = await addDoc(collection(db, 'events'), publicEventData);
      
      // Update season with BOTH event IDs
      await updateDoc(doc(db, 'teams', teamId, 'seasons', docRef.id), {
        registrationEventId: eventRef.id,
        publicEventId: publicEventRef.id, // Track the public event too
      });
      
      // Update team's current season
      await updateDoc(doc(db, 'teams', teamId), {
        currentSeasonId: docRef.id,
      });
      
      onSeasonChange?.(docRef.id);
      
      // Set pending flyer season ID to show the notification
      setPendingFlyerSeasonId(docRef.id);
      
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
        allowPayInFull: true,
        allowPaymentPlan: false,
        allowInPersonPayment: false,
      });
      setShowCreateModal(false);
      
    } catch (error: any) {
      console.error('Error creating season:', error);
      setActionError(error.message || 'Failed to create season');
    } finally {
      setCreating(false);
    }
  };
  
  // Handle creating flyer for season
  const handleCreateFlyer = (seasonId: string) => {
    // Find the season data
    const season = seasons.find(s => s.id === seasonId);
    if (!season) return;
    
    // Store season data in sessionStorage for Design Studio to pick up
    sessionStorage.setItem('pendingRegistrationFlyer', JSON.stringify({
      seasonId,
      teamId,
      teamName,
      seasonName: season.name,
      registrationFee: season.registrationFee,
      registrationOpenDate: season.registrationOpenDate,
      registrationCloseDate: season.registrationCloseDate,
      description: season.description,
      includedItems: season.includedItems,
      sport,
      registrationEventId: season.registrationEventId,
    }));
    
    // Clear the pending notification
    setPendingFlyerSeasonId(null);
    
    // Navigate to Design Studio
    if (onNavigateToDesignStudio) {
      onNavigateToDesignStudio();
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
  
  // Delete registration
  const handleDeleteRegistration = async (seasonId: string, registrationId: string) => {
    if (deletingRegistration) return;
    
    setDeletingRegistration(true);
    try {
      // Delete the registration document
      await deleteDoc(doc(db, 'teams', teamId, 'seasons', seasonId, 'registrations', registrationId));
      
      // Decrement player count if it was approved
      const season = seasons.find(s => s.id === seasonId);
      const reg = registrations[seasonId]?.find(r => r.id === registrationId);
      if (season && reg?.status === 'approved') {
        await updateDoc(doc(db, 'teams', teamId, 'seasons', seasonId), {
          playerCount: Math.max(0, (season.playerCount || 1) - 1),
        });
      }
      
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting registration:', error);
      alert('Failed to delete registration');
    } finally {
      setDeletingRegistration(false);
    }
  };
  
  // Edit registration
  const handleStartEdit = (reg: SeasonRegistration) => {
    setEditingRegistration(reg);
    setEditFormData({
      playerName: reg.playerName,
      parentName: reg.parentName,
      parentEmail: reg.parentEmail,
      status: reg.status,
    });
  };
  
  const handleSaveEdit = async () => {
    if (!editingRegistration || !selectedSeason || savingEdit) return;
    
    setSavingEdit(true);
    try {
      await updateDoc(
        doc(db, 'teams', teamId, 'seasons', selectedSeason.id, 'registrations', editingRegistration.id),
        {
          ...editFormData,
          updatedAt: serverTimestamp(),
        }
      );
      setEditingRegistration(null);
      setEditFormData({});
    } catch (error) {
      console.error('Error updating registration:', error);
      alert('Failed to update registration');
    } finally {
      setSavingEdit(false);
    }
  };
  
  // Edit Season - open modal with current season data
  const handleStartEditSeason = () => {
    if (!currentSeason) return;
    setEditSeasonData({
      name: currentSeason.name,
      startDate: currentSeason.startDate,
      registrationOpenDate: currentSeason.registrationOpenDate,
      registrationCloseDate: currentSeason.registrationCloseDate,
      registrationFee: currentSeason.registrationFee,
      maxRosterSize: currentSeason.maxRosterSize,
      description: currentSeason.description,
    });
    setShowEditSeasonModal(true);
  };
  
  // Save Season Edit
  const handleSaveSeasonEdit = async () => {
    if (!currentSeason || savingSeasonEdit) return;
    
    setSavingSeasonEdit(true);
    try {
      await updateDoc(doc(db, 'teams', teamId, 'seasons', currentSeason.id), {
        ...editSeasonData,
        updatedAt: serverTimestamp(),
      });
      
      // Also update the linked registration event if it exists
      if (currentSeason.registrationEventId) {
        await updateDoc(doc(db, 'teams', teamId, 'events', currentSeason.registrationEventId), {
          title: `${editSeasonData.name} Registration`,
          description: editSeasonData.description || '',
          startDate: editSeasonData.registrationOpenDate,
          endDate: editSeasonData.registrationCloseDate,
          registrationFee: editSeasonData.registrationFee,
          maxAttendees: editSeasonData.maxRosterSize || 0,
          ageGroup: ageGroup || null,
          sport: sport,
          // Include requirement fields
          requireMedicalInfo: editSeasonData.requireMedicalInfo ?? true,
          requireEmergencyContact: editSeasonData.requireEmergencyContact ?? true,
          requireUniformSizes: editSeasonData.requireUniformSizes ?? true,
          requireWaiver: editSeasonData.requireWaiver ?? true,
          waiverText: editSeasonData.waiverText || '',
          updatedAt: serverTimestamp(),
        });
      }
      
      // Update public event too
      if (currentSeason.publicEventId) {
        await updateDoc(doc(db, 'events', currentSeason.publicEventId), {
          title: `${editSeasonData.name} Registration`,
          description: editSeasonData.description || '',
          startDate: editSeasonData.registrationOpenDate,
          endDate: editSeasonData.registrationCloseDate,
          registrationFee: editSeasonData.registrationFee,
          maxAttendees: editSeasonData.maxRosterSize || 0,
          ageGroup: ageGroup || null,
          sport: sport,
          // Include requirement fields
          requireMedicalInfo: editSeasonData.requireMedicalInfo ?? true,
          requireEmergencyContact: editSeasonData.requireEmergencyContact ?? true,
          requireUniformSizes: editSeasonData.requireUniformSizes ?? true,
          requireWaiver: editSeasonData.requireWaiver ?? true,
          waiverText: editSeasonData.waiverText || '',
          updatedAt: serverTimestamp(),
        });
      }
      
      setShowEditSeasonModal(false);
      setEditSeasonData({});
    } catch (error) {
      console.error('Error updating season:', error);
      alert('Failed to update season');
    } finally {
      setSavingSeasonEdit(false);
    }
  };
  
  // Delete Season
  const handleDeleteSeason = async () => {
    if (!currentSeason || deletingSeason) return;
    
    setDeletingSeason(true);
    try {
      // Delete linked events
      if (currentSeason.registrationEventId) {
        await deleteDoc(doc(db, 'teams', teamId, 'events', currentSeason.registrationEventId));
      }
      if (currentSeason.publicEventId) {
        await deleteDoc(doc(db, 'events', currentSeason.publicEventId));
      }
      
      // Delete the season
      await deleteDoc(doc(db, 'teams', teamId, 'seasons', currentSeason.id));
      
      // Clear current season from team
      await updateDoc(doc(db, 'teams', teamId), {
        currentSeasonId: null,
      });
      
      onSeasonChange?.(null);
      setShowDeleteSeasonConfirm(false);
      setShowEditSeasonModal(false);
    } catch (error) {
      console.error('Error deleting season:', error);
      alert('Failed to delete season');
    } finally {
      setDeletingSeason(false);
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
      {/* Flyer Creation Notification Banner */}
      {pendingFlyerSeasonId && (
        <div className={`p-4 rounded-xl border-2 border-dashed animate-pulse ${
          theme === 'dark' 
            ? 'bg-gradient-to-r from-orange-500/20 to-purple-500/20 border-orange-500/50' 
            : 'bg-gradient-to-r from-orange-100 to-purple-100 border-orange-400'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                theme === 'dark' ? 'bg-orange-500/30' : 'bg-orange-200'
              }`}>
                <Palette className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  🎨 Create Your Registration Flyer!
                </h4>
                <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Season created! Now design a flyer to share with parents. Your registration info will be pre-loaded.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPendingFlyerSeasonId(null)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  theme === 'dark' 
                    ? 'bg-white/10 text-zinc-300 hover:bg-white/20' 
                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                }`}
              >
                Later
              </button>
              <button
                onClick={() => handleCreateFlyer(pendingFlyerSeasonId)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-purple-500 hover:from-orange-600 hover:to-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-orange-500/25"
              >
                <Palette className="w-4 h-4" />
                Design Flyer Now
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Current Season Status */}
      {currentSeason ? (
        <GlassCard className="p-6">
          {/* League Info Banner - show if team is in active league */}
          {isInActiveLeague && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-3 ${
              theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'
            }`}>
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div>
                <span className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                  Season managed by <strong>{leagueName || 'your league'}</strong>
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
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
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Start Season - Only for non-league teams */}
              {currentSeason.status === 'registration' && !isInActiveLeague && (
                <button
                  onClick={() => handleStartSeason(currentSeason)}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span className="hidden xs:inline">Start</span> Season
                </button>
              )}
              
              {/* End Season - Only for non-league teams */}
              {currentSeason.status === 'active' && !isInActiveLeague && (
                <button
                  onClick={() => {
                    setSelectedSeason(currentSeason);
                    setShowEndSeasonModal(true);
                  }}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  <span className="hidden xs:inline">End</span> Season
                </button>
              )}
              
              {(currentSeason.status === 'registration' || currentSeason.status === 'active') && (
                <button
                  onClick={() => {
                    setSelectedSeason(currentSeason);
                    setShowRegistrationsModal(true);
                  }}
                  className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Registrations</span>
                  <span className="sm:hidden">Regs</span>
                </button>
              )}
              
              {/* Schedule Button */}
              {(currentSeason.status === 'registration' || currentSeason.status === 'active') && (
                <button
                  onClick={() => {
                    setSelectedSeason(currentSeason);
                    setShowScheduleModal(true);
                  }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                >
                  <CalendarDays className="w-4 h-4" />
                  <span className="hidden sm:inline">Schedule</span>
                  <span className="sm:hidden">Sched</span>
                </button>
              )}
              
              {/* Share Registration Link Button - Icon only on mobile */}
              {currentSeason.status === 'registration' && (
                <button
                  onClick={() => handleCopyRegistrationLink(currentSeason)}
                  className={`px-3 py-2 ${copiedLink === currentSeason.id 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-purple-600 hover:bg-purple-700'} text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors`}
                  title="Copy shareable registration link"
                >
                  {copiedLink === currentSeason.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span className="hidden sm:inline">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Share</span>
                    </>
                  )}
                </button>
              )}
              
              {/* Edit Season Button */}
              <button
                onClick={handleStartEditSeason}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  theme === 'dark' 
                    ? 'bg-zinc-700 hover:bg-zinc-600 text-white' 
                    : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                }`}
                title="Edit season settings"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
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
          
          {/* Registration Link - Share with Parents */}
          {currentSeason.status === 'registration' && (
            <div className={`mt-4 p-4 rounded-lg border-2 ${
              theme === 'dark' 
                ? 'bg-purple-500/10 border-purple-500/30' 
                : 'bg-purple-50 border-purple-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Link2 className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                  Registration Link
                </span>
              </div>
              <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Share this link with parents to register their athletes
              </p>
              <div className={`flex items-center gap-2 p-2 rounded-lg ${
                theme === 'dark' ? 'bg-black/30' : 'bg-white'
              }`}>
                <input 
                  type="text"
                  readOnly
                  value={currentSeason.publicEventId 
                    ? `${window.location.origin}/event/${currentSeason.publicEventId}`
                    : `${window.location.origin}/team/${teamId}/register?season=${currentSeason.id}`}
                  className={`flex-1 text-sm truncate bg-transparent border-none outline-none ${
                    theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'
                  }`}
                />
                <button
                  onClick={() => handleCopyRegistrationLink(currentSeason)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    copiedLink === currentSeason.id
                      ? 'bg-green-500 text-white'
                      : theme === 'dark'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  {copiedLink === currentSeason.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {/* Flyer Status */}
          {!currentSeason.flyerId && (
            <button
              onClick={() => {
                // Build registration link
                const baseUrl = window.location.origin;
                const registrationLink = currentSeason.registrationEventId 
                  ? `${baseUrl}/#/events/${currentSeason.registrationEventId}/register`
                  : `${baseUrl}/#/register/${teamId}/${currentSeason.id}`;
                
                onNavigateToDesignStudio?.({
                  seasonId: currentSeason.id,
                  seasonName: currentSeason.name,
                  teamName,
                  sport,
                  registrationFee: currentSeason.registrationFee,
                  registrationOpenDate: currentSeason.registrationOpenDate,
                  registrationCloseDate: currentSeason.registrationCloseDate,
                  ageGroup: ageGroup, // Use team's ageGroup
                  description: currentSeason.description,
                  registrationLink,
                });
              }}
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
          {/* If team is in active league, show waiting message */}
          {isInActiveLeague ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                Waiting for League
              </h3>
              <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Your team is part of <strong className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}>{leagueName || 'a league'}</strong>.
                <br />
                The league commissioner will start the season for all teams.
              </p>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                <p className={`text-xs ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                  💡 Once the league starts the season, you can create your registration event for parents to sign up.
                </p>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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
      
      {/* Create Season Button (if has current season) - Only for non-league teams */}
      {currentSeason && currentSeason.status === 'completed' && !isInActiveLeague && (
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
      
      {/* Create Season Modal - Use React Portal to render above everything */}
      {showCreateModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          style={{ zIndex: 99999 }}
        >
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl relative ${
            theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className={`sticky top-0 p-6 border-b z-10 ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  🏆 Start New Season
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
                      step="1"
                      value={newSeason.registrationFee || ''}
                      onChange={(e) => setNewSeason(prev => ({ ...prev, registrationFee: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                      placeholder="0"
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
              
              {/* Payment Methods - only show if fee > 0 */}
              {newSeason.registrationFee > 0 && (
                <div>
                  <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    💳 Accepted Payment Methods
                  </label>
                  <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Choose which payment options parents can use during registration
                  </p>
                  <div className="space-y-3">
                    <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-all ${
                      newSeason.allowPayInFull 
                        ? theme === 'dark' ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
                        : theme === 'dark' ? 'bg-black/20 border-white/10 hover:border-white/20' : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={newSeason.allowPayInFull}
                        onChange={(e) => setNewSeason(prev => ({ ...prev, allowPayInFull: e.target.checked }))}
                        className="w-5 h-5 mt-0.5 rounded border-zinc-300 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <span className={`font-medium ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>
                          💵 Pay in Full
                        </span>
                        <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                          Parent pays entire registration fee upfront via card/PayPal
                        </p>
                      </div>
                    </label>
                    
                    <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-all ${
                      newSeason.allowPaymentPlan 
                        ? theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                        : theme === 'dark' ? 'bg-black/20 border-white/10 hover:border-white/20' : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={newSeason.allowPaymentPlan}
                        onChange={(e) => setNewSeason(prev => ({ ...prev, allowPaymentPlan: e.target.checked }))}
                        className="w-5 h-5 mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className={`font-medium ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>
                          📅 Payment Plan
                        </span>
                        <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                          Split into installments (e.g., 3 monthly payments)
                        </p>
                      </div>
                    </label>
                    
                    <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-all ${
                      newSeason.allowInPersonPayment 
                        ? theme === 'dark' ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'
                        : theme === 'dark' ? 'bg-black/20 border-white/10 hover:border-white/20' : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={newSeason.allowInPersonPayment}
                        onChange={(e) => setNewSeason(prev => ({ ...prev, allowInPersonPayment: e.target.checked }))}
                        className="w-5 h-5 mt-0.5 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <span className={`font-medium ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>
                          🤝 In-Person Payment
                        </span>
                        <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                          Cash, check, or card at practice/games (you'll mark as paid manually)
                        </p>
                      </div>
                    </label>
                  </div>
                  
                  {!newSeason.allowPayInFull && !newSeason.allowPaymentPlan && !newSeason.allowInPersonPayment && (
                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Please enable at least one payment method
                    </p>
                  )}
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
        </div>,
        document.body
      )}
      
      {/* End Season Confirmation Modal */}
      {showEndSeasonModal && selectedSeason && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          style={{ zIndex: 99999 }}
        >
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
        </div>,
        document.body
      )}
      
      {/* Registrations Modal */}
      {showRegistrationsModal && selectedSeason && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          style={{ zIndex: 99999 }}
        >
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
                  {(registrations[selectedSeason.id] || []).map(reg => {
                    // Calculate payment status
                    const hasPaymentPlan = reg.isPaymentPlan;
                    const isPaidInFull = reg.feePaid || (reg.totalPaid && reg.totalPaid >= reg.feeAmount);
                    const hasPartialPayment = hasPaymentPlan && reg.totalPaid && reg.totalPaid > 0 && !isPaidInFull;
                    const remainingAmount = reg.remainingBalance || (reg.feeAmount - (reg.totalPaid || 0));
                    
                    return (
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
                            
                            {/* Payment Status Badge - Clickable for details */}
                            {isPaidInFull ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                                Paid
                              </span>
                            ) : hasPartialPayment ? (
                              <button
                                onClick={() => setSelectedRegistrationForPayment(reg)}
                                className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Clock className="w-3 h-3" />
                                Payment Plan
                                <Info className="w-3 h-3" />
                              </button>
                            ) : hasPaymentPlan ? (
                              <button
                                onClick={() => setSelectedRegistrationForPayment(reg)}
                                className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <AlertCircle className="w-3 h-3" />
                                No Payments
                                <Info className="w-3 h-3" />
                              </button>
                            ) : reg.feeAmount > 0 ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
                                Unpaid
                              </span>
                            ) : null}
                            
                            {/* Edit & Delete Buttons */}
                            <button
                              onClick={() => handleStartEdit(reg)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                theme === 'dark' ? 'hover:bg-white/10 text-zinc-400 hover:text-blue-400' : 'hover:bg-zinc-200 text-zinc-500 hover:text-blue-600'
                              }`}
                              title="Edit registration"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(reg.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                theme === 'dark' ? 'hover:bg-white/10 text-zinc-400 hover:text-red-400' : 'hover:bg-zinc-200 text-zinc-500 hover:text-red-600'
                              }`}
                              title="Delete registration"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Delete Confirmation Inline */}
                        {showDeleteConfirm === reg.id && (
                          <div className={`mt-3 p-3 rounded-lg border ${
                            theme === 'dark' ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'
                          }`}>
                            <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                              Delete registration for <strong>{reg.playerName}</strong>?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDeleteRegistration(selectedSeason.id, reg.id)}
                                disabled={deletingRegistration}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                              >
                                {deletingRegistration ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="w-4 h-4" />
                                    Yes, Delete
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  theme === 'dark' ? 'bg-zinc-700 hover:bg-zinc-600 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                                }`}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Show quick payment info if on payment plan */}
                        {hasPaymentPlan && !isPaidInFull && (
                          <div className={`mt-2 pt-2 border-t text-xs ${theme === 'dark' ? 'border-white/10 text-zinc-500' : 'border-zinc-200 text-zinc-500'}`}>
                            Paid: ${((reg.totalPaid || 0) / 100).toFixed(2)} of ${(reg.feeAmount / 100).toFixed(2)} 
                            <span className="ml-2 text-purple-400">
                              (${(remainingAmount / 100).toFixed(2)} remaining)
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Edit Registration Modal */}
      {editingRegistration && selectedSeason && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          style={{ zIndex: 100000 }}
        >
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900/95 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  Edit Registration
                </h2>
                <button
                  onClick={() => {
                    setEditingRegistration(null);
                    setEditFormData({});
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Player Name */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Player Name
                </label>
                <input
                  type="text"
                  value={editFormData.playerName || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, playerName: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-zinc-800 border-white/10 text-white placeholder-zinc-500' 
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400'
                  } focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all`}
                />
              </div>
              
              {/* Parent Name */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Parent Name
                </label>
                <input
                  type="text"
                  value={editFormData.parentName || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, parentName: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-zinc-800 border-white/10 text-white placeholder-zinc-500' 
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400'
                  } focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all`}
                />
              </div>
              
              {/* Parent Email */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Parent Email
                </label>
                <input
                  type="email"
                  value={editFormData.parentEmail || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, parentEmail: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-zinc-800 border-white/10 text-white placeholder-zinc-500' 
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400'
                  } focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all`}
                />
              </div>
              
              {/* Status */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Status
                </label>
                <select
                  value={editFormData.status || 'pending'}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-zinc-800 border-white/10 text-white' 
                      : 'bg-white border-zinc-300 text-zinc-900'
                  } focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all`}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="waitlist">Waitlist</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setEditingRegistration(null);
                    setEditFormData({});
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    theme === 'dark' ? 'bg-zinc-700 hover:bg-zinc-600 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {savingEdit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Schedule Modal */}
      {showScheduleModal && selectedSeason && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          style={{ zIndex: 99999 }}
        >
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
        </div>,
        document.body
      )}
      
      {/* Payment Details Popup */}
      {selectedRegistrationForPayment && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 99999 }}
        >
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900/95 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-500" />
                <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  Payment Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedRegistrationForPayment(null)}
                className={`p-1.5 rounded-lg transition-colors ${
                  theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Player Info */}
              <div>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  {selectedRegistrationForPayment.playerName}
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Parent: {selectedRegistrationForPayment.parentName}
                </p>
                {selectedRegistrationForPayment.parentEmail && (
                  <p className={`text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    {selectedRegistrationForPayment.parentEmail}
                  </p>
                )}
              </div>
              
              {/* Payment Summary */}
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-black/30' : 'bg-zinc-100'}`}>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>Total Fee:</span>
                    <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                      ${(selectedRegistrationForPayment.feeAmount / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>Amount Paid:</span>
                    <span className="font-medium text-green-400">
                      ${((selectedRegistrationForPayment.totalPaid || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className={`flex justify-between text-sm pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-zinc-300'}`}>
                    <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Remaining Balance:</span>
                    <span className="font-bold text-purple-400">
                      ${((selectedRegistrationForPayment.remainingBalance || (selectedRegistrationForPayment.feeAmount - (selectedRegistrationForPayment.totalPaid || 0))) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-3">
                  <div className={`h-2 rounded-full ${theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'}`}>
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, ((selectedRegistrationForPayment.totalPaid || 0) / selectedRegistrationForPayment.feeAmount) * 100)}%` 
                      }}
                    />
                  </div>
                  <p className={`text-xs mt-1 text-center ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    {Math.round(((selectedRegistrationForPayment.totalPaid || 0) / selectedRegistrationForPayment.feeAmount) * 100)}% paid
                  </p>
                </div>
              </div>
              
              {/* Payment History */}
              {selectedRegistrationForPayment.paymentHistory && selectedRegistrationForPayment.paymentHistory.length > 0 && (
                <div>
                  <h4 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Payment History
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedRegistrationForPayment.paymentHistory.map((payment, idx) => (
                      <div 
                        key={payment.id || idx}
                        className={`flex justify-between items-center text-sm p-2 rounded ${theme === 'dark' ? 'bg-black/20' : 'bg-zinc-50'}`}
                      >
                        <div>
                          <span className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}>
                            {payment.paidAt?.toDate ? new Date(payment.paidAt.toDate()).toLocaleDateString() : 'Unknown date'}
                          </span>
                          {payment.note && (
                            <span className={`ml-2 text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                              - {payment.note}
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-green-400">
                          +${(payment.amount / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Reminder info */}
              <div className={`text-xs p-3 rounded-lg ${theme === 'dark' ? 'bg-purple-500/10 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Payment Plan Active</p>
                    <p className="mt-1 opacity-75">
                      {selectedRegistrationForPayment.lastPaymentReminderAt 
                        ? `Last reminder sent: ${new Date(selectedRegistrationForPayment.lastPaymentReminderAt.toDate?.() || selectedRegistrationForPayment.lastPaymentReminderAt).toLocaleDateString()}`
                        : 'Reminders are sent every 30 days until paid in full.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
              <button
                onClick={() => setSelectedRegistrationForPayment(null)}
                className="w-full py-2 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Edit Season Modal */}
      {showEditSeasonModal && currentSeason && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          style={{ zIndex: 100000 }}
        >
          <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900/95 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className={`sticky top-0 p-6 border-b ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  Edit Season
                </h2>
                <button
                  onClick={() => {
                    setShowEditSeasonModal(false);
                    setEditSeasonData({});
                    setShowDeleteSeasonConfirm(false);
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Season Name */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Season Name
                </label>
                <input
                  type="text"
                  value={editSeasonData.name || ''}
                  onChange={(e) => setEditSeasonData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-zinc-800 border-white/10 text-white' 
                      : 'bg-white border-zinc-300 text-zinc-900'
                  }`}
                />
              </div>
              
              {/* Registration Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Registration Opens
                  </label>
                  <input
                    type="date"
                    value={editSeasonData.registrationOpenDate || ''}
                    onChange={(e) => setEditSeasonData(prev => ({ ...prev, registrationOpenDate: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-white/10 text-white' 
                        : 'bg-white border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Registration Closes
                  </label>
                  <input
                    type="date"
                    value={editSeasonData.registrationCloseDate || ''}
                    onChange={(e) => setEditSeasonData(prev => ({ ...prev, registrationCloseDate: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-white/10 text-white' 
                        : 'bg-white border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
              </div>
              
              {/* Start Date */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Season Start Date
                </label>
                <input
                  type="date"
                  value={editSeasonData.startDate || ''}
                  onChange={(e) => setEditSeasonData(prev => ({ ...prev, startDate: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-zinc-800 border-white/10 text-white' 
                      : 'bg-white border-zinc-300 text-zinc-900'
                  }`}
                />
              </div>
              
              {/* Fee & Roster Size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Registration Fee ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={((editSeasonData.registrationFee || 0) / 100).toFixed(2)}
                    onChange={(e) => setEditSeasonData(prev => ({ ...prev, registrationFee: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-white/10 text-white' 
                        : 'bg-white border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Max Roster Size
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editSeasonData.maxRosterSize || ''}
                    onChange={(e) => setEditSeasonData(prev => ({ ...prev, maxRosterSize: parseInt(e.target.value) || 0 }))}
                    placeholder="0 = Unlimited"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-white/10 text-white' 
                        : 'bg-white border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
              </div>
              
              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Description
                </label>
                <textarea
                  value={editSeasonData.description || ''}
                  onChange={(e) => setEditSeasonData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border resize-none ${
                    theme === 'dark' 
                      ? 'bg-zinc-800 border-white/10 text-white' 
                      : 'bg-white border-zinc-300 text-zinc-900'
                  }`}
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditSeasonModal(false);
                    setEditSeasonData({});
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    theme === 'dark' ? 'bg-zinc-700 hover:bg-zinc-600 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSeasonEdit}
                  disabled={savingSeasonEdit}
                  className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {savingSeasonEdit ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
              
              {/* Delete Season Section */}
              <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
                {!showDeleteSeasonConfirm ? (
                  <button
                    onClick={() => setShowDeleteSeasonConfirm(true)}
                    className="w-full px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Season
                  </button>
                ) : (
                  <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
                    <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                      <strong>Delete this season?</strong> This will also delete the linked registration event and cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteSeason}
                        disabled={deletingSeason}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                      >
                        {deletingSeason ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Yes, Delete
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowDeleteSeasonConfirm(false)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          theme === 'dark' ? 'bg-zinc-700 hover:bg-zinc-600 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SeasonManager;
