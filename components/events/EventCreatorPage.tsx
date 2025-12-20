import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Event } from '../../types/events';
import EventCreator from './EventCreator';
import { Loader2, AlertCircle } from 'lucide-react';
import { toastSuccess, toastError } from '../../services/toast';

/**
 * EventCreatorPage - Wrapper for EventCreator that handles auth and navigation
 */
const EventCreatorPage: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const editEventId = eventId || searchParams.get('edit'); // Support both /events/:eventId/edit and /events/create?edit=id
  const { userData, teamData, loading: authLoading } = useAuth();
  
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(!!editEventId);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Get the current team ID
  const teamId = teamData?.id || userData?.teamId;
  const teamName = teamData?.name || 'My Team';

  // Load event data for editing
  useEffect(() => {
    if (!editEventId) {
      setLoadingEvent(false);
      return;
    }
    
    const loadEvent = async () => {
      try {
        setLoadingEvent(true);
        setLoadError(null);
        const eventDoc = await getDoc(doc(db, 'events', editEventId));
        if (eventDoc.exists()) {
          setEditEvent({ id: eventDoc.id, ...eventDoc.data() } as Event);
        } else {
          setLoadError('Event not found');
        }
      } catch (err) {
        console.error('Error loading event:', err);
        setLoadError('Failed to load event');
      } finally {
        setLoadingEvent(false);
      }
    };
    
    loadEvent();
  }, [editEventId]);

  // Loading state
  if (authLoading || loadingEvent) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Error loading event
  if (loadError) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {loadError}
          </h3>
          <button 
            onClick={() => navigate('/events')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Events
          </button>
        </div>
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

  const handleDelete = async () => {
    if (!editEvent?.id) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete "${editEvent.title}"? This cannot be undone.`);
    if (!confirmed) return;
    
    try {
      await deleteDoc(doc(db, 'events', editEvent.id));
      toastSuccess('Event deleted successfully');
      navigate('/events');
    } catch (err) {
      console.error('Error deleting event:', err);
      toastError('Failed to delete event');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <EventCreator
        teamId={teamId}
        teamName={teamName}
        onComplete={handleComplete}
        onCancel={handleCancel}
        onDelete={editEvent ? handleDelete : undefined}
        editEvent={editEvent || undefined}
      />
    </div>
  );
};

export default EventCreatorPage;
