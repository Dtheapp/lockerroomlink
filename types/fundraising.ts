// Fundraising Types
// ==================
// Zero-fee fundraising for teams and athletes
// Donations go direct to PayPal - we take nothing

export type CampaignType = 'team' | 'athlete';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
export type CampaignCategory = 
  | 'tournament' 
  | 'equipment' 
  | 'travel' 
  | 'training' 
  | 'uniforms' 
  | 'facility' 
  | 'scholarship'
  | 'nil' 
  | 'other';

// =============================================================================
// CAMPAIGN
// =============================================================================
export interface FundraisingCampaign {
  id: string;
  
  // Type & ownership
  type: CampaignType;
  teamId?: string;           // Required for team campaigns
  athleteId?: string;        // Required for athlete campaigns
  createdBy: string;         // User ID who created
  
  // Basic info
  title: string;
  description: string;
  story: string;             // Longer form story (rich text/markdown)
  category: CampaignCategory;
  
  // Media
  coverImage?: string;       // Main campaign image
  images: string[];          // Additional images
  videoUrl?: string;         // YouTube/Vimeo URL
  
  // Goal & progress
  goalAmount: number;        // Goal in cents
  raisedAmount: number;      // Total raised in cents
  donorCount: number;        // Number of unique donors
  
  // PayPal - Direct payment to recipient
  paypalEmail: string;       // Recipient's PayPal email
  paypalMerchantId?: string; // Optional: For verified business accounts
  
  // Timeline
  startDate: Date;
  endDate?: Date;            // Optional end date
  
  // Status & visibility
  status: CampaignStatus;
  isPublic: boolean;         // Show on public fundraising page
  isFeatured: boolean;       // Featured on homepage
  isVerified: boolean;       // Verified by OSYS team
  
  // Settings
  allowAnonymousDonations: boolean;
  showDonorNames: boolean;
  showDonorAmounts: boolean;
  minimumDonation: number;   // Minimum donation in cents (default: 100 = $1)
  suggestedAmounts: number[]; // Suggested donation amounts in cents
  
  // Optional tip to OSYS
  allowPlatformTip: boolean; // Show "Support OSYS?" option
  
  // Social sharing
  shareMessage?: string;     // Custom share message
  hashtags?: string[];       // Hashtags for social sharing
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Denormalized data for display
  teamName?: string;
  teamLogo?: string;
  athleteName?: string;
  athletePhoto?: string;
  sport?: string;
}

// =============================================================================
// DONATION
// =============================================================================
export interface Donation {
  id: string;
  campaignId: string;
  
  // Donor info
  donorUserId?: string;      // If logged in
  donorName: string;         // Display name
  donorEmail: string;        // For receipt
  isAnonymous: boolean;
  
  // Amount
  amount: number;            // Donation amount in cents
  platformTip: number;       // Optional tip to OSYS in cents
  totalCharged: number;      // Total amount (donation + tip)
  
  // PayPal transaction
  paypalOrderId: string;
  paypalTransactionId: string;
  paypalPayerEmail?: string;
  paypalStatus: 'COMPLETED' | 'PENDING' | 'REFUNDED';
  
  // Message
  message?: string;          // Optional message to campaign owner
  
  // Metadata
  createdAt: Date;
  
  // Denormalized
  campaignTitle: string;
  recipientName: string;
}

// =============================================================================
// CAMPAIGN UPDATE (for progress updates)
// =============================================================================
export interface CampaignUpdate {
  id: string;
  campaignId: string;
  
  title: string;
  content: string;           // Rich text/markdown
  images?: string[];
  
  createdAt: Date;
  createdBy: string;
}

// =============================================================================
// API TYPES
// =============================================================================
export interface CreateCampaignRequest {
  type: CampaignType;
  teamId?: string;
  athleteId?: string;
  title: string;
  description: string;
  story: string;
  category: CampaignCategory;
  goalAmount: number;
  paypalEmail: string;
  coverImage?: string;
  endDate?: Date;
  suggestedAmounts?: number[];
}

export interface CreateDonationRequest {
  campaignId: string;
  amount: number;            // In cents
  platformTip?: number;      // Optional tip in cents
  donorName: string;
  donorEmail: string;
  isAnonymous: boolean;
  message?: string;
}

export interface DonationResult {
  success: boolean;
  donationId?: string;
  paypalOrderId?: string;
  error?: string;
}

// =============================================================================
// DASHBOARD STATS
// =============================================================================
export interface FundraisingStats {
  totalRaised: number;       // All-time in cents
  totalCampaigns: number;
  activeCampaigns: number;
  totalDonors: number;
  averageDonation: number;
  topCampaigns: FundraisingCampaign[];
}

// =============================================================================
// NIL MARKETPLACE TYPES
// =============================================================================

// Athlete's NIL availability settings
export interface NILProfile {
  athleteId: string;
  athleteName: string;
  teamId?: string;
  teamName?: string;
  
  // Availability
  isOpenToDeals: boolean;           // Simple toggle - "Open to NIL Deals"
  availableForTypes: NILDealType[]; // What types they're open to
  
  // Profile info for sponsors
  bio?: string;                     // NIL-specific bio
  socialMediaHandles?: {
    instagram?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  followerCount?: number;           // Total social following
  
  // Preferences
  minimumDealValue?: number;        // Won't consider deals below this (cents)
  preferredContactMethod?: 'app' | 'email' | 'both';
  
  createdAt: Date;
  updatedAt: Date;
}

// Types of NIL deals
export type NILDealType = 'sponsorship' | 'appearance' | 'social_media' | 'merchandise' | 'autograph' | 'shoutout' | 'camp' | 'custom' | 'other';

// Athlete-created marketplace listing (NIL Ask)
export interface NILListing {
  id: string;
  athleteId: string;
  athleteName: string;
  teamId?: string;
  teamName?: string;
  
