# Registration & Events System Specification

> **Version:** 1.0 Draft  
> **Created:** December 6, 2025  
> **Status:** Pending Approval

---

## 📋 Overview

This document outlines the architecture for a two-part feature system:

1. **Events & Fliers** - A flexible system for teams to create events (registrations, game promotions, fundraisers, BBQs, etc.) with shareable, branded digital fliers
2. **Team Registration** - A specialized event type that handles athlete signups with payment processing and automatic roster management

---

## 🏗️ Architecture Decisions

### Payment Provider: PayPal Checkout
- Teams connect their PayPal Business account
- Payments go directly to the team (not through us)
- We receive webhooks for payment confirmation
- Automatic registration status updates on successful payment
- Room to add Stripe as alternative in future

### Account Requirement: Required
- Parents must have an account to register athletes
- Benefits: Athlete profile already exists, can be auto-added to roster, enables push notifications

### Platform Fee: Layered In (Disabled Initially)
- Fee collection capability built in but disabled by default
- Can enable per-team or globally when ready to monetize
- Suggested: 2-3% platform fee on paid registrations

---

## 📊 Data Models

### Update to Existing: `teams` Collection

Add location fields for state-specific waiver generation:

```typescript
// Add to existing team document
interface TeamLocationFields {
  location: {
    address?: string;
    city?: string;
    state: string;                     // REQUIRED - for waiver generation
    zip?: string;
    country: string;                   // Default: "USA"
  };
}
```

### Collection: `events`

```typescript
interface Event {
  id: string;                          // Firestore auto-generated
  teamId: string;                      // Reference to team
  createdBy: string;                   // Coach/admin userId
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Event Details
  type: 'registration' | 'game' | 'fundraiser' | 'social' | 'other';
  title: string;                       // "2025 Spring Soccer Registration"
  description: string;                 // Rich text description
  
  // Dates
  eventStartDate: Timestamp;           // When the event/season starts
  eventEndDate: Timestamp;             // When the event/season ends
  registrationOpenDate: Timestamp;     // When signups open
  registrationCloseDate: Timestamp;    // When signups close
  
  // Location
  location: {
    name: string;                      // "City Park Field #3"
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    mapUrl?: string;                   // Google Maps link
  };
  
  // Capacity (for registration type)
  maxCapacity?: number;                // null = unlimited
  currentCount: number;                // Current registrations
  waitlistEnabled: boolean;
  waitlistCount: number;
  
  // Age Requirements
  ageRequirement?: {
    type: 'under' | 'over' | 'between';  // U12 = under 12, etc.
    minAge?: number;                      // For 'over' or 'between'
    maxAge?: number;                      // For 'under' or 'between'
    asOfDate: Timestamp;                  // Age calculated as of this date (e.g., season start)
  };
  
  // Included Items (what's included in registration)
  includedItems: string[];             // ["Jersey", "Shorts", "Season Photos"]
  
  // Custom Fields (optional info the team wants)
  customFields: CustomField[];
  
  // Flier Settings
  flier: EventFlier;
  
  // Waiver Settings
  waiver: {
    type: 'standard' | 'custom';       // Standard = auto-generated for team's state
    customText?: string;               // If type = 'custom'
    customPdfUrl?: string;             // If they uploaded their own PDF
  };
  
  // Duplication tracking
  duplicatedFrom?: string;             // Original event ID if this was copied
  
  // Status
  status: 'draft' | 'active' | 'paused' | 'closed' | 'cancelled';
  
  // Visibility
  isPublic: boolean;                   // Show on public team profile
  shareableLink: string;               // Short URL for sharing
}

interface CustomField {
  id: string;
  label: string;                       // "Preferred Position"
  type: 'text' | 'select' | 'checkbox' | 'textarea';
  options?: string[];                  // For select type
  required: boolean;
}

interface EventFlier {
  templateId: string;                  // Which template design
  backgroundColor: string;             // Or use team colors
  accentColor: string;
  headerImage?: string;                // Custom header image URL
  showQRCode: boolean;
  qrCodeUrl: string;                   // Generated link
  customMessage?: string;              // Optional extra text block
  generatedImageUrl?: string;          // Cached flier image for sharing
}
```

### Collection: `eventPricing`
Subcollection under each event for fee tiers.

```typescript
interface EventPricingTier {
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
```

### Collection: `promoCodes`

