// =============================================================================
// FUNDRAISING PAGE
// =============================================================================
// Public page for discovering fundraising campaigns
// Zero platform fees - direct PayPal to recipients

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AnimatedBackground,
  GlassCard,
  GlassPanel,
  Button,
  Badge,
  GradientText,
  ProgressBar,
  Avatar,
  SectionHeader
} from './ui/OSYSComponents';
import { Skeleton } from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import { CreateCampaignModal } from './CreateCampaignModal';
import { DonateModal } from './DonateModal';
import { 
  getPublicCampaigns, 
  getFundraisingStats,
  formatCurrency, 
  calculateProgress, 
  calculateDaysRemaining 
} from '../services/fundraising';
import { FundraisingCampaign, FundraisingStats, CampaignCategory, CampaignType } from '../types/fundraising';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../services/toast';

// Demo data for when no real campaigns exist
const DEMO_CAMPAIGNS: FundraisingCampaign[] = [
  {
    id: 'demo-1',
    type: 'team',
    teamId: 'demo-team',
    createdBy: 'demo-user',
    title: 'National Championship Trip - Orlando 2026',
    description: 'Help our JV team compete at the National Youth Football Championship! We need to cover travel, hotel, and entry fees.',
    story: 'Our team has worked hard all season...',
    category: 'tournament',
    goalAmount: 1200000, // $12,000
    raisedAmount: 845000, // $8,450
    donorCount: 147,
    paypalEmail: 'demo@example.com',
    startDate: new Date(),
    status: 'active',
    isPublic: true,
    isFeatured: true,
    isVerified: true,
    allowAnonymousDonations: true,
    showDonorNames: true,
    showDonorAmounts: true,
    minimumDonation: 100,
    suggestedAmounts: [500, 1000, 2500, 5000, 10000],
    allowPlatformTip: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: [],
    teamName: 'Eastside Eagles',
    sport: '🏈 Football',
    endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000) // 12 days
  },
  {
    id: 'demo-2',
    type: 'team',
    teamId: 'demo-team-2',
    createdBy: 'demo-user',
    title: 'New Uniforms & Equipment',
    description: 'Our team needs new jerseys and practice equipment for the upcoming season.',
    story: 'We are looking forward to a great season...',
    category: 'equipment',
    goalAmount: 350000, // $3,500
    raisedAmount: 210000, // $2,100
    donorCount: 89,
    paypalEmail: 'demo2@example.com',
    startDate: new Date(),
    status: 'active',
    isPublic: true,
    isFeatured: false,
    isVerified: false,
    allowAnonymousDonations: true,
    showDonorNames: true,
    showDonorAmounts: true,
    minimumDonation: 100,
    suggestedAmounts: [500, 1000, 2500, 5000, 10000],
    allowPlatformTip: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: [],
    teamName: 'Westside Hoops',
    sport: '🏀 Basketball',
    endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'demo-3',
    type: 'athlete',
    athleteId: 'demo-athlete',
    createdBy: 'demo-user',
    title: 'Elite QB Academy - Summer Camp',
    description: 'Help me attend the Elite QB Academy this summer to develop my skills and compete at the next level!',
    story: 'I have been playing quarterback for 5 years...',
    category: 'training',
    goalAmount: 250000, // $2,500
    raisedAmount: 185000, // $1,850
    donorCount: 42,
    paypalEmail: 'demo3@example.com',
    startDate: new Date(),
    status: 'active',
    isPublic: true,
    isFeatured: false,
    isVerified: true,
    allowAnonymousDonations: true,
    showDonorNames: true,
    showDonorAmounts: true,
    minimumDonation: 100,
    suggestedAmounts: [500, 1000, 2500, 5000, 10000],
    allowPlatformTip: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: [],
    athleteName: 'Marcus Johnson',
    sport: '🏈 Football'
  }
];

const DEMO_TOP_DONORS = [
  { name: 'The Wilson Family', amount: 500000, badge: '🏆 Champion' },
  { name: 'Coach Mike Roberts', amount: 250000, badge: '⭐ All-Star' },
  { name: 'Atlanta Youth Sports Foundation', amount: 200000, badge: '🎖️ MVP' },
  { name: 'Johnson Family', amount: 150000, badge: null },
  { name: 'Local Business Alliance', amount: 120000, badge: null },
];

