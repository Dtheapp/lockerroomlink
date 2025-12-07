// =============================================================================
// FUNDRAISING SERVICE
// =============================================================================
// Zero-fee fundraising for teams and athletes
// Donations go direct to PayPal - we take nothing
// Only PayPal's standard 2.9% + $0.30 fee applies

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  increment,
  serverTimestamp,
  Timestamp,
  writeBatch,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { 
  FundraisingCampaign, 
  Donation, 
  CampaignUpdate,
  CreateCampaignRequest,
  CreateDonationRequest,
  DonationResult,
  FundraisingStats,
  CampaignStatus,
  CampaignType,
  CampaignCategory,
  NILDeal,
  NILPayment,
  NILWallet
} from '../types/fundraising';

// =============================================================================
// CAMPAIGN FUNCTIONS
// =============================================================================

/**
 * Create a new fundraising campaign
 */
export async function createCampaign(
  request: CreateCampaignRequest,
  userId: string,
  denormalizedData: {
    teamName?: string;
    teamLogo?: string;
    athleteName?: string;
    athletePhoto?: string;
    sport?: string;
  }
): Promise<FundraisingCampaign> {
  const campaign: Omit<FundraisingCampaign, 'id'> = {
    type: request.type,
    teamId: request.teamId,
    athleteId: request.athleteId,
    createdBy: userId,
    
    title: request.title,
    description: request.description,
    story: request.story,
    category: request.category,
    
    coverImage: request.coverImage,
    images: [],
    
    goalAmount: request.goalAmount,
    raisedAmount: 0,
    donorCount: 0,
    
    paypalEmail: request.paypalEmail,
    
    startDate: new Date(),
    endDate: request.endDate,
    
    status: 'active',
    isPublic: true,
    isFeatured: false,
    isVerified: false,
    
    allowAnonymousDonations: true,
    showDonorNames: true,
    showDonorAmounts: true,
    minimumDonation: 100, // $1 minimum
    suggestedAmounts: request.suggestedAmounts || [500, 1000, 2500, 5000, 10000], // $5, $10, $25, $50, $100
    
    allowPlatformTip: true,
    
    createdAt: new Date(),
    updatedAt: new Date(),
    
    ...denormalizedData
  };

  const docRef = await addDoc(collection(db, 'campaigns'), {
    ...campaign,
    startDate: Timestamp.fromDate(campaign.startDate),
    endDate: campaign.endDate ? Timestamp.fromDate(campaign.endDate) : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { ...campaign, id: docRef.id };
}

/**
 * Get a campaign by ID
 */
export async function getCampaign(campaignId: string): Promise<FundraisingCampaign | null> {
  const docRef = doc(db, 'campaigns', campaignId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    ...data,
    id: docSnap.id,
    startDate: data.startDate?.toDate() || new Date(),
    endDate: data.endDate?.toDate() || null,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    completedAt: data.completedAt?.toDate() || null
  } as FundraisingCampaign;
}

/**
 * Get all public active campaigns
 */
export async function getPublicCampaigns(options?: {
  type?: CampaignType;
  category?: CampaignCategory;
  sport?: string;
  limitCount?: number;
  startAfterDoc?: DocumentSnapshot;
}): Promise<FundraisingCampaign[]> {
  let q = query(
    collection(db, 'campaigns'),
    where('isPublic', '==', true),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  );

  if (options?.type) {
    q = query(q, where('type', '==', options.type));
  }

  if (options?.category) {
    q = query(q, where('category', '==', options.category));
  }

  if (options?.sport) {
    q = query(q, where('sport', '==', options.sport));
  }

  if (options?.startAfterDoc) {
    q = query(q, startAfter(options.startAfterDoc));
  }

  q = query(q, limit(options?.limitCount || 20));

  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as FundraisingCampaign;
  });
}

/**
 * Get campaigns by team
 */
export async function getTeamCampaigns(teamId: string): Promise<FundraisingCampaign[]> {
  const q = query(
    collection(db, 'campaigns'),
    where('teamId', '==', teamId),
    orderBy('createdAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as FundraisingCampaign;
  });
}

