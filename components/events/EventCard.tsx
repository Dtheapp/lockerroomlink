import React from 'react';
import { 
  Calendar, 
  MapPin, 
  Users, 
  DollarSign, 
  Clock,
  Eye,
  Edit2,
  Copy,
  MoreVertical,
  CheckCircle,
  PauseCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Event, EventStatus, PricingTier } from '../../types/events';

interface EventCardProps {
  event: Event;
  pricingTiers?: PricingTier[];
  onView?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onManage?: () => void;
  isCoachView?: boolean; // Show edit/manage options
  compact?: boolean; // Smaller card for lists
}

// Format price from cents to dollars
const formatPrice = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

// Get lowest price from tiers
const getLowestPrice = (tiers: PricingTier[]): number | null => {
  if (!tiers || tiers.length === 0) return null;
  const activeTiers = tiers.filter(t => t.isActive);
  if (activeTiers.length === 0) return null;
  return Math.min(...activeTiers.map(t => t.price));
};

// Format date for display
const formatDate = (timestamp: any): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

// Get status badge style and text
const getStatusBadge = (status: EventStatus): { bg: string; text: string; icon: React.ReactNode; label: string } => {
  switch (status) {
    case 'active':
      return { 
        bg: 'bg-green-100 dark:bg-green-900/30', 
        text: 'text-green-800 dark:text-green-400',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Active'
      };
    case 'draft':
      return { 
        bg: 'bg-gray-100 dark:bg-gray-700', 
        text: 'text-gray-800 dark:text-gray-300',
        icon: <Edit2 className="w-3 h-3" />,
        label: 'Draft'
      };
    case 'paused':
      return { 
        bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
        text: 'text-yellow-800 dark:text-yellow-400',
        icon: <PauseCircle className="w-3 h-3" />,
        label: 'Paused'
      };
    case 'closed':
      return { 
        bg: 'bg-blue-100 dark:bg-blue-900/30', 
        text: 'text-blue-800 dark:text-blue-400',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Closed'
      };
    case 'cancelled':
      return { 
        bg: 'bg-red-100 dark:bg-red-900/30', 
        text: 'text-red-800 dark:text-red-400',
        icon: <XCircle className="w-3 h-3" />,
        label: 'Cancelled'
      };
    default:
      return { 
        bg: 'bg-gray-100 dark:bg-gray-700', 
        text: 'text-gray-800 dark:text-gray-300',
        icon: <AlertCircle className="w-3 h-3" />,
        label: status
      };
  }
};

