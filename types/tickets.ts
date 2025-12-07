// Digital Ticket System Types
// ===========================

import { Timestamp } from 'firebase/firestore';

// =============================================================================
// TICKET CONFIGURATION (Set by coach for each event)
// =============================================================================

export interface TicketConfig {
  id: string;
  teamId: string;
  eventId: string;                     // Links to existing event
  
  // Ticket details
  enabled: boolean;                    // Ticket sales on/off
  price: number;                       // In cents (1500 = $15.00)
  currency: 'USD';
  
  // Capacity
  totalCapacity: number;               // Total tickets available
  soldCount: number;                   // How many sold
  reservedCount: number;               // Reserved for team/sponsors
  
  // Sales window
  salesStartDate: Timestamp;           // When sales open
  salesEndDate: Timestamp;             // When sales close
  
  // Options
  allowMultiple: boolean;              // Can one person buy multiple?
  maxPerOrder: number;                 // Max tickets per order (default 10)
  
  // Seating (optional)
  hasSeating: boolean;                 // General admission vs assigned seating
  seatMap?: string;                    // URL to seat map image
  
  // Display
  showRemainingCount: boolean;         // Show "X tickets left"
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// =============================================================================
// TICKET TIERS (Optional - for different ticket types)
// =============================================================================

export interface TicketTier {
  id: string;
  ticketConfigId: string;
  
  name: string;                        // "General Admission", "VIP", "Student"
  description?: string;
  price: number;                       // In cents
  
  totalCapacity: number;
  soldCount: number;
  
  // Restrictions
  requiresProof?: boolean;             // For student tickets, etc.
  
  sortOrder: number;
  isActive: boolean;
}

// =============================================================================
// TICKET ORDER (Purchase transaction)
// =============================================================================

export type TicketOrderStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type TicketPaymentMethod = 'paypal' | 'free';

export interface TicketOrder {
  id: string;
  teamId: string;
  eventId: string;
  ticketConfigId: string;
  
  // Buyer info
  buyerUserId?: string;                // If logged in (optional for fans)
  buyerEmail: string;                  // Required - for email delivery
  buyerName: string;
  buyerPhone?: string;
  
  // Tickets in this order
  tickets: TicketOrderItem[];
  ticketCount: number;
  
  // Payment
  subtotal: number;                    // In cents
  processingFee: number;               // Platform fee (5% + $0.50)
  grandTotal: number;                  // What buyer pays
  
  paymentMethod: TicketPaymentMethod;
  paymentStatus: TicketOrderStatus;
  paypalOrderId?: string;
  paypalTransactionId?: string;
  
  // Timestamps
  createdAt: Timestamp;
  completedAt?: Timestamp;
  
  // Email delivery
  emailSent: boolean;
  emailSentAt?: Timestamp;
}

export interface TicketOrderItem {
  tierId?: string;                     // If using tiers
  tierName?: string;
  quantity: number;
  priceEach: number;                   // In cents
  subtotal: number;                    // quantity * priceEach
}

// =============================================================================
// INDIVIDUAL TICKET (One per entry)
// =============================================================================

export type TicketStatus = 'valid' | 'used' | 'cancelled' | 'expired';

export interface Ticket {
  id: string;
  orderId: string;
  teamId: string;
  eventId: string;
  
  // Ticket details
  ticketNumber: string;                // Human-readable (e.g., "OSYS-1234-ABCD")
  qrCode: string;                      // QR code data (unique hash)
  
  // Owner
  ownerEmail: string;
  ownerName: string;
  
  // Status
  status: TicketStatus;
  usedAt?: Timestamp;
  scannedBy?: string;                  // userId of scanner
  
  // Tier info
  tierId?: string;
  tierName?: string;
  price: number;                       // In cents
  
  // Wallet pass URLs
  appleWalletUrl?: string;             // .pkpass download URL
  googleWalletUrl?: string;            // Google Pay pass URL
  
  createdAt: Timestamp;
}

// =============================================================================
// TICKET SCAN LOG (For gate management)
// =============================================================================

export interface TicketScan {
  id: string;
  ticketId: string;
  eventId: string;
  teamId: string;
  
  scannedAt: Timestamp;
  scannedBy: string;                   // userId
  scannerName: string;
  
  result: 'valid' | 'already_used' | 'invalid' | 'expired';
  ticketNumber: string;
  ownerName: string;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface CreateTicketOrderRequest {
  teamId: string;
  eventId: string;
  ticketConfigId: string;
  
  buyerEmail: string;
  buyerName: string;
  buyerPhone?: string;
  
  items: {
    tierId?: string;
    tierName?: string;
    quantity: number;
    priceEach: number;
  }[];
  
  subtotal: number;
  processingFee: number;
  grandTotal: number;
}

export interface CreateTicketOrderResponse {
  success: boolean;
  orderId?: string;
  paypalOrderId?: string;
  error?: string;
}

export interface CaptureTicketOrderRequest {
  orderId: string;
  paypalOrderId: string;
}

export interface CaptureTicketOrderResponse {
  success: boolean;
  transactionId?: string;
  tickets?: Ticket[];
  error?: string;
}

export interface SendTicketEmailRequest {
  orderId: string;
  tickets: Ticket[];
  buyerEmail: string;
  buyerName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  teamName: string;
}

export interface ScanTicketRequest {
  qrCode: string;
  eventId: string;
  scannerId: string;
  scannerName: string;
}

export interface ScanTicketResponse {
  success: boolean;
  result: 'valid' | 'already_used' | 'invalid' | 'expired';
  ticket?: Ticket;
  message: string;
}

// =============================================================================
// WALLET PASS TYPES
// =============================================================================

export interface WalletPassData {
  ticketId: string;
  ticketNumber: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  teamName: string;
  teamLogo?: string;
  ownerName: string;
  qrCode: string;
  tierName?: string;
  price: number;
}

// =============================================================================
// REVENUE TRACKING
// =============================================================================

export interface TicketRevenueSummary {
  eventId: string;
  teamId: string;
  
  totalTicketsSold: number;
  totalRevenue: number;                // In cents (gross)
  platformFees: number;                // Our cut (5% + $0.50/ticket)
  netRevenue: number;                  // What team gets
  
  // Breakdown by tier
  tierBreakdown: {
    tierId: string;
    tierName: string;
    soldCount: number;
    revenue: number;
  }[];
}