```typescript
interface PromoCode {
  id: string;
  eventId: string;                     // Specific to one event
  teamId: string;                      // For team-level queries
  
  code: string;                        // "EARLYBIRD2025" (uppercase, no spaces)
  
  discountType: 'percentage' | 'fixed' | 'free';
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
```

### Collection: `registrationOrders`
For multi-athlete checkout, groups registrations into a single order.

```typescript
interface RegistrationOrder {
  id: string;                          // Same as orderId in registrations
  eventId: string;
  teamId: string;
  parentUserId: string;
  
  // Athletes in this order
  registrationIds: string[];           // Array of registration IDs
  athleteCount: number;
  
  // Payment totals
  subtotal: number;                    // Sum of all registrations
  totalDiscount: number;               // All promo discounts
  grandTotal: number;                  // Final amount charged
  
  // Payment
  paymentMethod: 'paypal' | 'in_person' | 'free';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paypalOrderId?: string;
  paypalTransactionId?: string;
  paidAt?: Timestamp;
  
  // Timestamps
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

### Collection: `registrations`

```typescript
interface Registration {
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
  athleteSnapshot: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    profileImage?: string;
  };
  
  // Pricing
  pricingTierId: string;
  originalPrice: number;               // In cents
  discountAmount: number;              // From promo code
  finalPrice: number;                  // What they paid
  promoCodeId?: string;                // If used
  promoCodeUsed?: string;              // The actual code string
  
  // Payment
  paymentMethod: 'paypal' | 'in_person' | 'free';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paypalOrderId?: string;              // PayPal order reference
  paypalTransactionId?: string;        // PayPal capture ID
  paidAt?: Timestamp;
  
  // Custom field responses
  customFieldResponses: {
    [fieldId: string]: string | string[] | boolean;
  };
  
  // Emergency contact (required for youth sports)
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  
  // Medical info (optional but common)
  medicalInfo?: {
    allergies?: string;
    medications?: string;
    conditions?: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
  };
  
  // Waiver
  waiverAccepted: boolean;
  waiverAcceptedAt?: Timestamp;
  waiverSignature?: string;            // Typed name as signature
  waiverIpAddress?: string;
  
  // Status flow
  status: 'pending_payment' | 'paid' | 'roster_added' | 'waitlisted' | 'cancelled' | 'refunded';
  
  // Roster integration
  rosterAddedAt?: Timestamp;           // When auto-added to team roster
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: `teamPaymentSettings`

```typescript
interface TeamPaymentSettings {
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
```

---

## 🔄 User Flows

