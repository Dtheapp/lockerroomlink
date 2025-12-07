import React from 'react';
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
  StatCard
} from './ui/OSYSComponents';
import { DemoNavigation } from './ui/DemoNavigation';

const upcomingEvents = [
  { day: '12', month: 'DEC', title: 'vs. Panthers', meta: '🏟️ Home • 7:00 PM', type: 'Game Day', typeVariant: 'primary' as const },
  { day: '10', month: 'DEC', title: 'Practice', meta: '📍 Main Field • 4:00 PM', type: 'Practice', typeVariant: 'default' as const },
  { day: '14', month: 'DEC', title: 'Film Review Session', meta: '🎬 Team Room • 5:00 PM', type: 'Meeting', typeVariant: 'default' as const },
];

const quickActions = [
  { icon: '📋', label: 'New Play', link: '/playbook' },
  { icon: '📺', label: 'Go Live', link: '#', comingSoon: true },
  { icon: '📢', label: 'Announce', link: '/chat' },
  { icon: '📊', label: 'Log Stats', link: '/stats' },
  { icon: '💰', label: 'Fundraise', link: '/fundraising', comingSoon: true },
  { icon: '💫', label: 'Send Kudos', link: '#' },
];

const recentActivity = [
  { avatar: 'MJ', name: 'Marcus Johnson', action: 'posted a new highlight video', time: '2 hours ago', isGold: true },
  { avatar: 'DS', name: 'DeAndre Smith', action: 'confirmed attendance for practice', time: '3 hours ago' },
  { avatar: '💰', name: 'Donation', action: '$150 from Johnson Family', time: '5 hours ago', isIcon: true },
  { avatar: '📋', name: 'Playbook', action: '"Shotgun Y-Cross" viewed by 28 players', time: 'Yesterday', isIcon: true },
];