/**
 * Get campaigns by athlete
 */
export async function getAthleteCampaigns(athleteId: string): Promise<FundraisingCampaign[]> {
  const q = query(
    collection(db, 'campaigns'),
    where('athleteId', '==', athleteId),
    orderBy('createdAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as FundraisingCampaign;
  });
}

/**
 * Get campaigns created by user
 */
export async function getUserCampaigns(userId: string): Promise<FundraisingCampaign[]> {
  const q = query(
    collection(db, 'campaigns'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as FundraisingCampaign;
  });
}

/**
 * Update a campaign
 */
export async function updateCampaign(
  campaignId: string, 
  updates: Partial<FundraisingCampaign>
): Promise<void> {
  const docRef = doc(db, 'campaigns', campaignId);
  
  // Convert dates to Timestamps
  const updateData: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  if (updates.startDate) {
    updateData.startDate = Timestamp.fromDate(updates.startDate);
  }
  if (updates.endDate) {
    updateData.endDate = Timestamp.fromDate(updates.endDate);
  }
  if (updates.completedAt) {
    updateData.completedAt = Timestamp.fromDate(updates.completedAt);
  }
  
  await updateDoc(docRef, updateData);
}

/**
 * Update campaign status
 */
export async function updateCampaignStatus(
  campaignId: string, 
  status: CampaignStatus
): Promise<void> {
  const updates: Record<string, unknown> = { 
    status, 
    updatedAt: serverTimestamp() 
  };
  
  if (status === 'completed') {
    updates.completedAt = serverTimestamp();
  }
  
  await updateDoc(doc(db, 'campaigns', campaignId), updates);
}

/**
 * Upload campaign cover image
 */
