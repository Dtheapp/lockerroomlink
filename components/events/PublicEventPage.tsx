import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import EventDetails from './EventDetails';
import { Event, PricingTier } from '../../types/events';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * PublicEventPage - Wrapper for public event view (no auth required)
 * If user is logged in and event is a registration type, can auto-navigate to registration
 */
const PublicEventPage: React.FC = () => {
  const navigate = useNavigate();
  const { eventId, shareableLink } = useParams<{ eventId?: string; shareableLink?: string }>();
  const { user } = useAuth();
  const [checkingEvent, setCheckingEvent] = useState(true);

  // Determine the event ID from URL params
  const resolvedEventId = eventId || shareableLink;

  // Check if event is registration type and auto-redirect if user is logged in
  useEffect(() => {
    const checkEventAndRedirect = async () => {
      if (!resolvedEventId) {
        setCheckingEvent(false);
        return;
      }
      
      // If user is logged in, check if this is a registration event
      if (user) {
        try {
          const eventDoc = await getDoc(doc(db, 'events', resolvedEventId));
          if (eventDoc.exists()) {
            const eventData = eventDoc.data();
            // If it's a registration event, go straight to registration
            if (eventData.type === 'registration') {
              navigate(`/dashboard/events/${resolvedEventId}/register`, { replace: true });
              return;
            }
          }
        } catch (err) {
          console.error('Error checking event:', err);
        }
      }
      
      setCheckingEvent(false);
    };
    
    checkEventAndRedirect();
  }, [resolvedEventId, user, navigate]);

  // Show loading while checking
  if (checkingEvent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

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
    // Navigate to the auth-required registration page
    if (user) {
      navigate(`/dashboard/events/${resolvedEventId}/register`);
    } else {
      // Redirect to login with return URL
      navigate(`/login`, { state: { returnTo: `/event/${resolvedEventId}` } });
    }
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
