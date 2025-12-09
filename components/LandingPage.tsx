import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDemoToast } from '../hooks/useOSYSData';
import {
  AnimatedBackground,
  GlassCard,
  GlassPanel,
  Button,
  Badge,
  GradientText,
  HeroStat,
  FeatureCard,
  SectionHeader
} from '../components/ui/OSYSComponents';

// Scrolling feature ticker with typewriter effect - types left, scrolls right
const FeatureTicker: React.FC = () => {
  const features = [
    'Livestreaming',
    'Zero-Fee Fundraising',
    'Game Ticketing',
    'Team Registration',
    'Design Studio',
    'Smart Playbooks',
    'Live Stats',
    'Film Room',
    'AI Safety',
    'Fan Engagement',
    'Player Profiles',
    'Messaging'
  ];
  
  const [visibleFeatures, setVisibleFeatures] = useState<string[]>([]);
  const [currentTyping, setCurrentTyping] = useState('');
  const [featureIndex, setFeatureIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  
  // Check screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Mobile shows 2 features, desktop shows 3
  const maxVisible = isMobile ? 2 : 3;
  
  useEffect(() => {
    const currentFeature = features[featureIndex % features.length];
    
    if (charIndex < currentFeature.length) {
      // Still typing current feature - slowed down by ~15%
      const timeout = setTimeout(() => {
        setCurrentTyping(currentFeature.substring(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 80);
      return () => clearTimeout(timeout);
    } else {
      // Finished typing, pause then move to next
      const timeout = setTimeout(() => {
        // Add completed feature to visible list (prepend so newest is first)
        setVisibleFeatures(prev => {
          const updated = [currentFeature, ...prev];
          // Keep only the first (maxVisible - 1) completed features
          if (updated.length > maxVisible - 1) {
            return updated.slice(0, maxVisible - 1);
          }
          return updated;
        });
        // Reset for next feature
        setCurrentTyping('');
        setCharIndex(0);
        setFeatureIndex(prev => prev + 1);
      }, 1400);
      return () => clearTimeout(timeout);
    }
  }, [charIndex, featureIndex, features, maxVisible]);
  
  return (
    <div className="flex items-center justify-center gap-x-2 overflow-hidden whitespace-nowrap">
      {/* Currently typing on the LEFT */}
      {currentTyping && (
        <span className="text-purple-300 font-semibold shrink-0 drop-shadow-lg">
          {currentTyping}
          <span className="animate-pulse text-purple-200">|</span>
        </span>
      )}
      {/* Completed features scroll to the RIGHT, getting more faded */}
      {visibleFeatures.map((feature, index) => (
        <span 
          key={`${feature}-${featureIndex}-${index}`}
          className="text-slate-200 transition-all duration-500 shrink-0"
          style={{ 
            opacity: Math.max(0.5, 1 - index * 0.25)
          }}
        >
          <span className="text-purple-400 mx-1">•</span>
          {feature}
        </span>
      ))}
    </div>
  );
};

const LandingPage: React.FC = () => {
  const { showToast, ToastComponent } = useDemoToast();
  
  return (
    <div className="min-h-screen text-white">
      <AnimatedBackground />

      {/* Navigation */}
      <nav className="osys-glass fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xl">
            ⚡
          </div>
          <span className="text-xl font-bold text-slate-900">OSYS</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-700 font-medium">
          <a href="#features" className="hover:text-slate-900 transition">Features</a>
          <a href="#sports" className="hover:text-slate-900 transition">Sports</a>
          <a href="#pricing" className="hover:text-slate-900 transition">Pricing</a>
          <Link to="/fundraising" className="hover:text-slate-900 transition">Fundraising</Link>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <Link to="/auth">
            <button className="px-4 py-2 text-sm font-semibold text-slate-900 hover:text-purple-600 transition">Sign In</button>
          </Link>
          <Link to="/auth?signup=true">
            <Button variant="primary" size="sm">Get Started Free</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24">
        <div className="text-center max-w-5xl mx-auto">
          <div className="osys-animate-slide-down mb-6">
            <Badge variant="primary">🚀 Now supporting 5 sports</Badge>
          </div>

          <h1 className="osys-animate-slide-up mb-6" style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
            <span style={{ color: '#ffffff', textShadow: '0 4px 20px rgba(255,255,255,0.3), 0 0 40px rgba(139,92,246,0.5)' }}>The Operating System</span>
            <br />
            <GradientText>for Youth Sports</GradientText>
          </h1>

          <div className="text-xl md:text-2xl max-w-3xl mx-auto mb-8 osys-animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="min-h-[2rem] mb-3">
              <FeatureTicker />
            </div>
            <p className="text-slate-200 text-lg">Everything your team needs in one powerful platform.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-12 osys-animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link to="/auth?signup=true">
              <Button variant="primary" size="lg">
                Get Started Free
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Button>
            </Link>
            <Button variant="ghost" size="lg" onClick={() => showToast('🎬 Demo video coming soon!', 'info')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Watch Demo
            </Button>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 osys-animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <HeroStat value="50K+" label="Athletes" />
            <div className="w-px h-12 bg-slate-700 hidden md:block" />
            <HeroStat value="2,500+" label="Teams" />
            <div className="w-px h-12 bg-slate-700 hidden md:block" />
            <HeroStat value="$1.2M" label="Raised" />
            <div className="w-px h-12 bg-slate-700 hidden md:block" />
            <HeroStat value="4.9★" label="Rating" />
          </div>
        </div>

        {/* Phone Mockup */}
        <div className="mt-16 osys-animate-float">
          <div className="relative">
            <div className="w-72 h-[500px] bg-slate-900 rounded-[3rem] border-4 border-slate-700 p-3 shadow-2xl">
              <div className="w-full h-full bg-slate-950 rounded-[2.5rem] overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm">🏈 Eagles vs Panthers</span>
                    <Badge variant="live">● LIVE</Badge>
                  </div>
                  <div className="flex justify-between items-center py-6">
                    <div className="text-center">
                      <div className="text-sm text-slate-400">Eagles</div>
                      <div className="text-4xl font-bold">28</div>
                    </div>
                    <div className="text-slate-500">Q4 2:34</div>
                    <div className="text-center">
                      <div className="text-sm text-slate-400">Panthers</div>
                      <div className="text-4xl font-bold">21</div>
                    </div>
                  </div>
                  <div className="bg-slate-800/80 backdrop-blur-sm border border-white/10 p-3 rounded-xl text-sm text-white">
                    <span className="mr-2">🏆</span>
                    TD Pass - M. Johnson → D. Smith
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos Section */}
      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-xs text-slate-300 uppercase tracking-widest mb-8">
            Trusted by organizations nationwide
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-slate-300">
            <span>🏫 Atlanta Youth League</span>
            <span>⚡ Texas Elite Sports</span>
            <span>🌟 SoCal Athletics</span>
            <span>🏆 Midwest Champions</span>
            <span>🎯 East Coast Elite</span>
          </div>
        </div>
      </section>

      {/* AI Comparison CTA - Shiny Banner */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/compare" className="block group">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-pink-900 to-purple-900 border border-purple-500/50 p-8 md:p-12 hover:border-purple-400 transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/30">
              {/* Animated Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              
              {/* Glowing Orbs */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/50 animate-pulse">
                    🤖
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-3 py-1 bg-purple-500/30 border border-purple-400/50 rounded-full text-xs font-semibold text-purple-200">
                        AI-Generated Analysis
                      </span>
                      <span className="text-yellow-400 animate-pulse">✨</span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-white">
                      OSYS vs <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Everyone</span>
                    </h3>
                    <p className="text-slate-300 mt-1">See how we compare to TeamSnap, GameChanger, Hudl & more — <span className="text-purple-300 font-semibold">100+ features</span> analyzed by AI</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex flex-col items-end text-right">
                    <span className="text-4xl font-black text-white">6x</span>
                    <span className="text-sm text-slate-400">more features</span>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    <svg className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Bottom Stats Row */}
              <div className="relative z-10 mt-6 pt-6 border-t border-white/10 flex flex-wrap justify-center gap-6 md:gap-12 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-400">✓</div>
                  <div className="text-xs text-slate-400">Private Coaching</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">✓</div>
                  <div className="text-xs text-slate-400">Zero-Fee Fundraising</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">✓</div>
                  <div className="text-xs text-slate-400">Cheer Support</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">✓</div>
                  <div className="text-xs text-slate-400">Referee System</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">✓</div>
                  <div className="text-xs text-slate-400">Grievance Reporting</div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* How It Works - Parent-Athlete Connection */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            badge="How It Works"
            title="Built for"
            highlight="the whole family"
            subtitle="Parents link directly to their athletes for a connected experience."
          />

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <GlassCard className="text-center">
              <div className="text-4xl mb-4">👨‍👩‍👧‍👦</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#1e293b' }}>Parents Link to Athletes</h3>
              <p style={{ color: '#334155' }}>One account connects to all your children. See their stats, games, and team updates in one dashboard.</p>
            </GlassCard>
            <GlassCard className="text-center">
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#1e293b' }}>Full Play Traceability</h3>
              <p style={{ color: '#334155' }}>Every stat links back to the play it came from. Watch the film, see the play diagram, review the details.</p>
            </GlassCard>
            <GlassCard className="text-center">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#1e293b' }}>AI-Monitored Safety</h3>
              <p style={{ color: '#334155' }}>All chats and posts are scanned for harmful content. Profanity filters, grooming detection, and 24/7 monitoring.</p>
            </GlassCard>
          </div>

          <div className="mt-12 bg-slate-800/80 backdrop-blur-md border border-white/10 rounded-2xl p-8">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <Badge variant="gold" className="mb-4">World-Class Traceability</Badge>
                <h3 className="text-2xl font-bold mb-4 text-white">From Stats to Plays to Film</h3>
                <p className="text-slate-200 mb-4">
                  OSYS connects everything. When you record a touchdown, you can tag the exact play from your playbook and link to the game film. Parents and scouts can trace any stat back to its source.
                </p>
                <ul className="space-y-2 text-slate-200">
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">✓</span> Stats linked to specific plays
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">✓</span> Video clips tagged by player and play
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">✓</span> Formation success rates calculated automatically
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">✓</span> Parent dashboard with all child stats
                  </li>
                </ul>
              </div>
              <div className="bg-slate-700/80 backdrop-blur-md border border-white/10 rounded-xl p-6">
                <div className="text-sm text-slate-300 mb-3">Example Stat Trace</div>
                <div className="space-y-3">
                  <div className="bg-slate-600/80 rounded-lg p-3 flex items-center justify-between text-white">
                    <span>🏈 TD Pass</span>
                    <span className="text-purple-400">→</span>
                  </div>
                  <div className="bg-slate-600/80 rounded-lg p-3 flex items-center justify-between text-white">
                    <span>📋 "Power Sweep Right"</span>
                    <span className="text-purple-400">→</span>
                  </div>
                  <div className="bg-slate-600/80 rounded-lg p-3 flex items-center justify-between text-white">
                    <span>🎬 Game Film 2:34</span>
                    <span className="text-emerald-400">✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            badge="Features"
            title="Everything your"
            highlight="team needs"
            subtitle="One platform. Infinite possibilities."
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 osys-stagger">
            <FeatureCard
              icon="📡"
              title="Live Game Streaming"
              description="One-tap broadcasts with real-time scores. Multi-camera support, instant highlights, and donation tipping during streams."
              link="/livestream"
            />
            <FeatureCard
              icon="💰"
              title="Zero-Fee Fundraising"
              description="100% goes to the team. Individual athlete campaigns, team equipment drives, and tournament travel funds."
              link="/fundraising"
            />
            <FeatureCard
              icon="🎟️"
              title="Game Ticketing"
              description="Sell tickets online, scan at the gate with QR codes. Reserved seating, season passes, and family bundles."
              link="/events"
            />
            <FeatureCard
              icon="📝"
              title="Team Registration"
              description="Online signups with waivers, payment collection, and roster management. Parents link directly to their athletes."
              link="/events"
            />
            <FeatureCard
              icon="🎨"
              title="Design Studio"
              description="Create professional graphics, team posters, player cards, and social media content with our drag-and-drop editor."
              link="/design"
            />
            <FeatureCard
              icon="📋"
              title="Smart Playbooks"
              description="Drag-and-drop play designer with animated routes. Assign positions and share instantly with your team."
              link="/playbook"
            />
            <FeatureCard
              icon="📊"
              title="Live Stats & Analytics"
              description="Real-time stat tracking with per-play traceability. Know exactly which plays are working."
              link="/stats"
            />
            <FeatureCard
              icon="📹"
              title="Video Film Room"
              description="Upload game film, tag players, create highlights, and trace plays back to your playbook."
              link="/videos"
            />
            <FeatureCard
              icon="🛡️"
              title="AI Safety Monitoring"
              description="All content is monitored by AI to protect kids. Profanity filters, grooming detection, and real-time moderation."
              link="/chat"
            />
          </div>
        </div>
      </section>

      {/* Sports Section */}
      <section id="sports" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            title="Built for many sports"
            subtitle="Football, basketball, soccer, baseball, and more."
          />

          <div className="flex flex-wrap justify-center gap-6">
            {['🏈 Football', '🏀 Basketball', '⚽ Soccer', '⚾ Baseball', '🏐 Volleyball'].map((sport) => (
              <div key={sport} className="bg-slate-800/90 backdrop-blur-md border border-purple-500/30 px-6 py-4 text-lg font-semibold text-white rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:border-purple-400/50 transition-all">
                {sport}
              </div>
            ))}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-lg font-semibold text-white rounded-xl shadow-lg shadow-purple-500/30">
              ✨ & more
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            badge="Pricing"
            title="Simple,"
            highlight="transparent pricing"
            subtitle="Start free. Upgrade when you're ready."
          />

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free Tier */}
            <GlassCard className="text-center">
              <h3 className="text-xl font-bold mb-2" style={{ color: '#1e293b' }}>Starter</h3>
              <div className="text-4xl font-bold mb-1" style={{ color: '#1e293b' }}>$0</div>
              <div className="text-sm mb-6" style={{ color: '#475569' }}>Forever free</div>
              <ul className="text-sm space-y-3 mb-8 text-left" style={{ color: '#334155' }}>
                <li>✓ Up to 25 players</li>
                <li>✓ Basic playbook</li>
                <li>✓ Team chat</li>
                <li>✓ Game scheduling</li>
              </ul>
              <Link to="/auth?signup=true" className="w-full">
                <Button variant="primary" className="w-full">Get Started</Button>
              </Link>
            </GlassCard>

            {/* Pro Tier */}
            <GlassCard glow className="text-center relative">
              <Badge variant="gold" className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-lg">
                Most Popular
              </Badge>
              <h3 className="text-xl font-bold mb-2 mt-4" style={{ color: '#1e293b' }}>Pro</h3>
              <div className="text-4xl font-bold mb-1" style={{ color: '#f59e0b' }}>
                $29
              </div>
              <div className="text-sm mb-6" style={{ color: '#475569' }}>per month</div>
              <ul className="text-sm space-y-3 mb-8 text-left" style={{ color: '#334155' }}>
                <li>✓ Unlimited players</li>
                <li>✓ Advanced playbook</li>
                <li>✓ Live stats tracking</li>
                <li>✓ Video library (50GB)</li>
                <li>✓ Livestreaming</li>
                <li>✓ Fundraising tools</li>
              </ul>
              <Link to="/auth?signup=true" className="w-full">
                <Button variant="gold" className="w-full">Start Free Trial</Button>
              </Link>
            </GlassCard>

            {/* Elite Tier */}
            <GlassCard className="text-center">
              <h3 className="text-xl font-bold mb-2" style={{ color: '#1e293b' }}>Elite</h3>
              <div className="text-4xl font-bold mb-1" style={{ color: '#1e293b' }}>$99</div>
              <div className="text-sm mb-6" style={{ color: '#475569' }}>per month</div>
              <ul className="text-sm space-y-3 mb-8 text-left" style={{ color: '#334155' }}>
                <li>✓ Everything in Pro</li>
                <li>✓ Unlimited video storage</li>
                <li>✓ Advanced analytics</li>
                <li>✓ Multi-team management</li>
                <li>✓ Priority support</li>
                <li>✓ Custom branding</li>
              </ul>
              <Button variant="primary" className="w-full" onClick={() => showToast('📞 Enterprise sales coming soon!', 'info')}>Contact Sales</Button>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <GlassCard className="py-16 px-8">
            <h2 className="mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 700 }}>
              <span style={{ color: '#1e293b' }}>Ready to </span>
              <GradientText>transform</GradientText>
              <span style={{ color: '#1e293b' }}> your team?</span>
            </h2>
            <p className="text-lg mb-8" style={{ color: '#334155' }}>
              Join thousands of teams already using OSYS to win more games.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/auth?signup=true">
                <Button variant="primary" size="lg">Get Started Free</Button>
              </Link>
              <Button variant="gold" size="lg" onClick={() => showToast('📅 Demo scheduling coming soon!', 'info')}>Schedule Demo</Button>
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
              <span className="font-bold text-white">OSYS</span>
            </div>
            <div className="flex gap-6 text-sm text-slate-300">
              <a href="#" className="hover:text-white transition">Privacy</a>
              <a href="#" className="hover:text-white transition">Terms</a>
              <a href="#" className="hover:text-white transition">Contact</a>
            </div>
            <div className="text-sm text-slate-300">
              © 2025 OSYS. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
      
      {/* Toast */}
      {ToastComponent}
    </div>
  );
};

export default LandingPage;
