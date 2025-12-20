import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Event, PricingTier, EventStatus, EventType } from '../../types/events';
import EventCard from './EventCard';
import EmptyState from '../ui/EmptyState';
import { toastSuccess, toastError } from '../../services/toast';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  ChevronDown,
  Loader2,
  FolderOpen
} from 'lucide-react';

interface EventListProps {
  teamId: string;
  onCreateEvent?: () => void;
  onViewEvent?: (event: Event) => void;
  onEditEvent?: (event: Event) => void;
  onDeleteEvent?: (event: Event) => void;
  onDuplicateEvent?: (event: Event) => void;
  onManageEvent?: (event: Event) => void;
  isCoachView?: boolean;
  showCreateButton?: boolean;
  filterByType?: EventType;
  filterByStatus?: EventStatus;
  maxItems?: number;
  compact?: boolean;
}

const EventList: React.FC<EventListProps> = ({
  teamId,
  onCreateEvent,
  onViewEvent,
  onEditEvent,
  onDeleteEvent,
  onDuplicateEvent,
  onManageEvent,
  isCoachView = false,
  showCreateButton = true,
  filterByType,
  filterByStatus,
  maxItems,
  compact = false
}) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [pricingTiersMap, setPricingTiersMap] = useState<Record<string, PricingTier[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>(filterByStatus || 'all');
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>(filterByType || 'all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch events for the team
  useEffect(() => {
    const fetchEvents = async () => {
      if (!teamId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Build query - simple query first to avoid index requirements
        // Note: Composite indexes may need to be created in Firebase Console
        let eventsQuery = query(
          collection(db, 'events'),
          where('teamId', '==', teamId)
        );
        
        const snapshot = await getDocs(eventsQuery);
        let eventsData: Event[] = [];
        
        snapshot.forEach(doc => {
          eventsData.push({ id: doc.id, ...doc.data() } as Event);
        });
        
        // Sort client-side to avoid needing composite index
        eventsData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime; // descending
        });
        
        setEvents(eventsData);
        
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
          
          // Sort client-side to avoid needing composite index
          tiers.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          
          tiersMap[event.id] = tiers;
        }));
        
        setPricingTiersMap(tiersMap);
        
      } catch (err: any) {
        console.error('Error fetching events:', err);
        setError('Failed to load events. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [teamId]);

  // Handle delete event
  const handleDeleteEvent = async (event: Event) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${event.title}"? This cannot be undone.`);
    if (!confirmed) return;
    
    try {
      await deleteDoc(doc(db, 'events', event.id));
      setEvents(prev => prev.filter(e => e.id !== event.id));
      toastSuccess('Event deleted successfully');
      onDeleteEvent?.(event);
    } catch (err) {
      console.error('Error deleting event:', err);
      toastError('Failed to delete event');
    }
  };

  // Filter events
  const filteredEvents = events.filter(event => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!event.title.toLowerCase().includes(query) && 
          !event.description?.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    // Status filter
    if (statusFilter !== 'all' && event.status !== statusFilter) {
      return false;
    }
    
    // Type filter
    if (typeFilter !== 'all' && event.type !== typeFilter) {
      return false;
    }
    
    // For non-coach view, only show active/public events
    if (!isCoachView) {
      if (event.status !== 'active' || !event.isPublic) {
        return false;
      }
    }
    
    return true;
  });

  // Apply maxItems limit
  const displayEvents = maxItems ? filteredEvents.slice(0, maxItems) : filteredEvents;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg p-4 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          {isCoachView && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors ${
                showFilters 
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          )}
          
          {/* Create button */}
          {isCoachView && showCreateButton && onCreateEvent && (
            <button
              onClick={onCreateEvent}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </button>
          )}
        </div>
      </div>
      
      {/* Filter panel */}
      {isCoachView && showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex flex-wrap gap-4">
          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EventStatus | 'all')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          {/* Type filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EventType | 'all')}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="practice">Practice</option>
              <option value="game">Game / Match</option>
              <option value="registration">Registration</option>
              <option value="fundraiser">Fundraiser</option>
              <option value="social">Social</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          {/* Clear filters */}
          {(statusFilter !== 'all' || typeFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setTypeFilter('all');
                setSearchQuery('');
              }}
              className="self-end px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      
      {/* Events list/grid */}
      {displayEvents.length === 0 ? (
        searchQuery || statusFilter !== 'all' || typeFilter !== 'all' ? (
          <EmptyState
            type="search"
            title="No Events Match Your Filters"
            description="Try adjusting your search or filters to find what you're looking for."
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setTypeFilter('all');
            }}
            compact
          />
        ) : (
          <EmptyState
            type="events"
            title={isCoachView ? "Schedule Your First Event" : "No Events Yet"}
            description={
              isCoachView 
                ? "Create events for practices, games, camps, tryouts, and more. Collect registrations and payments all in one place."
                : "Check back later for upcoming events from this team."
            }
            actionLabel={isCoachView && showCreateButton && onCreateEvent ? "Create First Event" : undefined}
            onAction={isCoachView && showCreateButton && onCreateEvent ? onCreateEvent : undefined}
          />
        )
      ) : compact ? (
        // Compact list view
        <div className="space-y-2">
          {displayEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              pricingTiers={pricingTiersMap[event.id] || []}
              onView={() => onViewEvent?.(event)}
              onEdit={() => onEditEvent?.(event)}
              onDelete={() => handleDeleteEvent(event)}
              onDuplicate={() => onDuplicateEvent?.(event)}
              onManage={() => onManageEvent?.(event)}
              isCoachView={isCoachView}
              compact
            />
          ))}
        </div>
      ) : (
        // Grid view
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              pricingTiers={pricingTiersMap[event.id] || []}
              onView={() => onViewEvent?.(event)}
              onEdit={() => onEditEvent?.(event)}
              onDelete={() => handleDeleteEvent(event)}
              onDuplicate={() => onDuplicateEvent?.(event)}
              onManage={() => onManageEvent?.(event)}
              isCoachView={isCoachView}
            />
          ))}
        </div>
      )}
      
      {/* Show more link */}
      {maxItems && filteredEvents.length > maxItems && (
        <div className="text-center pt-2">
          <button
            onClick={() => onViewEvent?.(filteredEvents[0])} // Navigate to events page
            className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium"
          >
            View all {filteredEvents.length} events →
          </button>
        </div>
      )}
    </div>
  );
};

export default EventList;
