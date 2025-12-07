import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EventDetails from './EventDetails';
import { Event, PricingTier } from '../../types/events';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * EventDetailsPage - Wrapper for EventDetails that handles URL params and navigation
 */
const EventDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  // No event ID in URL
  if (!eventId) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Event Not Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No event ID was provided in the URL.
          </p>
          <button
            onClick={() => navigate('/events')}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    navigate('/events');
  };

  const handleRegister = (event: Event, pricingTiers: PricingTier[]) => {
    navigate(`/events/${eventId}/register`);
  };

  return (
    <div className="p-4 md:p-6">
      <EventDetails
        eventId={eventId}
        onBack={handleBack}
        onRegister={handleRegister}
        showBackButton={true}
      />
    </div>
  );
};

export default EventDetailsPage;
