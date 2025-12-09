import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Event, EventType, PricingTier, NewEvent, CustomField, EventLocation } from '../../types/events';
import { US_STATES } from '../../types/events';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  X, 
  Calendar, 
  MapPin, 
  DollarSign,
  Users,
  FileText,
  Image,
  Loader2,
  Plus,
  Trash2,
  Info,
  AlertCircle
} from 'lucide-react';

interface EventCreatorProps {
  teamId: string;
  teamName?: string;
  onComplete: (eventId: string) => void;
  onCancel: () => void;
  duplicateFrom?: Event; // For duplicating existing events
}

// Steps in the wizard
const STEPS = [
  { id: 'type', title: 'Event Type', icon: FileText },
  { id: 'details', title: 'Details', icon: Calendar },
  { id: 'location', title: 'Location', icon: MapPin },
  { id: 'pricing', title: 'Pricing', icon: DollarSign },
  { id: 'options', title: 'Options', icon: Users },
  { id: 'review', title: 'Review', icon: Check },
];

// Default empty event
const getDefaultEvent = (teamId: string, duplicateFrom?: Event): Partial<NewEvent> => {
  if (duplicateFrom) {
    // Extract only the fields that belong in NewEvent (exclude auto-generated fields)
    const { id, createdAt, updatedAt, currentCount, waitlistCount, shareableLink, ...eventData } = duplicateFrom;
    return {
      ...eventData,
      teamId,
      title: `Copy of ${duplicateFrom.title}`,
      status: 'draft',
      duplicatedFrom: duplicateFrom.id,
    };
  }
  
  return {
    teamId,
    type: 'registration',
    title: '',
    description: '',
    location: { name: '' },
    maxCapacity: undefined,
    waitlistEnabled: false,
    includedItems: [],
    customFields: [],
    waiver: { type: 'standard' },
    flier: {
      templateId: 'classic',
      backgroundColor: '#ffffff',
      accentColor: '#4f46e5',
      showQRCode: true,
      qrCodeUrl: '',
    },
    status: 'draft',
    isPublic: true,
    allowInPersonPayment: true,
    allowPaymentPlan: true,
    paymentPlanMinDownPayment: 100, // $1.00 minimum
  };
};

