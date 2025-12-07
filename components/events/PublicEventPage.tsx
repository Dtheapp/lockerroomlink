import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EventDetails from './EventDetails';
import { Event, PricingTier } from '../../types/events';
import { AlertCircle } from 'lucide-react';

/**
 * PublicEventPage - Wrapper for public event view (no auth required)
 */
const PublicEventPage: React.FC = () => {
  const navigate = useNavigate();
  const { eventId, shareableLink } = useParams<{ eventId?: string; shareableLink?: string }>();

  // Determine the event ID from URL params
  const resolvedEventId = eventId || shareableLink;

  // No event ID in URL
  if (!resolvedEventId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Event Not Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            The event you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  const handleRegister = (event: Event, pricingTiers: PricingTier[]) => {
    navigate(`/events/${resolvedEventId}/register`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <EventDetails
          eventId={resolvedEventId}
          onRegister={handleRegister}
          showBackButton={false}
        />
      </div>
    </div>
  );
};

export default PublicEventPage;
