import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GlassCard, Badge } from './ui/OSYSComponents';
import { 
  Store, 
  Plus, 
  Edit2, 
  Trash2, 
  Pause, 
  Play,
  DollarSign,
  Clock,
  ShoppingBag,
  Eye,
  EyeOff,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Settings
} from 'lucide-react';
import { NILListing, NILOffer, NILProfile, NILDealType } from '../types/fundraising';
import { 
  getAthleteNILListings,
  createNILListing,
  updateNILListing,
  getAthleteNILOffers,
  respondToNILOffer,
  getAthleteNILProfile,
  updateAthleteNILProfile
} from '../services/fundraising';

// Deal type labels
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

interface AthleteNILManagerProps {
  athleteId: string;
  athleteName: string;
  teamId?: string;
  teamName?: string;
}

export default function AthleteNILManager({ 
  athleteId, 
  athleteName, 
  teamId, 
  teamName 
}: AthleteNILManagerProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'listings' | 'offers' | 'settings'>('listings');
  const [listings, setListings] = useState<NILListing[]>([]);
  const [offers, setOffers] = useState<NILOffer[]>([]);
  const [profile, setProfile] = useState<NILProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingListing, setEditingListing] = useState<NILListing | null>(null);

  useEffect(() => {
    loadData();
  }, [athleteId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listingsData, offersData, profileData] = await Promise.all([
        getAthleteNILListings(athleteId),
        getAthleteNILOffers(athleteId),
        getAthleteNILProfile(athleteId)
      ]);
      setListings(listingsData);
      setOffers(offersData);
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading NIL data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleListing = async (listing: NILListing) => {
    try {
      await updateNILListing(listing.id, { isActive: !listing.isActive });
      setListings(listings.map(l => 
        l.id === listing.id ? { ...l, isActive: !l.isActive } : l
      ));
    } catch (error) {
      console.error('Error toggling listing:', error);
    }
  };

  const pendingOffers = offers.filter(o => o.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header with Open to NIL toggle */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-orange-500/20 dark:to-yellow-500/20">
              <Store className="w-6 h-6 text-purple-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">My NIL Marketplace</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Create listings and manage offers
              </p>
            </div>
          </div>
          
          {/* Open to NIL Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Open to NIL Deals</span>
            <button
              onClick={async () => {
                const newValue = !profile?.isOpenToDeals;
                await updateAthleteNILProfile(athleteId, { isOpenToDeals: newValue });
                setProfile(prev => prev ? { ...prev, isOpenToDeals: newValue } : null);
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                profile?.isOpenToDeals 
                  ? 'bg-green-500' 
                  : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                profile?.isOpenToDeals ? 'translate-x-6' : ''
              }`} />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
        <TabButton 
          active={activeTab === 'listings'} 
          onClick={() => setActiveTab('listings')}
        >
          <Store className="w-4 h-4" />
          My Listings
          <Badge variant="default" className="text-xs">{listings.length}</Badge>
        </TabButton>
        <TabButton 
          active={activeTab === 'offers'} 
          onClick={() => setActiveTab('offers')}
        >
          <DollarSign className="w-4 h-4" />
          Incoming Offers
          {pendingOffers.length > 0 && (
            <Badge variant="success" className="text-xs">{pendingOffers.length}</Badge>
          )}
        </TabButton>
        <TabButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')}
        >
          <Settings className="w-4 h-4" />
          NIL Settings
        </TabButton>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 dark:border-orange-500"></div>
        </div>
      ) : (
        <>
          {activeTab === 'listings' && (
            <ListingsTab
              listings={listings}
              onToggle={handleToggleListing}
              onEdit={(listing) => {
                setEditingListing(listing);
                setShowCreateModal(true);
              }}
              onCreate={() => setShowCreateModal(true)}
              onRefresh={loadData}
            />
          )}
          {activeTab === 'offers' && (
            <OffersTab
              offers={offers}
              onRespond={async (offerId, status, response) => {
                await respondToNILOffer(offerId, status, response);
                loadData();
              }}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              profile={profile}
              athleteId={athleteId}
              athleteName={athleteName}
              teamId={teamId}
              teamName={teamName}
              onUpdate={(updated) => setProfile(updated)}
            />
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <ListingModal
          listing={editingListing}
          athleteId={athleteId}
          athleteName={athleteName}
          teamId={teamId}
          teamName={teamName}
          onClose={() => {
            setShowCreateModal(false);
            setEditingListing(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingListing(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 transition ${
        active 
          ? 'border-purple-500 dark:border-orange-500 text-purple-600 dark:text-orange-400' 
          : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}

// Listings Tab
interface ListingsTabProps {
  listings: NILListing[];
  onToggle: (listing: NILListing) => void;
  onEdit: (listing: NILListing) => void;
  onCreate: () => void;
  onRefresh: () => void;
}

function ListingsTab({ listings, onToggle, onEdit, onCreate, onRefresh }: ListingsTabProps) {
  return (
    <div className="space-y-4">
      {/* Create Button */}
      <button
        onClick={onCreate}
        className="w-full p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl hover:border-purple-500 dark:hover:border-orange-500 hover:bg-purple-50/50 dark:hover:bg-orange-500/5 transition flex items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-orange-400"
      >
        <Plus className="w-5 h-5" />
        Create New Listing
      </button>

      {/* Listings */}
      {listings.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Store className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No Listings Yet</h3>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Create your first NIL listing to start receiving offers
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-4">
          {listings.map((listing) => (
            <GlassCard key={listing.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white">{listing.title}</h3>
                    <Badge variant={listing.isActive ? 'success' : 'default'} className="text-xs">
                      {listing.isActive ? 'Active' : 'Paused'}
                    </Badge>
                    <Badge variant="default" className="text-xs">
                      {dealTypeLabels[listing.dealType]}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                    {listing.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold text-purple-600 dark:text-orange-400">
                      {formatCurrency(listing.price)}
                      {listing.isPriceNegotiable && (
                        <span className="font-normal text-zinc-400 ml-1">· Negotiable</span>
                      )}
                    </span>
                    {listing.deliveryTimeframe && (
                      <span className="flex items-center gap-1 text-zinc-500">
                        <Clock className="w-4 h-4" />
                        {listing.deliveryTimeframe}
                      </span>
                    )}
                    {listing.maxQuantity && (
                      <span className="flex items-center gap-1 text-zinc-500">
                        <ShoppingBag className="w-4 h-4" />
                        {listing.quantitySold}/{listing.maxQuantity} sold
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggle(listing)}
                    className={`p-2 rounded-lg transition ${
                      listing.isActive 
                        ? 'hover:bg-yellow-100 dark:hover:bg-yellow-900/20 text-yellow-600' 
                        : 'hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600'
                    }`}
                    title={listing.isActive ? 'Pause listing' : 'Activate listing'}
                  >
                    {listing.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onEdit(listing)}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    title="Edit listing"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// Offers Tab
interface OffersTabProps {
  offers: NILOffer[];
  onRespond: (offerId: string, status: 'accepted' | 'declined', response?: string) => void;
}

function OffersTab({ offers, onRespond }: OffersTabProps) {
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseMessage, setResponseMessage] = useState('');

  const pendingOffers = offers.filter(o => o.status === 'pending');
  const otherOffers = offers.filter(o => o.status !== 'pending');

  const handleRespond = (offerId: string, status: 'accepted' | 'declined') => {
    onRespond(offerId, status, responseMessage);
    setRespondingTo(null);
    setResponseMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Pending Offers */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
          Pending Offers ({pendingOffers.length})
        </h3>
        {pendingOffers.length === 0 ? (
          <GlassCard className="p-6 text-center text-zinc-500 dark:text-zinc-400">
            No pending offers
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {pendingOffers.map((offer) => (
              <GlassCard key={offer.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-zinc-900 dark:text-white">{offer.title}</h4>
                      {offer.isRecordedDeal && (
                        <Badge variant="warning" className="text-xs">Recorded Deal</Badge>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500">
                      From {offer.sponsorName}
                      {offer.sponsorCompany && ` · ${offer.sponsorCompany}`}
                    </p>
                  </div>
                  <Badge variant="default" className="text-xs">{dealTypeLabels[offer.dealType]}</Badge>
                </div>
                
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                  {offer.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-purple-600 dark:text-orange-400">
                    {formatCurrency(offer.offeredAmount)}
                    {offer.isNegotiable && (
                      <span className="text-sm font-normal text-zinc-400 ml-2">Negotiable</span>
                    )}
                  </div>
                  
                  {respondingTo === offer.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={responseMessage}
                        onChange={(e) => setResponseMessage(e.target.value)}
                        placeholder="Add a response message..."
                        className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                      <button
                        onClick={() => handleRespond(offer.id, 'accepted')}
                        className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespond(offer.id, 'declined')}
                        className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => setRespondingTo(null)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRespondingTo(offer.id)}
                      className="px-4 py-1.5 text-sm bg-purple-600 dark:bg-orange-500 text-white rounded-lg hover:opacity-90"
                    >
                      Respond
                    </button>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Past Offers */}
      {otherOffers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            Past Offers
          </h3>
          <div className="space-y-3">
            {otherOffers.map((offer) => (
              <GlassCard key={offer.id} className="p-3 opacity-75">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-white">{offer.title}</span>
                    <span className="text-sm text-zinc-500 ml-2">from {offer.sponsorName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                      {formatCurrency(offer.offeredAmount)}
                    </span>
                    <Badge 
                      variant={offer.status === 'accepted' ? 'success' : offer.status === 'declined' ? 'error' : 'default'} 
                      className="text-xs"
                    >
                      {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Settings Tab
interface SettingsTabProps {
  profile: NILProfile | null;
  athleteId: string;
  athleteName: string;
  teamId?: string;
  teamName?: string;
  onUpdate: (profile: NILProfile) => void;
}

function SettingsTab({ profile, athleteId, athleteName, teamId, teamName, onUpdate }: SettingsTabProps) {
  const [form, setForm] = useState({
    bio: profile?.bio || '',
    instagram: profile?.socialMediaHandles?.instagram || '',
    twitter: profile?.socialMediaHandles?.twitter || '',
    tiktok: profile?.socialMediaHandles?.tiktok || '',
    youtube: profile?.socialMediaHandles?.youtube || '',
    followerCount: profile?.followerCount?.toString() || '',
    minimumDealValue: profile?.minimumDealValue ? (profile.minimumDealValue / 100).toString() : '',
    availableForTypes: profile?.availableForTypes || []
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateAthleteNILProfile(athleteId, {
        bio: form.bio,
        socialMediaHandles: {
          instagram: form.instagram || undefined,
          twitter: form.twitter || undefined,
          tiktok: form.tiktok || undefined,
          youtube: form.youtube || undefined
        },
        followerCount: form.followerCount ? parseInt(form.followerCount) : undefined,
        minimumDealValue: form.minimumDealValue ? Math.round(parseFloat(form.minimumDealValue) * 100) : undefined,
        availableForTypes: form.availableForTypes
      });
      onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleDealType = (type: NILDealType) => {
    if (form.availableForTypes.includes(type)) {
      setForm({ ...form, availableForTypes: form.availableForTypes.filter(t => t !== type) });
    } else {
      setForm({ ...form, availableForTypes: [...form.availableForTypes, type] });
    }
  };

  return (
    <div className="space-y-6">
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">NIL Profile</h3>
        
        {/* Bio */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            NIL Bio
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Tell sponsors about yourself and what you can offer..."
            rows={3}
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none"
          />
        </div>

        {/* Social Media */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Instagram Handle
            </label>
            <input
              type="text"
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              placeholder="@username"
              className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Twitter Handle
            </label>
            <input
              type="text"
              value={form.twitter}
              onChange={(e) => setForm({ ...form, twitter: e.target.value })}
              placeholder="@username"
              className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              TikTok Handle
            </label>
            <input
              type="text"
              value={form.tiktok}
              onChange={(e) => setForm({ ...form, tiktok: e.target.value })}
              placeholder="@username"
              className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              YouTube Channel
            </label>
            <input
              type="text"
              value={form.youtube}
              onChange={(e) => setForm({ ...form, youtube: e.target.value })}
              placeholder="@channel"
              className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
        </div>

        {/* Follower Count */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Total Social Following
          </label>
          <input
            type="number"
            value={form.followerCount}
            onChange={(e) => setForm({ ...form, followerCount: e.target.value })}
            placeholder="Combined followers across all platforms"
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          />
        </div>

        {/* Minimum Deal Value */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Minimum Deal Value
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="number"
              value={form.minimumDealValue}
              onChange={(e) => setForm({ ...form, minimumDealValue: e.target.value })}
              placeholder="Won't consider deals below this amount"
              className="w-full pl-10 pr-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">Leave blank to consider all offers</p>
        </div>

        {/* Deal Types */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Types of Deals You're Open To
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dealTypeLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => toggleDealType(value as NILDealType)}
                className={`px-3 py-1.5 rounded-full text-sm transition ${
                  form.availableForTypes.includes(value as NILDealType)
                    ? 'bg-purple-600 dark:bg-orange-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-purple-600 dark:bg-orange-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </GlassCard>
    </div>
  );
}

// Listing Create/Edit Modal
interface ListingModalProps {
  listing: NILListing | null;
  athleteId: string;
  athleteName: string;
  teamId?: string;
  teamName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ListingModal({ 
  listing, 
  athleteId, 
  athleteName, 
  teamId, 
  teamName, 
  onClose, 
  onSuccess 
}: ListingModalProps) {
  const [form, setForm] = useState({
    title: listing?.title || '',
    description: listing?.description || '',
    dealType: listing?.dealType || ('shoutout' as NILDealType),
    price: listing ? (listing.price / 100).toString() : '',
    isPriceNegotiable: listing?.isPriceNegotiable ?? true,
    maxQuantity: listing?.maxQuantity?.toString() || '',
    deliveryTimeframe: listing?.deliveryTimeframe || '',
    requirements: listing?.requirements?.join('\n') || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.price) {
      setError('Please fill in all required fields');
      return;
    }

    const priceCents = Math.round(parseFloat(form.price) * 100);
    if (isNaN(priceCents) || priceCents < 100) {
      setError('Please enter a valid price (minimum $1)');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data = {
        title: form.title,
        description: form.description,
        dealType: form.dealType,
        price: priceCents,
        isPriceNegotiable: form.isPriceNegotiable,
        maxQuantity: form.maxQuantity ? parseInt(form.maxQuantity) : undefined,
        deliveryTimeframe: form.deliveryTimeframe || undefined,
        requirements: form.requirements ? form.requirements.split('\n').filter(r => r.trim()) : undefined
      };

      if (listing) {
        await updateNILListing(listing.id, data);
      } else {
        await createNILListing({
          ...data,
          athleteId,
          athleteName,
          teamId,
          teamName,
          isActive: true
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            {listing ? 'Edit Listing' : 'Create NIL Listing'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Listing Title *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Personalized Video Shoutout"
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          />
        </div>

        {/* Deal Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Type *
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

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Description *
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe what you'll provide..."
            rows={3}
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none"
          />
        </div>

        {/* Price */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Price *
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0.00"
              min="1"
              step="0.01"
              className="w-full pl-10 pr-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isPriceNegotiable}
              onChange={(e) => setForm({ ...form, isPriceNegotiable: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Open to offers/negotiation</span>
          </label>
        </div>

        {/* Delivery Timeframe */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Delivery Timeframe
          </label>
          <input
            type="text"
            value={form.deliveryTimeframe}
            onChange={(e) => setForm({ ...form, deliveryTimeframe: e.target.value })}
            placeholder="e.g., Within 3 days"
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          />
        </div>

        {/* Max Quantity */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Maximum Quantity (Optional)
          </label>
          <input
            type="number"
            value={form.maxQuantity}
            onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}
            placeholder="Leave blank for unlimited"
            min="1"
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          />
        </div>

        {/* Requirements */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Buyer Requirements (One per line)
          </label>
          <textarea
            value={form.requirements}
            onChange={(e) => setForm({ ...form, requirements: e.target.value })}
            placeholder="e.g., Name of recipient&#10;Occasion (birthday, graduation, etc.)"
            rows={3}
            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
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
            disabled={saving}
            className="flex-1 py-2 bg-purple-600 dark:bg-orange-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {listing ? 'Update Listing' : 'Create Listing'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
