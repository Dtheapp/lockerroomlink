/**
 * Simple Registration Page
 * Standalone page for the new clean registration flow
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Event } from '../../types/events';
import SimpleRegistrationForm, { RegistrationSuccess } from './SimpleRegistrationForm';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';

const SimpleRegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [event, setEvent] = useState<Event | null>(null);
  const [registrationFee, setRegistrationFee] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedRegistrationId, setCompletedRegistrationId] = useState<string | null>(null);
  
  // Fetch event and pricing
  useEffect(() => {
    const fetchEventAndPricing = async () => {
      if (!eventId) {
        setError('No event ID provided');
        setLoading(false);
        return;
      }
      
      try {
        // Fetch event
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (eventDoc.exists()) {
          setEvent({ id: eventDoc.id, ...eventDoc.data() } as Event);
          
          // Try to fetch first pricing tier for the fee
          try {
            const tiersQuery = query(
              collection(db, 'events', eventId, 'pricingTiers'),
              limit(1)
            );
            const tiersSnapshot = await getDocs(tiersQuery);
            if (!tiersSnapshot.empty) {
              const firstTier = tiersSnapshot.docs[0].data();
              setRegistrationFee(firstTier.price || 0);
            }
          } catch (tierErr) {
            console.warn('Could not fetch pricing tiers (using free):', tierErr);
          }
        } else {
          setError('Event not found');
        }
      } catch (err: any) {
        console.error('Error fetching event:', err);
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEventAndPricing();
  }, [eventId]);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      // Store the intended destination
      sessionStorage.setItem('redirectAfterLogin', `/events/${eventId}/register`);
      navigate('/login');
    }
  }, [user, authLoading, eventId, navigate]);
  
  const handleSuccess = (registrationId: string) => {
    setCompletedRegistrationId(registrationId);
  };
  
  const handleCancel = () => {
    navigate(`/events/${eventId}`);
  };
  
  const handleClose = () => {
    navigate(`/events/${eventId}`);
  };
  
  // Loading state
  if (loading || authLoading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !event) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg text-center`}>
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {error || 'Event Not Found'}
          </h2>
          <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            We couldn't load the event. Please try again.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  // Success state
  if (completedRegistrationId) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center p-4`}>
        <RegistrationSuccess
          registrationId={completedRegistrationId}
          eventName={event.title}
          onClose={handleClose}
        />
      </div>
    );
  }
  
  // Registration form
  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} py-8 px-4`}>
      {/* Back button */}
      <div className="max-w-2xl mx-auto mb-4">
        <button
          onClick={handleCancel}
          className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to event
        </button>
      </div>
      
      <SimpleRegistrationForm
        event={event}
        registrationFee={registrationFee}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default SimpleRegistrationPage;
