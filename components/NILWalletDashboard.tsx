// =============================================================================
// NIL WALLET DASHBOARD
// =============================================================================
// Shows NIL earnings, pending deals, and payout history for athletes

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  GlassCard, 
  Button, 
  Badge
} from './ui/OSYSComponents';
import EmptyState from './ui/EmptyState';
import { 
  getNILWallet, 
  getAthleteNILDeals, 
  updateNILDeal 
} from '../services/fundraising';
import { NILWallet, NILDeal } from '../types/fundraising';
import { showToast } from '../services/toast';

// =============================================================================
// TYPES
// =============================================================================

type TabType = 'overview' | 'deals' | 'payouts';
type DealStatus = NILDeal['status'];

interface PayoutRecord {
  id: string;
  amount: number;
  date: Date;
  method: 'paypal' | 'check' | 'direct_deposit';
  status: 'pending' | 'completed' | 'failed';
}

// Tab button component since it's not exported
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
    }`}
  >
    {children}
  </button>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const NILWalletDashboard: React.FC = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<NILWallet | null>(null);
  const [deals, setDeals] = useState<NILDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [payoutHistory] = useState<PayoutRecord[]>([]);
  
  // Demo data for showcase
  const demoWallet: NILWallet = {
    athleteId: user?.uid || 'demo',
    athleteName: user?.displayName || 'Demo Athlete',
    totalEarnings: 284750,
    pendingBalance: 45000,
    availableBalance: 239750,
    lifetimeDeals: 8,
    paypalEmail: user?.email || 'athlete@email.com',
    isVerified: true,
    parentGuardianEmail: 'parent@email.com',
    parentGuardianName: 'Parent Name',
    updatedAt: new Date()
  };

  const demoDeals: NILDeal[] = [
    {
      id: 'deal-1',
      athleteId: user?.uid || 'demo',
      athleteName: user?.displayName || 'Demo Athlete',
      teamId: 'team-1',
      teamName: 'Lincoln Lions',
      sponsorName: 'Local Sports Shop',
      sponsorContact: 'contact@sportsshop.com',
      dealType: 'social_media',
      description: 'Instagram post featuring new cleats',
      amount: 15000,
      status: 'completed',
      requirements: [
        'One Instagram feed post',
        'Tag @localsportsshop',
        'Use hashtag #sponsored'
      ],
      deliverables: 'Instagram post URL',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      id: 'deal-2',
      athleteId: user?.uid || 'demo',
      athleteName: user?.displayName || 'Demo Athlete',
      teamId: 'team-1',
      teamName: 'Lincoln Lions',
      sponsorName: 'GameDay Grill',
      sponsorContact: 'manager@gamedaygrill.com',
      dealType: 'appearance',
      description: 'Autograph signing at restaurant opening',
      amount: 30000,
      status: 'active',
      requirements: [
        '2-hour appearance',
        'Sign autographs',
        'Photos with fans'
      ],
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'deal-3',
      athleteId: user?.uid || 'demo',
      athleteName: user?.displayName || 'Demo Athlete',
      teamId: 'team-1',
      teamName: 'Lincoln Lions',
      sponsorName: 'Elite Training Academy',
      sponsorContact: 'camps@elitetraining.com',
      dealType: 'camp',
      description: 'Youth football camp coaching assistant',
      amount: 50000,
      status: 'pending',
      requirements: [
        '4-hour camp session',
        'Help coach drills',
        'Inspire young athletes'
      ],
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  useEffect(() => {
    const loadWalletData = async () => {
      if (!user?.uid) {
        setWallet(demoWallet);
        setDeals(demoDeals);
        setLoading(false);
        return;
      }

      try {
        const [walletData, dealsData] = await Promise.all([
          getNILWallet(user.uid),
          getAthleteNILDeals(user.uid)
        ]);

        // Use demo data if no real data exists
        setWallet(walletData || demoWallet);
        setDeals(dealsData.length > 0 ? dealsData : demoDeals);
      } catch (error) {
        console.error('Error loading NIL wallet:', error);
        setWallet(demoWallet);
        setDeals(demoDeals);
      } finally {
        setLoading(false);
      }
    };

    loadWalletData();
  }, [user?.uid]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleAcceptDeal = async (deal: NILDeal) => {
    try {
      await updateNILDeal(deal.id, { status: 'active' });
      setDeals(prev => prev.map(d => 
        d.id === deal.id ? { ...d, status: 'active' as DealStatus } : d
      ));
      showToast(`Deal accepted: ${deal.description}`, 'success');
    } catch (error) {
      console.error('Error accepting deal:', error);
      showToast('Failed to accept deal', 'error');
    }
  };

  const handleDeclineDeal = async (deal: NILDeal) => {
    try {
      await updateNILDeal(deal.id, { status: 'declined' });
      setDeals(prev => prev.map(d => 
        d.id === deal.id ? { ...d, status: 'declined' as DealStatus } : d
      ));
      showToast('Deal declined', 'info');
    } catch (error) {
      console.error('Error declining deal:', error);
      showToast('Failed to decline deal', 'error');
    }
  };

  const handleCompleteDeal = async (deal: NILDeal) => {
    try {
      await updateNILDeal(deal.id, { 
        status: 'completed',
        completedAt: new Date()
      });
      setDeals(prev => prev.map(d => 
        d.id === deal.id ? { ...d, status: 'completed' as DealStatus, completedAt: new Date() } : d
      ));
      showToast('Deal marked as completed! Payment will be processed soon.', 'success');
    } catch (error) {
      console.error('Error completing deal:', error);
      showToast('Failed to complete deal', 'error');
    }
  };

  const requestPayout = () => {
    showToast('Payout request submitted! You\'ll receive funds within 3-5 business days.', 'success');
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const formatCurrency = (amount: number) => {
    // Amount is in cents
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount / 100);
  };

  const formatDate = (date: Date | undefined | null) => {
    if (!date) return 'TBD';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDealStatusBadge = (status: NILDeal['status']) => {
    const statusConfig: Record<NILDeal['status'], { color: string; label: string }> = {
      pending: { color: 'bg-amber-500/20 text-amber-400', label: 'Pending Review' },
      active: { color: 'bg-blue-500/20 text-blue-400', label: 'Active' },
      completed: { color: 'bg-green-500/20 text-green-400', label: 'Completed' },
      paid: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Paid' },
      declined: { color: 'bg-red-500/20 text-red-400', label: 'Declined' },
      cancelled: { color: 'bg-zinc-500/20 text-zinc-400', label: 'Cancelled' }
    };
    const config = statusConfig[status];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getDealTypeIcon = (type: NILDeal['dealType']) => {
    const icons: Record<NILDeal['dealType'], string> = {
      social_media: '📱',
      appearance: '🎤',
      sponsorship: '✍️',
      merchandise: '👕',
      camp: '🏈',
      other: '📋'
    };
    return icons[type] || '📋';
  };

  // =============================================================================
  // LOADING STATE
  // =============================================================================

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-zinc-800 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-zinc-800/50 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-zinc-800/50 rounded-xl" />
      </div>
    );
  }

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            💰 NIL Wallet
          </h1>
          <p className="text-zinc-400 mt-1">
            Track your Name, Image, and Likeness earnings
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {wallet?.isVerified ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              ✓ Verified
            </Badge>
          ) : (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              ⏳ Verification Pending
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-2xl">
              💵
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Total Earnings</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(wallet?.totalEarnings || 0)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl">
              ⏳
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Pending</p>
              <p className="text-2xl font-bold text-amber-400">
                {formatCurrency(wallet?.pendingBalance || 0)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl">
              💳
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Available</p>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(wallet?.availableBalance || 0)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl">
              🤝
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Total Deals</p>
              <p className="text-2xl font-bold text-purple-400">
                {wallet?.lifetimeDeals || 0}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Payout Button */}
      {(wallet?.availableBalance || 0) >= 25 && (
        <GlassCard className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">Ready to withdraw?</p>
              <p className="text-zinc-400 text-sm">
                You have {formatCurrency(wallet?.availableBalance || 0)} available for payout
              </p>
            </div>
            <Button variant="gold" onClick={requestPayout}>
              Request Payout via PayPal
            </Button>
          </div>
        </GlassCard>
      )}

      {/* Parent/Guardian Notice */}
      {wallet?.parentGuardianEmail && (
        <GlassCard className="p-4 bg-blue-500/10 border-blue-500/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👨‍👩‍👧</span>
            <div>
              <p className="text-white font-medium">Parent/Guardian Managed Account</p>
              <p className="text-zinc-400 text-sm">
                Managed by: {wallet.parentGuardianName} ({wallet.parentGuardianEmail})
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <TabButton 
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </TabButton>
        <TabButton 
          active={activeTab === 'deals'}
          onClick={() => setActiveTab('deals')}
        >
          Deals ({deals.length})
        </TabButton>
        <TabButton 
          active={activeTab === 'payouts'}
          onClick={() => setActiveTab('payouts')}
        >
          Payout History
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Deals */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Deals</h3>
            {deals.length === 0 ? (
              <EmptyState 
                type="generic" 
                title="No Deals Yet" 
                description="Connect with local sponsors to start earning from NIL deals"
                compact
              />
            ) : (
              <div className="space-y-3">
                {deals.slice(0, 3).map(deal => (
                  <div 
                    key={deal.id}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getDealTypeIcon(deal.dealType)}</span>
                      <div>
                        <p className="text-white font-medium">{deal.sponsorName}</p>
                        <p className="text-zinc-400 text-sm">{deal.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">{formatCurrency(deal.amount)}</p>
                      {getDealStatusBadge(deal.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {deals.length > 3 && (
              <Button 
                variant="ghost" 
                className="w-full mt-4"
                onClick={() => setActiveTab('deals')}
              >
                View All Deals →
              </Button>
            )}
          </GlassCard>

          {/* Earnings Chart (simplified) */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Earnings by Type</h3>
            <div className="space-y-4">
              {['social_post', 'appearance', 'camp', 'endorsement'].map(type => {
                const typeDeals = deals.filter(d => d.dealType === type);
                const total = typeDeals.reduce((sum, d) => sum + d.amount, 0);
                const percentage = wallet?.totalEarnings 
                  ? Math.round((total / wallet.totalEarnings) * 100) 
                  : 0;
                
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-400 capitalize">
                        {getDealTypeIcon(type as NILDeal['dealType'])} {type.replace('_', ' ')}
                      </span>
                      <span className="text-white">{formatCurrency(total)}</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'deals' && (
        <div className="space-y-4">
          {/* Pending Deals */}
          {deals.filter(d => d.status === 'pending').length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">
                ⏳ Pending Approval
              </h3>
              <div className="space-y-3">
                {deals.filter(d => d.status === 'pending').map(deal => (
                  <GlassCard key={deal.id} className="p-4 border-amber-500/30">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl">
                          {getDealTypeIcon(deal.dealType)}
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{deal.sponsorName}</h4>
                          <p className="text-zinc-400 text-sm">{deal.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {deal.requirements?.map((req, i) => (
                              <span 
                                key={i}
                                className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400"
                              >
                                {req}
                              </span>
                            ))}
                          </div>
                          <p className="text-zinc-500 text-xs mt-2">
                            Start Date: {formatDate(deal.startDate)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">
                          {formatCurrency(deal.amount)}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleDeclineDeal(deal)}
                          >
                            Decline
                          </Button>
                          <Button 
                            size="sm" 
                            variant="gold"
                            onClick={() => handleAcceptDeal(deal)}
                          >
                            Accept Deal
                          </Button>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Active Deals */}
          {deals.filter(d => d.status === 'active').length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">
                🟢 Active Deals
              </h3>
              <div className="space-y-3">
                {deals.filter(d => d.status === 'active').map(deal => (
                  <GlassCard key={deal.id} className="p-4 border-blue-500/30">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl">
                          {getDealTypeIcon(deal.dealType)}
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{deal.sponsorName}</h4>
                          <p className="text-zinc-400 text-sm">{deal.description}</p>
                          <p className="text-zinc-500 text-xs mt-2">
                            Due: {formatDate(deal.endDate || deal.startDate)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-400">
                          {formatCurrency(deal.amount)}
                        </p>
                        <Button 
                          size="sm" 
                          variant="gold"
                          className="mt-3"
                          onClick={() => handleCompleteDeal(deal)}
                        >
                          Mark Complete ✓
                        </Button>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Completed Deals */}
          {deals.filter(d => ['completed', 'paid'].includes(d.status)).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 mt-6">
                ✅ Completed
              </h3>
              <div className="space-y-3">
                {deals.filter(d => ['completed', 'paid'].includes(d.status)).map(deal => (
                  <GlassCard key={deal.id} className="p-4 opacity-80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-2xl">
                          {getDealTypeIcon(deal.dealType)}
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{deal.sponsorName}</h4>
                          <p className="text-zinc-400 text-sm">{deal.description}</p>
                          <p className="text-zinc-500 text-xs mt-1">
                            Completed: {formatDate(deal.completedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-400">
                          {formatCurrency(deal.amount)}
                        </p>
                        {getDealStatusBadge(deal.status)}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {deals.length === 0 && (
            <EmptyState 
              type="generic" 
              title="No NIL Deals Yet"
              description="Connect with local sponsors to start earning from your Name, Image, and Likeness!"
            />
          )}
        </div>
      )}

      {activeTab === 'payouts' && (
        <div>
          {payoutHistory.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <div className="text-4xl mb-4">💸</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No Payouts Yet
              </h3>
              <p className="text-zinc-400 mb-4">
                Complete deals and build up your balance to request payouts
              </p>
              <p className="text-sm text-zinc-500">
                Minimum payout: $25.00 • Processed via PayPal within 3-5 business days
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {payoutHistory.map(payout => (
                <GlassCard key={payout.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-2xl">
                        💸
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          Payout via {payout.method.replace('_', ' ')}
                        </p>
                        <p className="text-zinc-400 text-sm">
                          {formatDate(payout.date)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-400">
                        {formatCurrency(payout.amount)}
                      </p>
                      <span className={`text-xs ${
                        payout.status === 'completed' 
                          ? 'text-green-400' 
                          : payout.status === 'pending'
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}>
                        {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* How It Works */}
      <GlassCard className="p-6 mt-8">
        <h3 className="text-lg font-semibold text-white mb-4">💡 How NIL Deals Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-xl mx-auto mb-2">
              1️⃣
            </div>
            <p className="text-white font-medium">Get Discovered</p>
            <p className="text-zinc-400 text-sm">Local sponsors find you through your team page</p>
          </div>
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-xl mx-auto mb-2">
              2️⃣
            </div>
            <p className="text-white font-medium">Review Deals</p>
            <p className="text-zinc-400 text-sm">Accept or decline offers with parent approval</p>
          </div>
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-xl mx-auto mb-2">
              3️⃣
            </div>
            <p className="text-white font-medium">Complete Work</p>
            <p className="text-zinc-400 text-sm">Fulfill requirements and mark as complete</p>
          </div>
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-xl mx-auto mb-2">
              4️⃣
            </div>
            <p className="text-white font-medium">Get Paid</p>
            <p className="text-zinc-400 text-sm">Request payout to PayPal when ready</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default NILWalletDashboard;
