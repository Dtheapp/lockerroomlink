// Event & Registration System Types
// ================================

import { Timestamp } from 'firebase/firestore';

// =============================================================================
// TEAM LOCATION (added to existing team model)
// =============================================================================

export interface TeamLocation {
  address?: string;
  city?: string;
  state: string;                       // Required for waiver generation
  zip?: string;
  country: string;                     // Default: "USA"
}

// =============================================================================
// EVENTS
// =============================================================================

export type EventType = 'registration' | 'game' | 'fundraiser' | 'social' | 'other';
export type EventStatus = 'draft' | 'active' | 'paused' | 'closed' | 'cancelled';

export interface EventLocation {
  name: string;                        // "City Park Field #3"
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  mapUrl?: string;                     // Google Maps link
}

export interface AgeRequirement {
  type: 'under' | 'over' | 'between';  // U12 = under 12, etc.
  minAge?: number;                     // For 'over' or 'between'
  maxAge?: number;                     // For 'under' or 'between'
  asOfDate: Timestamp;                 // Age calculated as of this date
}

export interface CustomField {
  id: string;
  label: string;                       // "Preferred Position"
  type: 'text' | 'select' | 'checkbox' | 'textarea';
  options?: string[];                  // For select type
  required: boolean;
}

export interface EventFlier {
  templateId: string;                  // Which template design
  backgroundColor: string;             // Or use team colors
  accentColor: string;
  headerImage?: string;                // Custom header image URL
  showQRCode: boolean;
  qrCodeUrl: string;                   // Generated link
  customMessage?: string;              // Optional extra text block
  generatedImageUrl?: string;          // Cached flier image for sharing
}

export interface EventWaiver {
  type: 'standard' | 'custom';         // Standard = auto-generated for team's state
  customText?: string;                 // If type = 'custom'
  customPdfUrl?: string;               // If they uploaded their own PDF
}

export interface Event {
  id: string;                          // Firestore auto-generated
  teamId: string;                      // Reference to team
  createdBy: string;                   // Coach/admin userId
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Event Details
  type: EventType;
  title: string;                       // "2025 Spring Soccer Registration"
  description: string;                 // Rich text description
  
  // Dates
  eventStartDate: Timestamp;           // When the event/season starts
  eventEndDate: Timestamp;             // When the event/season ends
  registrationOpenDate?: Timestamp;    // When signups open (for registration type)
  registrationCloseDate?: Timestamp;   // When signups close
  
  // Location
  location: EventLocation;
  
  // Capacity (for registration type)
  maxCapacity?: number;                // null = unlimited
  currentCount: number;                // Current registrations
  waitlistEnabled: boolean;
  waitlistCount: number;
  
  // Age Requirements (optional)
  ageRequirement?: AgeRequirement;
  
  // Included Items (what's included in registration)
  includedItems: string[];             // ["Jersey", "Shorts", "Season Photos"]
  
  // Custom Fields (optional info the team wants)
  customFields: CustomField[];
  
  // Flier Settings
  flier: EventFlier;
  
  // Waiver Settings
  waiver: EventWaiver;
  
  // Duplication tracking
  duplicatedFrom?: string;             // Original event ID if this was copied
  
  // Status
  status: EventStatus;
  
  // Visibility
  isPublic: boolean;                   // Show on public team profile
  shareableLink: string;               // Short URL for sharing
  
  // Payment options
  allowInPersonPayment: boolean;       // Allow "pay in person" option
}

// =============================================================================
// PRICING TIERS
// =============================================================================

export interface PricingTier {
  id: string;
  eventId: string;
  
  name: string;                        // "Early Bird", "Regular", "Late"
  description?: string;                // "Register before Jan 1st"
  
  price: number;                       // In cents (5000 = $50.00)
  currency: 'USD';                     // Start with USD only
  
  // Date-based availability
  availableFrom?: Timestamp;           // null = immediately
  availableUntil?: Timestamp;          // null = until registration closes
  
  // Quantity limits
  maxQuantity?: number;                // null = unlimited at this tier
  currentQuantity: number;             // How many have used this tier
  
  // Display order
  sortOrder: number;
  
  isActive: boolean;
}

// =============================================================================
// PROMO CODES
// =============================================================================

export type DiscountType = 'percentage' | 'fixed' | 'free';

export interface PromoCode {
  id: string;
  eventId: string;                     // Specific to one event
  teamId: string;                      // For team-level queries
  
  code: string;                        // "EARLYBIRD2025" (uppercase, no spaces)
  
  discountType: DiscountType;
  discountValue: number;               // 10 = 10% or $10 depending on type
  
  // Usage limits
  maxUses?: number;                    // null = unlimited
  currentUses: number;
  maxUsesPerUser: number;              // Usually 1
  
  // Validity
  validFrom: Timestamp;
  validUntil: Timestamp;
  