const CATEGORY_OPTIONS: { value: CampaignCategory | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All Campaigns', icon: '🌟' },
  { value: 'tournament', label: 'Tournaments', icon: '🏆' },
  { value: 'equipment', label: 'Equipment', icon: '🎒' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'training', label: 'Training', icon: '💪' },
];

const FundraisingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<FundraisingCampaign[]>([]);
  const [stats, setStats] = useState<FundraisingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | CampaignType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CampaignCategory>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<FundraisingCampaign | null>(null);
  const [showDonateModal, setShowDonateModal] = useState(false);

  // Load campaigns and stats
  useEffect(() => {
    const loadData = async () => {
      try {
        const [campaignsData, statsData] = await Promise.all([
          getPublicCampaigns({
            type: filter === 'all' ? undefined : filter,
            category: categoryFilter === 'all' ? undefined : categoryFilter,
            limitCount: 20
          }),
          getFundraisingStats()
        ]);

        // If no real campaigns, use demo data
        if (campaignsData.length === 0) {
          setCampaigns(DEMO_CAMPAIGNS);
          setStats({
            totalRaised: 124000000, // $1.24M
            totalCampaigns: 847,
            activeCampaigns: 156,
            totalDonors: 15234,
            averageDonation: 8500,
            topCampaigns: DEMO_CAMPAIGNS.slice(0, 3)
          });
        } else {
          setCampaigns(campaignsData);
          setStats(statsData);
        }
      } catch (err) {
        console.error('Failed to load campaigns:', err);
        // Fallback to demo data
        setCampaigns(DEMO_CAMPAIGNS);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [filter, categoryFilter]);

  const filteredCampaigns = campaigns.filter(c => {
    if (filter !== 'all' && c.type !== filter) return false;
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    return true;
  });

  const handleDonate = (campaign: FundraisingCampaign) => {
    // Check if it's a demo campaign
    if (campaign.id.startsWith('demo-')) {
      showToast('This is a demo campaign. Create your own to start raising funds!', 'info');
      return;
    }
    setSelectedCampaign(campaign);
    setShowDonateModal(true);
  };

  const handleViewCampaign = (campaign: FundraisingCampaign) => {
    if (campaign.id.startsWith('demo-')) {
      showToast('This is a demo campaign. Create your own to start raising funds!', 'info');
      return;
    }
    navigate(`/fundraising/${campaign.id}`);
  };

  const handleCreateCampaign = () => {
    if (!user) {
      showToast('Please sign in to create a campaign', 'info');
      navigate('/auth');
      return;
    }
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen text-zinc-900 dark:text-white bg-white dark:bg-transparent">
      <div className="hidden dark:block"><AnimatedBackground /></div>
      <div className="dark:hidden fixed inset-0 bg-gradient-to-br from-purple-50 via-white to-indigo-50 -z-10" />

      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-transparent dark:backdrop-blur-xl border border-zinc-200 dark:border-white/10 dark:osys-glass fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 flex items-center gap-8 rounded-2xl shadow-lg dark:shadow-none">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xl">
            ⚡
          </div>
          <span className="text-xl font-bold">OSYS</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-4">
          <Link to="/nil-marketplace" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-orange-400 transition">
            NIL Marketplace
          </Link>
        </div>
        
        <div className="flex items-center gap-3 ml-auto">
          {user ? (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
          ) : (
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
          )}
          <Button variant="gold" size="sm" onClick={handleCreateCampaign}>
            Start Fundraiser
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="osys-animate-slide-up">
              <Badge variant="gold" className="mb-4">💰 Fundraising</Badge>
              <h1 className="osys-text-display mb-4">
                Fund your<br />
                <GradientText variant="gold">dreams</GradientText>
              </h1>
              <p className="text-lg text-zinc-600 dark:text-slate-400 mb-8">
                Raise money for tournaments, equipment, travel, and more. 
                <strong className="text-zinc-900 dark:text-white"> Zero platform fees</strong> for youth sports.
              </p>
              <Button variant="gold" size="lg" onClick={handleCreateCampaign}>
                Create Campaign
              </Button>
            </div>

            {/* Stats Card */}
            <GlassPanel className="p-8 osys-animate-slide-up bg-zinc-50 dark:bg-transparent border border-zinc-200 dark:border-white/10">
              {loading ? (
                <div className="grid grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="text-center">
                      <Skeleton className="h-10 w-20 mx-auto mb-2" />
                      <Skeleton className="h-4 w-16 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-bold osys-text-gradient-gold">
                      {stats ? formatCurrency(stats.totalRaised) : '$0'}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-slate-400 mt-1">Total Raised</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                      {stats?.totalCampaigns || 0}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-slate-400 mt-1">Campaigns</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                      {stats?.totalDonors ? `${(stats.totalDonors / 1000).toFixed(1)}K` : '0'}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-slate-400 mt-1">Donors</div>
                  </div>
                </div>
              )}
            </GlassPanel>
          </div>
        </div>
      </section>

      {/* Active Campaigns */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold">Active Campaigns</h2>
              <p className="text-zinc-500 dark:text-slate-400 text-sm">Support young athletes reaching for their dreams</p>
            </div>
            
            {/* Type Filter Pills */}
            <div className="flex gap-2 flex-wrap">
              {['all', 'team', 'athlete'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as 'all' | CampaignType)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    filter === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-100 dark:bg-slate-800/50 text-zinc-600 dark:text-slate-400 hover:bg-zinc-200 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'team' ? '👥 Teams' : '🏃 Athletes'}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap mb-8">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value === 'all' ? 'all' : cat.value as CampaignCategory)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  categoryFilter === cat.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-zinc-100 dark:bg-slate-800/50 text-zinc-600 dark:text-slate-400 hover:bg-zinc-200 dark:hover:bg-slate-700/50'
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {/* Campaigns Grid */}
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-[350px] rounded-2xl" />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <EmptyState
              type="search"
              title="No Campaigns Found"
              description="No campaigns match your filters. Try adjusting your search or create a new campaign!"
              actionLabel="Create Campaign"
              onAction={handleCreateCampaign}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 osys-stagger">
              {filteredCampaigns.map((campaign) => {
                const progress = calculateProgress(campaign.raisedAmount, campaign.goalAmount);
                const daysLeft = calculateDaysRemaining(campaign.endDate);
                
                return (
                  <GlassCard 
                    key={campaign.id} 
                    className={`cursor-pointer hover:scale-[1.02] transition-transform ${campaign.isFeatured ? 'md:col-span-2 lg:col-span-2' : ''}`}
                    onClick={() => handleViewCampaign(campaign)}
                  >
                    {campaign.isFeatured && (
                      <Badge variant="gold" className="mb-4">⭐ Featured</Badge>
                    )}
                    
                    {/* Sport Icon Header */}
                    <div className="flex items-center justify-center text-6xl mb-4 py-4 rounded-xl bg-zinc-100 dark:bg-slate-800/50">
                      {campaign.coverImage ? (
                        <img src={campaign.coverImage} alt="" className="w-full h-32 object-cover rounded-xl" />
                      ) : (
                        campaign.sport?.split(' ')[0] || '🏆'
                      )}
                    </div>

                    {/* Team/Athlete Info */}
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar 
                        name={campaign.type === 'athlete' ? campaign.athleteName : campaign.teamName} 
                        src={campaign.type === 'athlete' ? campaign.athletePhoto : campaign.teamLogo}
                        size="sm" 
                      />
                      <span className="font-medium">
                        {campaign.type === 'athlete' ? campaign.athleteName : campaign.teamName}
                      </span>
                      {campaign.isVerified && <Badge variant="success">Verified</Badge>}
                      {campaign.type === 'athlete' && (
                        <Badge variant="gold">Athlete</Badge>
                      )}
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-lg font-bold mb-2">{campaign.title}</h3>
                    <p className="text-zinc-500 dark:text-slate-400 text-sm mb-4 line-clamp-2">
                      {campaign.description}
                    </p>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span>
                          <strong className="text-zinc-900 dark:text-white">
                            {formatCurrency(campaign.raisedAmount)}
                          </strong>
                          <span className="text-zinc-400 dark:text-slate-500"> raised</span>
                        </span>
                        <span className="text-zinc-400 dark:text-slate-500">
                          of {formatCurrency(campaign.goalAmount)}
                        </span>
                      </div>
                      <ProgressBar value={progress} variant="gold" />
                      <div className="flex justify-between text-xs text-zinc-400 dark:text-slate-500 mt-2">
                        <span>🎯 {progress}% funded</span>
                        <span>⏰ {daysLeft !== null ? `${daysLeft} days left` : 'No deadline'}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500 dark:text-slate-400">
                        {campaign.donorCount} donors
                      </span>
                      <div className="flex gap-2">
                        <Button 
                          variant={campaign.isFeatured ? 'gold' : 'primary'} 
                          size="sm"
                          onClick={() => handleDonate(campaign)}
                        >
                          Donate
                        </Button>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}

          {filteredCampaigns.length > 0 && (
            <div className="text-center mt-8">
              <Button variant="ghost">Load More Campaigns</Button>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6 border-t border-zinc-200 dark:border-white/5">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            badge="How It Works"
            title="Start raising"
            highlight="in minutes"
          />

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Create Campaign', desc: 'Set your goal, add photos, tell your story. Takes less than 5 minutes.' },
              { step: '2', title: 'Share & Promote', desc: 'Share with family, friends, and your OSYS community. We\'ll help amplify.' },
              { step: '3', title: 'Collect Funds', desc: 'Donations go directly to your PayPal. 0% platform fee for youth sports!' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4 text-white">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-zinc-500 dark:text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Donor Wall */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <SectionHeader
            badge="🏆 Top Supporters"
            title="Community"
            highlight="champions"
          />

          <div className="space-y-3">
            {DEMO_TOP_DONORS.map((donor, i) => (
              <GlassCard key={i} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-lg font-bold text-slate-900">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{donor.name}</div>
                    {donor.badge && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">{donor.badge}</span>
                    )}
                  </div>
                </div>
                <div className="text-xl font-bold osys-text-gradient-gold">
                  {formatCurrency(donor.amount)}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Zero Fees Banner */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <GlassCard className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold mb-4">
              <GradientText variant="gold">0% Platform Fees</GradientText>
            </h2>
            <p className="text-lg text-zinc-600 dark:text-slate-400 mb-6 max-w-xl mx-auto">
              Every dollar goes to young athletes. We believe in supporting youth sports, not profiting from it.
              <span className="block mt-2 text-sm">
                Only PayPal's standard processing fee applies (2.9% + $0.30)
              </span>
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="gold" size="lg" onClick={handleCreateCampaign}>
                Start Your Campaign
              </Button>
              <Link to="/welcome">
                <Button variant="ghost" size="lg">Learn More</Button>
              </Link>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-200 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white">
                ⚡
              </div>
              <span className="font-bold">OSYS</span>
            </div>
            <div className="flex gap-6 text-sm text-zinc-500 dark:text-slate-400">
              <Link to="/" className="hover:text-zinc-900 dark:hover:text-white transition">Home</Link>
              <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition">Privacy</a>
              <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition">Terms</a>
              <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition">Contact</a>
            </div>
            <div className="text-sm text-zinc-400 dark:text-slate-500">
              © 2025 OSYS. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(campaignId) => {
          setShowCreateModal(false);
          navigate(`/fundraising/${campaignId}`);
        }}
      />

      {/* Donate Modal */}
      {selectedCampaign && (
        <DonateModal
          isOpen={showDonateModal}
          onClose={() => {
            setShowDonateModal(false);
            setSelectedCampaign(null);
          }}
          campaign={selectedCampaign}
          onSuccess={() => {
            // Refresh campaigns
            getPublicCampaigns({ limitCount: 20 }).then(data => {
              if (data.length > 0) setCampaigns(data);
            });
          }}
        />
      )}
    </div>
  );
};

export default FundraisingPage;
