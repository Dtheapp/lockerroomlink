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
import { DemoNavigation } from './ui/DemoNavigation';

// Scrolling feature ticker with typewriter effect - types left, scrolls right
const FeatureTicker: React.FC = () => {
  const features = [
    'Social Media',
    'Fundraising', 
    'Livestreams',
    'Ticketing',
    'Playbooks',
    'Registration',
    'Team Stats',
    'Video Library',
    'Fan Engagement',
    'Messaging',
    'Player Profiles',
    'Events'
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
        <span className="text-purple-400 font-medium shrink-0">
          {currentTyping}
          <span className="animate-pulse text-purple-300">|</span>
        </span>
      )}
      {/* Completed features scroll to the RIGHT, getting more faded */}
      {visibleFeatures.map((feature, index) => (
        <span 
          key={`${feature}-${featureIndex}-${index}`}
          className="text-slate-400 transition-all duration-500 shrink-0"
          style={{ 
            opacity: Math.max(0.35, 1 - index * 0.3)
          }}
        >
          <span className="text-purple-500 mx-1">•</span>
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
          <span className="text-xl font-bold">OSYS</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#sports" className="hover:text-white transition">Sports</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
          <Link to="/fundraising" className="hover:text-white transition">Fundraising</Link>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign In</Button>
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

          <h1 className="osys-text-hero osys-animate-slide-up mb-6">
            The Operating System
            <br />
            <GradientText>for Youth Sports</GradientText>
          </h1>

          <div className="text-xl md:text-2xl max-w-3xl mx-auto mb-8 osys-animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="min-h-[2rem] mb-3">
              <FeatureTicker />
            </div>
            <p className="text-slate-500 text-lg">Everything your team needs in one powerful platform.</p>
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
                  <div className="osys-glass p-3 rounded-xl text-sm">
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
          <p className="text-center text-xs text-slate-500 uppercase tracking-widest mb-8">
            Trusted by organizations nationwide
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-slate-500">
            <span>🏫 Atlanta Youth League</span>
            <span>⚡ Texas Elite Sports</span>
            <span>🌟 SoCal Athletics</span>
            <span>🏆 Midwest Champions</span>
            <span>🎯 East Coast Elite</span>
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
              icon="📋"
              title="Smart Playbooks"
              description="Drag-and-drop play designer with animated routes. Share instantly with your team."
              link="/playbook"
            />
            <FeatureCard
              icon="📊"
              title="Live Stats"
              description="Real-time stat tracking during games. Automated analytics and player insights."
              link="/stats"
            />
            <FeatureCard
              icon="📹"
              title="Video Library"
              description="Upload game film, create highlights, and organize footage by player or play."
              link="/videos"
            />
            <FeatureCard
              icon="💰"
              title="Fundraising"
              description="Zero-fee fundraising for teams and individual athletes. Travel to nationals, buy equipment."
              link="/fundraising"
              comingSoon
            />
            <FeatureCard
              icon="📡"
              title="Livestreaming"
              description="One-tap live broadcasts. Fans can watch from anywhere. Automatic highlight clips."
              link="/livestream"
              comingSoon
            />
            <FeatureCard
              icon="💬"
              title="Team Chat"
              description="Secure messaging for coaches, players, and parents. Announcements and direct messages."
              link="/chat"
            />
            <div className="osys-glass px-6 py-8 rounded-2xl flex items-center justify-center text-slate-400">
              <span className="text-2xl mr-3">✨</span>
              <span className="text-lg">& more coming soon...</span>
            </div>
          </div>
        </div>
      </section>

      {/* Sports Section */}
      <section id="sports" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            badge="Sports"
            title="Built for"
            highlight="every sport"
            subtitle="Football, basketball, soccer, baseball, and more."
          />

          <div className="flex flex-wrap justify-center gap-6">
            {['🏈 Football', '🏀 Basketball', '⚽ Soccer', '⚾ Baseball', '🏐 Volleyball'].map((sport) => (
              <div key={sport} className="osys-glass px-6 py-4 text-lg font-medium">
                {sport}
              </div>
            ))}
            <div className="osys-glass px-6 py-4 text-lg font-medium text-slate-400">
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
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <div className="text-4xl font-bold mb-1">$0</div>
              <div className="text-slate-400 text-sm mb-6">Forever free</div>
              <ul className="text-sm text-slate-300 space-y-3 mb-8 text-left">
                <li>✓ Up to 25 players</li>
                <li>✓ Basic playbook</li>
                <li>✓ Team chat</li>
                <li>✓ Game scheduling</li>
              </ul>
              <Link to="/auth?signup=true" className="w-full">
                <Button variant="ghost" className="w-full">Get Started</Button>
              </Link>
            </GlassCard>

            {/* Pro Tier */}
            <GlassCard glow className="text-center relative">
              <Badge variant="gold" className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-bold mb-1">
                <GradientText variant="gold">$29</GradientText>
              </div>
              <div className="text-slate-400 text-sm mb-6">per month</div>
              <ul className="text-sm text-slate-300 space-y-3 mb-8 text-left">
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
              <h3 className="text-xl font-bold mb-2">Elite</h3>
              <div className="text-4xl font-bold mb-1">$99</div>
              <div className="text-slate-400 text-sm mb-6">per month</div>
              <ul className="text-sm text-slate-300 space-y-3 mb-8 text-left">
                <li>✓ Everything in Pro</li>
                <li>✓ Unlimited video storage</li>
                <li>✓ Advanced analytics</li>
                <li>✓ Multi-team management</li>
                <li>✓ Priority support</li>
                <li>✓ Custom branding</li>
              </ul>
              <Button variant="ghost" className="w-full" onClick={() => showToast('📞 Enterprise sales coming soon!', 'info')}>Contact Sales</Button>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <GlassCard className="py-16 px-8">
            <h2 className="osys-text-display mb-4">
              Ready to <GradientText>transform</GradientText> your team?
            </h2>
            <p className="text-lg text-slate-400 mb-8">
              Join thousands of teams already using OSYS to win more games.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/auth?signup=true">
                <Button variant="primary" size="lg">Get Started Free</Button>
              </Link>
              <Button variant="ghost" size="lg" onClick={() => showToast('📅 Demo scheduling coming soon!', 'info')}>Schedule Demo</Button>
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

      {/* Demo Navigation */}
      <DemoNavigation currentPage="welcome" />
      
      {/* Toast */}
      {ToastComponent}
    </div>
  );
};

export default LandingPage;