const EventCreator: React.FC<EventCreatorProps> = ({
  teamId,
  teamName,
  onComplete,
  onCancel,
  duplicateFrom
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [event, setEvent] = useState<Partial<NewEvent>>(getDefaultEvent(teamId, duplicateFrom));
  const [pricingTiers, setPricingTiers] = useState<Partial<PricingTier>[]>(
    duplicateFrom ? [] : [{ name: 'Standard', price: 0, isActive: true, sortOrder: 0 }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update event field
  const updateEvent = (updates: Partial<NewEvent>) => {
    setEvent(prev => ({ ...prev, ...updates }));
  };

  // Update location field
  const updateLocation = (updates: Partial<EventLocation>) => {
    setEvent(prev => ({
      ...prev,
      location: { ...prev.location, ...updates } as EventLocation
    }));
  };

  // Add pricing tier
  const addPricingTier = () => {
    setPricingTiers(prev => [...prev, {
      name: '',
      price: 0,
      isActive: true,
      sortOrder: prev.length,
    }]);
  };

  // Update pricing tier
  const updatePricingTier = (index: number, updates: Partial<PricingTier>) => {
    setPricingTiers(prev => prev.map((tier, i) => 
      i === index ? { ...tier, ...updates } : tier
    ));
  };

  // Remove pricing tier
  const removePricingTier = (index: number) => {
    setPricingTiers(prev => prev.filter((_, i) => i !== index));
  };

  // Add included item
  const addIncludedItem = () => {
    updateEvent({ includedItems: [...(event.includedItems || []), ''] });
  };

  // Update included item
  const updateIncludedItem = (index: number, value: string) => {
    const items = [...(event.includedItems || [])];
    items[index] = value;
    updateEvent({ includedItems: items });
  };

  // Remove included item
  const removeIncludedItem = (index: number) => {
    updateEvent({ includedItems: (event.includedItems || []).filter((_, i) => i !== index) });
  };

  // Validate current step
  const validateStep = (): boolean => {
    setError(null);
    
    switch (STEPS[currentStep].id) {
      case 'type':
        return !!event.type;
      case 'details':
        if (!event.title?.trim()) {
          setError('Please enter an event title');
          return false;
        }
        if (!event.eventStartDate) {
          setError('Please select a start date');
          return false;
        }
        return true;
      case 'location':
        if (!event.location?.name?.trim()) {
          setError('Please enter a location name');
          return false;
        }
        return true;
      case 'pricing':
        if (event.type === 'registration' && pricingTiers.length === 0) {
          setError('Please add at least one pricing tier');
          return false;
        }
        for (const tier of pricingTiers) {
          if (!tier.name?.trim()) {
            setError('All pricing tiers must have a name');
            return false;
          }
        }
        return true;
      default:
        return true;
    }
  };

  // Go to next step
  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  // Go to previous step
  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  // Save event
  const saveEvent = async (publish: boolean = false) => {
    if (!validateStep()) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Generate shareable link placeholder
      const shareableLink = `${window.location.origin}/event/PLACEHOLDER`;
      
      // Create event document
      const eventData: any = {
        ...event,
        teamId,
        status: publish ? 'active' : 'draft',
        currentCount: 0,
        waitlistCount: 0,
        shareableLink,
        createdBy: '', // Will be set by the calling component
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        flier: {
          ...event.flier,
          qrCodeUrl: shareableLink,
        }
      };
      
      // Convert date strings to Timestamps if needed
      if (event.eventStartDate && typeof event.eventStartDate === 'string') {
        eventData.eventStartDate = Timestamp.fromDate(new Date(event.eventStartDate as unknown as string));
      }
      if (event.eventEndDate && typeof event.eventEndDate === 'string') {
        eventData.eventEndDate = Timestamp.fromDate(new Date(event.eventEndDate as unknown as string));
      }
      if (event.registrationOpenDate && typeof event.registrationOpenDate === 'string') {
        eventData.registrationOpenDate = Timestamp.fromDate(new Date(event.registrationOpenDate as unknown as string));
      }
      if (event.registrationCloseDate && typeof event.registrationCloseDate === 'string') {
        eventData.registrationCloseDate = Timestamp.fromDate(new Date(event.registrationCloseDate as unknown as string));
      }
      
      const eventRef = await addDoc(collection(db, 'events'), eventData);
      
      // Update shareable link with actual ID
      // (In production, you'd use a URL shortener or custom domain)
      
      // Add pricing tiers as subcollection
      for (const tier of pricingTiers) {
        await addDoc(collection(db, 'events', eventRef.id, 'pricingTiers'), {
          ...tier,
          eventId: eventRef.id,
          currentQuantity: 0,
          isActive: tier.isActive ?? true,
        });
      }
      
      onComplete(eventRef.id);
      
    } catch (err: any) {
      console.error('Error saving event:', err);
      setError('Failed to save event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'type':
        return <StepEventType event={event} updateEvent={updateEvent} />;
      case 'details':
        return <StepDetails event={event} updateEvent={updateEvent} />;
      case 'location':
        return <StepLocation event={event} updateLocation={updateLocation} />;
      case 'pricing':
        return (
          <StepPricing 
            event={event}
            pricingTiers={pricingTiers}
            addPricingTier={addPricingTier}
            updatePricingTier={updatePricingTier}
            removePricingTier={removePricingTier}
          />
        );
      case 'options':
        return (
          <StepOptions
            event={event}
            updateEvent={updateEvent}
            addIncludedItem={addIncludedItem}
            updateIncludedItem={updateIncludedItem}
            removeIncludedItem={removeIncludedItem}
          />
        );
      case 'review':
        return <StepReview event={event} pricingTiers={pricingTiers} teamName={teamName} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {duplicateFrom ? 'Duplicate Event' : 'Create New Event'}
          </h2>
          <button 
            onClick={onCancel}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      {/* Progress steps */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  disabled={index > currentStep}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' 
                      : isComplete
                        ? 'text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isComplete ? 'bg-green-500 text-white' : ''
                  }`}>
                    {isComplete ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      
      {/* Step content */}
      <div className="p-6 min-h-[400px]">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}
        
        {renderStepContent()}
      </div>
      
      {/* Footer with navigation */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          onClick={currentStep === 0 ? onCancel : prevStep}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </button>
        
        <div className="flex items-center gap-3">
          {currentStep === STEPS.length - 1 ? (
            <>
              <button
                onClick={() => saveEvent(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => saveEvent(true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Publish Event
              </button>
            </>
          ) : (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// STEP COMPONENTS
// =============================================================================

// Step 1: Event Type
const StepEventType: React.FC<{
  event: Partial<NewEvent>;
  updateEvent: (updates: Partial<NewEvent>) => void;
}> = ({ event, updateEvent }) => {
  const eventTypes: { type: EventType; title: string; description: string; icon: string }[] = [
    { type: 'registration', title: 'Team Registration', description: 'Sign up players for your team or season', icon: '📋' },
    { type: 'game', title: 'Game / Match', description: 'Promote an upcoming game or match', icon: '🏆' },
    { type: 'fundraiser', title: 'Fundraiser', description: 'Raise money for your team', icon: '💰' },
    { type: 'social', title: 'Team Social', description: 'BBQ, party, or team gathering', icon: '🎉' },
    { type: 'other', title: 'Other Event', description: 'Any other type of event', icon: '📅' },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        What type of event are you creating?
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Select the type that best describes your event.
      </p>
      
      <div className="grid gap-3">
        {eventTypes.map(({ type, title, description, icon }) => (
          <button
            key={type}
            onClick={() => updateEvent({ type })}
            className={`flex items-center gap-4 p-4 border-2 rounded-xl text-left transition-all ${
              event.type === type
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <span className="text-3xl">{icon}</span>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
            </div>
            {event.type === type && (
              <Check className="w-6 h-6 text-indigo-600 ml-auto" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// Step 2: Event Details
const StepDetails: React.FC<{
  event: Partial<NewEvent>;
  updateEvent: (updates: Partial<NewEvent>) => void;
}> = ({ event, updateEvent }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Event Details
      </h3>
      
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Event Title *
        </label>
        <input
          type="text"
          value={event.title || ''}
          onChange={(e) => updateEvent({ title: e.target.value })}
          placeholder="e.g., 2025 Spring Soccer Registration"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      
      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={event.description || ''}
          onChange={(e) => updateEvent({ description: e.target.value })}
          placeholder="Tell parents what this event is about..."
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      
      {/* Dates */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Date *
          </label>
          <input
            type="date"
            value={event.eventStartDate ? (typeof event.eventStartDate === 'string' ? event.eventStartDate : '') : ''}
            onChange={(e) => updateEvent({ eventStartDate: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={event.eventEndDate ? (typeof event.eventEndDate === 'string' ? event.eventEndDate : '') : ''}
            onChange={(e) => updateEvent({ eventEndDate: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      
      {/* Registration dates (for registration type) */}
      {event.type === 'registration' && (
        <div className="grid sm:grid-cols-2 gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Registration Opens
            </label>
            <input
              type="date"
              value={event.registrationOpenDate ? (typeof event.registrationOpenDate === 'string' ? event.registrationOpenDate : '') : ''}
              onChange={(e) => updateEvent({ registrationOpenDate: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Registration Closes
            </label>
            <input
              type="date"
              value={event.registrationCloseDate ? (typeof event.registrationCloseDate === 'string' ? event.registrationCloseDate : '') : ''}
              onChange={(e) => updateEvent({ registrationCloseDate: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Step 3: Location
const StepLocation: React.FC<{
  event: Partial<NewEvent>;
  updateLocation: (updates: Partial<EventLocation>) => void;
}> = ({ event, updateLocation }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Event Location
      </h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Location Name *
        </label>
        <input
          type="text"
          value={event.location?.name || ''}
          onChange={(e) => updateLocation({ name: e.target.value })}
          placeholder="e.g., City Park Field #3"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Street Address
        </label>
        <input
          type="text"
          value={event.location?.address || ''}
          onChange={(e) => updateLocation({ address: e.target.value })}
          placeholder="123 Main Street"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            City
          </label>
          <input
            type="text"
            value={event.location?.city || ''}
            onChange={(e) => updateLocation({ city: e.target.value })}
            placeholder="City"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            State
          </label>
          <select
            value={event.location?.state || ''}
            onChange={(e) => updateLocation({ state: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select...</option>
            {US_STATES.map(state => (
              <option key={state.code} value={state.code}>{state.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ZIP Code
          </label>
          <input
            type="text"
            value={event.location?.zip || ''}
            onChange={(e) => updateLocation({ zip: e.target.value })}
            placeholder="12345"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Google Maps Link (optional)
        </label>
        <input
          type="url"
          value={event.location?.mapUrl || ''}
          onChange={(e) => updateLocation({ mapUrl: e.target.value })}
          placeholder="https://maps.google.com/..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
};

// Step 4: Pricing
const StepPricing: React.FC<{
  event: Partial<NewEvent>;
  pricingTiers: Partial<PricingTier>[];
  addPricingTier: () => void;
  updatePricingTier: (index: number, updates: Partial<PricingTier>) => void;
  removePricingTier: (index: number) => void;
}> = ({ event, pricingTiers, addPricingTier, updatePricingTier, removePricingTier }) => {
  if (event.type !== 'registration') {
    return (
      <div className="text-center py-8">
        <Info className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Pricing Needed
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Pricing is only required for registration events. You can skip this step.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Pricing Tiers
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create different pricing options (e.g., Early Bird, Regular, Late)
          </p>
        </div>
        <button
          onClick={addPricingTier}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Tier
        </button>
      </div>
      
      <div className="space-y-4">
        {pricingTiers.map((tier, index) => (
          <div 
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-start justify-between mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Tier {index + 1}
              </h4>
              {pricingTiers.length > 1 && (
                <button
                  onClick={() => removePricingTier(index)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tier Name *
                </label>
                <input
                  type="text"
                  value={tier.name || ''}
                  onChange={(e) => updatePricingTier(index, { name: e.target.value })}
                  placeholder="e.g., Early Bird"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={(tier.price || 0) / 100}
                  onChange={(e) => updatePricingTier(index, { price: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={tier.description || ''}
                onChange={(e) => updatePricingTier(index, { description: e.target.value })}
                placeholder="e.g., Register before Jan 1st to save!"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Step 5: Options
const StepOptions: React.FC<{
  event: Partial<NewEvent>;
  updateEvent: (updates: Partial<NewEvent>) => void;
  addIncludedItem: () => void;
  updateIncludedItem: (index: number, value: string) => void;
  removeIncludedItem: (index: number) => void;
}> = ({ event, updateEvent, addIncludedItem, updateIncludedItem, removeIncludedItem }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Additional Options
      </h3>
      
      {/* Capacity */}
      {event.type === 'registration' && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Maximum Roster Size
            </label>
            <input
              type="number"
              min="0"
              value={event.maxCapacity || ''}
              onChange={(e) => updateEvent({ maxCapacity: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="Leave empty for unlimited"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={event.waitlistEnabled || false}
              onChange={(e) => updateEvent({ waitlistEnabled: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Enable waitlist when full
            </span>
          </label>
          
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={event.allowInPersonPayment || false}
              onChange={(e) => updateEvent({ allowInPersonPayment: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Allow "Pay in Person" option
            </span>
          </label>
          
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={event.allowPaymentPlan || false}
              onChange={(e) => updateEvent({ allowPaymentPlan: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Allow "Pay As You Go" payment plans
            </span>
          </label>
          
          {event.allowPaymentPlan && (
            <div className="ml-8 mt-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">
                Minimum Initial Payment
              </label>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 dark:text-purple-400">$</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={((event.paymentPlanMinDownPayment || 100) / 100).toFixed(2)}
                  onChange={(e) => updateEvent({ 
                    paymentPlanMinDownPayment: Math.max(100, Math.round(parseFloat(e.target.value || '1') * 100))
                  })}
                  className="w-24 px-3 py-1.5 border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-sm text-purple-600 dark:text-purple-400">minimum</span>
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                Parents can pay any amount ≥ this when starting a payment plan. Balance due before season ends.
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* What's included */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            What's Included
          </label>
          <button
            onClick={addIncludedItem}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
        
        <div className="space-y-2">
          {(event.includedItems || []).map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => updateIncludedItem(index, e.target.value)}
                placeholder="e.g., Jersey, Photos, etc."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => removeIncludedItem(index)}
                className="p-2 text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          {(!event.includedItems || event.includedItems.length === 0) && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No items added yet. Click "Add Item" to list what's included.
            </p>
          )}
        </div>
      </div>
      
      {/* Visibility */}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={event.isPublic !== false}
          onChange={(e) => updateEvent({ isPublic: e.target.checked })}
          className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-gray-700 dark:text-gray-300">
          Show on public team profile
        </span>
      </label>
    </div>
  );
};

// Step 6: Review
const StepReview: React.FC<{
  event: Partial<NewEvent>;
  pricingTiers: Partial<PricingTier>[];
  teamName?: string;
}> = ({ event, pricingTiers, teamName }) => {
  const formatPrice = (cents: number): string => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Review Your Event
      </h3>
      
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Team</p>
          <p className="font-medium text-gray-900 dark:text-white">{teamName || 'Your Team'}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Event Type</p>
          <p className="font-medium text-gray-900 dark:text-white capitalize">{event.type}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Title</p>
          <p className="font-medium text-gray-900 dark:text-white">{event.title}</p>
        </div>
        
        {event.description && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
            <p className="text-gray-900 dark:text-white">{event.description}</p>
          </div>
        )}
        
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
          <p className="font-medium text-gray-900 dark:text-white">{event.location?.name}</p>
          {event.location?.city && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {[event.location.city, event.location.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        
        {event.type === 'registration' && pricingTiers.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pricing</p>
            <ul className="mt-1 space-y-1">
              {pricingTiers.map((tier, index) => (
                <li key={index} className="text-gray-900 dark:text-white">
                  {tier.name}: {formatPrice(tier.price || 0)}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {event.maxCapacity && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Capacity</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {event.maxCapacity} spots {event.waitlistEnabled && '(waitlist enabled)'}
            </p>
          </div>
        )}
        
        {event.includedItems && event.includedItems.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Includes</p>
            <p className="text-gray-900 dark:text-white">
              {event.includedItems.filter(Boolean).join(', ')}
            </p>
          </div>
        )}
      </div>
      
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800 dark:text-yellow-300">
          <p className="font-medium">Ready to publish?</p>
          <p>You can save as draft to continue editing later, or publish now to make it live.</p>
        </div>
      </div>
    </div>
  );
};

export default EventCreator;