### Flow 1: Coach Creates Registration Event

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Start New Event                                            │
├─────────────────────────────────────────────────────────────────────┤
│ Coach clicks "Create Event" from team dashboard                    │
│ → Select event type: Registration (or Game, Fundraiser, etc.)      │
│ → For Registration type, extra fields appear                       │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Event Details                                              │
├─────────────────────────────────────────────────────────────────────┤
│ • Title: "2025 Spring Soccer Registration"                         │
│ • Description: Rich text about the season                          │
│ • Event dates: Mar 1 - Jun 15, 2025                                │
│ • Registration window: Jan 1 - Feb 28, 2025                        │
│ • Location: City Park Field #3                                     │
│ • Max roster size: 18 players (optional)                           │
│ • Enable waitlist: Yes/No                                          │
│ • What's included: [Jersey] [Shorts] [Photos] [+ Add]              │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Pricing Tiers                                              │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ TIER 1: Early Bird                                             ││
│ │ Price: $75.00                                                  ││
│ │ Available: Jan 1 - Jan 31                                      ││
│ │ Max signups: 10                                                ││
│ └─────────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ TIER 2: Regular                                                ││
│ │ Price: $100.00                                                 ││
│ │ Available: Feb 1 - Feb 28                                      ││
│ │ Max signups: Unlimited                                         ││
│ └─────────────────────────────────────────────────────────────────┘│
│ [+ Add Another Tier]                                               │
│                                                                    │
│ □ Offer "Pay in Person" option (player added manually by coach)   │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Custom Fields (Optional)                                   │
├─────────────────────────────────────────────────────────────────────┤
│ Standard fields always included:                                   │
│ • Athlete info (from profile)                                      │
│ • Emergency contact                                                │
│ • Medical info (optional section)                                  │
│ • Waiver acceptance                                                │
│                                                                    │
│ Add custom fields:                                                 │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ Label: "Preferred Position"                                   │ │
│ │ Type: [Dropdown ▼]                                            │ │
│ │ Options: Goalkeeper, Defender, Midfielder, Forward            │ │
│ │ Required: □                                                   │ │
│ └───────────────────────────────────────────────────────────────┘ │
│ [+ Add Custom Field]                                               │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Payment Setup                                              │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │  💳 PayPal Business Account                                   │ │
│ │                                                               │ │
│ │  Status: ✅ Connected                                         │ │
│ │  Account: teamcoach@email.com                                 │ │
│ │                                                               │ │
│ │  [Disconnect] [Test Connection]                               │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ OR if not connected:                                               │
│                                                                    │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │  💳 Connect PayPal to Accept Payments                         │ │
│ │                                                               │ │
│ │  Connect your PayPal Business account to receive              │ │
│ │  registration payments directly.                              │ │
│ │                                                               │ │
│ │  [Connect PayPal]                                             │ │
│ └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Design Flier                                               │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌────────────────────────────────────────┐│
│ │                     │  │ TEMPLATE                               ││
│ │   [LIVE PREVIEW]    │  │ ○ Classic        ○ Modern              ││
│ │                     │  │ ○ Bold           ○ Minimal             ││
│ │   Shows flier as    │  ├────────────────────────────────────────┤│
│ │   user customizes   │  │ COLORS                                 ││
│ │                     │  │ ● Use team colors                      ││
│ │   Team Logo         │  │ ○ Custom: [█████] [█████]              ││
│ │   Event Title       │  ├────────────────────────────────────────┤│
│ │   Dates             │  │ HEADER IMAGE                           ││
│ │   Location          │  │ [Upload Image] or use default          ││
│ │   Price             │  ├────────────────────────────────────────┤│
│ │   What's Included   │  │ OPTIONS                                ││
│ │   [QR CODE]         │  │ ☑ Show QR Code                         ││
│ │   Custom Message    │  │ ☑ Show pricing                         ││
│ │                     │  │ ☑ Show "What's Included"               ││
│ │                     │  ├────────────────────────────────────────┤│
│ └─────────────────────┘  │ CUSTOM MESSAGE                         ││
│                          │ [                                    ] ││
│                          │ "Join our championship team!"          ││
│                          └────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: Review & Publish                                           │
├─────────────────────────────────────────────────────────────────────┤
│ Review all settings                                                │
│                                                                    │
│ [Save as Draft]    [Publish Now]    [Schedule Publish]             │
│                                                                    │
│ After publish:                                                     │
│ • Shareable link generated: lrl.app/r/abc123                       │
│ • QR code ready for flier                                          │
│ • Flier image downloadable (PNG/PDF)                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Parent Registers Athlete(s)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ENTRY POINT                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Parent scans QR code or clicks link from flier                     │
│ → lrl.app/r/abc123                                                 │
│                                                                    │
│ If not logged in → Redirect to login/signup with return URL        │
│ If logged in → Continue to registration                            │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Event Overview                                             │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │  🏈 Wildcats Football                                          ││
│ │                                                                 ││
│ │  2025 SPRING REGISTRATION                                       ││
│ │                                                                 ││
│ │  📅 Season: March 1 - June 15, 2025                            ││
│ │  📍 City Park Field #3                                         ││
│ │  💰 Starting at $75                                            ││
│ │  👶 Ages: Under 12 (as of Mar 1, 2025)                         ││  ← Age requirement shown
│ │                                                                 ││
│ │  ✓ Jersey included                                             ││
│ │  ✓ Shorts included                                             ││
│ │  ✓ Season photos                                               ││
│ │                                                                 ││
│ │  Spots remaining: 12 of 18                                     ││
│ │                                                                 ││
│ │  [Register Now]                                                ││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Select Athlete(s) - MULTI-SELECT CART                      │
├─────────────────────────────────────────────────────────────────────┤
│ "Select athletes to register"                                      │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ ☑ Tommy Smith (Age 10)                                         ││
│ │   ✓ Meets age requirement (Under 12)                           ││
│ │   Select tier: [Early Bird - $75 ▼]                            ││
│ └──────────────────────────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ ☑ Jimmy Smith (Age 8)                                          ││
│ │   ✓ Meets age requirement (Under 12)                           ││
│ │   Select tier: [Early Bird - $75 ▼]                            ││
│ └──────────────────────────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ ☐ Sarah Smith (Age 14)                                         ││
│ │   ⚠️ Does not meet age requirement (must be Under 12)          ││  ← Cannot select
│ └──────────────────────────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ ☐ Mike Smith (Age 11)                                          ││
│ │   ℹ️ Already registered for this event                         ││  ← Cannot select
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ [+ Add New Athlete]                                                │
│                                                                    │
│ ────────────────────────────────────────────────────────────────── │
│ 🛒 CART SUMMARY                                                    │
│ • Tommy Smith - Early Bird: $75.00                                 │
│ • Jimmy Smith - Early Bird: $75.00                                 │
│                                                                    │
│ Have a promo code? [Enter code] [Apply]                            │
│ ✅ Code "SIBLING" applied: -$25.00 (second child discount)         │
│                                                                    │
│ Subtotal:        $150.00                                           │
│ Discount:        -$25.00                                           │
│ Total:           $125.00                                           │
│                                                                    │
│ [Continue to Forms →]                                              │
│                                                                    │
│ ─── OR ───                                                         │
│                                                                    │
│ □ I will pay in person (cash/check to coach)                       │
│   Note: Registration is not confirmed until payment received       │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Additional Information (PER ATHLETE)                       │
├─────────────────────────────────────────────────────────────────────┤
│ Progress: ███████░░░ Athlete 1 of 2 - Tommy Smith                  │
│                                                                    │
│ EMERGENCY CONTACT *                                                │
│ ☑ Same as my contact info                    ← Pre-fill option     │
│ Name:         [John Smith                    ]                     │
│ Relationship: [Father          ▼]                                  │
│ Phone:        [(555) 123-4567                ]                     │
│ Email:        [john@email.com                ]                     │
│                                                                    │
│ MEDICAL INFORMATION (Optional)                                     │
│ [Expand to fill]                                                   │
│                                                                    │
│ ADDITIONAL QUESTIONS                                               │
│ Preferred Position: [Midfielder ▼]                                 │
│ T-Shirt Size:       [Youth Large ▼]                                │
│                                                                    │
│ [← Back]                           [Next Athlete →]                │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
                    (Repeat for each athlete)
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Waiver & Agreement                                         │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ PARTICIPATION WAIVER - State of California                     ││  ← Auto for team's state
│ │                                                                 ││
│ │ I, the undersigned parent/guardian, hereby give permission     ││
│ │ for my child(ren) to participate in the Wildcats Football      ││
│ │ program. I understand that participation involves physical     ││
│ │ activity and inherent risks...                                 ││
│ │                                                                 ││
│ │ [Read full waiver]                                             ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ Registering: Tommy Smith, Jimmy Smith                              │
│                                                                    │
│ ☑ I have read and agree to the participation waiver               │
│ ☑ I confirm all information provided is accurate                  │
│ ☑ I am the legal parent/guardian of the athlete(s) listed        │
│                                                                    │
│ Electronic Signature: [John Smith            ]                     │
│ Date: December 6, 2025                                             │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5A: Payment (Online)                                          │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │  ORDER SUMMARY                                                 ││
│ │                                                                 ││
│ │  Wildcats Football - Spring 2025                               ││
│ │                                                                 ││
│ │  ┌───────────────────────────────────────────────────────────┐ ││
│ │  │ Tommy Smith - Early Bird              $75.00              │ ││
│ │  │ Jimmy Smith - Early Bird              $75.00              │ ││
│ │  │ Sibling Discount                     -$25.00              │ ││
│ │  └───────────────────────────────────────────────────────────┘ ││
│ │                                                                 ││
│ │  Subtotal:     $150.00                                         ││
│ │  Discount:     -$25.00                                         ││
│ │  ─────────────────────                                         ││
│ │  Total:        $125.00                                         ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │         [PayPal Checkout Button]                               ││
│ │                                                                 ││
│ │  Pay with PayPal or Debit/Credit Card                          ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ → PayPal popup/redirect opens                                      │
│ → Parent completes payment                                         │
│ → Returns to app with confirmation                                 │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5B: Payment (In Person) - Alternative Flow                    │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │  ⏳ REGISTRATION PENDING                                       ││
│ │                                                                 ││
│ │  Your registration has been submitted for:                     ││
│ │  • Tommy Smith                                                 ││
│ │  • Jimmy Smith                                                 ││
│ │                                                                 ││
│ │  Amount Due: $125.00                                           ││
│ │  Payment Method: In Person                                     ││
│ │                                                                 ││
│ │  Please contact the coach to arrange payment.                  ││
│ │  Your spots are NOT guaranteed until payment is received.      ││
│ │                                                                 ││
│ │  Coach Contact: coach@team.com                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ Note: Athletes will NOT be auto-added to roster.                   │
│ Coach must manually add after receiving payment.                   │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Confirmation (Online Payment)                              │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │  ✅ REGISTRATION COMPLETE!                                     ││
│ │                                                                 ││
│ │  Successfully registered for                                   ││
│ │  Wildcats Football - Spring 2025:                              ││
│ │                                                                 ││
│ │  ✓ Tommy Smith - Added to roster                               ││
│ │  ✓ Jimmy Smith - Added to roster                               ││
│ │                                                                 ││
│ │  Confirmation #: ORD-2025-ABC123                               ││
│ │  Amount Paid: $125.00                                          ││
│ │  Payment ID: PAYPAL-XYZ789                                     ││
│ │                                                                 ││
│ │  📧 A confirmation email has been sent to your email.          ││
│ │                                                                 ││
│ │  [View Team Page]  [Download Receipt]                          ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ → Push notification sent to coach                                  │
│ → All athletes auto-added to team roster                           │
│ → Registration count incremented                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Coach Manages Registrations

