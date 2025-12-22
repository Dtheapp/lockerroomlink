import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, collectionGroup, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateAgeGroup } from '../../services/ageValidator';
import EventList from './EventList';
import CalendarView from '../calendar/CalendarView';
import { Event, PricingTier } from '../../types/events';
import { Loader2, AlertCircle, Calendar, Search, MapPin, Users, ChevronRight, UserPlus, ChevronDown, Trophy, Clock, ExternalLink, X } from 'lucide-react';
import { toastSuccess, toastError } from '../../services/toast';

// Season registration as pseudo-event for display
interface SeasonRegistration {
  id: string;
  type: 'season_registration';
  seasonId: string;
  programId: string;
  programName: string;
  seasonName: string;
  sport: string;
  ageGroups: string[];
  registrationFee: number;
  registrationOpenDate?: Date;
  registrationCloseDate?: Date;
  location?: string;
}

interface DraftPoolInfo {
  isInDraftPool: boolean;
  teamId?: string;
  teamName?: string;
  registrationCloseDate?: string;
  draftPoolCount?: number;
}

interface DraftPoolPreview {
  teamId: string;
  teamName: string;
  players: { name: string; ageGroup?: string; registeredAt?: any }[];
}

/**
 * EventsPage - Wrapper component for EventList that handles auth context
 * For users without a team, shows public events available for registration
 */
