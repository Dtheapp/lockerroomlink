// =============================================================================
// CAMPAIGN DETAIL PAGE
// =============================================================================
// Public page for viewing and donating to a fundraising campaign

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Heart, 
  Share2, 
  Calendar, 
  Users, 
  Target, 
  Clock,
  ChevronLeft,
  ExternalLink,
  CheckCircle
} from 'lucide-react';
import { 
  AnimatedBackground, 
  GlassCard, 
  Button, 
  Badge, 
  ProgressBar, 
  Avatar,
  GradientText 
} from './ui/OSYSComponents';
import { Skeleton } from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import { DonateModal } from './DonateModal';
import { 
  getCampaign, 
  getCampaignDonations, 
  getCampaignUpdates,
  formatCurrency, 
  calculateProgress, 
  calculateDaysRemaining 
} from '../services/fundraising';
import { FundraisingCampaign, Donation, CampaignUpdate } from '../types/fundraising';
import { showToast } from '../services/toast';

const CATEGORY_ICONS: Record<string, string> = {
  tournament: '🏆',
  equipment: '🎒',
  travel: '✈️',
  training: '💪',
  uniforms: '👕',
  facility: '🏟️',
  scholarship: '🎓',
  nil: '💰',
  other: '📋',
};

const CampaignDetail: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<FundraisingCampaign | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [updates, setUpdates] = useState<CampaignUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'story' | 'donors' | 'updates'>('story');

  useEffect(() => {
    const loadCampaign = async () => {
      if (!campaignId) {
        setError('Campaign not found');
        setLoading(false);
        return;
      }

      try {
        const [campaignData, donationsData, updatesData] = await Promise.all([
          getCampaign(campaignId),
          getCampaignDonations(campaignId, { includeAnonymous: true, limitCount: 20 }),
          getCampaignUpdates(campaignId)
        ]);

        if (!campaignData) {
          setError('Campaign not found');
        } else {
          setCampaign(campaignData);
          setDonations(donationsData);
          setUpdates(updatesData);
        }
      } catch (err) {
        console.error('Failed to load campaign:', err);
        setError('Failed to load campaign');
      } finally {
        setLoading(false);
      }
    };

    loadCampaign();
  }, [campaignId]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: campaign?.title,
          text: `Support this campaign: ${campaign?.title}`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard!', 'success');
    }
  };

  const handleDonationSuccess = () => {
    // Refresh campaign data
    if (campaignId) {
      getCampaign(campaignId).then(data => data && setCampaign(data));
      getCampaignDonations(campaignId, { includeAnonymous: true, limitCount: 20 }).then(setDonations);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-transparent">
        <div className="hidden dark:block"><AnimatedBackground /></div>
        <div className="dark:hidden fixed inset-0 bg-gradient-to-br from-purple-50 via-white to-indigo-50 -z-10" />
        
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Skeleton className="h-[400px] rounded-2xl mb-6" />
          <Skeleton className="h-[200px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-white dark:bg-transparent flex items-center justify-center">
        <div className="hidden dark:block"><AnimatedBackground /></div>
        <EmptyState
          type="search"
          title="Campaign Not Found"
          description="This campaign may have been removed or doesn't exist."
          actionLabel="Browse Campaigns"
          onAction={() => window.location.href = '/fundraising'}
        />
      </div>
    );
  }

  const progress = calculateProgress(campaign.raisedAmount, campaign.goalAmount);
  const daysLeft = calculateDaysRemaining(campaign.endDate);

  return (
    <div className="min-h-screen text-zinc-900 dark:text-white bg-white dark:bg-transparent">
      <div className="hidden dark:block"><AnimatedBackground /></div>
      <div className="dark:hidden fixed inset-0 bg-gradient-to-br from-purple-50 via-white to-indigo-50 -z-10" />

      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-transparent dark:backdrop-blur-xl border border-zinc-200 dark:border-white/10 dark:osys-glass fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 flex items-center gap-8 rounded-2xl shadow-lg dark:shadow-none">
        <Link to="/fundraising" className="flex items-center gap-2 text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white transition">
          <ChevronLeft className="w-5 h-5" />
          <span>Back</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-sm">
            ⚡
          </div>
          <span className="font-bold">OSYS</span>
        </div>
        
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="ghost" size="sm" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button variant="gold" size="sm" onClick={() => setShowDonateModal(true)}>
            <Heart className="w-4 h-4 mr-2" /> Donate
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-8 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Cover Image */}
          <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden mb-6">
            {campaign.coverImage ? (
              <img 
                src={campaign.coverImage} 
                alt={campaign.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <span className="text-8xl">{CATEGORY_ICONS[campaign.category] || '🏆'}</span>
              </div>
            )}
            
            {/* Badges */}
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge variant={campaign.type === 'team' ? 'primary' : 'gold'}>
                {campaign.type === 'team' ? '👥 Team' : '🏃 Athlete'}
              </Badge>
              {campaign.isVerified && (
                <Badge variant="success">
                  <CheckCircle className="w-3 h-3 mr-1" /> Verified
                </Badge>
              )}
            </div>
          </div>

          {/* Campaign Info */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="md:col-span-2 space-y-6">
              {/* Title & Meta */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar 
                    name={campaign.teamName || campaign.athleteName || 'Campaign'} 
                    src={campaign.teamLogo || campaign.athletePhoto}
                    size="md" 
                  />
                  <div>
                    <div className="font-medium">{campaign.teamName || campaign.athleteName}</div>
                    <div className="text-sm text-zinc-500 dark:text-slate-400">{campaign.sport}</div>
                  </div>
                </div>
                
                <h1 className="text-3xl md:text-4xl font-bold mb-3">{campaign.title}</h1>
                <p className="text-lg text-zinc-600 dark:text-slate-400">{campaign.description}</p>
              </div>

              {/* Tabs */}
              <div className="border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex gap-6">
                  {(['story', 'donors', 'updates'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-3 font-medium transition-colors relative ${
                        activeTab === tab
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {tab === 'donors' && ` (${campaign.donorCount})`}
                      {tab === 'updates' && ` (${updates.length})`}
                      {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="min-h-[300px]">
                {activeTab === 'story' && (
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap">{campaign.story}</div>
                  </div>
                )}

                {activeTab === 'donors' && (
                  <div className="space-y-3">
                    {donations.length === 0 ? (
                      <EmptyState
                        type="fans"
                        title="Be the First Donor!"
                        description="Your donation could start something amazing."
                        actionLabel="Donate Now"
                        onAction={() => setShowDonateModal(true)}
                        compact
                      />
                    ) : (
                      donations.map((donation, i) => (
                        <GlassCard key={donation.id} className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <Avatar 
                              name={donation.isAnonymous ? 'Anonymous' : donation.donorName} 
                              size="sm" 
                            />
                            <div>
                              <div className="font-medium">
                                {donation.isAnonymous ? 'Anonymous' : donation.donorName}
                              </div>
                              {donation.message && (
                                <p className="text-sm text-zinc-500 dark:text-slate-400 mt-1">
                                  "{donation.message}"
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-amber-600 dark:text-amber-400">
                              {formatCurrency(donation.amount)}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {donation.createdAt.toLocaleDateString()}
                            </div>
                          </div>
                        </GlassCard>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'updates' && (
                  <div className="space-y-4">
                    {updates.length === 0 ? (
                      <EmptyState
                        type="generic"
                        title="No Updates Yet"
                        description="Check back later for campaign updates."
                        compact
                      />
                    ) : (
                      updates.map(update => (
                        <GlassCard key={update.id}>
                          <div className="text-sm text-zinc-500 dark:text-slate-400 mb-2">
                            {update.createdAt.toLocaleDateString()}
                          </div>
                          <h4 className="font-bold text-lg mb-2">{update.title}</h4>
                          <div className="whitespace-pre-wrap">{update.content}</div>
                        </GlassCard>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Donation Card */}
            <div className="md:col-span-1">
              <div className="sticky top-28">
                <GlassCard className="space-y-6">
                  {/* Progress */}
                  <div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(campaign.raisedAmount)}
                      </span>
                      <span className="text-zinc-500 dark:text-slate-400">
                        of {formatCurrency(campaign.goalAmount)}
                      </span>
                    </div>
                    <ProgressBar value={progress} variant="gold" className="h-3" />
                    <div className="flex justify-between text-sm text-zinc-500 dark:text-slate-400 mt-2">
                      <span>{progress}% funded</span>
                      <span>{campaign.donorCount} donors</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl">
                      <Users className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
                      <div className="font-bold">{campaign.donorCount}</div>
                      <div className="text-xs text-zinc-500">Donors</div>
                    </div>
                    {daysLeft !== null ? (
                      <div className="text-center p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl">
                        <Clock className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
                        <div className="font-bold">{daysLeft}</div>
                        <div className="text-xs text-zinc-500">Days Left</div>
                      </div>
                    ) : (
                      <div className="text-center p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl">
                        <Calendar className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
                        <div className="font-bold">Open</div>
                        <div className="text-xs text-zinc-500">No Deadline</div>
                      </div>
                    )}
                  </div>

                  {/* Donate Button */}
                  <Button 
                    variant="gold" 
                    className="w-full py-4 text-lg"
                    onClick={() => setShowDonateModal(true)}
                  >
                    <Heart className="w-5 h-5 mr-2" /> Donate Now
                  </Button>

                  {/* Zero Fees Badge */}
                  <div className="text-center text-sm text-zinc-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      ✨ <strong>0% platform fee</strong> — every dollar counts
                    </span>
                  </div>

                  {/* Share Button */}
                  <Button variant="ghost" className="w-full" onClick={handleShare}>
                    <Share2 className="w-4 h-4 mr-2" /> Share Campaign
                  </Button>
                </GlassCard>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Donate Modal */}
      {campaign && (
        <DonateModal
          isOpen={showDonateModal}
          onClose={() => setShowDonateModal(false)}
          campaign={campaign}
          onSuccess={handleDonationSuccess}
        />
      )}
    </div>
  );
};

export default CampaignDetail;