```
┌─────────────────────────────────────────────────────────────────────┐
│ REGISTRATION DASHBOARD                                             │
├─────────────────────────────────────────────────────────────────────┤
│ 2025 Spring Registration                                           │
│ Status: Active • 14/18 spots filled • 2 waitlisted                 │
│                                                                    │
│ [Edit Event] [Pause] [Duplicate Event] [Download Roster] [Flier]   │
│                                                                    │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ FILTERS: [All ▼] [Paid ▼] [Search...]                         ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ NAME           │ STATUS      │ TIER       │ AMOUNT   │ DATE    ││
│ ├─────────────────────────────────────────────────────────────────┤│
│ │ Tommy Smith    │ ✅ Paid     │ Early Bird │ $50.00   │ Dec 6   ││
│ │ Jimmy Smith    │ ✅ Paid     │ Early Bird │ $50.00   │ Dec 6   ││
│ │ Sarah Jones    │ ✅ Paid     │ Regular    │ $100.00  │ Dec 5   ││
│ │ Mike Wilson    │ ⏳ Pending  │ Early Bird │ $75.00   │ Dec 6   ││
│ │ Lisa Brown     │ 📋 Waitlist │ Regular    │ --       │ Dec 4   ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ Click row to view details, mark as refunded, or remove             │
│                                                                    │
│ ─────────────────────────────────────────────────────────────────  │
│                                                                    │
│ REVENUE SUMMARY                                                    │
│ Total Collected: $1,250.00                                         │
│ Pending (In Person): $150.00                                       │
│ Refunded: $0.00                                                    │
│                                                                    │
│ [+ Add Player Manually]  ← For cash payments or special cases      │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 4: Duplicate Event (Copy from Last Season)

```
┌─────────────────────────────────────────────────────────────────────┐
│ DUPLICATE EVENT                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ Create a copy of "2024 Fall Registration"                          │
│                                                                    │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ What to copy:                                                  ││
│ │                                                                 ││
│ │ ☑ Event details (title, description, location)                 ││
│ │ ☑ Pricing tiers                                                ││
│ │ ☑ Custom form fields                                           ││
│ │ ☑ Included items                                               ││
│ │ ☑ Waiver settings                                              ││
│ │ ☑ Flier design                                                 ││
│ │ ☐ Promo codes (expired codes will be skipped)                  ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│ New Event Title: [2025 Spring Registration        ]                │
│                                                                    │
│ ⚠️ You'll need to update dates after duplicating                  │
│                                                                    │
│ [Cancel]                              [Create Duplicate]           │
└─────────────────────────────────────────────────────────────────────┘

