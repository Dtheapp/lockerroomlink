// Digital Ticket Service
// ======================
// Handles ticket purchases, QR generation, and wallet passes

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  increment,
  Timestamp,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  CreateTicketOrderRequest, 
  CreateTicketOrderResponse,
  CaptureTicketOrderResponse,
  Ticket,
  TicketConfig,
  TicketOrder,
  ScanTicketRequest,
  ScanTicketResponse,
  WalletPassData
} from '../types/tickets';

// =============================================================================
// CONSTANTS
// =============================================================================

const PLATFORM_FEE_PERCENT = 0.05;    // 5%
const PLATFORM_FEE_FIXED = 50;         // $0.50 per ticket in cents
const MAX_TICKETS_PER_ORDER = 10;

// =============================================================================
// TICKET NUMBER GENERATION
// =============================================================================

/**
 * Generate a unique, human-readable ticket number
 * Format: OSYS-XXXX-XXXX
 */
export const generateTicketNumber = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0, O, I, 1)
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `OSYS-${part1}-${part2}`;
};

/**
 * Generate QR code data (unique hash for each ticket)
 */
export const generateQRCode = (ticketId: string, ticketNumber: string): string => {
  // Include ticket ID and a random component for security
  const random = Math.random().toString(36).substring(2, 10);
  return `OSYS:${ticketId}:${ticketNumber}:${random}`;
};

// =============================================================================
// FEE CALCULATIONS
// =============================================================================

/**
 * Calculate platform processing fees
 * 5% + $0.50 per ticket
 */
export const calculateProcessingFee = (subtotal: number, ticketCount: number): number => {
  const percentFee = Math.round(subtotal * PLATFORM_FEE_PERCENT);
  const fixedFee = ticketCount * PLATFORM_FEE_FIXED;
  return percentFee + fixedFee;
};

/**
 * Calculate grand total (subtotal + fees)
 */
export const calculateGrandTotal = (subtotal: number, ticketCount: number): number => {
  return subtotal + calculateProcessingFee(subtotal, ticketCount);
};

// =============================================================================
// TICKET CONFIG OPERATIONS
// =============================================================================

/**
 * Get ticket config for an event
 */
export const getTicketConfig = async (eventId: string): Promise<TicketConfig | null> => {
  try {
    const q = query(
      collection(db, 'ticketConfigs'),
      where('eventId', '==', eventId)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as TicketConfig;
  } catch (error) {
    console.error('Error getting ticket config:', error);
    return null;
  }
};

/**
 * Create or update ticket config for an event
 */
export const saveTicketConfig = async (
  teamId: string,
  eventId: string,
  config: Partial<TicketConfig>,
  userId: string
): Promise<string> => {
  const existing = await getTicketConfig(eventId);
  
  if (existing) {
    // Update existing
    await updateDoc(doc(db, 'ticketConfigs', existing.id), {
      ...config,
      updatedAt: Timestamp.now()
    });
    return existing.id;
  } else {
    // Create new
    const docRef = await addDoc(collection(db, 'ticketConfigs'), {
      teamId,
      eventId,
      enabled: true,
      currency: 'USD',
      soldCount: 0,
      reservedCount: 0,
      allowMultiple: true,
      maxPerOrder: MAX_TICKETS_PER_ORDER,
      hasSeating: false,
      showRemainingCount: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
      ...config
    });
    return docRef.id;
  }
};

// =============================================================================
// ORDER CREATION
// =============================================================================

/**
 * Create a ticket order (before PayPal payment)
 */
export const createTicketOrder = async (
  request: CreateTicketOrderRequest,
  userId?: string
): Promise<CreateTicketOrderResponse> => {
  try {
    // Validate ticket count
    const totalTickets = request.items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalTickets > MAX_TICKETS_PER_ORDER) {
      return { 
        success: false, 
        error: `Maximum ${MAX_TICKETS_PER_ORDER} tickets per order` 
      };
    }

    // Check availability
    const config = await getTicketConfig(request.eventId);
    if (!config) {
      return { success: false, error: 'Tickets not available for this event' };
    }
    
    if (!config.enabled) {
      return { success: false, error: 'Ticket sales are currently closed' };
    }

    const available = config.totalCapacity - config.soldCount - config.reservedCount;
    if (totalTickets > available) {
      return { success: false, error: `Only ${available} tickets remaining` };
    }

    // Create order in Firestore
    const order: Omit<TicketOrder, 'id'> = {
      teamId: request.teamId,
      eventId: request.eventId,
      ticketConfigId: request.ticketConfigId,
      buyerUserId: userId,
      buyerEmail: request.buyerEmail,
      buyerName: request.buyerName,
      buyerPhone: request.buyerPhone,
      tickets: request.items.map(item => ({
        ...item,
        subtotal: (item as any).subtotal ?? (item.quantity * item.priceEach)
      })),
      ticketCount: totalTickets,
      subtotal: request.subtotal,
      processingFee: request.processingFee,
      grandTotal: request.grandTotal,
      paymentMethod: request.grandTotal > 0 ? 'paypal' : 'free',
      paymentStatus: 'pending',
      createdAt: Timestamp.now(),
      emailSent: false
    };

    const docRef = await addDoc(collection(db, 'ticketOrders'), order);

    // If free tickets, complete immediately
    if (request.grandTotal === 0) {
      const tickets = await generateTicketsForOrder(docRef.id, order);
      await updateDoc(doc(db, 'ticketOrders', docRef.id), {
        paymentStatus: 'completed',
        completedAt: Timestamp.now()
      });
      
      // Update sold count
      await updateDoc(doc(db, 'ticketConfigs', request.ticketConfigId), {
        soldCount: increment(totalTickets)
      });

      return { success: true, orderId: docRef.id };
    }

    // Create PayPal order
    const response = await fetch('/.netlify/functions/create-ticket-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        orderId: docRef.id
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      // Clean up failed order
      await updateDoc(doc(db, 'ticketOrders', docRef.id), {
        paymentStatus: 'failed'
      });
      return result;
    }

    // Store PayPal order ID
    await updateDoc(doc(db, 'ticketOrders', docRef.id), {
      paypalOrderId: result.paypalOrderId
    });

    return {
      success: true,
      orderId: docRef.id,
      paypalOrderId: result.paypalOrderId
    };
  } catch (error) {
    console.error('Error creating ticket order:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create order' 
    };
  }
};

