import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateAgeGroup } from '../../services/ageValidator';
import EventList from './EventList';
import { Event, PricingTier } from '../../types/events';
import { Loader2, AlertCircle, Calendar, Search, MapPin, Users, ChevronRight, UserPlus, ChevronDown, Trophy, Clock } from 'lucide-react';

interface DraftPoolInfo {
  isInDraftPool: boolean;
  teamName?: string;
  registrationCloseDate?: string;
}

/**
 * EventsPage - Wrapper component for EventList that handles auth context
 * For users without a team, shows public events available for registration
 */
const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userData, teamData, players, selectedPlayer, setSelectedPlayer, loading: authLoading } = useAuth();

  // Get the current team ID
  const teamId = teamData?.id || userData?.teamId;

  // State for public events browse (for users without a team)
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const [publicPricingTiers, setPublicPricingTiers] = useState<Record<string, PricingTier[]>>({});
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAthleteSelector, setShowAthleteSelector] = useState(false);
  
  // Draft pool check for players waiting to be drafted
  const [draftPoolInfo, setDraftPoolInfo] = useState<DraftPoolInfo>({ isInDraftPool: false });
  const [draftPoolLoading, setDraftPoolLoading] = useState(true);
  
  // Check if selected player is in draft pool
  useEffect(() => {
    const checkDraftPool = async () => {
      if (!selectedPlayer?.id) {
        setDraftPoolLoading(false);
        return;
      }
      
      try {
        // Search all teams' draft pools for this player
        const teamsSnap = await getDocs(collection(db, 'teams'));
        
        for (const teamDoc of teamsSnap.docs) {
          const draftPoolQuery = query(
            collection(db, 'teams', teamDoc.id, 'draftPool'),
            where('playerId', '==', selectedPlayer.id),
            where('status', '==', 'waiting')
          );
          const draftSnap = await getDocs(draftPoolQuery);
          
          if (!draftSnap.empty) {
            // Found in draft pool - get registration close date from season
            const teamDataDoc = teamDoc.data();
            let closeDate: string | undefined;
            
            // Try to get registration close date from active season
            const seasonsSnap = await getDocs(collection(db, 'teams', teamDoc.id, 'seasons'));
            seasonsSnap.forEach(seasonDoc => {
              const sData = seasonDoc.data();
              if (sData.isActive && sData.registrationCloseDate) {
                closeDate = sData.registrationCloseDate;
              }
            });
            
            setDraftPoolInfo({
              isInDraftPool: true,
              teamName: teamDataDoc.name || 'the team',
              registrationCloseDate: closeDate,
            });
            setDraftPoolLoading(false);
            return;
          }
        }
        
        setDraftPoolInfo({ isInDraftPool: false });
        setDraftPoolLoading(false);
      } catch (err) {
        console.error('Error checking draft pool:', err);
        setDraftPoolInfo({ isInDraftPool: false });
        setDraftPoolLoading(false);
      }
    };
    
    checkDraftPool();
  }, [selectedPlayer?.id]);

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
      } catch (error) {
        console.error('Error fetching public events:', error);
      } finally {
        setLoadingPublic(false);
      }
    };
    
    fetchPublicEvents();
  }, [teamId, authLoading]);

  // Loading state
  if (authLoading || draftPoolLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 dark:text-orange-500" />
      </div>
    );
  }
  
  // DRAFT POOL VIEW - Player is waiting to be drafted (show instead of registration browser)
  if (!teamId && draftPoolInfo.isInDraftPool) {
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
          
          <p className="text-slate-600 dark:text-zinc-400 mb-6 text-lg">
            {isParent ? 'Your athlete is' : "You're"} registered and waiting to be drafted to <span className="font-semibold text-emerald-600 dark:text-emerald-400">{draftPoolInfo.teamName}</span>.
          </p>
          
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
    // Filter events by search query AND by athlete's age group
    const filteredEvents = publicEvents.filter(event => {
      // First, filter by age group if an athlete is selected
      if (selectedAthleteAgeGroup && (event as any).ageGroup) {
        // Match the age group (e.g., "9U" matches "9U")
        if ((event as any).ageGroup !== selectedAthleteAgeGroup) {
          return false;
        }
      }
      
      // Then filter by search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        event.title?.toLowerCase().includes(q) ||
        event.description?.toLowerCase().includes(q) ||
        event.location?.toLowerCase().includes(q) ||
        event.teamName?.toLowerCase().includes(q) ||
        (event as any).ageGroup?.toLowerCase().includes(q)
      );
    });

    return (
      <div className="p-4 md:p-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 dark:from-orange-500 dark:to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Find a Team</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Browse open registrations and tryouts</p>
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
            {selectedAthleteAgeGroup && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                Showing registrations for <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedAthleteAgeGroup}</span> teams
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
              {searchQuery ? 'No Results Found' : selectedAthleteAgeGroup ? `No ${selectedAthleteAgeGroup} Registrations` : 'No Open Registrations'}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              {searchQuery 
                ? `No events found matching "${searchQuery}". Try a different search.`
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
              
              return (
                <button
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}/register`)}
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
                        {/* Age Group Badge */}
                        {(event as any).ageGroup && (
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
                        {event.teamName && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{event.teamName}</span>
                        )}
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-orange-400 transition-colors">
                        {event.title}
                      </h3>
                      
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
    navigate(`/events/${event.id}/edit`);
  };

  const handleManageEvent = (event: Event) => {
    navigate(`/events/${event.id}/manage`);
  };

  const handleDuplicateEvent = (event: Event) => {
    // TODO: Implement duplicate functionality
    console.log('Duplicate event:', event.id);
  };

  return (
    <div className="p-4 md:p-6">
      <EventList
        teamId={teamId}
        isCoachView={isCoach}
        showCreateButton={isCoach}
        onCreateEvent={handleCreateEvent}
        onViewEvent={handleViewEvent}
        onEditEvent={isCoach ? handleEditEvent : undefined}
        onManageEvent={isCoach ? handleManageEvent : undefined}
        onDuplicateEvent={isCoach ? handleDuplicateEvent : undefined}
      />
    </div>
  );
};

export default EventsPage;
