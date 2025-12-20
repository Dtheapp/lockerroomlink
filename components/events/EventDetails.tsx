import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Event, PricingTier, EventWithDetails } from '../../types/events';
import { Team } from '../../types';
import { 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign, 
  Clock,
  CheckCircle,
  Gift,
  ExternalLink,
  Share2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  QrCode,
  Baby
} from 'lucide-react';

interface EventDetailsProps {
  eventId: string;
  onBack?: () => void;
  onRegister?: (event: Event, pricingTiers: PricingTier[]) => void;
  showBackButton?: boolean;
}

// Format price from cents to dollars
const formatPrice = (cents: number): string => {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
};

// Format date for display
const formatDate = (timestamp: any): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
};

// Format time for display
const formatTime = (timestamp: any): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true
  });
};

// Format time string (HH:MM) to 12-hour format
const formatTimeString = (timeStr: string | undefined): string => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '';
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
};

// Format date with time
const formatDateWithTime = (timestamp: any, eventStartTime?: string): string => {
  if (!timestamp) return '';
  const dateStr = formatDate(timestamp);
  // Use explicit time string if available (for games/practices)
  if (eventStartTime) {
    const timeStr = formatTimeString(eventStartTime);
    if (timeStr) return `${dateStr} at ${timeStr}`;
  }
  const timeStr = formatTime(timestamp);
  if (!timeStr) return dateStr;
  return `${dateStr} at ${timeStr}`;
};

// Format date range - accepts optional eventStartTime for games/practices
const formatDateRange = (start: any, end: any, eventStartTime?: string): string => {
  const startStr = formatDateWithTime(start, eventStartTime);
  const endStr = formatDateWithTime(end);
  if (!startStr) return '';
  if (!endStr || startStr === endStr) return startStr;
  // If same day, just show end time
  const startDate = formatDate(start);
  const endDate = formatDate(end);
  if (startDate === endDate) {
    return `${startStr} - ${formatTime(end)}`;
  }
  return `${startStr} - ${endStr}`;
};

