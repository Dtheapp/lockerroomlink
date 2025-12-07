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
  NILWallet,
  NILProfile,
  NILListing,
  NILOffer,
  NILPurchase,
  NILDealType
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

// =============================================================================
// NIL MARKETPLACE FUNCTIONS
// =============================================================================

/**
 * Get or create athlete's NIL profile
 */
export async function getNILProfile(athleteId: string): Promise<NILProfile | null> {
  try {
    const docRef = doc(db, 'nilProfiles', athleteId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as NILProfile;
  } catch (error) {
    console.error('Error getting NIL profile:', error);
    return null;
  }
}

/**
 * Create or update athlete's NIL profile
 */
export async function updateNILProfile(
  athleteId: string, 
  updates: Partial<NILProfile>
): Promise<void> {
  const docRef = doc(db, 'nilProfiles', athleteId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  }).catch(async () => {
    // Document doesn't exist, create it
    const { setDoc } = await import('firebase/firestore');
    await setDoc(docRef, {
      athleteId,
      isOpenToDeals: false,
      availableForTypes: [],
      ...updates,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
}

/**
 * Create a NIL listing (athlete's offer to marketplace)
 */
export async function createNILListing(
  listing: Omit<NILListing, 'id' | 'quantitySold' | 'createdAt' | 'updatedAt'>
): Promise<NILListing> {
  const docRef = await addDoc(collection(db, 'nilListings'), {
    ...listing,
    quantitySold: 0,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return {
    ...listing,
    id: docRef.id,
    quantitySold: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Update a NIL listing
 */
export async function updateNILListing(
  listingId: string,
  updates: Partial<NILListing>
): Promise<void> {
  await updateDoc(doc(db, 'nilListings', listingId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * Get athlete's NIL listings
 */
export async function getAthleteNILListings(athleteId: string): Promise<NILListing[]> {
  const q = query(
    collection(db, 'nilListings'),
    where('athleteId', '==', athleteId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as NILListing;
  });
}

/**
 * Get active NIL listings for marketplace browse
 */
export async function getActiveNILListings(options?: {
  dealType?: NILDealType;
  teamId?: string;
  limitCount?: number;
}): Promise<NILListing[]> {
  let q = query(
    collection(db, 'nilListings'),
    where('isActive', '==', true)
  );
  
  if (options?.dealType) {
    q = query(q, where('dealType', '==', options.dealType));
  }
  
  if (options?.teamId) {
    q = query(q, where('teamId', '==', options.teamId));
  }
  
  q = query(q, orderBy('createdAt', 'desc'), limit(options?.limitCount || 50));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as NILListing;
  });
}

/**
 * Create a NIL offer (fan/sponsor proposing deal to athlete)
 */
export async function createNILOffer(
  offer: Omit<NILOffer, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<NILOffer> {
  const docRef = await addDoc(collection(db, 'nilOffers'), {
    ...offer,
    status: offer.isRecordedDeal ? 'completed' : 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return {
    ...offer,
    id: docRef.id,
    status: offer.isRecordedDeal ? 'completed' : 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Update NIL offer status (athlete accepting/declining)
 */
export async function updateNILOffer(
  offerId: string,
  updates: Partial<NILOffer>
): Promise<void> {
  await updateDoc(doc(db, 'nilOffers', offerId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * Get offers for an athlete
 */
export async function getAthleteNILOffers(athleteId: string): Promise<NILOffer[]> {
  const q = query(
    collection(db, 'nilOffers'),
    where('athleteId', '==', athleteId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      proposedStartDate: data.proposedStartDate?.toDate(),
      proposedEndDate: data.proposedEndDate?.toDate(),
      completedDate: data.completedDate?.toDate(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as NILOffer;
  });
}

/**
 * Get offers made by a sponsor/fan
 */
export async function getSponsorNILOffers(sponsorId: string): Promise<NILOffer[]> {
  const q = query(
    collection(db, 'nilOffers'),
    where('sponsorId', '==', sponsorId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      proposedStartDate: data.proposedStartDate?.toDate(),
      proposedEndDate: data.proposedEndDate?.toDate(),
      completedDate: data.completedDate?.toDate(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as NILOffer;
  });
}

/**
 * Purchase a NIL listing (fan buying athlete's offering)
 */
export async function createNILPurchase(
  purchase: Omit<NILPurchase, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<NILPurchase> {
  const docRef = await addDoc(collection(db, 'nilPurchases'), {
    ...purchase,
    status: 'pending_payment',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  // Increment quantity sold on listing
  await updateDoc(doc(db, 'nilListings', purchase.listingId), {
    quantitySold: increment(1),
    updatedAt: serverTimestamp()
  });
  
  return {
    ...purchase,
    id: docRef.id,
    status: 'pending_payment',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Update NIL purchase status
 */
export async function updateNILPurchase(
  purchaseId: string,
  updates: Partial<NILPurchase>
): Promise<void> {
  await updateDoc(doc(db, 'nilPurchases', purchaseId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * Get athlete's received purchases (orders to fulfill)
 */
export async function getAthleteNILPurchases(athleteId: string): Promise<NILPurchase[]> {
  const q = query(
    collection(db, 'nilPurchases'),
    where('athleteId', '==', athleteId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      deliveredAt: data.deliveredAt?.toDate(),
      paidAt: data.paidAt?.toDate(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as NILPurchase;
  });
}

/**
 * Get buyer's purchases
 */
export async function getBuyerNILPurchases(buyerId: string): Promise<NILPurchase[]> {
  const q = query(
    collection(db, 'nilPurchases'),
    where('buyerId', '==', buyerId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      deliveredAt: data.deliveredAt?.toDate(),
      paidAt: data.paidAt?.toDate(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as NILPurchase;
  });
}

/**
 * Get athletes open to NIL deals (for marketplace browse)
 */
export async function getAthletesOpenToNIL(options?: {
  teamId?: string;
  dealTypes?: NILDealType[];
  limitCount?: number;
}): Promise<NILProfile[]> {
  let q = query(
    collection(db, 'nilProfiles'),
    where('isOpenToDeals', '==', true)
  );
  
  if (options?.teamId) {
    q = query(q, where('teamId', '==', options.teamId));
  }
  
  q = query(q, limit(options?.limitCount || 50));
  
  const snapshot = await getDocs(q);
  let profiles = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    } as NILProfile;
  });
  
  // Filter by deal types if specified (client-side since Firestore doesn't support array-contains-any with other conditions well)
  if (options?.dealTypes && options.dealTypes.length > 0) {
    profiles = profiles.filter(p => 
      p.availableForTypes.some(t => options.dealTypes!.includes(t))
    );
  }
  
  return profiles;
}

// =============================================================================
// ALIASES FOR COMPONENT COMPATIBILITY
// =============================================================================

/**
 * Alias for getNILProfile - used by components
 */
export const getAthleteNILProfile = getNILProfile;

/**
 * Update athlete NIL profile and return the updated profile
 */
export async function updateAthleteNILProfile(
  athleteId: string,
  updates: Partial<NILProfile>
): Promise<NILProfile> {
  await updateNILProfile(athleteId, updates);
  const profile = await getNILProfile(athleteId);
  if (!profile) {
    throw new Error('Failed to get updated profile');
  }
  return profile;
}

/**
 * Alias for getActiveNILListings - used by components
 */
export const getMarketplaceListings = getActiveNILListings;

/**
 * Respond to an NIL offer (accept/decline with optional message)
 */
export async function respondToNILOffer(
  offerId: string,
  status: 'accepted' | 'declined',
  athleteResponse?: string
): Promise<void> {
  await updateNILOffer(offerId, {
    status,
    athleteResponse,
    updatedAt: new Date()
  });
  
  // If accepted, create an NIL deal from this offer
  if (status === 'accepted') {
    const offerDoc = await getDoc(doc(db, 'nilOffers', offerId));
    if (offerDoc.exists()) {
      const offer = offerDoc.data() as NILOffer;
      await createNILDeal(offer.athleteId, {
        athleteName: offer.athleteName,
        teamId: offer.teamId,
        source: 'offer',
        sourceId: offerId,
        sponsorId: offer.sponsorId,
        sponsorName: offer.sponsorName,
        sponsorEmail: offer.sponsorEmail,
        sponsorCompany: offer.sponsorCompany,
        dealType: offer.dealType,
        description: offer.description,
        requirements: offer.requirements,
        amount: offer.offeredAmount,
        startDate: new Date(),
        status: 'active'
      });
    }
  }
}