const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userData, teamData, players, selectedPlayer, setSelectedPlayer, selectedSportContext, loading: authLoading } = useAuth();

  // Get the current team ID
  const teamId = teamData?.id || userData?.teamId;

  // State for public events browse (for users without a team)
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const [seasonRegistrations, setSeasonRegistrations] = useState<SeasonRegistration[]>([]);
  const [publicPricingTiers, setPublicPricingTiers] = useState<Record<string, PricingTier[]>>({});
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAthleteSelector, setShowAthleteSelector] = useState(false);
  
  // Draft pool counts by team ID (to show on event cards)
  const [draftPoolCounts, setDraftPoolCounts] = useState<Record<string, number>>({});
  
  // Draft pool preview modal
  const [draftPoolPreview, setDraftPoolPreview] = useState<DraftPoolPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Draft pool check for players waiting to be drafted
  const [draftPoolInfo, setDraftPoolInfo] = useState<DraftPoolInfo>({ isInDraftPool: false });
  const [draftPoolLoading, setDraftPoolLoading] = useState(true);
  
  // Check if selected player is in draft pool FOR THE SELECTED SPORT
  // Only load draft pool info if selectedSportContext is 'draft_pool'
  useEffect(() => {
    const checkDraftPool = async () => {
      // If no sport context or not in draft pool mode, skip
      if (!selectedSportContext || selectedSportContext.status !== 'draft_pool') {
        console.log('[EventsPage] Sport context is not draft_pool, skipping draft pool check');
        setDraftPoolInfo({ isInDraftPool: false });
        setDraftPoolLoading(false);
        return;
      }
      
      const draftTeamId = selectedSportContext.draftPoolTeamId;
      if (!draftTeamId) {
        console.log('[EventsPage] No draftPoolTeamId in sport context');
        setDraftPoolInfo({ isInDraftPool: false });
        setDraftPoolLoading(false);
        return;
      }
      
      try {
        console.log('[EventsPage] Loading draft pool info for team:', draftTeamId);
        
        // Get team info
        const teamDoc = await getDoc(doc(db, 'teams', draftTeamId));
        const teamDataDoc = teamDoc.exists() ? teamDoc.data() : { name: 'the team' };
        
        // Get registration close date from season
        let closeDate: string | undefined;
        const seasonsSnap = await getDocs(collection(db, 'teams', draftTeamId, 'seasons'));
        seasonsSnap.forEach(seasonDoc => {
          const sData = seasonDoc.data();
          if (sData.isActive && sData.registrationCloseDate) {
            closeDate = sData.registrationCloseDate;
          }
        });
        
        // Get draft pool count
        const draftPoolQuery = query(
          collection(db, 'teams', draftTeamId, 'draftPool'),
          where('status', '==', 'waiting')
        );
        const draftSnap = await getDocs(draftPoolQuery);
        
        setDraftPoolInfo({
          isInDraftPool: true,
          teamId: draftTeamId,
          teamName: teamDataDoc.name || selectedSportContext.draftPoolTeamName || 'the team',
          registrationCloseDate: closeDate,
          draftPoolCount: draftSnap.size,
        });
        setDraftPoolLoading(false);
      } catch (err) {
        console.error('Error checking draft pool:', err);
        setDraftPoolInfo({ isInDraftPool: false });
        setDraftPoolLoading(false);
      }
    };
    
    checkDraftPool();
  }, [selectedSportContext?.status, selectedSportContext?.draftPoolTeamId]);

  // Calculate the selected athlete's age group
  const selectedAthleteAgeGroup = useMemo(() => {
    if (selectedPlayer?.dob) {
      return calculateAgeGroup(selectedPlayer.dob);
    }
    return null;
  }, [selectedPlayer?.dob]);

  // Fetch public events for users without a team
  useEffect(() => {
    if (teamId || authLoading) return; // Skip if user has a team
    
    const fetchPublicEvents = async () => {
      setLoadingPublic(true);
      try {
        // Query for public, active events with registration
        const eventsQuery = query(
          collection(db, 'events'),
          where('isPublic', '==', true),
          where('status', '==', 'active'),
          limit(50)
        );
        
        const snapshot = await getDocs(eventsQuery);
        let eventsData: Event[] = [];
        const now = new Date();
        
        snapshot.forEach(doc => {
          const data = doc.data() as Event;
          // Only include registration events
          if (data.type === 'registration' || data.type === 'tryout') {
            // Filter out events with closed registration
            const registrationCloseDate = (data as any).registrationCloseDate?.toDate?.();
            if (registrationCloseDate && registrationCloseDate < now) {
              // Registration has closed - skip this event
              return;
            }
            
            // Filter out events from ended seasons
            const seasonStatus = (data as any).seasonStatus;
            if (seasonStatus === 'completed' || seasonStatus === 'ended') {
              return;
            }
            
            eventsData.push({ id: doc.id, ...data });
          }
        });
        
        // Sort by start date (upcoming first)
        eventsData.sort((a, b) => {
          const aDate = (a as any).registrationOpenDate?.toDate?.() || (a as any).startDate?.toDate?.() || new Date(0);
          const bDate = (b as any).registrationOpenDate?.toDate?.() || (b as any).startDate?.toDate?.() || new Date(0);
          return aDate.getTime() - bDate.getTime();
        });
        
        setPublicEvents(eventsData);
        
        // Fetch pricing tiers for each event
        const tiersMap: Record<string, PricingTier[]> = {};
        await Promise.all(eventsData.map(async (event) => {
          const tiersSnapshot = await getDocs(
            collection(db, 'events', event.id, 'pricingTiers')
          );
          let tiers: PricingTier[] = [];
          tiersSnapshot.forEach(doc => {
            tiers.push({ id: doc.id, ...doc.data() } as PricingTier);
          });
          tiersMap[event.id] = tiers;
        }));
        
        setPublicPricingTiers(tiersMap);
        
        // Fetch draft pool counts for each team
        const uniqueTeamIds = [...new Set(eventsData.map(e => e.teamId).filter(Boolean))];
        console.log('[EventsPage] Fetching draft pool counts for teams:', uniqueTeamIds);
        const countsMap: Record<string, number> = {};
        await Promise.all(uniqueTeamIds.map(async (eventTeamId) => {
          if (!eventTeamId) return;
          try {
            const draftPoolQuery = query(
              collection(db, 'teams', eventTeamId, 'draftPool'),
              where('status', '==', 'waiting')
            );
            const draftSnap = await getDocs(draftPoolQuery);
            countsMap[eventTeamId] = draftSnap.size;
            console.log('[EventsPage] Team', eventTeamId, 'draft pool count:', draftSnap.size);
          } catch (err) {
            console.log('[EventsPage] Failed to fetch draft pool for team', eventTeamId, err);
            // Silently fail - user may not have permission to read draft pool
            countsMap[eventTeamId] = 0;
          }
        }));
        console.log('[EventsPage] Final draft pool counts:', countsMap);
        setDraftPoolCounts(countsMap);
      } catch (error) {
        console.error('Error fetching public events:', error);
      } finally {
        setLoadingPublic(false);
      }
    };
    
    fetchPublicEvents();
  }, [teamId, authLoading]);

  // Fetch program seasons with open registration
  useEffect(() => {
    if (teamId || authLoading) return; // Skip if user has a team
    
    const fetchProgramSeasons = async () => {
      try {
        console.log('[EventsPage] Fetching program seasons with open registration...');
        const now = new Date();
        
        // Query all programs first
        const programsSnap = await getDocs(collection(db, 'programs'));
        
        const allSeasonRegs: SeasonRegistration[] = [];
        
        // For each program, get seasons with open registration
        await Promise.all(programsSnap.docs.map(async (programDoc) => {
          const programData = programDoc.data();
          const programId = programDoc.id;
          
          try {
            // Get seasons for this program
            const seasonsSnap = await getDocs(
              collection(db, 'programs', programId, 'seasons')
            );
            
            seasonsSnap.docs.forEach((seasonDoc) => {
              const seasonData = seasonDoc.data();
              
              // Check if season/registration is ended based on status
              const status = seasonData.status;
              if (status === 'completed' || status === 'ended' || status === 'archived' || status === 'active') {
                return; // Skip ended or already active seasons
              }
              
              // Helper to parse date from either Timestamp or string
              const parseDate = (val: any): Date | null => {
                if (!val) return null;
                if (val.toDate) return val.toDate(); // Firestore Timestamp
                if (typeof val === 'string') return new Date(val + 'T23:59:59'); // YYYY-MM-DD string - add end of day
                return null;
              };
              
              // Check registration dates
              const openDate = parseDate(seasonData.registrationOpenDate);
              const closeDate = parseDate(seasonData.registrationCloseDate);
              const seasonStartDate = parseDate(seasonData.startDate) || parseDate(seasonData.seasonStartDate);
              
              // Skip if registration has DEFINITELY closed
              if (closeDate && closeDate < now) {
                console.log('[EventsPage] Skipping season - registration closed:', seasonDoc.id, closeDate);
                return;
              }
              
              // Also skip if season has already started AND there's no explicit close date
              // (implies registration closed when season started)
              if (!closeDate && seasonStartDate && seasonStartDate < now) {
                console.log('[EventsPage] Skipping season - season started, no close date:', seasonDoc.id, seasonStartDate);
                return;
              }
              
              // ALLOW future registrations - they'll be marked as "Opens [date]"
              // (Don't skip openDate > now anymore)
              
              // Extract age groups - check multiple sources
              // 1. sportsOffered array (new format)
              // 2. activeAgeGroups (explicit list)
              // 3. program-level ageGroups (fallback)
              let seasonAgeGroups: string[] = [];
              if (seasonData.sportsOffered && Array.isArray(seasonData.sportsOffered)) {
                seasonAgeGroups = seasonData.sportsOffered.flatMap((sc: any) => 
                  (sc.ageGroups || []).map((ag: any) => ag.name || ag.ageGroups?.join('-') || ag)
                );
              }
              if (seasonAgeGroups.length === 0 && seasonData.activeAgeGroups) {
                seasonAgeGroups = seasonData.activeAgeGroups;
              }
              if (seasonAgeGroups.length === 0 && programData.ageGroups) {
                seasonAgeGroups = programData.ageGroups;
              }
              
              // Use sport-specific program name if available
              const sport = seasonData.sport || programData.sport || 'Football';
              const sportLower = sport.toLowerCase();
              const sportNames = programData.sportNames as { [key: string]: string } | undefined;
              const programDisplayName = sportNames?.[sportLower] || programData.name || 'Program';
              
              // This season has open registration!
              allSeasonRegs.push({
                id: `season_${seasonDoc.id}`,
                type: 'season_registration',
                seasonId: seasonDoc.id,
                programId: programId,
                programName: programDisplayName,
                seasonName: seasonData.name || 'Season',
                sport: sport,
                ageGroups: seasonAgeGroups,
                registrationFee: seasonData.registrationFee || 0,
                registrationOpenDate: openDate,
                registrationCloseDate: closeDate,
                location: programData.city ? `${programData.city}, ${programData.state}` : undefined,
              });
            });
          } catch (err) {
            console.log('[EventsPage] Error fetching seasons for program', programId, err);
          }
        }));
        
        console.log('[EventsPage] Found', allSeasonRegs.length, 'season registrations');
        setSeasonRegistrations(allSeasonRegs);
      } catch (error) {
        console.error('Error fetching program seasons:', error);
      }
    };
    
    fetchProgramSeasons();
  }, [teamId, authLoading]);

  // Function to load draft pool preview
  const loadDraftPoolPreview = async (eventTeamId: string, teamName: string) => {
    setLoadingPreview(true);
    try {
      const draftPoolQuery = query(
        collection(db, 'teams', eventTeamId, 'draftPool'),
        where('status', '==', 'waiting')
      );
      const draftSnap = await getDocs(draftPoolQuery);
      
      const players = draftSnap.docs.map(doc => {
        const data = doc.data();
        return {
          name: data.playerName || 'Unknown',
          ageGroup: data.ageGroup,
          registeredAt: data.createdAt,
        };
      });
      
      // Sort by registration date (newest first)
      players.sort((a, b) => {
        const aTime = a.registeredAt?.toMillis?.() || 0;
        const bTime = b.registeredAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      
      setDraftPoolPreview({
        teamId: eventTeamId,
        teamName,
        players,
      });
    } catch (err) {
      console.error('Error loading draft pool preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Loading state
  if (authLoading || draftPoolLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 dark:text-orange-500" />
      </div>
    );
  }
  
  // DRAFT POOL VIEW - Player is waiting to be drafted for the SELECTED SPORT
  // Only show when selectedSportContext.status === 'draft_pool'
  if (!teamId && selectedSportContext?.status === 'draft_pool' && draftPoolInfo.isInDraftPool) {
    const isParent = userData?.role === 'Parent';
    const closeDateFormatted = draftPoolInfo.registrationCloseDate 
      ? new Date(draftPoolInfo.registrationCloseDate + 'T23:59:59').toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : null;
    
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-zinc-900 dark:to-zinc-950 rounded-2xl p-8 max-w-lg text-center border border-emerald-200 dark:border-emerald-900/30 shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            🎉 You're in the Draft Pool!
          </h2>
          
          <p className="text-slate-600 dark:text-zinc-400 mb-4 text-lg">
            {isParent ? 'Your athlete is' : "You're"} registered and waiting to be drafted to{' '}
            {draftPoolInfo.teamId ? (
              <a 
                href={`#/team/${draftPoolInfo.teamId}`}
                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                {draftPoolInfo.teamName}
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{draftPoolInfo.teamName}</span>
            )}.
          </p>
          
          {/* Draft Pool Count Badge */}
          {draftPoolInfo.draftPoolCount && draftPoolInfo.draftPoolCount > 0 && (
            <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Users className="w-4 h-4" />
              {draftPoolInfo.draftPoolCount} player{draftPoolInfo.draftPoolCount !== 1 ? 's' : ''} in draft pool
            </div>
          )}
          
          <div className="bg-white dark:bg-zinc-900/50 border border-emerald-200 dark:border-emerald-900/30 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3 text-left">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">What happens next?</h4>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  {closeDateFormatted ? (
                    <>Registration closes on <span className="font-bold text-emerald-600 dark:text-emerald-400">{closeDateFormatted}</span>. After that, the coach will draft players to the roster.</>
                  ) : (
                    <>The coach will review registrations and draft players to the roster soon.</>
                  )}
                </p>
              </div>
            </div>
          </div>
          
          {/* View Team Page Button */}
          {draftPoolInfo.teamId && (
            <a 
              href={`#/team/${draftPoolInfo.teamId}`}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/30 mb-4"
            >
              <Users className="w-5 h-5" />
              View Team Page
            </a>
          )}
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Once {isParent ? 'your athlete is' : "you're"} drafted, the schedule will appear here.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No team - show public events browse for registration
  if (!teamId) {
    // Convert season registrations to event-like format for unified display
    const seasonAsEvents: Event[] = seasonRegistrations.map(sr => ({
      id: sr.id,
      title: `${sr.programName} - ${sr.seasonName}`,
      type: 'registration' as const,
      description: `Open registration for ${sr.sport}`,
      location: sr.location || 'Online Registration',
      status: 'active' as const,
      startDate: sr.registrationOpenDate ? Timestamp.fromDate(sr.registrationOpenDate) : undefined,
      endDate: sr.registrationCloseDate ? Timestamp.fromDate(sr.registrationCloseDate) : undefined,
      teamId: sr.programId, // Use programId as teamId for routing
      teamName: sr.programName,
      isPublic: true,
      // Store season-specific data
      sport: sr.sport,
      ageGroup: sr.ageGroups?.[0] || '', // First age group for filtering
      ageGroups: sr.ageGroups, // All age groups
      seasonId: sr.seasonId,
      programId: sr.programId,
      isSeasonRegistration: true, // Flag to identify season registrations
      registrationFee: sr.registrationFee,
    } as any));

    // Combine events and season registrations
    const allRegistrations = [...publicEvents, ...seasonAsEvents];

    // Filter events by sport context, search query, AND athlete's age group
    const filteredEvents = allRegistrations.filter(event => {
      // First, filter by selected sport context if set
      if (selectedSportContext?.sport && selectedSportContext.status === 'none') {
        // Only show events for the selected sport when browsing for registration
        const eventSport = ((event as any).sport || '').toLowerCase();
        if (eventSport && eventSport !== selectedSportContext.sport) {
          return false;
        }
      }
      
      // Then, filter by age group if an athlete is selected
      if (selectedAthleteAgeGroup) {
        const eventAgeGroup = (event as any).ageGroup;
        const eventAgeGroups = (event as any).ageGroups as string[] | undefined;
        
        // Check if any age group matches
        let matches = false;
        
        // Check single ageGroup field
        if (eventAgeGroup) {
          // Handle range formats like "9U-10U" or exact match "9U"
          if (eventAgeGroup.includes('-')) {
            const [minAg, maxAg] = eventAgeGroup.split('-');
            const minAge = parseInt(minAg.replace(/\D/g, '')) || 0;
            const maxAge = parseInt(maxAg.replace(/\D/g, '')) || 99;
            const athleteAge = parseInt(selectedAthleteAgeGroup.replace(/\D/g, '')) || 0;
            matches = athleteAge >= minAge && athleteAge <= maxAge;
          } else {
            matches = eventAgeGroup === selectedAthleteAgeGroup;
          }
        }
        
        // Check ageGroups array (for season registrations)
        if (!matches && eventAgeGroups && Array.isArray(eventAgeGroups)) {
          matches = eventAgeGroups.some(ag => {
            if (ag.includes('-')) {
              const [minAg, maxAg] = ag.split('-');
              const minAge = parseInt(minAg.replace(/\D/g, '')) || 0;
              const maxAge = parseInt(maxAg.replace(/\D/g, '')) || 99;
              const athleteAge = parseInt(selectedAthleteAgeGroup.replace(/\D/g, '')) || 0;
              return athleteAge >= minAge && athleteAge <= maxAge;
            }
            return ag === selectedAthleteAgeGroup;
          });
        }
        
        if (!matches && (eventAgeGroup || (eventAgeGroups && eventAgeGroups.length > 0))) {
          return false;
        }
      }
      
      // Finally filter by search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        event.title?.toLowerCase().includes(q) ||
        event.description?.toLowerCase().includes(q) ||
        event.location?.toLowerCase().includes(q) ||
        event.teamName?.toLowerCase().includes(q) ||
        (event as any).ageGroup?.toLowerCase().includes(q) ||
        ((event as any).ageGroups as string[] | undefined)?.some(ag => ag.toLowerCase().includes(q))
      );
    });

    return (
      <div className="p-4 md:p-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 dark:from-orange-500 dark:to-orange-600 rounded-xl flex items-center justify-center shadow-lg text-2xl">
              {selectedSportContext?.sport === 'football' ? '🏈' :
               selectedSportContext?.sport === 'basketball' ? '🏀' :
               selectedSportContext?.sport === 'cheer' ? '📣' :
               selectedSportContext?.sport === 'soccer' ? '⚽' :
               selectedSportContext?.sport === 'baseball' ? '⚾' :
               selectedSportContext?.sport === 'volleyball' ? '🏐' :
               <Calendar className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {selectedSportContext?.sport && selectedSportContext.status === 'none'
                  ? `Find a ${selectedSportContext.sport.charAt(0).toUpperCase() + selectedSportContext.sport.slice(1)} Team`
                  : 'Find a Team'}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {selectedSportContext?.sport && selectedSportContext.status === 'none'
                  ? `Browse ${selectedSportContext.sport} registrations and tryouts`
                  : 'Browse open registrations and tryouts'}
              </p>
            </div>
          </div>
        </div>

        {/* Athlete Selector for Parents */}
        {userData?.role === 'Parent' && players.length > 0 && (
          <div className="mb-4">
            <div className="relative">
              <button
                onClick={() => setShowAthleteSelector(!showAthleteSelector)}
                className="w-full flex items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-left hover:border-purple-500 dark:hover:border-orange-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Browsing for</p>
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {selectedPlayer?.name || 'Select Athlete'}
                      {selectedAthleteAgeGroup && (
                        <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                          {selectedAthleteAgeGroup}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${showAthleteSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown */}
              {showAthleteSelector && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
                  {players.map((player) => {
                    const playerAgeGroup = calculateAgeGroup(player.dob);
                    return (
                      <button
                        key={player.id}
                        onClick={() => {
                          setSelectedPlayer(player);
                          setShowAthleteSelector(false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                          selectedPlayer?.id === player.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          selectedPlayer?.id === player.id 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}>
                          {player.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-zinc-900 dark:text-white">{player.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {playerAgeGroup ? `Age Group: ${playerAgeGroup}` : 'No DOB set'}
                          </p>
                        </div>
                        {playerAgeGroup && (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            {playerAgeGroup}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {(selectedAthleteAgeGroup || (selectedSportContext?.sport && selectedSportContext.status === 'none')) && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                Showing {selectedSportContext?.sport && selectedSportContext.status === 'none' && (
                  <span className="font-bold text-purple-600 dark:text-orange-400 capitalize">{selectedSportContext.sport} </span>
                )}
                registrations{selectedAthleteAgeGroup && (
                  <> for <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedAthleteAgeGroup}</span> teams</>
                )}
              </p>
            )}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, teams, locations..."
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-2 focus:ring-purple-500 dark:focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Loading state */}
        {loadingPublic ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500 dark:text-orange-500 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">Loading available registrations...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              {searchQuery ? 'No Results Found' : 
               selectedSportContext?.sport && selectedSportContext.status === 'none' 
                 ? `No ${selectedSportContext.sport.charAt(0).toUpperCase() + selectedSportContext.sport.slice(1)} Registrations`
                 : selectedAthleteAgeGroup 
                   ? `No ${selectedAthleteAgeGroup} Registrations` 
                   : 'No Open Registrations'}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              {searchQuery 
                ? `No events found matching "${searchQuery}". Try a different search.`
                : selectedSportContext?.sport && selectedSportContext.status === 'none'
                  ? `No open registrations for ${selectedSportContext.sport} right now. Try selecting a different sport or check back later!`
                  : selectedAthleteAgeGroup 
                    ? `No open registrations for ${selectedAthleteAgeGroup} teams right now. Try selecting a different athlete or check back later!`
                    : 'There are no open registrations or tryouts at the moment. Check back later!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {filteredEvents.length} open registration{filteredEvents.length !== 1 ? 's' : ''} found
            </p>
            
            {filteredEvents.map(event => {
              const tiers = publicPricingTiers[event.id] || [];
              const minPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : 0;
              const maxPrice = tiers.length > 0 ? Math.max(...tiers.map(t => t.price)) : 0;
              const poolCount = event.teamId ? draftPoolCounts[event.teamId] : 0;
              const isSeasonReg = (event as any).isSeasonRegistration;
              
              return (
                <button
                  key={event.id}
                  onClick={() => {
                    if (isSeasonReg) {
                      // Navigate to season registration page with programId for faster lookup
                      navigate(`/register/${(event as any).seasonId}?program=${(event as any).programId}`);
                    } else {
                      // Navigate to event registration page
                      navigate(`/events/${event.id}/register`);
                    }
                  }}
                  className="w-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 text-left hover:border-purple-500 dark:hover:border-orange-500 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Event type badge */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          event.type === 'registration' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                          {event.type === 'registration' ? 'Registration' : 'Tryout'}
                        </span>
                        {/* Age Group Badge - show all age groups for season registrations */}
                        {(event as any).ageGroups && Array.isArray((event as any).ageGroups) && (event as any).ageGroups.length > 0 ? (
                          (event as any).ageGroups.slice(0, 3).map((ag: string, idx: number) => (
                            <span key={idx} className="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                              {ag}
                            </span>
                          ))
                        ) : (event as any).ageGroup && (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                            {(event as any).ageGroup}
                          </span>
                        )}
                        {/* Sport Badge */}
                        {(event as any).sport && (
                          <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize">
                            {(event as any).sport}
                          </span>
                        )}
                        {event.teamName && event.teamId && !isSeasonReg && (
                          <a
                            href={`#/team/${event.teamId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                          >
                            {event.teamName}
                          </a>
                        )}
                        {event.teamName && (!event.teamId || isSeasonReg) && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{event.teamName}</span>
                        )}
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-orange-400 transition-colors">
                        {event.title}
                      </h3>
                      
                      {/* Registration Status & Dates */}
                      {isSeasonReg && (() => {
                        const now = new Date();
                        const openDate = event.startDate?.toDate?.();
                        const closeDate = event.endDate?.toDate?.();
                        const opensInFuture = openDate && openDate > now;
                        const closingSoon = closeDate && closeDate > now && (closeDate.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000; // Within 7 days
                        
                        return (
                          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                            {opensInFuture ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                                <Clock className="w-3 h-3" />
                                Opens {openDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                                Open Now
                              </span>
                            )}
                            {closeDate && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${
                                closingSoon 
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                              }`}>
                                <Clock className="w-3 h-3" />
                                {closingSoon ? 'Closes ' : 'Until '}
                                {closeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      
                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {event.startDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {event.startDate.toDate?.().toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        {event.maxCapacity && (
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{event.maxCapacity} spots</span>
                          </div>
                        )}
                        {/* Draft Pool Count - Clickable to view players */}
                        {poolCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              loadDraftPoolPreview(event.teamId!, event.teamName || 'Unknown Team');
                            }}
                            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline"
                          >
                            <Users className="w-4 h-4" />
                            <span>{poolCount} registered</span>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Price + Arrow */}
                    <div className="flex items-center gap-3">
                      {tiers.length > 0 && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-purple-600 dark:text-orange-400">
                            {minPrice === maxPrice 
                              ? `$${minPrice}`
                              : `$${minPrice} - $${maxPrice}`
                            }
                          </p>
                          <p className="text-xs text-zinc-500">Registration</p>
                        </div>
                      )}
                      <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-purple-500 dark:group-hover:text-orange-500 transition-colors" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        
        {/* Draft Pool Preview Modal */}
        {draftPoolPreview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDraftPoolPreview(null)}>
            <div 
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <h3 className="font-bold text-lg">Draft Pool</h3>
                  </div>
                  <button
                    onClick={() => setDraftPoolPreview(null)}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-emerald-100 text-sm mt-1">{draftPoolPreview.teamName}</p>
              </div>
              
              {/* Player List */}
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                {loadingPreview ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : draftPoolPreview.players.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No players registered yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                      {draftPoolPreview.players.length} player{draftPoolPreview.players.length !== 1 ? 's' : ''} waiting to be drafted
                    </p>
                    {draftPoolPreview.players.map((player, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-zinc-900 dark:text-white">{player.name}</p>
                          {player.ageGroup && (
                            <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">
                              {player.ageGroup}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  onClick={() => setDraftPoolPreview(null)}
                  className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Determine if user is a coach
  const isCoach = userData?.role === 'Coach';

  // Event handlers
  const handleCreateEvent = () => {
    navigate('/events/create');
  };

  const handleViewEvent = (event: Event) => {
    navigate(`/events/${event.id}`);
  };

  const handleEditEvent = (event: Event) => {
    // Navigate to event creator in edit mode
    navigate(`/events/create?edit=${event.id}`);
  };

  const handleManageEvent = (event: Event) => {
    navigate(`/events/${event.id}/manage`);
  };

  const handleDuplicateEvent = (event: Event) => {
    // TODO: Implement duplicate functionality
    console.log('Duplicate event:', event.id);
  };

  // Handle delete event from calendar
  const handleDeleteEvent = async (eventId: string) => {
    if (!teamId) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this event? This cannot be undone.');
    if (!confirmed) return;
    
    try {
      await deleteDoc(doc(db, 'teams', teamId, 'events', eventId));
      toastSuccess('Event deleted successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      toastError('Failed to delete event');
    }
  };

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-120px)]">
      <CalendarView
        teamId={teamId}
        programId={teamData?.programId}
        seasonId={teamData?.currentSeasonId}
        onEventClick={(eventId) => navigate(`/events/${eventId}`)}
        onCreateEvent={(date) => {
          // Pass date as query param if provided
          if (date) {
            const dateStr = date.toISOString().split('T')[0];
            navigate(`/events/create?date=${dateStr}`);
          } else {
            navigate('/events/create');
          }
        }}
        onEditEvent={(eventId) => navigate(`/events/create?edit=${eventId}`)}
        onDeleteEvent={handleDeleteEvent}
        isCoach={isCoach}
        sport={teamData?.sport}
      />
    </div>
  );
};

export default EventsPage;