export async function uploadCampaignImage(
  campaignId: string,
  file: File
): Promise<string> {
  const fileRef = ref(storage, `campaigns/${campaignId}/${file.name}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

// =============================================================================
// DONATION FUNCTIONS
// =============================================================================

/**
 * Record a donation after PayPal payment is complete
 */
export async function recordDonation(
  request: CreateDonationRequest,
  userId: string | null,
  paypalData: {
    orderId: string;
    transactionId: string;
    payerEmail?: string;
  },
  campaignData: {
    title: string;
    recipientName: string;
  }
): Promise<Donation> {
  const batch = writeBatch(db);
  
  const totalCharged = request.amount + (request.platformTip || 0);
  
  const donation: Omit<Donation, 'id'> = {
    campaignId: request.campaignId,
    
    donorUserId: userId || undefined,
    donorName: request.donorName,
    donorEmail: request.donorEmail,
    isAnonymous: request.isAnonymous,
    
    amount: request.amount,
    platformTip: request.platformTip || 0,
    totalCharged,
    
    paypalOrderId: paypalData.orderId,
    paypalTransactionId: paypalData.transactionId,
    paypalPayerEmail: paypalData.payerEmail,
    paypalStatus: 'COMPLETED',
    
    message: request.message,
    
    createdAt: new Date(),
    
    campaignTitle: campaignData.title,
    recipientName: campaignData.recipientName
  };

  // Add donation document
  const donationRef = doc(collection(db, 'donations'));
  batch.set(donationRef, {
    ...donation,
    createdAt: serverTimestamp()
  });

  // Update campaign totals
  const campaignRef = doc(db, 'campaigns', request.campaignId);
  batch.update(campaignRef, {
    raisedAmount: increment(request.amount),
    donorCount: increment(1),
    updatedAt: serverTimestamp()
  });

  await batch.commit();

  return { ...donation, id: donationRef.id };
}

/**
 * Get donations for a campaign
 */
export async function getCampaignDonations(
  campaignId: string, 
  options?: { 
    includeAnonymous?: boolean;
    limitCount?: number;
  }
): Promise<Donation[]> {
  let q = query(
    collection(db, 'donations'),
    where('campaignId', '==', campaignId),
    where('paypalStatus', '==', 'COMPLETED'),
    orderBy('createdAt', 'desc'),
    limit(options?.limitCount || 50)
  );

  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date()
    } as Donation;
  }).filter(donation => {
    // Optionally filter anonymous donations (for public display)
    if (!options?.includeAnonymous && donation.isAnonymous) {
      return false;
    }
    return true;
  });
}

/**
 * Get user's donation history
 */
export async function getUserDonations(userId: string): Promise<Donation[]> {
  const q = query(
    collection(db, 'donations'),
    where('donorUserId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date()
    } as Donation;
  });
}

// =============================================================================
// CAMPAIGN UPDATE FUNCTIONS
// =============================================================================

/**
 * Post an update to a campaign
 */
export async function postCampaignUpdate(
  campaignId: string,
  userId: string,
  update: { title: string; content: string; images?: string[] }
): Promise<CampaignUpdate> {
  const updateData: Omit<CampaignUpdate, 'id'> = {
    campaignId,
    title: update.title,
    content: update.content,
    images: update.images,
    createdAt: new Date(),
    createdBy: userId
  };

  const docRef = await addDoc(
    collection(db, 'campaigns', campaignId, 'updates'),
    {
      ...updateData,
      createdAt: serverTimestamp()
    }
  );

  return { ...updateData, id: docRef.id };
}

/**
 * Get updates for a campaign
 */
export async function getCampaignUpdates(campaignId: string): Promise<CampaignUpdate[]> {
  const q = query(
    collection(db, 'campaigns', campaignId, 'updates'),
    orderBy('createdAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date()
    } as CampaignUpdate;
  });
}

// =============================================================================
// STATS & ANALYTICS
// =============================================================================

/**
 * Get fundraising stats for homepage/admin
 */
export async function getFundraisingStats(): Promise<FundraisingStats> {
  // Get all completed donations
  const donationsQuery = query(
    collection(db, 'donations'),
    where('paypalStatus', '==', 'COMPLETED')
  );
  const donationsSnap = await getDocs(donationsQuery);
  
  let totalRaised = 0;
  const donorSet = new Set<string>();
  
  donationsSnap.docs.forEach(doc => {
    const data = doc.data();
    totalRaised += data.amount || 0;
    if (data.donorEmail) donorSet.add(data.donorEmail);
  });

  // Get campaign counts
  const activeCampaignsQuery = query(
    collection(db, 'campaigns'),
    where('status', '==', 'active')
  );
  const activeCampaignsSnap = await getDocs(activeCampaignsQuery);
  
  const allCampaignsQuery = query(collection(db, 'campaigns'));
  const allCampaignsSnap = await getDocs(allCampaignsQuery);

  // Get top campaigns
  const topCampaignsQuery = query(
    collection(db, 'campaigns'),
    where('status', '==', 'active'),
    where('isPublic', '==', true),
    orderBy('raisedAmount', 'desc'),
    limit(5)
  );
  const topCampaignsSnap = await getDocs(topCampaignsQuery);
  
  const topCampaigns = topCampaignsSnap.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as FundraisingCampaign;
  });

  return {
    totalRaised,
    totalCampaigns: allCampaignsSnap.size,
    activeCampaigns: activeCampaignsSnap.size,
    totalDonors: donorSet.size,
    averageDonation: donationsSnap.size > 0 ? Math.round(totalRaised / donationsSnap.size) : 0,
    topCampaigns
  };
}

// =============================================================================
// NIL FUNCTIONS
// =============================================================================

/**
 * Create a new NIL deal
 */
export async function createNILDeal(
  athleteId: string,
  deal: Omit<NILDeal, 'id' | 'athleteId' | 'createdAt' | 'updatedAt'>
): Promise<NILDeal> {
  const nilDeal: Omit<NILDeal, 'id'> = {
    ...deal,
    athleteId,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const docRef = await addDoc(collection(db, 'nilDeals'), {
    ...nilDeal,
    startDate: Timestamp.fromDate(nilDeal.startDate),
    endDate: nilDeal.endDate ? Timestamp.fromDate(nilDeal.endDate) : null,
    completedAt: nilDeal.completedAt ? Timestamp.fromDate(nilDeal.completedAt) : null,
    paidAt: nilDeal.paidAt ? Timestamp.fromDate(nilDeal.paidAt) : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { ...nilDeal, id: docRef.id };
}

/**
 * Update an existing NIL deal
 */
export async function updateNILDeal(
  dealId: string,
  updates: Partial<Omit<NILDeal, 'id' | 'athleteId' | 'createdAt'>>
): Promise<void> {
  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp()
  };

  // Convert dates to Firestore timestamps
  if (updates.startDate) {
    updateData.startDate = Timestamp.fromDate(updates.startDate);
  }
  if (updates.endDate) {
    updateData.endDate = Timestamp.fromDate(updates.endDate);
  }
  if (updates.completedAt) {
    updateData.completedAt = Timestamp.fromDate(updates.completedAt);
  }
  if (updates.paidAt) {
    updateData.paidAt = Timestamp.fromDate(updates.paidAt);
  }

  await updateDoc(doc(db, 'nilDeals', dealId), updateData);
}

/**
 * Get NIL deals for an athlete
 */
export async function getAthleteNILDeals(athleteId: string): Promise<NILDeal[]> {
  const q = query(
    collection(db, 'nilDeals'),
    where('athleteId', '==', athleteId),
    orderBy('createdAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || null,
      completedAt: data.completedAt?.toDate() || null,
      paidAt: data.paidAt?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as NILDeal;
  });
}

/**
 * Record a NIL payment
 */
export async function recordNILPayment(
  dealId: string,
  athleteId: string,
  payment: { amount: number; date: Date; description: string; proofUrl?: string }
): Promise<NILPayment> {
  const batch = writeBatch(db);
  
  const nilPayment: Omit<NILPayment, 'id'> = {
    dealId,
    athleteId,
    amount: payment.amount,
    date: payment.date,
    description: payment.description,
    proofUrl: payment.proofUrl,
    createdAt: new Date()
  };

  // Add payment document
  const paymentRef = doc(collection(db, 'nilPayments'));
  batch.set(paymentRef, {
    ...nilPayment,
    date: Timestamp.fromDate(nilPayment.date),
    createdAt: serverTimestamp()
  });

  // Update deal total
  const dealRef = doc(db, 'nilDeals', dealId);
  batch.update(dealRef, {
    paymentsReceived: increment(payment.amount),
    updatedAt: serverTimestamp()
  });

  await batch.commit();

  return { ...nilPayment, id: paymentRef.id };
}

/**
 * Get NIL wallet summary for an athlete
 */
export async function getNILWallet(athleteId: string): Promise<NILWallet | null> {
  // Get all deals
  const deals = await getAthleteNILDeals(athleteId);
  
  if (deals.length === 0) {
    return null;
  }
  
  // Get recent payments
  const paymentsQuery = query(
    collection(db, 'nilPayments'),
    where('athleteId', '==', athleteId),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  const paymentsSnap = await getDocs(paymentsQuery);
  
  const recentPayments = paymentsSnap.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      date: data.date?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date()
    } as NILPayment;
  });

  // Calculate totals from deals
  const completedDeals = deals.filter(d => ['completed', 'paid'].includes(d.status));
  const pendingDeals = deals.filter(d => ['active', 'pending'].includes(d.status));
  
  const totalEarnings = completedDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const pendingBalance = pendingDeals.reduce((sum, deal) => sum + deal.amount, 0);
  
  // Available = completed deals minus any already paid out
  const paidDeals = deals.filter(d => d.status === 'paid');
  const paidAmount = paidDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const availableBalance = totalEarnings - paidAmount;

  return {
    athleteId,
    totalEarnings,
    pendingBalance,
    availableBalance,
    lifetimeDeals: deals.length,
    activeDeals: deals.filter(d => d.status === 'active').length,
    completedDeals: completedDeals.length,
    recentPayments,
    updatedAt: new Date()
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency amount (cents to dollars)
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}

/**
 * Calculate percentage of goal reached
 */
export function calculateProgress(raised: number, goal: number): number {
  if (goal === 0) return 0;
  return Math.min(100, Math.round((raised / goal) * 100));
}

/**
 * Calculate days remaining
 */
export function calculateDaysRemaining(endDate: Date | null | undefined): number | null {
  if (!endDate) return null;
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
