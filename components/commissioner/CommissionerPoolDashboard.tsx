/**
 * Commissioner Pool Dashboard
 * Shows all registration pools for the current season
 * Allows commissioners to:
 * - View player counts per pool
 * - Create teams from pools
 * - Schedule drafts for pools with 2+ teams
 * - Auto-assign players for single-team pools
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, doc, getDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  getSeasonPools,
  createTeamsForPool,
  autoAssignPlayersToTeam,
  scheduleDraft
} from '../../services/programSeasonService';
import {
  ProgramSeason,
  RegistrationPool,
  SportType
} from '../../types';
import {
  Button,
  Badge,
  GlassCard,
  GradientText
} from '../ui/OSYSComponents';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import {
  Users,
  Trophy,
  Plus,
  Calendar,
  Shuffle,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Settings,
  UserPlus
} from 'lucide-react';
import { toastSuccess, toastError, toastInfo } from '../../services/toast';

// Sport icons
const SPORT_ICONS: Record<SportType, string> = {
  football: '🏈',
  basketball: '🏀',
  cheer: '📣',
  soccer: '⚽',
  baseball: '⚾',
  volleyball: '🏐',
  other: '🎯'
};

// Helper to convert Firestore Timestamp to Date
const toDate = (timestamp: Timestamp | Date | undefined): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof (timestamp as Timestamp).toDate === 'function') {
    return (timestamp as Timestamp).toDate();
  }
  return null;
};

// Pool status badge mapping
const getPoolStatusBadge = (status: RegistrationPool['status']) => {
  switch (status) {
    case 'open':
      return <Badge variant="success">Open</Badge>;
    case 'closed':
      return <Badge variant="warning">Closed</Badge>;
    case 'teams_created':
      return <Badge variant="primary">Teams Created</Badge>;
    case 'draft_scheduled':
      return <Badge variant="gold">Draft Scheduled</Badge>;
    case 'draft_complete':
      return <Badge variant="success">Draft Complete</Badge>;
    case 'assigned':
      return <Badge variant="default">Assigned</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
};

interface Props {
  programId?: string;
  seasonId?: string;
}

export const CommissionerPoolDashboard: React.FC<Props> = ({ programId: propProgramId, seasonId: propSeasonId }) => {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { programId: routeProgramId, seasonId: routeSeasonId } = useParams<{ programId: string; seasonId: string }>();
  const isDark = theme === 'dark';
  
  // Use props or route params
  const programId = propProgramId || routeProgramId || '';
  const seasonId = propSeasonId || routeSeasonId || '';
  
  // State
  const [season, setSeason] = useState<ProgramSeason | null>(null);
  const [pools, setPools] = useState<RegistrationPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPool, setSelectedPool] = useState<RegistrationPool | null>(null);
  const [creatingTeams, setCreatingTeams] = useState<string | null>(null);
  const [numTeamsToCreate, setNumTeamsToCreate] = useState(2);
  const [showCreateTeamsModal, setShowCreateTeamsModal] = useState(false);
  
  // Load season and pools
  useEffect(() => {
    if (!programId || !seasonId) return;
    
    const loadSeasonData = async () => {
      try {
        // Load season
        const seasonDoc = await getDoc(doc(db, 'programs', programId, 'seasons', seasonId));
        if (seasonDoc.exists()) {
          setSeason({ id: seasonDoc.id, ...seasonDoc.data() } as ProgramSeason);
        }
      } catch (err) {
        console.error('Error loading season:', err);
        toastError('Failed to load season data');
      }
    };
    
    loadSeasonData();
    
    // Real-time listener for pools
    const poolsQuery = query(
      collection(db, 'programs', programId, 'seasons', seasonId, 'pools'),
      orderBy('sport'),
      orderBy('ageGroupLabel')
    );
    
    const unsubscribe = onSnapshot(poolsQuery, (snapshot) => {
      const poolsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RegistrationPool[];
      
      setPools(poolsData);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [programId, seasonId]);
  
  // Group pools by sport
  const poolsBySport = pools.reduce((acc, pool) => {
    if (!acc[pool.sport]) {
      acc[pool.sport] = [];
    }
    acc[pool.sport].push(pool);
    return acc;
  }, {} as Record<SportType, RegistrationPool[]>);
  
  // Calculate stats
  const totalPlayers = pools.reduce((sum, pool) => sum + pool.playerCount, 0);
  const poolsReadyForTeams = pools.filter(p => p.playerCount >= p.minPlayersPerTeam);
  const poolsWithTeams = pools.filter(p => (p.teamIds?.length || 0) > 0);
  
  // Handle creating teams for a pool
  const handleCreateTeams = async (pool: RegistrationPool, numTeams: number) => {
    setCreatingTeams(pool.id);
    
    try {
      // Generate team names
      const teamData: { name: string; coachId: string; coachName: string }[] = [];
      for (let i = 0; i < numTeams; i++) {
        teamData.push({
          name: `${pool.ageGroupLabel} Team ${i + 1}`,
          coachId: '', // To be assigned later
          coachName: 'TBD'
        });
      }
      
      const teamIds = await createTeamsForPool(
        programId,
        seasonId,
        pool.id,
        teamData
      );
      
      if (numTeams === 1 && teamIds.length > 0) {
        // Single team - auto-assign all players
        await autoAssignPlayersToTeam(programId, seasonId, pool.id, teamIds[0], teamData[0].name);
        toastSuccess(`Created team and auto-assigned ${pool.playerCount} players!`);
      } else {
        // Multiple teams - schedule draft
        toastSuccess(`Created ${numTeams} teams! Ready to schedule draft.`);
      }
      
      setShowCreateTeamsModal(false);
      setSelectedPool(null);
    } catch (err: any) {
      console.error('Error creating teams:', err);
      toastError(err.message || 'Failed to create teams');
    } finally {
      setCreatingTeams(null);
    }
  };
  
  // Handle scheduling a draft
  const handleScheduleDraft = async (pool: RegistrationPool) => {
    if (!pool.teamIds || pool.teamIds.length < 2) {
      toastError('Need at least 2 teams to schedule a draft');
      return;
    }
    
    try {
      // Schedule draft for 7 days from now
      const draftDate = new Date();
      draftDate.setDate(draftDate.getDate() + 7);
      draftDate.setHours(19, 0, 0, 0); // 7 PM
      
      await scheduleDraft(
        programId,
        seasonId,
        pool.id,
        {
          scheduledDate: draftDate,
          draftType: 'snake',
          lotteryEnabled: true
        },
        user!.uid
      );
      
      toastSuccess('Draft scheduled! Coaches will be notified.');
    } catch (err: any) {
      console.error('Error scheduling draft:', err);
      toastError(err.message || 'Failed to schedule draft');
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  
  // No program/season
  if (!programId || !seasonId) {
    return (
      <EmptyState
        type="generic"
        icon={AlertCircle}
        title="No Season Selected"
        description="Please select a program and season to view registration pools."
        actionLabel="Go to Programs"
        onAction={() => navigate('/commissioner/programs')}
      />
    );
  }
  
  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 ${isDark ? 'bg-black/40 backdrop-blur-xl border-b border-white/10' : 'bg-white/80 backdrop-blur-xl border-b border-slate-200'}`}>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <GradientText className="text-2xl font-bold">
                {season?.name || 'Season'} Pools
              </GradientText>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {season?.programName} • Registration {season?.status === 'registration_open' ? 'Open' : 'Closed'}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/commissioner')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
      
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <Users className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {totalPlayers}
            </div>
            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Total Registrations
            </div>
          </GlassCard>
          
          <GlassCard className="p-4 text-center">
            <Trophy className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {pools.length}
            </div>
            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Age Group Pools
            </div>
          </GlassCard>
          
          <GlassCard className="p-4 text-center">
            <CheckCircle2 className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {poolsReadyForTeams.length}
            </div>
            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Ready for Teams
            </div>
          </GlassCard>
          
          <GlassCard className="p-4 text-center">
            <Shuffle className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {poolsWithTeams.length}
            </div>
            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Teams Created
            </div>
          </GlassCard>
        </div>
        
        {/* Pools by Sport */}
        {Object.entries(poolsBySport).map(([sport, sportPools]) => (
          <div key={sport} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{SPORT_ICONS[sport as SportType]}</span>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {sport.charAt(0).toUpperCase() + sport.slice(1)} Pools
                </h2>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {sportPools.reduce((sum, p) => sum + p.playerCount, 0)} registered players
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sportPools.map(pool => {
                const hasEnoughPlayers = pool.playerCount >= pool.minPlayersPerTeam;
                const hasTeams = (pool.teamIds?.length || 0) > 0;
                const needsDraft = hasTeams && (pool.teamIds?.length || 0) >= 2 && pool.status !== 'draft_complete';
                
                return (
                  <GlassCard key={pool.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {pool.ageGroupLabel}
                        </h3>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Birth Years: {pool.maxBirthYear} - {pool.minBirthYear}
                        </p>
                      </div>
                      {getPoolStatusBadge(pool.status)}
                    </div>
                    
                    {/* Player Count */}
                    <div className={`flex items-center gap-2 mb-3 p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                      <Users className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                      <div className="flex-1">
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {pool.playerCount} Players
                        </div>
                        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Min: {pool.minPlayersPerTeam} | Max: {pool.maxPlayersPerTeam}
                        </div>
                      </div>
                      {hasEnoughPlayers ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    
                    {/* Teams Info */}
                    {hasTeams && (
                      <div className={`flex items-center gap-2 mb-3 p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                        <Trophy className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                        <div className="flex-1">
                          <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {pool.teamIds?.length} Team{pool.teamIds?.length !== 1 ? 's' : ''}
                          </div>
                          {pool.draftDate && (
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              Draft: {toDate(pool.draftDate)?.toLocaleDateString() || 'TBD'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      {!hasTeams && hasEnoughPlayers && (
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={() => {
                            setSelectedPool(pool);
                            setShowCreateTeamsModal(true);
                          }}
                          disabled={creatingTeams === pool.id}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Create Teams
                        </Button>
                      )}
                      
                      {needsDraft && !pool.draftDate && (
                        <Button
                          variant="gold"
                          className="flex-1"
                          onClick={() => handleScheduleDraft(pool)}
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Schedule Draft
                        </Button>
                      )}
                      
                      {needsDraft && pool.draftDate && (
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={() => navigate(`/commissioner/draft/${pool.id}`)}
                        >
                          <Shuffle className="w-4 h-4 mr-1" />
                          Run Draft
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        onClick={() => navigate(`/commissioner/pool/${pool.id}/players`)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* Empty State */}
        {pools.length === 0 && (
          <EmptyState
            type="roster"
            icon={Users}
            title="No Registration Pools"
            description="Pools are auto-created when you set up a season. Create a new season to generate pools."
            actionLabel="Create Season"
            onAction={() => navigate(`/commissioner/season-setup/${programId}`)}
          />
        )}
      </div>
      
      {/* Create Teams Modal */}
      {showCreateTeamsModal && selectedPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6">
            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Create Teams for {selectedPool.ageGroupLabel}
            </h2>
            
            <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              You have <strong>{selectedPool.playerCount}</strong> players in this pool.
              How many teams do you want to create?
            </p>
            
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Number of Teams
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, Math.floor(selectedPool.playerCount / selectedPool.minPlayersPerTeam))}
                  value={numTeamsToCreate}
                  onChange={(e) => setNumTeamsToCreate(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className={`text-2xl font-bold w-12 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {numTeamsToCreate}
                </span>
              </div>
              <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                ~{Math.floor(selectedPool.playerCount / numTeamsToCreate)} players per team
              </p>
            </div>
            
            {numTeamsToCreate === 1 ? (
              <div className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-500" />
                  <span className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>
                    All players will be auto-assigned to this team
                  </span>
                </div>
              </div>
            ) : (
              <div className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-center gap-2">
                  <Shuffle className="w-5 h-5 text-amber-500" />
                  <span className={isDark ? 'text-amber-400' : 'text-amber-700'}>
                    A draft will be scheduled for coaches to pick players
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowCreateTeamsModal(false);
                  setSelectedPool(null);
                }}
                disabled={!!creatingTeams}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => handleCreateTeams(selectedPool, numTeamsToCreate)}
                disabled={!!creatingTeams}
              >
                {creatingTeams ? 'Creating...' : 'Create Teams'}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default CommissionerPoolDashboard;