/**
 * Capture payment and generate tickets
 */
export const captureTicketPayment = async (
  orderId: string,
  paypalOrderId: string
): Promise<CaptureTicketOrderResponse> => {
  try {
    // Call Netlify function to capture payment
    const response = await fetch('/.netlify/functions/capture-ticket-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, paypalOrderId })
    });

    const result = await response.json();
    
    if (!result.success) {
      return result;
    }

    // Get the order
    const orderDoc = await getDoc(doc(db, 'ticketOrders', orderId));
    if (!orderDoc.exists()) {
      return { success: false, error: 'Order not found' };
    }

    const order = { id: orderDoc.id, ...orderDoc.data() } as TicketOrder;

    // Generate tickets
    const tickets = await generateTicketsForOrder(orderId, order);

    // Update order status
    await updateDoc(doc(db, 'ticketOrders', orderId), {
      paymentStatus: 'completed',
      paypalTransactionId: result.transactionId,
      completedAt: Timestamp.now()
    });

    // Update sold count
    await updateDoc(doc(db, 'ticketConfigs', order.ticketConfigId), {
      soldCount: increment(order.ticketCount)
    });

    return {
      success: true,
      transactionId: result.transactionId,
      tickets
    };
  } catch (error) {
    console.error('Error capturing ticket payment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to capture payment' 
    };
  }
};

// =============================================================================
// TICKET GENERATION
// =============================================================================

/**
 * Generate individual tickets for a completed order
 */
const generateTicketsForOrder = async (
  orderId: string,
  order: Omit<TicketOrder, 'id'> & { id?: string }
): Promise<Ticket[]> => {
  const tickets: Ticket[] = [];
  const batch = writeBatch(db);

  for (const item of order.tickets) {
    for (let i = 0; i < item.quantity; i++) {
      const ticketRef = doc(collection(db, 'tickets'));
      const ticketNumber = generateTicketNumber();
      const qrCode = generateQRCode(ticketRef.id, ticketNumber);

      const ticket: Ticket = {
        id: ticketRef.id,
        orderId,
        teamId: order.teamId,
        eventId: order.eventId,
        ticketNumber,
        qrCode,
        ownerEmail: order.buyerEmail,
        ownerName: order.buyerName,
        status: 'valid',
        tierId: item.tierId,
        tierName: item.tierName,
        price: item.priceEach,
        createdAt: Timestamp.now()
      };

      batch.set(ticketRef, ticket);
      tickets.push(ticket);
    }
  }

  await batch.commit();
  return tickets;
};