// Get event type badge style
const getTypeBadge = (type: string): { bg: string; text: string } => {
  switch (type) {
    case 'registration':
      return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400' };
    case 'game':
      return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400' };
    case 'fundraiser':
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400' };
    case 'social':
      return { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-400' };
    default:
      return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300' };
  }
};

const EventCard: React.FC<EventCardProps> = ({
  event,
  pricingTiers = [],
  onView,
  onEdit,
  onDuplicate,
  onManage,
  isCoachView = false,
  compact = false
}) => {
  const statusBadge = getStatusBadge(event.status);
  const typeBadge = getTypeBadge(event.type);
  const lowestPrice = getLowestPrice(pricingTiers);
  
  // Calculate spots remaining
  const spotsRemaining = event.maxCapacity ? event.maxCapacity - event.currentCount : null;
  const isFull = event.maxCapacity !== undefined && event.maxCapacity !== null && event.currentCount >= event.maxCapacity;
  
  // Check if registration is open
  const now = new Date();
  const regOpenDate = event.registrationOpenDate?.toDate ? event.registrationOpenDate.toDate() : null;
  const regCloseDate = event.registrationCloseDate?.toDate ? event.registrationCloseDate.toDate() : null;
  const isRegistrationOpen = regOpenDate && regCloseDate && now >= regOpenDate && now <= regCloseDate;
  const isUpcoming = regOpenDate && now < regOpenDate;

  if (compact) {
    // Compact card for lists
    return (
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
        onClick={onView}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge.bg} ${typeBadge.text}`}>
                {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusBadge.bg} ${statusBadge.text}`}>
                {statusBadge.icon}
                {statusBadge.label}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {event.title}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(event.eventStartDate)}
              </span>
              {event.type === 'registration' && event.maxCapacity && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {event.currentCount}/{event.maxCapacity}
                </span>
              )}
            </div>
          </div>
          
          {isCoachView && (
            <div className="flex items-center gap-2 ml-4">
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {onDuplicate && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full card
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header with gradient based on event type */}
      <div className={`h-2 ${
        event.type === 'registration' ? 'bg-gradient-to-r from-purple-500 to-indigo-500' :
        event.type === 'game' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
        event.type === 'fundraiser' ? 'bg-gradient-to-r from-green-500 to-teal-500' :
        event.type === 'social' ? 'bg-gradient-to-r from-pink-500 to-rose-500' :
        'bg-gradient-to-r from-gray-400 to-gray-500'
      }`} />
      
      <div className="p-5">
        {/* Badges row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${typeBadge.bg} ${typeBadge.text}`}>
              {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${statusBadge.bg} ${statusBadge.text}`}>
              {statusBadge.icon}
              {statusBadge.label}
            </span>
          </div>
          
          {isCoachView && (
            <div className="relative group">
              <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <MoreVertical className="w-4 h-4" />
              </button>
              {/* Dropdown menu */}
              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                )}
                {onDuplicate && (
                  <button
                    onClick={onDuplicate}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                )}
                {onManage && (
                  <button
                    onClick={onManage}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Manage
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {event.title}
        </h3>
        
        {/* Description (truncated) */}
        {event.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
            {event.description}
          </p>
        )}
        
        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{formatDate(event.eventStartDate)}</span>
          </div>
          
          {/* Location */}
          {event.location?.name && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="truncate">{event.location.name}</span>
            </div>
          )}
          
          {/* Price (for registration events) */}
          {event.type === 'registration' && lowestPrice !== null && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span>From {formatPrice(lowestPrice)}</span>
            </div>
          )}
          
          {/* Capacity (for registration events) */}
          {event.type === 'registration' && event.maxCapacity && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Users className="w-4 h-4 text-gray-400" />
              <span className={isFull ? 'text-red-500 font-medium' : ''}>
                {isFull ? 'Full' : `${spotsRemaining} spots left`}
              </span>
            </div>
          )}
        </div>
        
        {/* Age requirement badge */}
        {event.ageRequirement && (
          <div className="mb-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
              {event.ageRequirement.type === 'under' && `Under ${event.ageRequirement.maxAge}`}
              {event.ageRequirement.type === 'over' && `${event.ageRequirement.minAge}+`}
              {event.ageRequirement.type === 'between' && `Ages ${event.ageRequirement.minAge}-${event.ageRequirement.maxAge}`}
            </span>
          </div>
        )}
        
        {/* Registration status banner */}
        {event.type === 'registration' && (
          <div className={`rounded-lg px-3 py-2 mb-4 text-sm ${
            isFull 
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' 
              : isRegistrationOpen 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : isUpcoming
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {isFull ? (
                <span>Registration full {event.waitlistEnabled && '(Waitlist available)'}</span>
              ) : isRegistrationOpen ? (
                <span>Registration open until {formatDate(event.registrationCloseDate)}</span>
              ) : isUpcoming ? (
                <span>Registration opens {formatDate(event.registrationOpenDate)}</span>
              ) : (
                <span>Registration closed</span>
              )}
            </div>
          </div>
        )}
        
        {/* Action button */}
        <button
          onClick={onView}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" />
          {isCoachView ? 'View Details' : 'Learn More'}
        </button>
      </div>
    </div>
  );
};

export default EventCard;