  // Restrictions
  applicableTiers?: string[];          // null = all tiers, or specific tier IDs
  
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

// =============================================================================
// REGISTRATION ORDERS (groups multiple athletes in one checkout)
// =============================================================================

export type PaymentMethod = 'paypal' | 'in_person' | 'free';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface RegistrationOrder {
  id: string;                          // Same as orderId in registrations
  eventId: string;
  teamId: string;
  parentUserId: string;
  
  // Athletes in this order
  registrationIds: string[];           // Array of registration IDs
  athleteCount: number;
  
  // Payment totals
  subtotal: number;                    // Sum of all registrations (cents)
  totalDiscount: number;               // All promo discounts (cents)
  grandTotal: number;                  // Final amount charged (cents)
  
  // Payment
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paypalOrderId?: string;
  paypalTransactionId?: string;
  paidAt?: Timestamp;
  
  // Timestamps
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

// =============================================================================
// REGISTRATIONS (individual athlete registration)
// =============================================================================

export type RegistrationStatus = 
  | 'pending_payment' 
  | 'paid' 
  | 'roster_added' 
  | 'waitlisted' 
  | 'cancelled' 
  | 'refunded';

export interface AthleteSnapshot {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  profileImage?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface MedicalInfo {
  allergies?: string;
  medications?: string;
  conditions?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
}

export interface WaiverSignature {
  athleteName: string;
  signedBy: string;                    // Parent's name who signed
  signedAt: Date;
  ipAddress: string;                   // Captured on backend
  waiverVersion: string;               // State code or 'custom'
  waiverText: string;                  // Full waiver text at time of signing
}

export interface Registration {
  id: string;
  eventId: string;
  teamId: string;
  
  // Cart/Order grouping (for multi-athlete checkout)
  orderId: string;                     // Groups multiple athletes in same checkout
  orderIndex: number;                  // 1, 2, 3... position in cart
  
  // Who's registering
  parentUserId: string;                // The parent's account
  athleteId: string;                   // The athlete being registered
  
  // Athlete snapshot (in case profile changes later)
  athleteSnapshot: AthleteSnapshot;
  
  // Pricing
  pricingTierId: string;
  originalPrice: number;               // In cents
  discountAmount: number;              // From promo code
  finalPrice: number;                  // What they paid
  promoCodeId?: string;                // If used
  promoCodeUsed?: string;              // The actual code string
  
  // Payment
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paypalOrderId?: string;              // PayPal order reference
  paypalTransactionId?: string;        // PayPal capture ID
  paidAt?: Timestamp;
  
  // Custom field responses
  customFieldResponses: Record<string, string | string[] | boolean>;
  
  // Emergency contact (required for youth sports)
  emergencyContact: EmergencyContact;
  
  // Medical info (optional but common)
  medicalInfo?: MedicalInfo;
  
  // Waiver
  waiverAccepted: boolean;
  waiverAcceptedAt?: Timestamp;
  waiverSignature?: string;            // Typed name as signature
  waiverIpAddress?: string;
  
  // Status flow
  status: RegistrationStatus;
  
  // Roster integration
  rosterAddedAt?: Timestamp;           // When auto-added to team roster
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================================================
// TEAM PAYMENT SETTINGS
// =============================================================================

export interface TeamPaymentSettings {
  teamId: string;                      // Document ID = teamId
  
  // PayPal Integration
  paypalConnected: boolean;
  paypalMerchantId?: string;           // Their PayPal merchant ID
  paypalEmail?: string;                // Display email (for confirmation)
  paypalConnectedAt?: Timestamp;
  
  // Future: Stripe
  stripeConnected: boolean;
  stripeAccountId?: string;
  
  // Platform fee settings (for future monetization)
  platformFeeEnabled: boolean;         // Default: false
  platformFeePercent: number;          // Default: 0, e.g., 2.5 for 2.5%
  platformFeeFixed: number;            // Fixed fee in cents, e.g., 50 for $0.50
  
  // Notification preferences
  notifyOnRegistration: boolean;       // Email coach on new signup
  notifyOnPayment: boolean;            // Email coach on payment received
  
  updatedAt: Timestamp;
  updatedBy: string;
}

// =============================================================================
// HELPER TYPES FOR UI
// =============================================================================

// For creating new events (without auto-generated fields)
export type NewEvent = Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'currentCount' | 'waitlistCount' | 'shareableLink'>;

// For creating new pricing tiers
export type NewPricingTier = Omit<PricingTier, 'id' | 'currentQuantity'>;

// For creating new promo codes
export type NewPromoCode = Omit<PromoCode, 'id' | 'currentUses' | 'createdAt'>;

// Event with related data (for display)
export interface EventWithDetails extends Event {
  pricingTiers: PricingTier[];
  registrationCount: number;
  teamName?: string;
  teamLogo?: string;
}

// Registration with parent/athlete names (for coach list)
export interface RegistrationWithNames extends Registration {
  parentName: string;
  parentEmail: string;
  athleteName: string;
}

// =============================================================================
// FLIER TEMPLATES
// =============================================================================

export interface FlierTemplate {
  id: string;
  name: string;                        // "Classic", "Modern", "Bold", "Minimal"
  previewImage: string;                // Preview thumbnail
  
  // Layout configuration
  layout: {
    headerStyle: 'banner' | 'centered' | 'split';
    bodyStyle: 'cards' | 'list' | 'minimal';
    footerStyle: 'qr-center' | 'qr-corner' | 'no-qr';
  };
  
  // What sections to show by default
  defaultSections: {
    teamLogo: boolean;
    headerImage: boolean;
    eventTitle: boolean;
    dates: boolean;
    location: boolean;
    pricing: boolean;
    includedItems: boolean;
    qrCode: boolean;
    customMessage: boolean;
  };
  
  // Default colors (can be overridden by team colors)
  defaultColors: {
    background: string;
    accent: string;
    text: string;
  };
}

// =============================================================================
// US STATES (for location dropdown)
// =============================================================================

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
] as const;

export type USStateCode = typeof US_STATES[number]['code'];
