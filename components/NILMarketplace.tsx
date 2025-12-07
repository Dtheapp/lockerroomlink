import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GlassCard, SectionHeader, Badge } from './ui/OSYSComponents';
import { 
  Store, 
  DollarSign, 
  User, 
  MessageSquare, 
  Clock, 
  Check, 
  X, 
  Plus,
  Search,
  Filter,
  Star,
  ChevronRight,
  Instagram,
  Twitter,
  Youtube,
  Sparkles,
  Handshake,
  ShoppingBag
} from 'lucide-react';
import { NILListing, NILOffer, NILProfile, NILDealType } from '../types/fundraising';
import { 
  getMarketplaceListings, 
  createNILOffer,
  getAthleteNILProfile
} from '../services/fundraising';

// Deal type labels for display
const dealTypeLabels: Record<NILDealType, string> = {
  sponsorship: 'Sponsorship',
  appearance: 'Appearance',
  social_media: 'Social Media',
  merchandise: 'Merchandise',
  autograph: 'Autograph',
  shoutout: 'Shoutout',
  camp: 'Camp/Clinic',
  custom: 'Custom',
  other: 'Other'
};

// Format cents to dollars
const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
};

interface NILMarketplaceProps {
  teamId?: string;
  athleteId?: string; // For filtering to specific athlete
}

