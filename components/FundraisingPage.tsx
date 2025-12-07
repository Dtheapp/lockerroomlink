import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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

// Sample campaign data
const campaigns = [
  {
    id: 1,
    featured: true,
    sport: '🏈',
    team: 'Eastside Eagles',
    teamInitials: 'EE',
    verified: true,
    title: 'National Championship Trip - Orlando 2026',
    description: 'Help our JV team compete at the National Youth Football Championship! We need to cover travel, hotel, and entry fees.',
    raised: 8450,
    goal: 12000,
    daysLeft: 12,
    donors: 147,
    type: 'team'
  },
  {
    id: 2,
    sport: '🏀',
    team: 'Westside Hoops',
    teamInitials: 'WH',
    title: 'New Uniforms & Equipment',
    description: 'Our team needs new jerseys and practice equipment for the upcoming season.',
    raised: 2100,
    goal: 3500,
    daysLeft: 21,
    donors: 89,
    type: 'team'
  },
  {
    id: 3,
    sport: '⚽',
    team: 'Striker United',
    teamInitials: 'SU',
    title: 'Regional Tournament Travel Fund',
    description: 'Help us get to the Southwest Regional Championship in Phoenix!',
    raised: 4800,
    goal: 6000,
    daysLeft: 8,
    donors: 112,
    type: 'team'
  },
  {
    id: 4,
    sport: '🏈',
    athlete: 'Marcus Johnson',
    athleteInitials: 'MJ',
    title: 'Elite QB Academy - Summer Camp',
    description: 'Help me attend the Elite QB Academy this summer to develop my skills and compete at the next level!',
    raised: 1850,
    goal: 2500,
    daysLeft: 18,
    donors: 42,
    type: 'athlete',
    rating: '4-Star'
  },
  {
    id: 5,
    sport: '🏐',
    athlete: 'Sarah Chen',
    athleteInitials: 'SC',
    title: 'National Volleyball Camp',
    description: 'Support my journey to the USA Volleyball National Training Camp in Colorado Springs!',
    raised: 3200,
    goal: 4000,
    daysLeft: 15,
    donors: 67,
    type: 'athlete',
    rating: '3-Star'
  }
];

const topDonors = [
  { name: 'The Wilson Family', amount: 5000, badge: '🏆 Champion' },
  { name: 'Coach Mike Roberts', amount: 2500, badge: '⭐ All-Star' },
  { name: 'Atlanta Youth Sports Foundation', amount: 2000, badge: '🎖️ MVP' },
  { name: 'Johnson Family', amount: 1500, badge: null },
  { name: 'Local Business Alliance', amount: 1200, badge: null },
];