const EventDetails: React.FC<EventDetailsProps> = ({
  eventId,
  onBack,
  onRegister,
  showBackButton = true
}) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch event
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        
        if (!eventDoc.exists()) {
          setError('Event not found');
          setLoading(false);
          return;
        }
        
        const eventData = { id: eventDoc.id, ...eventDoc.data() } as Event;
        setEvent(eventData);
        
        // Fetch team info
        if (eventData.teamId) {
          const teamDoc = await getDoc(doc(db, 'teams', eventData.teamId));
          if (teamDoc.exists()) {
            setTeam({ id: teamDoc.id, ...teamDoc.data() } as Team);
          }
        }
        
        // Fetch pricing tiers (no orderBy to avoid index requirement)
        const tiersSnapshot = await getDocs(
          collection(db, 'events', eventId, 'pricingTiers')
        );
        
        let tiers: PricingTier[] = [];
        tiersSnapshot.forEach(doc => {
          tiers.push({ id: doc.id, ...doc.data() } as PricingTier);
        });
        
        // Sort client-side
        tiers.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
        setPricingTiers(tiers);
        
      } catch (err: any) {
        console.error('Error fetching event:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEventDetails();
  }, [eventId]);

  // Copy share link
  const handleShare = async () => {
    const shareUrl = event?.shareableLink || window.location.href;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: event?.title,
          text: `Check out ${event?.title}`,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  // Check registration status
  const getRegistrationStatus = () => {
    if (!event) return { canRegister: false, message: '' };
    
    const now = new Date();
    const regOpenDate = event.registrationOpenDate?.toDate ? event.registrationOpenDate.toDate() : null;
    const regCloseDate = event.registrationCloseDate?.toDate ? event.registrationCloseDate.toDate() : null;
    
    // Check if full
    if (event.maxCapacity && event.currentCount >= event.maxCapacity) {
      if (event.waitlistEnabled) {
        return { canRegister: true, message: 'Join Waitlist', isWaitlist: true };
      }
      return { canRegister: false, message: 'Registration Full' };
    }
    
    // Check dates
    if (regOpenDate && now < regOpenDate) {
      return { canRegister: false, message: `Opens ${formatDate(regOpenDate)}` };
    }
    
    if (regCloseDate && now > regCloseDate) {
      return { canRegister: false, message: 'Registration Closed' };
    }
    
    // Check status
    if (event.status !== 'active') {
      return { canRegister: false, message: 'Not Available' };
    }
    
    return { canRegister: true, message: 'Register Now' };
  };

  // Get active pricing tiers
  const getActiveTiers = (): PricingTier[] => {
    const now = new Date();
    return pricingTiers.filter(tier => {
      if (!tier.isActive) return false;
      
      const availableFrom = tier.availableFrom?.toDate ? tier.availableFrom.toDate() : null;
      const availableUntil = tier.availableUntil?.toDate ? tier.availableUntil.toDate() : null;
      
      if (availableFrom && now < availableFrom) return false;
      if (availableUntil && now > availableUntil) return false;
      
      if (tier.maxQuantity && tier.currentQuantity >= tier.maxQuantity) return false;
      
      return true;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error || 'Event not found'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This event may have been removed or the link is incorrect.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const registrationStatus = getRegistrationStatus();
  const activeTiers = getActiveTiers();
  const lowestPrice = activeTiers.length > 0 ? Math.min(...activeTiers.map(t => t.price)) : null;
  const spotsRemaining = event.maxCapacity ? event.maxCapacity - event.currentCount : null;

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Back button */}
      {showBackButton && onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      )}

      {/* Hero section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden mb-6">
        {/* Gradient header */}
        <div className={`h-3 ${
          event.type === 'registration' ? 'bg-gradient-to-r from-purple-500 to-indigo-500' :
          event.type === 'game' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
          event.type === 'fundraiser' ? 'bg-gradient-to-r from-green-500 to-teal-500' :
          event.type === 'social' ? 'bg-gradient-to-r from-pink-500 to-rose-500' :
          'bg-gradient-to-r from-gray-400 to-gray-500'
        }`} />
        
        <div className="p-6 md:p-8">
          {/* Team info */}
          {team && (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                {team.name ? (
                  <span className="text-lg font-bold text-gray-600 dark:text-gray-300">
                    {team.name.charAt(0)}
                  </span>
                ) : null}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{team.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{event.type}</p>
              </div>
            </div>
          )}
          
          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {event.title}
          </h1>
          
          {/* Quick info row */}
          <div className="flex flex-wrap gap-4 mb-6">
            {/* Date */}
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <span>{formatDateRange(event.eventStartDate, event.eventEndDate, (event as any).eventStartTime)}</span>
            </div>
            
            {/* Location */}
            {event.location?.name && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <MapPin className="w-5 h-5 text-indigo-500" />
                <span>{event.location.name}</span>
                {event.location.mapUrl && (
                  <a 
                    href={event.location.mapUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
            
            {/* Price */}
            {event.type === 'registration' && lowestPrice !== null && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <DollarSign className="w-5 h-5 text-green-500" />
                <span>{lowestPrice === 0 ? 'Free' : `From ${formatPrice(lowestPrice)}`}</span>
              </div>
            )}
          </div>
          
          {/* Age requirement */}
          {event.ageRequirement && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full text-sm font-medium mb-6">
              <Baby className="w-4 h-4" />
              {event.ageRequirement.type === 'under' && `Under ${event.ageRequirement.maxAge} years old`}
              {event.ageRequirement.type === 'over' && `${event.ageRequirement.minAge}+ years old`}
              {event.ageRequirement.type === 'between' && `Ages ${event.ageRequirement.minAge}-${event.ageRequirement.maxAge}`}
              {event.ageRequirement.asOfDate && (
                <span className="text-blue-600 dark:text-blue-300">
                  (as of {formatDate(event.ageRequirement.asOfDate)})
                </span>
              )}
            </div>
          )}
          
          {/* Description */}
          {event.description && (
            <div className="prose dark:prose-invert max-w-none mb-6">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
          
          {/* Capacity/spots info */}
          {event.type === 'registration' && event.maxCapacity && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Registration Spots
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {event.currentCount} / {event.maxCapacity} filled
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full transition-all ${
                    event.currentCount >= event.maxCapacity 
                      ? 'bg-red-500' 
                      : event.currentCount >= event.maxCapacity * 0.8 
                        ? 'bg-yellow-500' 
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((event.currentCount / event.maxCapacity) * 100, 100)}%` }}
                />
              </div>
              {spotsRemaining !== null && spotsRemaining > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  {spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''} remaining
                </p>
              )}
              {event.waitlistEnabled && event.currentCount >= event.maxCapacity && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                  Waitlist available ({event.waitlistCount} waiting)
                </p>
              )}
            </div>
          )}
          
          {/* Share button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {copied ? 'Link Copied!' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      {/* Pricing tiers (for registration events) */}
      {event.type === 'registration' && activeTiers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Pricing Options
          </h2>
          
          <div className="grid gap-4">
            {activeTiers.map(tier => (
              <div 
                key={tier.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {tier.name}
                  </h3>
                  <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    {formatPrice(tier.price)}
                  </span>
                </div>
                {tier.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {tier.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {tier.availableUntil && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Until {formatDate(tier.availableUntil)}
                    </span>
                  )}
                  {tier.maxQuantity && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {tier.maxQuantity - tier.currentQuantity} left
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What's included */}
      {event.includedItems && event.includedItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-500" />
            What's Included
          </h2>
          
          <ul className="grid sm:grid-cols-2 gap-3">
            {event.includedItems.map((item, index) => (
              <li 
                key={index}
                className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
              >
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Location details */}
      {event.location && (event.location.address || event.location.city) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-500" />
            Location
          </h2>
          
          <div className="text-gray-700 dark:text-gray-300">
            <p className="font-medium">{event.location.name}</p>
            {event.location.address && <p>{event.location.address}</p>}
            {(event.location.city || event.location.state || event.location.zip) && (
              <p>
                {[event.location.city, event.location.state, event.location.zip]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {event.location.mapUrl && (
              <a 
                href={event.location.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                View on Map
              </a>
            )}
          </div>
        </div>
      )}

      {/* Registration CTA - Sticky on mobile */}
      {event.type === 'registration' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 md:relative md:border-0 md:bg-transparent md:p-0 md:mt-6 z-40">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => registrationStatus.canRegister && onRegister?.(event, pricingTiers)}
              disabled={!registrationStatus.canRegister}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2 ${
                registrationStatus.canRegister
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {registrationStatus.canRegister && <CheckCircle className="w-5 h-5" />}
              {registrationStatus.message}
              {registrationStatus.canRegister && lowestPrice !== null && lowestPrice > 0 && (
                <span className="ml-2 opacity-90">• From {formatPrice(lowestPrice)}</span>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Spacer for sticky button on mobile */}
      {event.type === 'registration' && <div className="h-24 md:hidden" />}
    </div>
  );
};

export default EventDetails;
