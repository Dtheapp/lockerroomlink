/**
 * Draft Setup Wizard
 * Commissioner creates a new Draft Day event
 * Steps: Select Pool → Select Teams → Configure → Schedule → Review
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createDraftEvent, CreateDraftParams } from '../../services/draftDayService';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { DraftTeamInfo, SportType } from '../../types';
import {
  Button,
  Badge,
  GlassCard,
} from '../ui/OSYSComponents';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  Trophy,
  Calendar,
  Settings,
  Shuffle,
  Clock,
  MapPin,
  Zap,
  Timer,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { toastSuccess, toastError } from '../../services/toast';

// Sport emojis
const SPORT_EMOJI: Record<string, string> = {
  football: '🏈', basketball: '🏀', soccer: '⚽', baseball: '⚾',
  cheer: '📣', volleyball: '🏐', other: '🎯',
};

const STEPS = [
  { id: 'pool', label: 'Select Pool', icon: <Users className="w-4 h-4" /> },
  { id: 'teams', label: 'Select Teams', icon: <Trophy className="w-4 h-4" /> },
  { id: 'config', label: 'Configure', icon: <Settings className="w-4 h-4" /> },
  { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
  { id: 'review', label: 'Review', icon: <Check className="w-4 h-4" /> },
];

interface PoolOption {
  id: string;
  ageGroup: string;
  sport: SportType;
  playerCount: number;
  seasonId: string;
  seasonName?: string;
  sourceType: 'season_pool' | 'registration'; // Track where the pool data lives
  registrationId?: string; // For registration-based pools
}

interface TeamOption {
  id: string;
  name: string;
  sport: SportType;
  ageGroup: string;
  coachId: string;
  coachName: string;
  color?: string;
  logo?: string;
  selected: boolean;
}

const DraftSetup: React.FC = () => {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { poolId: preselectedPoolId } = useParams();
  
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  
  // Step 1: Pool selection
  const [pools, setPools] = useState<PoolOption[]>([]);
  const [loadingPools, setLoadingPools] = useState(true);
  const [selectedPool, setSelectedPool] = useState<PoolOption | null>(null);
  
  // Step 2: Team selection
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  
  // Step 3: Config
  const [draftType, setDraftType] = useState<'snake' | 'linear' | 'lottery'>('snake');
  const [pickTimer, setPickTimer] = useState(120);
  const [lotteryEnabled, setLotteryEnabled] = useState(true);
  const [allowTrading, setAllowTrading] = useState(false);
  
  // Step 4: Schedule
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('19:00');
  const [location, setLocation] = useState('');
  
  const dark = theme === 'dark';
  const programId = userData?.programId;

  // Load available pools
  useEffect(() => {
    if (!programId) {
      console.log('[DraftSetup] No programId found on userData, skipping pool load');
      setLoadingPools(false);
      return;
    }
    
    const loadPools = async () => {
      try {
        const poolOptions: PoolOption[] = [];
        
        // Source 1: Season-based pools (programs/{pid}/seasons/{sid}/pools)
        try {
          const seasonsSnap = await getDocs(
            query(collection(db, 'programs', programId, 'seasons'), orderBy('createdAt', 'desc'))
          );
          
          for (const seasonDoc of seasonsSnap.docs) {
            const season = seasonDoc.data();
            const poolsSnap = await getDocs(
              collection(db, 'programs', programId, 'seasons', seasonDoc.id, 'pools')
            );
            
            for (const poolDoc of poolsSnap.docs) {
              const pool = poolDoc.data();
              // Only show pools that have players and aren't already drafted
              if (pool.playerCount > 0 && pool.status !== 'draft_complete') {
                poolOptions.push({
                  id: poolDoc.id,
                  ageGroup: pool.ageGroupLabel || pool.ageGroup || 'Unknown',
                  sport: pool.sport || season.sport || 'football',
                  playerCount: pool.playerCount || 0,
                  seasonId: seasonDoc.id,
                  seasonName: season.name || season.seasonName,
                  sourceType: 'season_pool',
                });
              }
            }
          }
        } catch (seasonErr) {
          console.log('[DraftSetup] No seasons found or error:', seasonErr);
        }
        
        // Source 2: Registration-based pools (programs/{pid}/registrations)
        // These are the primary registration system where parents sign up players
        try {
          const regSnap = await getDocs(
            query(
              collection(db, 'programs', programId, 'registrations'),
              where('status', 'in', ['open', 'closed', 'completed'])
            )
          );
          
          for (const regDoc of regSnap.docs) {
            const reg = regDoc.data();
            const regCount = reg.registrationCount || 0;
            
            if (regCount > 0) {
              // Check if this registration has age group configs (multiple pools per registration)
              if (reg.ageGroupConfigs && reg.ageGroupConfigs.length > 0) {
                for (const agConfig of reg.ageGroupConfigs) {
                  const agCount = agConfig.registrationCount || 0;
                  if (agCount > 0) {
                    const poolId = `${regDoc.id}_${agConfig.id}`;
                    if (!poolOptions.find(p => p.id === poolId)) {
                      poolOptions.push({
                        id: poolId,
                        ageGroup: agConfig.label || agConfig.id || 'Unknown',
                        sport: reg.sport || 'football',
                        playerCount: agCount,
                        seasonId: reg.linkedSeasonId || '',
                        seasonName: reg.linkedSeasonName || reg.name,
                        sourceType: 'registration',
                        registrationId: regDoc.id,
                      });
                    }
                  }
                }
              } else {
                // Single pool for the whole registration
                if (!poolOptions.find(p => p.id === regDoc.id)) {
                  poolOptions.push({
                    id: regDoc.id,
                    ageGroup: reg.ageGroups?.[0] || 'All Ages',
                    sport: reg.sport || 'football',
                    playerCount: regCount,
                    seasonId: reg.linkedSeasonId || '',
                    seasonName: reg.linkedSeasonName || reg.name,
                    sourceType: 'registration',
                    registrationId: regDoc.id,
                  });
                }
              }
            }
          }
        } catch (regErr) {
          console.log('[DraftSetup] Error loading registrations:', regErr);
        }
        
        console.log('[DraftSetup] Found pools:', poolOptions.length, poolOptions);
        setPools(poolOptions);
        
        // Auto-select if preselected
        if (preselectedPoolId) {
          const match = poolOptions.find(p => p.id === preselectedPoolId);
          if (match) {
            setSelectedPool(match);
            setStep(1); // Skip to teams
          }
        }
      } catch (err) {
        console.error('Error loading pools:', err);
        toastError('Failed to load pools');
      } finally {
        setLoadingPools(false);
      }
    };
    
    loadPools();
  }, [programId, preselectedPoolId]);

  // Load teams when pool is selected
  useEffect(() => {
    if (!selectedPool || !programId) return;
    
    const loadTeams = async () => {
      setLoadingTeams(true);
      try {
        // Get teams for this program that match the age group
        const teamsSnap = await getDocs(
          query(
            collection(db, 'teams'),
            where('ownerId', '==', user?.uid),
            where('sport', '==', selectedPool.sport)
          )
        );
        
        const teamOptions: TeamOption[] = teamsSnap.docs
          .map(d => {
            const data = d.data();
            return {
              id: d.id,
              name: data.teamName || data.name || 'Unnamed Team',
              sport: data.sport,
              ageGroup: data.ageGroup || '',
              coachId: data.coachId || '',
              coachName: data.coachName || 'No coach assigned',
              color: data.teamColor || data.primaryColor,
              logo: data.logoUrl || data.teamLogo,
              selected: true, // Default all to selected
            };
          })
          .filter(t => {
            // Filter by age group if available
            if (selectedPool.ageGroup && t.ageGroup) {
              return t.ageGroup.toLowerCase().includes(selectedPool.ageGroup.toLowerCase()) ||
                     selectedPool.ageGroup.toLowerCase().includes(t.ageGroup.toLowerCase());
            }
            return true;
          });
        
        setTeams(teamOptions);
      } catch (err) {
        console.error('Error loading teams:', err);
        toastError('Failed to load teams');
      } finally {
        setLoadingTeams(false);
      }
    };
    
    loadTeams();
  }, [selectedPool, programId, user?.uid]);

  const selectedTeams = teams.filter(t => t.selected);

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedPool;
      case 1: return selectedTeams.length >= 2;
      case 2: return true; // Config always valid with defaults
      case 3: return !!draftDate && !!draftTime;
      case 4: return true; // Review step
      default: return false;
    }
  };

  const handleCreate = async () => {
    if (!selectedPool || !programId || !user) return;
    
    setSaving(true);
    try {
      const scheduledDate = new Date(`${draftDate}T${draftTime}`);
      
      const params: CreateDraftParams = {
        programId,
        seasonId: selectedPool.seasonId,
        poolId: selectedPool.id,
        programName: (userData as any)?.programName || (userData as any)?.teamName || '',
        sport: selectedPool.sport,
        ageGroupLabel: selectedPool.ageGroup,
        scheduledDate,
        location: location || undefined,
        teams: selectedTeams.map(t => ({
          teamId: t.id,
          teamName: t.name,
          coachId: t.coachId,
          coachName: t.coachName,
          color: t.color,
          logo: t.logo,
        })),
        draftType,
        pickTimerSeconds: pickTimer,
        allowTrading,
        lotteryEnabled,
        totalPlayers: selectedPool.playerCount,
        createdBy: user.uid,
      };
      
      const draftId = await createDraftEvent(params);
      toastSuccess('🏈 Draft Day created! Coaches will see it in their Draft Day tab.');
      navigate('/commissioner/draft-day');
    } catch (err) {
      console.error('Error creating draft:', err);
      toastError('Failed to create draft');
    } finally {
      setSaving(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    setTeams(prev => prev.map(t => 
      t.id === teamId ? { ...t, selected: !t.selected } : t
    ));
  };

  // Input class helper
  const inputClass = `w-full px-4 py-2.5 rounded-lg ${
    dark 
      ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50' 
      : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/50'
  } outline-none transition-all`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}
          className={`p-2 rounded-lg ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
            Create Draft Day
          </h1>
          <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
            Step {step + 1} of {STEPS.length}: {STEPS[step].label}
          </p>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className={`flex-1 h-1.5 rounded-full transition-colors ${
              i <= step 
                ? 'bg-purple-500' 
                : dark ? 'bg-white/10' : 'bg-slate-200'
            }`} />
          </div>
        ))}
      </div>

      {/* ============ STEP 0: SELECT POOL ============ */}
      {step === 0 && (
        <div className="space-y-4">
          <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
            Select which registration pool to draft from. Each pool represents an age group with registered players.
          </p>
          
          {loadingPools ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-20 rounded-xl animate-pulse ${dark ? 'bg-white/5' : 'bg-slate-100'}`} />
              ))}
            </div>
          ) : pools.length === 0 ? (
            <div className={`rounded-xl p-8 text-center ${dark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
              <AlertCircle className={`w-8 h-8 mx-auto mb-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
              <p className={`font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>No Pools Available</p>
              <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                Create a registration and wait for players to sign up first.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pools.map(pool => (
                <button
                  key={pool.id}
                  onClick={() => setSelectedPool(pool)}
                  className={`w-full text-left rounded-xl p-4 transition-all ${
                    selectedPool?.id === pool.id
                      ? 'ring-2 ring-purple-500 bg-purple-500/10'
                      : dark 
                        ? 'bg-white/5 border border-white/10 hover:bg-white/[0.07]' 
                        : 'bg-white border border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{SPORT_EMOJI[pool.sport] || '🎯'}</span>
                      <div>
                        <p className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
                          {pool.ageGroup}
                        </p>
                        {pool.seasonName && (
                          <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {pool.seasonName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`font-bold text-lg ${dark ? 'text-white' : 'text-slate-900'}`}>
                          {pool.playerCount}
                        </p>
                        <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>players</p>
                      </div>
                      {selectedPool?.id === pool.id && (
                        <Check className="w-5 h-5 text-purple-500" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ STEP 1: SELECT TEAMS ============ */}
      {step === 1 && (
        <div className="space-y-4">
          <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
            Select which teams will participate in this draft. You need at least 2 teams.
          </p>
          
          {loadingTeams ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className={`h-16 rounded-xl animate-pulse ${dark ? 'bg-white/5' : 'bg-slate-100'}`} />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className={`rounded-xl p-8 text-center ${dark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
              <AlertCircle className={`w-8 h-8 mx-auto mb-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
              <p className={`font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>No Teams Found</p>
              <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                Create teams for this age group first, then come back to set up the draft.
              </p>
              <Button
                variant="primary"
                className="mt-4"
                onClick={() => navigate('/commissioner/teams/create')}
              >
                Create Teams
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {teams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => toggleTeam(team.id)}
                    className={`w-full text-left rounded-xl p-4 transition-all ${
                      team.selected
                        ? 'ring-2 ring-purple-500 bg-purple-500/10'
                        : dark 
                          ? 'bg-white/5 border border-white/10 hover:bg-white/[0.07] opacity-60' 
                          : 'bg-white border border-slate-200 hover:border-purple-300 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {team.color ? (
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: team.color }}
                          >
                            {team.name.charAt(0)}
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {team.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
                            {team.name}
                          </p>
                          <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                            Coach: {team.coachName || 'No coach assigned'}
                          </p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        team.selected 
                          ? 'bg-purple-500 border-purple-500' 
                          : dark ? 'border-white/20' : 'border-slate-300'
                      }`}>
                        {team.selected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {selectedTeams.length < 2 && (
                <div className="flex items-center gap-2 text-amber-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Select at least 2 teams to create a draft
                </div>
              )}
              
              <p className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                {selectedTeams.length} of {teams.length} teams selected • ~{Math.ceil(selectedPool!.playerCount / selectedTeams.length)} players per team
              </p>
            </>
          )}
        </div>
      )}

      {/* ============ STEP 2: CONFIGURE ============ */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Draft Format */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
              Draft Format
            </label>
            <div className="space-y-2">
              {[
                { value: 'snake' as const, label: 'Snake Draft', desc: 'Order reverses each round. Most fair.' , emoji: '🐍' },
                { value: 'linear' as const, label: 'Linear Draft', desc: 'Same order every round.', emoji: '➡️' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setDraftType(option.value)}
                  className={`w-full text-left rounded-xl p-4 transition-all ${
                    draftType === option.value
                      ? 'ring-2 ring-purple-500 bg-purple-500/10'
                      : dark 
                        ? 'bg-white/5 border border-white/10 hover:bg-white/[0.07]' 
                        : 'bg-white border border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option.emoji}</span>
                    <div>
                      <p className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{option.label}</p>
                      <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{option.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Pick Timer */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
              <Timer className="w-4 h-4 inline mr-1" /> Pick Timer (seconds)
            </label>
            <div className="flex gap-2">
              {[60, 90, 120, 180, 300].map(secs => (
                <button
                  key={secs}
                  onClick={() => setPickTimer(secs)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    pickTimer === secs
                      ? 'bg-purple-600 text-white'
                      : dark 
                        ? 'bg-white/5 text-slate-300 hover:bg-white/10' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {secs < 60 ? `${secs}s` : `${secs / 60}m`}
                </button>
              ))}
            </div>
            <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              If time expires, the system will auto-pick from the coach's ranked list (or skip).
            </p>
          </div>

          {/* Lottery Toggle */}
          <div className={`rounded-xl p-4 ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎰</span>
                <div>
                  <p className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>Draft Lottery</p>
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Randomize pick order before the draft starts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLotteryEnabled(!lotteryEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  lotteryEnabled ? 'bg-purple-500' : dark ? 'bg-white/20' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  lotteryEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Trading Toggle */}
          <div className={`rounded-xl p-4 ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔄</span>
                <div>
                  <p className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>Allow Trading</p>
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Coaches can trade draft picks with each other
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAllowTrading(!allowTrading)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  allowTrading ? 'bg-purple-500' : dark ? 'bg-white/20' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  allowTrading ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 3: SCHEDULE ============ */}
      {step === 3 && (
        <div className="space-y-5">
          <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
            When and where will this draft take place?
          </p>
          
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
              <Calendar className="w-4 h-4 inline mr-1" /> Date
            </label>
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className={inputClass}
            />
          </div>
          
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
              <Clock className="w-4 h-4 inline mr-1" /> Time
            </label>
            <input
              type="time"
              value={draftTime}
              onChange={(e) => setDraftTime(e.target.value)}
              className={inputClass}
            />
          </div>
          
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
              <MapPin className="w-4 h-4 inline mr-1" /> Location (optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder='e.g., "Community Center" or "Zoom"'
              className={inputClass}
            />
            <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              Leave blank if drafting remotely in the app.
            </p>
          </div>
        </div>
      )}

      {/* ============ STEP 4: REVIEW ============ */}
      {step === 4 && (
        <div className="space-y-4">
          <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
            Review your Draft Day setup before creating it.
          </p>
          
          <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200'}`}>
            {/* Pool Info */}
            <div className={`px-4 py-3 border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{SPORT_EMOJI[selectedPool?.sport || 'other']}</span>
                <p className={`font-bold text-lg ${dark ? 'text-white' : 'text-slate-900'}`}>
                  {selectedPool?.ageGroup} Draft
                </p>
              </div>
              <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                {selectedPool?.playerCount} players available
              </p>
            </div>
            
            {/* Details Grid */}
            <div className="divide-y divide-white/5">
              {[
                { label: 'Teams', value: selectedTeams.map(t => t.name).join(', '), icon: <Trophy className="w-4 h-4" /> },
                { label: 'Format', value: `${draftType.charAt(0).toUpperCase() + draftType.slice(1)} Draft`, icon: <Shuffle className="w-4 h-4" /> },
                { label: 'Pick Timer', value: pickTimer >= 60 ? `${pickTimer / 60} minutes` : `${pickTimer} seconds`, icon: <Timer className="w-4 h-4" /> },
                { label: 'Rounds', value: `${Math.ceil((selectedPool?.playerCount || 0) / selectedTeams.length)} rounds`, icon: <Zap className="w-4 h-4" /> },
                { label: 'Lottery', value: lotteryEnabled ? 'Yes — random order' : 'No — default order', icon: <Shuffle className="w-4 h-4" /> },
                { label: 'Trading', value: allowTrading ? 'Allowed' : 'Not allowed', icon: <Settings className="w-4 h-4" /> },
                { label: 'Date & Time', value: draftDate ? new Date(`${draftDate}T${draftTime}`).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD', icon: <Calendar className="w-4 h-4" /> },
                { label: 'Location', value: location || 'Remote (in-app)', icon: <MapPin className="w-4 h-4" /> },
              ].map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={dark ? 'text-slate-500' : 'text-slate-400'}>{item.icon}</span>
                    <span className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</span>
                  </div>
                  <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Teams Preview */}
          <div className="flex flex-wrap gap-2">
            {selectedTeams.map(team => (
              <div
                key={team.id}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 ${dark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}
              >
                {team.color && (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                )}
                <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>{team.name}</span>
                <span className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{team.coachName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
            dark 
              ? 'bg-white/5 text-slate-300 hover:bg-white/10' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        
        {step < STEPS.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={saving || !canProceed()}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              <span className="flex items-center gap-1">
                🏈 Create Draft Day
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default DraftSetup;