export default function NILMarketplace({ teamId, athleteId }: NILMarketplaceProps) {
  const { user, userData } = useAuth();
  const [listings, setListings] = useState<NILListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<NILDealType | 'all'>('all');
  const [selectedListing, setSelectedListing] = useState<NILListing | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  
  // For custom offer
  const [customOffer, setCustomOffer] = useState({
    athleteId: '',
    title: '',
    description: '',
    dealType: 'custom' as NILDealType,
    amount: '',
    isNegotiable: true
  });

  useEffect(() => {
    loadListings();
  }, [teamId, athleteId, selectedType]);

  const loadListings = async () => {
    setLoading(true);
    try {
      const data = await getMarketplaceListings({
        teamId,
        athleteId,
        dealType: selectedType === 'all' ? undefined : selectedType,
        activeOnly: true
      });
      setListings(data);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredListings = listings.filter(listing => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      listing.title.toLowerCase().includes(term) ||
      listing.athleteName.toLowerCase().includes(term) ||
      listing.description.toLowerCase().includes(term)
    );
  });

  const handlePurchase = (listing: NILListing) => {
    setSelectedListing(listing);
    setShowPurchaseModal(true);
  };

  const handleMakeOffer = (listing?: NILListing) => {
    if (listing) {
      setCustomOffer({
        ...customOffer,
        athleteId: listing.athleteId,
        dealType: listing.dealType
      });
    }
    setSelectedListing(listing || null);
    setShowOfferModal(true);
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-orange-500/20 dark:to-yellow-500/20">
            <Store className="w-6 h-6 text-purple-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">NIL Marketplace</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Browse and purchase athlete opportunities</p>
          </div>
        </div>
        
        {/* Custom offer button for fans */}
        {userData?.role === 'fan' && (
          <button
            onClick={() => handleMakeOffer()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 dark:bg-orange-500 text-white rounded-lg hover:opacity-90 transition"
          >
            <Handshake className="w-4 h-4" />
            Make Custom Offer
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <GlassCard className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search athletes or opportunities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-orange-500 text-zinc-900 dark:text-white"
            />
          </div>
          
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-zinc-400" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as NILDealType | 'all')}
              className="px-4 py-2 bg-white/50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-orange-500 text-zinc-900 dark:text-white"
            >
              <option value="all">All Types</option>
              {Object.entries(dealTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Listings Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 dark:border-orange-500"></div>
        </div>
      ) : filteredListings.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Store className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No Listings Found</h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            {searchTerm || selectedType !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'No athletes have created marketplace listings yet'}
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredListings.map((listing) => (
            <ListingCard 
              key={listing.id} 
              listing={listing} 
              onPurchase={() => handlePurchase(listing)}
              onMakeOffer={() => handleMakeOffer(listing)}
              isFan={userData?.role === 'fan'}
            />
          ))}
        </div>
      )}

      {/* Purchase Modal */}
      {showPurchaseModal && selectedListing && (
        <PurchaseModal
          listing={selectedListing}
          user={user}
          userData={userData}
          onClose={() => {
            setShowPurchaseModal(false);
            setSelectedListing(null);
          }}
          onSuccess={() => {
            setShowPurchaseModal(false);
            setSelectedListing(null);
            loadListings();
          }}
        />
      )}

      {/* Custom Offer Modal */}
      {showOfferModal && (
        <CustomOfferModal
          listing={selectedListing}
          user={user}
          userData={userData}
          onClose={() => {
            setShowOfferModal(false);
            setSelectedListing(null);
          }}
          onSuccess={() => {
            setShowOfferModal(false);
            setSelectedListing(null);
          }}
        />
      )}
    </div>
  );
}

// Listing Card Component
interface ListingCardProps {
  listing: NILListing;
  onPurchase: () => void;
  onMakeOffer: () => void;
  isFan: boolean;
}

function ListingCard({ listing, onPurchase, onMakeOffer, isFan }: ListingCardProps) {
  return (
    <GlassCard className="p-4 hover:border-purple-500/30 dark:hover:border-orange-500/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 dark:from-orange-500 dark:to-yellow-500 flex items-center justify-center text-white font-bold">
            {listing.athleteName.charAt(0)}
          </div>
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-white">{listing.athleteName}</h4>
            {listing.teamName && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{listing.teamName}</p>
            )}
          </div>
        </div>
        <Badge variant="default" size="sm">
          {dealTypeLabels[listing.dealType]}
        </Badge>
      </div>

      {/* Listing Info */}
      <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">{listing.title}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2">
        {listing.description}
      </p>

      {/* Sample Image */}
      {listing.sampleImageUrl && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <img 
            src={listing.sampleImageUrl} 
            alt={listing.title}
            className="w-full h-32 object-cover"
          />
        </div>
      )}

      {/* Delivery & Availability */}
      <div className="flex flex-wrap gap-2 mb-4">
        {listing.deliveryTimeframe && (
          <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
            <Clock className="w-3 h-3" />
            {listing.deliveryTimeframe}
          </span>
        )}
        {listing.maxQuantity && (
          <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
            <ShoppingBag className="w-3 h-3" />
            {listing.maxQuantity - listing.quantitySold} left
          </span>
        )}
      </div>

      {/* Price & Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-white/10">
        <div>
          <span className="text-2xl font-bold text-purple-600 dark:text-orange-400">
            {formatCurrency(listing.price)}
          </span>
          {listing.isPriceNegotiable && (
            <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">Negotiable</span>
          )}
        </div>
        
        {isFan && (
          <div className="flex gap-2">
            {listing.isPriceNegotiable && (
              <button
                onClick={onMakeOffer}
                className="px-3 py-1.5 text-sm border border-purple-500 dark:border-orange-500 text-purple-600 dark:text-orange-400 rounded-lg hover:bg-purple-50 dark:hover:bg-orange-500/10 transition"
              >
                Offer
              </button>
            )}
            <button
              onClick={onPurchase}
              className="px-3 py-1.5 text-sm bg-purple-600 dark:bg-orange-500 text-white rounded-lg hover:opacity-90 transition"
            >
              Purchase
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// Purchase Modal
interface PurchaseModalProps {
  listing: NILListing;
  user: any;
  userData: any;
  onClose: () => void;
  onSuccess: () => void;
}

function PurchaseModal({ listing, user, userData, onClose, onSuccess }: PurchaseModalProps) {
  const [buyerNotes, setBuyerNotes] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!user) {
      setError('Please sign in to make a purchase');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // For now, just show placeholder - PayPal integration will come
      // In production, this would open PayPal payment flow
      alert('PayPal payment integration coming soon! This will process: ' + formatCurrency(listing.price));
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process purchase');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Purchase NIL Deal</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Listing Summary */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 dark:from-orange-500 dark:to-yellow-500 flex items-center justify-center text-white font-bold">
              {listing.athleteName.charAt(0)}
            </div>
            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white">{listing.athleteName}</h4>
              <p className="text-xs text-zinc-500">{dealTypeLabels[listing.dealType]}</p>
            </div>
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">{listing.title}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{listing.description}</p>
          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
            <span className="text-2xl font-bold text-purple-600 dark:text-orange-400">
              {formatCurrency(listing.price)}
            </span>
          </div>
        </div>

        {/* For Shoutouts - Who is it for? */}
        {(listing.dealType === 'shoutout' || listing.dealType === 'autograph') && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Who is this for? (Optional)
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Name of the recipient"
              className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
        )}

        {/* Special Instructions */}
        {listing.requirements && listing.requirements.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Required Information</h4>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
              {listing.requirements.map((req, idx) => (
                <li key={idx}>{req}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Notes for {listing.athleteName} (Optional)
          </label>
          <textarea
            value={buyerNotes}
            onChange={(e) => setBuyerNotes(e.target.value)}
            placeholder="Any special instructions or details..."
            rows={3}
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {!user && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-600 dark:text-yellow-400 text-sm">
            Please sign in to complete your purchase
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing || !user}
            className="flex-1 py-2 bg-purple-600 dark:bg-orange-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4" />
                Pay {formatCurrency(listing.price)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Custom Offer Modal
interface CustomOfferModalProps {
  listing: NILListing | null;
  user: any;
  userData: any;
  onClose: () => void;
  onSuccess: () => void;
}

function CustomOfferModal({ listing, user, userData, onClose, onSuccess }: CustomOfferModalProps) {
  const [form, setForm] = useState({
    athleteId: listing?.athleteId || '',
    athleteName: listing?.athleteName || '',
    title: '',
    description: '',
    dealType: (listing?.dealType || 'custom') as NILDealType,
    amount: '',
    isNegotiable: true,
    isRecordedDeal: false,
    completedDate: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchAthlete, setSearchAthlete] = useState('');

  const handleSubmit = async () => {
    if (!user) {
      setError('Please sign in to submit an offer');
      return;
    }

    if (!form.athleteId || !form.title || !form.description || !form.amount) {
      setError('Please fill in all required fields');
      return;
    }

    const amountCents = Math.round(parseFloat(form.amount) * 100);
    if (isNaN(amountCents) || amountCents < 100) {
      setError('Please enter a valid amount (minimum $1)');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await createNILOffer({
        athleteId: form.athleteId,
        athleteName: form.athleteName,
        sponsorId: user.uid,
        sponsorName: userData?.displayName || user.email,
        sponsorEmail: user.email,
        dealType: form.dealType,
        title: form.title,
        description: form.description,
        offeredAmount: amountCents,
        isNegotiable: form.isNegotiable,
        isRecordedDeal: form.isRecordedDeal,
        completedDate: form.isRecordedDeal && form.completedDate ? new Date(form.completedDate) : undefined
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit offer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            {form.isRecordedDeal ? 'Record Completed Deal' : 'Make NIL Offer'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Toggle for recorded deal */}
        <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRecordedDeal}
              onChange={(e) => setForm({ ...form, isRecordedDeal: e.target.checked })}
              className="w-5 h-5 rounded border-zinc-300 text-purple-600 dark:text-orange-500 focus:ring-purple-500 dark:focus:ring-orange-500"
            />
            <div>
              <span className="font-medium text-zinc-900 dark:text-white">Recording a completed deal?</span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Check this if the deal was done in person and you're just recording it
              </p>
            </div>
          </label>
        </div>

        {/* Athlete (if not from listing) */}
        {!listing && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Athlete Name *
            </label>
            <input
              type="text"
              value={form.athleteName}
              onChange={(e) => setForm({ ...form, athleteName: e.target.value })}
              placeholder="Enter athlete's name"
              className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Note: In a future update, you'll be able to search for athletes
            </p>
          </div>
        )}

        {/* If from listing, show athlete info */}
        {listing && (
          <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 dark:from-orange-500 dark:to-yellow-500 flex items-center justify-center text-white font-bold">
              {listing.athleteName.charAt(0)}
            </div>
            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white">{listing.athleteName}</h4>
              <p className="text-xs text-zinc-500">Re: {listing.title}</p>
            </div>
          </div>
        )}

        {/* Deal Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Deal Type *
          </label>
          <select
            value={form.dealType}
            onChange={(e) => setForm({ ...form, dealType: e.target.value as NILDealType })}
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          >
            {Object.entries(dealTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Offer Title *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Brief description of what you're proposing"
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Full Description *
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe what you're looking for in detail..."
            rows={4}
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none"
          />
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {form.isRecordedDeal ? 'Deal Value' : 'Offer Amount'} *
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              min="1"
              step="0.01"
              className="w-full pl-10 pr-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
        </div>

        {/* Negotiable (only for non-recorded deals) */}
        {!form.isRecordedDeal && (
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isNegotiable}
                onChange={(e) => setForm({ ...form, isNegotiable: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-300 text-purple-600 dark:text-orange-500 focus:ring-purple-500 dark:focus:ring-orange-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">I'm open to negotiation</span>
            </label>
          </div>
        )}

        {/* Completed Date (only for recorded deals) */}
        {form.isRecordedDeal && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              When was the deal completed?
            </label>
            <input
              type="date"
              value={form.completedDate}
              onChange={(e) => setForm({ ...form, completedDate: e.target.value })}
              className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {!user && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-600 dark:text-yellow-400 text-sm">
            Please sign in to submit an offer
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !user}
            className="flex-1 py-2 bg-purple-600 dark:bg-orange-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Handshake className="w-4 h-4" />
                {form.isRecordedDeal ? 'Record Deal' : 'Submit Offer'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