// =============================================================================
// TICKET RETRIEVAL
// =============================================================================

/**
 * Get tickets for an order
 */
export const getTicketsForOrder = async (orderId: string): Promise<Ticket[]> => {
  const q = query(
    collection(db, 'tickets'),
    where('orderId', '==', orderId),
    orderBy('createdAt', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
};

/**
 * Get tickets by email (for "my tickets" view)
 */
export const getTicketsByEmail = async (email: string): Promise<Ticket[]> => {
  const q = query(
    collection(db, 'tickets'),
    where('ownerEmail', '==', email.toLowerCase()),
    where('status', '==', 'valid'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
};

/**
 * Get ticket by QR code (for scanning)
 */
export const getTicketByQRCode = async (qrCode: string): Promise<Ticket | null> => {
  const q = query(
    collection(db, 'tickets'),
    where('qrCode', '==', qrCode)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ticket;
};

// =============================================================================
// TICKET SCANNING (Gate Management)
// =============================================================================

/**
 * Scan and validate a ticket
 */
export const scanTicket = async (request: ScanTicketRequest): Promise<ScanTicketResponse> => {
  try {
    return await runTransaction(db, async (transaction) => {
      // Find the ticket
      const q = query(
        collection(db, 'tickets'),
        where('qrCode', '==', request.qrCode)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Log invalid scan
        await addDoc(collection(db, 'ticketScans'), {
          ticketId: null,
          eventId: request.eventId,
          teamId: null,
          scannedAt: Timestamp.now(),
          scannedBy: request.scannerId,
          scannerName: request.scannerName,
          result: 'invalid',
          ticketNumber: 'UNKNOWN',
          ownerName: 'UNKNOWN'
        });
        
        return {
          success: false,
          result: 'invalid' as const,
          message: 'Invalid ticket - QR code not recognized'
        };
      }

      const ticketDoc = snapshot.docs[0];
      const ticket = { id: ticketDoc.id, ...ticketDoc.data() } as Ticket;

      // Check if ticket is for this event
      if (ticket.eventId !== request.eventId) {
        await addDoc(collection(db, 'ticketScans'), {
          ticketId: ticket.id,
          eventId: request.eventId,
          teamId: ticket.teamId,
          scannedAt: Timestamp.now(),
          scannedBy: request.scannerId,
          scannerName: request.scannerName,
          result: 'invalid',
          ticketNumber: ticket.ticketNumber,
          ownerName: ticket.ownerName
        });
        
        return {
          success: false,
          result: 'invalid' as const,
          ticket,
          message: 'Ticket is for a different event'
        };
      }

      // Check status
      if (ticket.status === 'used') {
        await addDoc(collection(db, 'ticketScans'), {
          ticketId: ticket.id,
          eventId: request.eventId,
          teamId: ticket.teamId,
          scannedAt: Timestamp.now(),
          scannedBy: request.scannerId,
          scannerName: request.scannerName,
          result: 'already_used',
          ticketNumber: ticket.ticketNumber,
          ownerName: ticket.ownerName
        });
        
        return {
          success: false,
          result: 'already_used' as const,
          ticket,
          message: `Already used at ${ticket.usedAt?.toDate().toLocaleTimeString()}`
        };
      }

      if (ticket.status === 'cancelled' || ticket.status === 'expired') {
        await addDoc(collection(db, 'ticketScans'), {
          ticketId: ticket.id,
          eventId: request.eventId,
          teamId: ticket.teamId,
          scannedAt: Timestamp.now(),
          scannedBy: request.scannerId,
          scannerName: request.scannerName,
          result: 'expired',
          ticketNumber: ticket.ticketNumber,
          ownerName: ticket.ownerName
        });
        
        return {
          success: false,
          result: 'expired' as const,
          ticket,
          message: `Ticket is ${ticket.status}`
        };
      }

      // Valid ticket - mark as used
      transaction.update(doc(db, 'tickets', ticket.id), {
        status: 'used',
        usedAt: Timestamp.now(),
        scannedBy: request.scannerId
      });

      // Log successful scan
      const scanRef = doc(collection(db, 'ticketScans'));
      transaction.set(scanRef, {
        ticketId: ticket.id,
        eventId: request.eventId,
        teamId: ticket.teamId,
        scannedAt: Timestamp.now(),
        scannedBy: request.scannerId,
        scannerName: request.scannerName,
        result: 'valid',
        ticketNumber: ticket.ticketNumber,
        ownerName: ticket.ownerName
      });

      return {
        success: true,
        result: 'valid' as const,
        ticket: { ...ticket, status: 'used' as const },
        message: `✓ Valid ticket for ${ticket.ownerName}`
      };
    });
  } catch (error) {
    console.error('Error scanning ticket:', error);
    return {
      success: false,
      result: 'invalid' as const,
      message: 'Error scanning ticket'
    };
  }
};

// =============================================================================
// EMAIL DELIVERY
// =============================================================================

/**
 * Send tickets via email with QR codes
 */
export const sendTicketEmail = async (
  orderId: string,
  eventDetails: {
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    eventLocation: string;
    teamName: string;
  }
): Promise<boolean> => {
  try {
    const orderDoc = await getDoc(doc(db, 'ticketOrders', orderId));
    if (!orderDoc.exists()) return false;

    const order = orderDoc.data() as TicketOrder;
    const tickets = await getTicketsForOrder(orderId);

    const response = await fetch('/.netlify/functions/send-ticket-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        tickets,
        buyerEmail: order.buyerEmail,
        buyerName: order.buyerName,
        ...eventDetails
      })
    });

    const result = await response.json();
    
    if (result.success) {
      await updateDoc(doc(db, 'ticketOrders', orderId), {
        emailSent: true,
        emailSentAt: Timestamp.now()
      });
    }

    return result.success;
  } catch (error) {
    console.error('Error sending ticket email:', error);
    return false;
  }
};

// =============================================================================
// WALLET PASSES
// =============================================================================

/**
 * Generate Apple Wallet pass URL
 */
export const getAppleWalletPassUrl = async (ticketId: string): Promise<string | null> => {
  try {
    const response = await fetch(`/.netlify/functions/generate-wallet-pass?ticketId=${ticketId}&type=apple`);
    const result = await response.json();
    return result.success ? result.passUrl : null;
  } catch {
    return null;
  }
};

/**
 * Generate Google Wallet pass URL
 */
export const getGoogleWalletPassUrl = async (ticketId: string): Promise<string | null> => {
  try {
    const response = await fetch(`/.netlify/functions/generate-wallet-pass?ticketId=${ticketId}&type=google`);
    const result = await response.json();
    return result.success ? result.passUrl : null;
  } catch {
    return null;
  }
};

// =============================================================================
// ANALYTICS
// =============================================================================

/**
 * Get ticket sales summary for an event
 */
export const getTicketSalesSummary = async (eventId: string) => {
  const config = await getTicketConfig(eventId);
  if (!config) return null;

  const ordersQuery = query(
    collection(db, 'ticketOrders'),
    where('eventId', '==', eventId),
    where('paymentStatus', '==', 'completed')
  );
  
  const ordersSnapshot = await getDocs(ordersQuery);
  
  let totalRevenue = 0;
  let platformFees = 0;
  let ticketsSold = 0;

  ordersSnapshot.docs.forEach(doc => {
    const order = doc.data() as TicketOrder;
    totalRevenue += order.subtotal;
    platformFees += order.processingFee;
    ticketsSold += order.ticketCount;
  });

  return {
    eventId,
    teamId: config.teamId,
    totalCapacity: config.totalCapacity,
    ticketsSold,
    ticketsAvailable: config.totalCapacity - config.soldCount - config.reservedCount,
    totalRevenue,
    platformFees,
    netRevenue: totalRevenue - platformFees,
    percentSold: Math.round((ticketsSold / config.totalCapacity) * 100)
  };
};

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Format cents to display currency
 */
export const formatTicketPrice = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

export default {
  // Config
  getTicketConfig,
  saveTicketConfig,
  // Orders
  createTicketOrder,
  captureTicketPayment,
  // Tickets
  getTicketsForOrder,
  getTicketsByEmail,
  getTicketByQRCode,
  // Scanning
  scanTicket,
  // Email
  sendTicketEmail,
  // Wallet
  getAppleWalletPassUrl,
  getGoogleWalletPassUrl,
  // Analytics
  getTicketSalesSummary,
  // Utilities
  calculateProcessingFee,
  calculateGrandTotal,
  formatTicketPrice
};