const FundraisingPage: React.FC = () => {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Teams', 'Athletes', 'Tournaments', 'Equipment'];

  const filteredCampaigns = filter === 'All' 
    ? campaigns 
    : filter === 'Teams' 
      ? campaigns.filter(c => c.type === 'team')
      : filter === 'Athletes'
        ? campaigns.filter(c => c.type === 'athlete')
        : campaigns;

  return (
    <div className="min-h-screen text-white">
      <AnimatedBackground />

      {/* Navigation */}
      <nav className="osys-glass fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xl">
            ⚡
          </div>
          <span className="text-xl font-bold">OSYS</span>
        </Link>
        
        <div className="flex items-center gap-3 ml-auto">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Button variant="gold" size="sm">Start Fundraiser</Button>
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
              <p className="text-lg text-slate-400 mb-8">
                Raise money for tournaments, equipment, travel, and more. 
                <strong className="text-white"> Zero platform fees</strong> for youth sports.
              </p>
              <Button variant="gold" size="lg">Create Campaign</Button>
            </div>

            {/* Stats Card */}
            <GlassPanel className="p-8 osys-animate-slide-up">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold osys-text-gradient-gold">$1.2M+</div>
                  <div className="text-sm text-slate-400 mt-1">Total Raised</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">847</div>
                  <div className="text-sm text-slate-400 mt-1">Campaigns</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">15K+</div>
                  <div className="text-sm text-slate-400 mt-1">Donors</div>
                </div>
              </div>
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
              <p className="text-slate-400 text-sm">Support young athletes reaching for their dreams</p>
            </div>
            
            {/* Filter Pills */}
            <div className="flex gap-2 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    filter === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Campaigns Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 osys-stagger">
            {filteredCampaigns.map((campaign) => (
              <GlassCard key={campaign.id} className={campaign.featured ? 'md:col-span-2 lg:col-span-2' : ''}>
                {campaign.featured && (
                  <Badge variant="gold" className="mb-4">⭐ Featured</Badge>
                )}
                
                {/* Sport Icon Header */}
                <div className="flex items-center justify-center text-6xl mb-4 py-4 rounded-xl bg-slate-800/50">
                  {campaign.sport}
                </div>

                {/* Team/Athlete Info */}
                <div className="flex items-center gap-2 mb-3">
                  <Avatar 
                    name={campaign.type === 'athlete' ? campaign.athlete : campaign.team} 
                    size="sm" 
                  />
                  <span className="font-medium">
                    {campaign.type === 'athlete' ? campaign.athlete : campaign.team}
                  </span>
                  {campaign.verified && <Badge variant="success">Verified</Badge>}
                  {campaign.type === 'athlete' && (
                    <Badge variant="gold">{campaign.rating}</Badge>
                  )}
                </div>

                {/* Title & Description */}
                <h3 className="text-lg font-bold mb-2">{campaign.title}</h3>
                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{campaign.description}</p>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>
                      <strong className="text-white">${campaign.raised.toLocaleString()}</strong>
                      <span className="text-slate-500"> raised</span>
                    </span>
                    <span className="text-slate-500">of ${campaign.goal.toLocaleString()}</span>
                  </div>
                  <ProgressBar 
                    value={Math.round((campaign.raised / campaign.goal) * 100)} 
                    variant="gold" 
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>🎯 {Math.round((campaign.raised / campaign.goal) * 100)}% funded</span>
                    <span>⏰ {campaign.daysLeft} days left</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{campaign.donors} donors</span>
                  <div className="flex gap-2">
                    {campaign.type === 'athlete' && (
                      <Button variant="ghost" size="sm">View Profile</Button>
                    )}
                    <Button variant={campaign.featured ? 'gold' : 'primary'} size="sm">
                      Donate
                    </Button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="ghost">Load More Campaigns</Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-6 border-t border-white/5">
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
              { step: '3', title: 'Collect Funds', desc: 'Donations go directly to your account. 0% platform fee for youth sports!' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
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
            {topDonors.map((donor, i) => (
              <GlassCard key={i} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-lg font-bold text-slate-900">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{donor.name}</div>
                    {donor.badge && (
                      <span className="text-xs text-amber-400">{donor.badge}</span>
                    )}
                  </div>
                </div>
                <div className="text-xl font-bold osys-text-gradient-gold">
                  ${donor.amount.toLocaleString()}
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
            <p className="text-lg text-slate-400 mb-6 max-w-xl mx-auto">
              Every dollar goes to young athletes. We believe in supporting youth sports, not profiting from it.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="gold" size="lg">Start Your Campaign</Button>
              <Button variant="ghost" size="lg">Learn More</Button>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                ⚡
              </div>
              <span className="font-bold">OSYS</span>
            </div>
            <div className="flex gap-6 text-sm text-slate-400">
              <Link to="/" className="hover:text-white transition">Home</Link>
              <a href="#" className="hover:text-white transition">Privacy</a>
              <a href="#" className="hover:text-white transition">Terms</a>
              <a href="#" className="hover:text-white transition">Contact</a>
            </div>
            <div className="text-sm text-slate-500">
              © 2025 OSYS. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FundraisingPage;
