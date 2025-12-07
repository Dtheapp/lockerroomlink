import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import EventCreator from './EventCreator';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * EventCreatorPage - Wrapper for EventCreator that handles auth and navigation
 */
const EventCreatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const { userData, teamData, loading: authLoading } = useAuth();

  // Get the current team ID
  const teamId = teamData?.id || userData?.teamId;
  const teamName = teamData?.name || 'My Team';

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
            Please select a team to create events.
          </p>
        </div>
      </div>
    );
  }

  // Must be a coach
  if (userData?.role !== 'Coach') {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Only coaches can create and edit events.
          </p>
        </div>
      </div>
    );
  }

  const handleComplete = (newEventId: string) => {
    navigate(`/events/${newEventId}`);
  };

  const handleCancel = () => {
    navigate('/events');
  };

  return (
    <div className="p-4 md:p-6">
      <EventCreator
        teamId={teamId}
        teamName={teamName}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default EventCreatorPage;
