// Events components barrel export
export { default as EventCard } from './EventCard';
export { default as EventList } from './EventList';
export { default as EventDetails } from './EventDetails';
export { default as EventCreator } from './EventCreator';
export { default as EventManagement } from './EventManagement';

// Registration flow components
export { 
  RegistrationFlow,
  AthleteSelector,
  RegistrationCart,
  RegistrationForm,
  WaiverAcceptance,
  PayPalCheckout
} from './registration';
export type { SelectedAthlete, AthleteFormData } from './registration';

// Flier components
export { default as FlierEditor } from './FlierEditor';
export type { FlierData } from './FlierEditor';
export { default as FlierTemplateSelector } from './FlierTemplateSelector';
export type { FlierTemplateOption } from './FlierTemplateSelector';

// Team settings
export { default as TeamPaymentSettings } from './TeamPaymentSettings';

// Re-export types for convenience
export type { 
  Event, 
  EventType, 
  EventStatus,
  PricingTier,
  PromoCode,
  Registration,
  RegistrationOrder,
  EventWithDetails,
  WaiverSignature
} from '../../types/events';