const OSYSDashboard: React.FC = () => {
  return (
    <div className="min-h-screen text-white">
      <AnimatedBackground />

      {/* Sidebar */}
      <aside className="osys-sidebar">
        <div className="osys-sidebar-logo">
          <div className="osys-sidebar-logo-icon">⚡</div>
          <span className="osys-sidebar-logo-text">OSYS</span>
        </div>

        <nav className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-4">Main</div>
          <Link to="/dashboard" className="osys-nav-item active">
            <span>📊</span>
            <span>Dashboard</span>
          </Link>
          <Link to="/playbook" className="osys-nav-item">
            <span>📋</span>
            <span>Playbook</span>
          </Link>
          <Link to="/roster" className="osys-nav-item">
            <span>👥</span>
            <span>Roster</span>
          </Link>
          <Link to="/events" className="osys-nav-item">
            <span>📅</span>
            <span>Schedule</span>
          </Link>

          <div className="text-xs text-slate-500 uppercase tracking-wider mt-6 mb-2 px-4">Engage</div>
          <Link to="/messenger" className="osys-nav-item">
            <span>💬</span>
            <span>Messages</span>
            <span className="ml-auto bg-purple-600 text-xs px-2 py-0.5 rounded-full">3</span>
          </Link>
          <Link to="/videos" className="osys-nav-item">
            <span>📺</span>
            <span>Livestream</span>
          </Link>
          <Link to="/fundraising" className="osys-nav-item">
            <span>💰</span>
            <span>Fundraising</span>
            <span className="ml-auto text-xs text-slate-500">Soon</span>
          </Link>

          <div className="text-xs text-slate-500 uppercase tracking-wider mt-6 mb-2 px-4">Analyze</div>
          <Link to="/stats" className="osys-nav-item">
            <span>📈</span>
            <span>Stats</span>
          </Link>
          <Link to="/videos" className="osys-nav-item">
            <span>🎬</span>
            <span>Film Room</span>
          </Link>
        </nav>

        {/* Team Switcher */}
        <div className="border-t border-white/10 pt-4 mt-4">
          <div className="osys-glass p-3 flex items-center gap-3">
            <Avatar name="Eastside Eagles" size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Eastside Eagles</div>
              <div className="text-xs text-slate-500">Head Coach</div>
            </div>
            <span className="text-slate-400">⌄</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="osys-main">
        {/* Top Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Good morning, Coach Davis 👋</h1>
            <p className="text-slate-400">Here's what's happening with your team.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
              <input 
                type="text" 
                placeholder="Search..." 
                className="osys-input pl-10 w-64"
              />
            </div>
            <button className="osys-btn osys-btn-ghost relative">
              🔔
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <Avatar name="Coach Davis" size="md" />
          </div>
        </header>

        {/* Stats Overview */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <GlassCard className="flex items-center gap-4">
            <div className="text-4xl">🏆</div>
            <div>
              <div className="text-3xl font-bold">8-2</div>
              <div className="text-sm text-slate-400">Season Record</div>
              <div className="text-xs text-green-400 mt-1">↑ 2nd in Region</div>
            </div>
          </GlassCard>

          <GlassCard className="flex items-center gap-4">
            <div className="text-4xl">👥</div>
            <div>
              <div className="text-3xl font-bold">32</div>
              <div className="text-sm text-slate-400">Active Players</div>
              <div className="text-xs text-slate-500 mt-1">28 confirmed for practice</div>
            </div>
          </GlassCard>

          <GlassCard className="flex items-center gap-4">
            <div className="text-4xl">📋</div>
            <div>
              <div className="text-3xl font-bold">47</div>
              <div className="text-sm text-slate-400">Plays Created</div>
              <div className="text-xs text-slate-500 mt-1">12 new this week</div>
            </div>
          </GlassCard>

          <GlassCard glow className="flex items-center gap-4">
            <div className="text-4xl">💰</div>
            <div>
              <div className="text-3xl font-bold osys-text-gradient-gold">$8,450</div>
              <div className="text-sm text-slate-400">Funds Raised</div>
              <div className="text-xs text-green-400 mt-1">↑ 70% of goal</div>
            </div>
          </GlassCard>
        </section>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upcoming Events */}
          <GlassCard className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">📅 Upcoming</h2>
              <Link to="/events" className="text-purple-400 text-sm">View All →</Link>
            </div>
            <div className="space-y-3">
              {upcomingEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition">
                  <div className="text-center min-w-[50px]">
                    <div className="text-xl font-bold">{event.day}</div>
                    <div className="text-xs text-slate-500">{event.month}</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-slate-400">{event.meta}</div>
                  </div>
                  <Badge variant={event.typeVariant}>{event.type}</Badge>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Quick Actions */}
          <GlassCard className="lg:col-span-1">
            <h2 className="text-lg font-bold mb-4">⚡ Quick Actions</h2>
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map((action, i) => (
                <Link
                  key={i}
                  to={action.link}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition text-center ${action.comingSoon ? 'osys-coming-soon' : ''}`}
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-xs font-medium">{action.label}</span>
                </Link>
              ))}
            </div>
          </GlassCard>

          {/* Recent Activity */}
          <GlassCard className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">📰 Activity Feed</h2>
              <button className="text-purple-400 text-sm">See All →</button>
            </div>
            <div className="space-y-3">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start gap-3 p-2">
                  {activity.isIcon ? (
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm">
                      {activity.avatar}
                    </div>
                  ) : (
                    <Avatar name={activity.name} size="sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <strong>{activity.name}</strong>{' '}
                      <span className="text-slate-400">{activity.action}</span>
                    </p>
                    <span className="text-xs text-slate-500">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Fundraising Progress */}
        <GlassCard className="mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold mb-1">🎯 National Championship Fundraiser</h2>
              <p className="text-slate-400 text-sm">Help us get to Orlando for the big game!</p>
            </div>
            <Link to="/fundraising">
              <Button variant="gold">View Campaign</Button>
            </Link>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>
                <strong className="osys-text-gradient-gold">$8,450</strong>
                <span className="text-slate-500"> raised</span>
              </span>
              <span className="text-slate-500">$12,000 goal</span>
            </div>
            <ProgressBar value={70} variant="gold" />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>147 supporters</span>
              <span>12 days remaining</span>
            </div>
          </div>
        </GlassCard>
      </main>

      {/* Demo Navigation */}
      <DemoNavigation currentPage="coach-demo" />
    </div>
  );
};

export default OSYSDashboard;
