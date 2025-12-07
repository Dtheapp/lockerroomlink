import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import EventList from './EventList';
import { Event } from '../../types/events';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * EventsPage - Wrapper component for EventList that handles auth context
 * This is the page component used by the router
 */
const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userData, teamData, loading: authLoading } = useAuth();

  // Get the current team ID
  const teamId = teamData?.id || userData?.teamId;

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // No team selected
  if (!teamId) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Team Selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Please select a team to view events.
          </p>
        </div>
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