After duplicate:
→ Opens event editor with all fields pre-filled
→ Coach updates dates, prices as needed
→ Saves as new event (original unchanged)
```

---

## 🎨 Flier Templates

### Template System

Rather than a full drag-drop editor, we use **smart templates** that auto-populate with event data.

```typescript
interface FlierTemplate {
  id: string;
  name: string;                        // "Classic", "Modern", "Bold", "Minimal"
  previewImage: string;                // Preview thumbnail
  
  // Layout configuration
  layout: {
    headerStyle: 'banner' | 'centered' | 'split';
    bodyStyle: 'cards' | 'list' | 'minimal';
    footerStyle: 'qr-center' | 'qr-corner' | 'no-qr';
  };
  
  // What sections to show
  sections: {
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
```

### Initial Templates (4 to start)

1. **Classic** - Traditional sports flier look, bold header, clear sections
2. **Modern** - Clean, minimal design with lots of whitespace
3. **Bold** - High contrast, attention-grabbing, great for printing
4. **Minimal** - Simple and elegant, focuses on key info

### Flier Generation

- Fliers are generated as **HTML → Canvas → Image**
- Use `html2canvas` or similar library
- Generate on-demand when user clicks "Download" or "Share"
- Cache generated image URL in Firestore for quick sharing

---

## 🔔 Notifications

### Push Notifications (via Firebase Cloud Messaging)

| Event | Who Receives | Message |
|-------|--------------|---------|
| New registration | Coach | "New registration: Tommy Smith signed up for Spring 2025" |
| Payment received | Coach | "Payment received: $75.00 from John Smith for Tommy's registration" |
| Registration confirmed | Parent | "✅ Tommy is registered for Wildcats Football!" |
| Waitlist spot available | Parent | "A spot opened up! Complete your registration for Tommy" |
| Registration closing soon | Parents (not registered) | "Last chance! Registration closes in 24 hours" |

### Email Notifications

- Registration confirmation with receipt
- Waitlist updates
- Event reminders (optional)

---

## 🔐 Permissions

| Action | Parent | Coach | Team Admin | App Admin |
|--------|--------|-------|------------|-----------|
| View public events | ✅ | ✅ | ✅ | ✅ |
| Register athlete | ✅ (own athletes) | ❌ | ❌ | ❌ |
| Create event | ❌ | ✅ | ✅ | ✅ |
| Edit event | ❌ | ✅ (own team) | ✅ (own team) | ✅ |
| View registrations | ❌ | ✅ (own team) | ✅ (own team) | ✅ |
| Process refunds | ❌ | ✅ | ✅ | ✅ |
| Add player manually | ❌ | ✅ | ✅ | ✅ |
| Create promo codes | ❌ | ✅ | ✅ | ✅ |
| Connect PayPal | ❌ | ✅ | ✅ | ✅ |

---

## 🛠️ Technical Implementation

### New Files to Create

```
components/
  events/
    EventCreator.tsx           # Multi-step event creation wizard
    EventList.tsx              # List of team's events
    EventCard.tsx              # Event preview card
    EventDetails.tsx           # Public event detail page
    EventManagement.tsx        # Coach dashboard for managing event
    DuplicateEventModal.tsx    # Copy from previous event
    
    registration/
      RegistrationFlow.tsx     # Multi-step parent registration
      AthleteSelector.tsx      # Multi-select athletes with age validation
      RegistrationCart.tsx     # Cart summary with promo codes
      RegistrationForm.tsx     # Emergency contact, custom fields (per athlete)
      WaiverAcceptance.tsx     # State-specific waiver display and signature
      PaymentStep.tsx          # PayPal checkout integration
      RegistrationConfirm.tsx  # Success page
      RegistrationList.tsx     # Coach view of all registrations
      ManualAddPlayer.tsx      # Coach manually adds player (cash payment)
      
    fliers/
      FlierEditor.tsx          # Template selection + customization
      FlierPreview.tsx         # Live preview component
      FlierTemplates.tsx       # Template definitions
      FlierDownload.tsx        # Generate and download flier
      
    pricing/
      PricingTierEditor.tsx    # Add/edit pricing tiers
      PromoCodeManager.tsx     # Create/manage promo codes
      
    waivers/
      WaiverTemplates.ts       # State-specific waiver text templates
      WaiverCustomizer.tsx     # Advanced: custom waiver editor

services/
  paypal.ts                    # PayPal API integration
  flierGenerator.ts            # HTML to image generation
  waiverService.ts             # Generate state-appropriate waivers
  ageValidator.ts              # Validate athlete age against requirements
  
netlify/functions/
  paypal-webhook.ts            # Handle PayPal payment webhooks
  create-paypal-order.ts       # Create PayPal order
  capture-paypal-order.ts      # Capture payment after approval

types/
  events.ts                    # All event/registration TypeScript interfaces
```

### PayPal Integration Steps

1. **Setup** (one-time by team)
   - Coach clicks "Connect PayPal"
   - OAuth flow to link their PayPal Business account
   - Store `merchantId` in `teamPaymentSettings`

2. **Create Order** (when parent checks out)
   - Call Netlify function `create-paypal-order`
   - Pass: amount, eventId, registrationId, team's merchantId
   - Returns: PayPal order ID

3. **Capture Payment** (after parent approves)
   - PayPal redirects back with approval
   - Call `capture-paypal-order` to finalize
   - On success: update registration status, add to roster

4. **Webhooks** (backup confirmation)
   - PayPal sends webhook on payment events
   - `paypal-webhook` function verifies and updates status

---

## 📱 UI Locations

### Where features appear in the app:

**For Coaches:**
- New "Events" tab in team dashboard
- "Create Event" button prominently displayed
- Registration management in event detail view
- PayPal connection in team settings

**For Parents:**
- "Open Registrations" section on public team profile
- Direct access via shareable links
- "My Registrations" in parent profile
- Registration history and receipts

**For Public (no account):**
- Can VIEW event fliers and details
- Must sign in/up to register

---

## 📅 Implementation Phases

### Phase 1A: Core Events System (Week 1-2)
- [ ] Events data model and Firestore rules
- [ ] Event creation wizard (basic)
- [ ] Event listing and detail pages
- [ ] Public event viewing

### Phase 1B: Registration Flow (Week 2-3)
- [ ] Registration data model
- [ ] Parent registration flow (no payment)
- [ ] Athlete selection from profile
- [ ] Emergency contact and custom fields
- [ ] Waiver acceptance
- [ ] "Pay in Person" option
- [ ] Manual player add by coach

### Phase 1C: Payments (Week 3-4)
- [ ] PayPal Business account connection
- [ ] PayPal checkout integration
- [ ] Payment webhooks
- [ ] Auto-add to roster on payment
- [ ] Basic receipt generation

### Phase 1D: Fliers (Week 4-5)
- [ ] Template system (2-3 templates)
- [ ] Flier customization UI
- [ ] Image generation
- [ ] Download and share functionality
- [ ] QR code generation

### Phase 2: Polish & Extras (Week 5-6)
- [ ] Pricing tiers with date windows
- [ ] Promo codes
- [ ] Waitlist functionality
- [ ] Push notifications
- [ ] Email confirmations
- [ ] Coach dashboard improvements
- [ ] Mobile optimization

---

## ✅ Approval Checklist

Before building, please confirm:

- [ ] Data models look correct
- [ ] User flows make sense
- [ ] Payment approach is acceptable
- [ ] Flier system scope is appropriate
- [ ] Permissions are correct
- [ ] Phase breakdown is reasonable

---

## ✅ Decisions Made

1. **Waiver text** - Standard template by default (auto-generated based on team's state location), with "Advanced" option to write custom or upload their own. **Requires teams to set their location** - add to team settings.

2. **Refunds** - Handle externally via PayPal. No in-app refund processing needed. Just update registration status if coach marks as refunded.

3. **Multiple athletes** - YES, allow registering multiple athletes in one checkout (cart-style). Better UX for families with multiple kids.

4. **Age verification** - YES, validate athlete's birthday against event age requirements (e.g., U12 must be under 12). Show requirement clearly on form.

5. **Recurring events** - YES, "Duplicate Event" / "Copy from Last Season" feature for easy year-over-year setup.

---

## 💡 UX Principles (Applied Throughout)

*"Always think about the user experience"*

- **Reduce friction** - Pre-fill everything possible from existing data
- **Be forgiving** - Allow corrections, don't punish mistakes
- **Show progress** - Multi-step wizards with clear progress indicators
- **Confirm success** - Clear confirmation screens with next steps
- **Mobile first** - All flows must work perfectly on phones (coaches at practice, parents on the go)
- **Smart defaults** - Most teams want the same things, make those the default
- **Progressive disclosure** - Show simple first, reveal advanced options only when needed

---

*Spec approved - ready to build Phase 1A!*