  // Listing details
  title: string;                    // "Personalized Video Shoutout"
  description: string;              // What they'll do
  dealType: NILDealType;
  
  // Pricing
  price: number;                    // Fixed price in cents
  isPriceNegotiable: boolean;       // Can buyers make offers?
  
  // Availability
  isActive: boolean;
  maxQuantity?: number;             // Limit how many they'll do (null = unlimited)
  quantitySold: number;             // How many purchased
  
  // Delivery
  deliveryTimeframe?: string;       // "Within 3 days"
  requirements?: string[];          // What buyer needs to provide
  
  // Media
  sampleImageUrl?: string;          // Example of what they provide
  
  createdAt: Date;
  updatedAt: Date;
}

// Purchase of a NIL listing (fan buying athlete's offer)
export interface NILPurchase {
  id: string;
  listingId: string;
  listingTitle: string;
  
  // Parties
  athleteId: string;
  athleteName: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  
  // Transaction
  amount: number;                   // Amount paid in cents
  platformFee: number;              // OSYS fee in cents (if any)
  athletePayout: number;            // What athlete receives
  
  // Details from buyer
  buyerNotes?: string;              // Special instructions
  recipientName?: string;           // For shoutouts - who it's for
  
  // Status
  status: 'pending_payment' | 'paid' | 'in_progress' | 'delivered' | 'completed' | 'disputed' | 'refunded' | 'cancelled';
  
  // Delivery
  deliveredAt?: Date;
  deliveryProofUrl?: string;        // URL to delivered content
  buyerRating?: number;             // 1-5 stars
  buyerReview?: string;
  
  // Payment
  paypalOrderId?: string;
  paypalTransactionId?: string;
  paidAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// Fan/Sponsor offer to athlete (NIL Offer)
export interface NILOffer {
  id: string;
  
  // Parties
  athleteId: string;
  athleteName: string;
  teamId?: string;
  sponsorId: string;                // User ID of person making offer
  sponsorName: string;
  sponsorEmail: string;
  sponsorCompany?: string;          // Business name if applicable
  
  // Offer details
  dealType: NILDealType;
  title: string;                    // Brief summary
  description: string;              // Full details
  requirements?: string[];          // What athlete would need to do
  
  // Value
  offeredAmount: number;            // Amount offered in cents
  isNegotiable: boolean;
  
  // Timeline
  proposedStartDate?: Date;
  proposedEndDate?: Date;
  
  // Status
  status: 'pending' | 'accepted' | 'declined' | 'negotiating' | 'expired' | 'completed' | 'cancelled';
  athleteResponse?: string;         // Athlete's message when accepting/declining
  counterOfferAmount?: number;      // If athlete counters
  
  // For "record completed deal" - deals done in person
  isRecordedDeal: boolean;          // True if this is just recording a done deal
  completedDate?: Date;             // When the IRL deal happened
  
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// NIL TRACKING (for athlete earnings)
// =============================================================================
export interface NILDeal {
  id: string;
  athleteId: string;
  athleteName?: string;
  teamId?: string;
  teamName?: string;
  
  // Source - where did this deal come from?
  source: 'listing' | 'offer' | 'recorded' | 'legacy';
  sourceId?: string;                // ID of listing, offer, or purchase
  
  // Sponsor info (user who proposes the deal)
  sponsorId?: string;               // User ID of the sponsor (required for new deals)
  sponsorName: string;
  sponsorContact?: string;
  sponsorEmail?: string;
  sponsorLogo?: string;
  sponsorCompany?: string;          // Business/organization name
  dealType: NILDealType;
  description: string;
  requirements?: string[];          // What the athlete needs to do
  deliverables?: string;            // Proof of completion
  
  // Value
  amount: number;                   // Deal amount in cents
  paymentSchedule?: 'one_time' | 'monthly' | 'per_event' | 'custom';
  
  // Timeline
  startDate: Date;
  endDate?: Date;
  completedAt?: Date;
  paidAt?: Date;
  
  // Status
  status: 'pending' | 'active' | 'completed' | 'paid' | 'declined' | 'cancelled';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface NILPayment {
  id: string;
  dealId: string;
  athleteId: string;
  
  amount: number;            // In cents
  date: Date;
  description: string;
  
  // Proof
  proofUrl?: string;         // Screenshot/document
  
  createdAt: Date;
}

export interface NILWallet {
  id?: string;
  athleteId: string;
  athleteName?: string;
  
  // Totals
  totalEarnings: number;     // All-time in cents
  pendingBalance: number;    // Pending payouts
  availableBalance: number;  // Ready for payout
  thisYearEarnings?: number; // Current year
  thisMonthEarnings?: number;// Current month
  
  // Deals
  activeDeals?: number;
  completedDeals?: number;
  lifetimeDeals: number;     // Total deals ever
  
  // PayPal
  paypalEmail?: string;
  
  // Verification
  isVerified?: boolean;
  
  // Parent/Guardian (for minors)
  parentGuardianName?: string;
  parentGuardianEmail?: string;
  
  // Recent activity
  recentPayments?: NILPayment[];
  
  createdAt?: Date;
  updatedAt: Date;
}
