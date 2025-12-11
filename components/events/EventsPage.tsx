import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import EventList from './EventList';
import { Event, PricingTier } from '../../types/events';
import { Loader2, AlertCircle, Calendar, Search, MapPin, Users, ChevronRight, UserPlus } from 'lucide-react';

/**
 * EventsPage - Wrapper component for EventList that handles auth context
 * For users without a team, shows public events available for registration
 */
const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userData, teamData, loading: authLoading } = useAuth();

  // Get the current team ID
  const teamId = teamData?.id || userData?.teamId;

  // State for public events browse (for users without a team)
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const [publicPricingTiers, setPublicPricingTiers] = useState<Record<string, PricingTier[]>>({});
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        
        snapshot.forEach(doc => {
          const data = doc.data() as Event;
          // Only include registration events
          if (data.type === 'registration' || data.type === 'tryout') {
            eventsData.push({ id: doc.id, ...data });
          }
        });
        
        // Sort by start date (upcoming first)
        eventsData.sort((a, b) => {
          const aDate = a.startDate?.toDate?.() || new Date(0);
          const bDate = b.startDate?.toDate?.() || new Date(0);
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
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 dark:text-orange-500" />
      </div>
    );
  }

  // No team - show public events browse for registration
  if (!teamId) {
    const filteredEvents = publicEvents.filter(event => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        event.title?.toLowerCase().includes(q) ||
        event.description?.toLowerCase().includes(q) ||
        event.location?.toLowerCase().includes(q) ||
        event.teamName?.toLowerCase().includes(q)
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
              {searchQuery ? 'No Results Found' : 'No Open Registrations'}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              {searchQuery 
                ? `No events found matching "${searchQuery}". Try a different search.`
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
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="w-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 text-left hover:border-purple-500 dark:hover:border-orange-500 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Event type badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          event.type === 'registration' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                          {event.type === 'registration' ? 'Registration' : 'Tryout'}
                        </span>
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
