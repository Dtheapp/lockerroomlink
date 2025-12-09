/**
 * Progress Tracking Dashboard
 * A professional, Google-style progress management page
 * Shows project status, milestones, and production readiness
 */

import React, { useState, useMemo } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  Target,
  Zap,
  Calendar,
  DollarSign,
  Users,
  Shield,
  Rocket,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Filter,
  BarChart3,
  Activity,
  Flag,
  Star,
  Code,
  Layers
} from 'lucide-react';

// ============================================================================
// DATA TYPES
// ============================================================================

type TaskStatus = 'done' | 'in-progress' | 'not-started' | 'blocked';
type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
type PhaseStatus = 'complete' | 'in-progress' | 'upcoming';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  notes?: string;
  category?: string;
}

interface Phase {
  id: string;
  name: string;
  description: string;
  status: PhaseStatus;
  targetDate?: string;
  tasks: Task[];
}

interface Milestone {
  id: string;
  title: string;
  date: string;
  completed: boolean;
  inProgress?: boolean;
}

interface RevenueStream {
  name: string;
  status: 'built' | 'in-progress' | 'not-built';
  targetMRR: number;
}

// ============================================================================
// PROJECT DATA - Parsed from MD files
// ============================================================================

const overallMetrics = {
  coreFeatures: 80,
  multiSport: 60,
  designUX: 45,
  monetization: 15,
  revenueStreams: 8,
  testingQA: 35,
  documentation: 70,
  totalProgress: 43,
};

const journeyMilestones: Milestone[] = [
  { id: '1', title: 'Basic App', date: '2024', completed: true },
  { id: '2', title: 'Feature Rich', date: '2024', completed: true },
  { id: '3', title: 'Multi-Sport', date: 'Dec 2025', completed: false, inProgress: true },
  { id: '4', title: 'Pilot Ready', date: 'Jan 2026', completed: false },
  { id: '5', title: 'Revenue Live', date: 'Feb 2026', completed: false },
  { id: '6', title: 'Scale (100 teams)', date: 'Apr 2026', completed: false },
  { id: '7', title: 'Full Platform', date: 'Q4 2026', completed: false },
  { id: '8', title: 'Exit/IPO', date: '2027+', completed: false },
];

const completedFeatures = [
  { category: 'Authentication & Roles', items: ['Firebase Auth', 'Email/password login', 'Role-based access', 'Protected routes', 'Force password change', 'Session persistence'] },
  { category: 'Dashboard', items: ['Coach dashboard', 'Bulletin board', 'Team record', 'Coaching staff', 'Quick actions', 'Dark mode'] },
  { category: 'Roster Management', items: ['Add/edit/delete players', 'Player photos', 'Jersey numbers', 'Positions', 'Medical info', 'Emergency contacts', 'Uniform tracking', 'Parent associations'] },
  { category: 'Playbook Designer', items: ['Canvas-based designer', 'Drag-and-drop', 'Route drawing', 'Formation templates', 'Play saving/loading', 'Categories', 'System playbook', 'Clone/trace', 'Export'] },
  { category: 'Team Chat', items: ['Real-time messaging', 'Image sharing', 'Message replies', 'Pinning', 'Read receipts', 'User muting', 'Notifications'] },
  { category: 'Video Library', items: ['YouTube integration', 'Video categories', 'Player tagging', 'Practice/game film', 'Search'] },
  { category: 'Stats System', items: ['Per-game entry', 'Season totals', 'Stat cards', 'Categories', 'Export/share', 'Historical tracking'] },
  { category: 'Events & Registration', items: ['Event creation', 'Registration forms', 'PayPal integration', 'Promo codes', 'Digital waivers', 'Flier editor', 'Attendee management', 'Refunds'] },
  { category: 'Live Streaming', items: ['YouTube Live', 'Multi-camera', 'Save to library', 'Live chat'] },
  { category: 'Fan Engagement', items: ['Fan following', 'Kudos/reactions', 'Fan clips', 'Public chat', 'Fan dashboard'] },
  { category: 'Admin System', items: ['Admin dashboard', 'User management', 'Team management', 'Content moderation', 'Activity logging', 'System announcements', 'Email communication'] },
  { category: 'Technical Foundation', items: ['TypeScript', 'React 19', 'Vite', 'Firebase Firestore', 'Firebase Auth', 'Firebase Storage', 'Security rules', 'Rate limiting', 'Input sanitization', 'PWA', 'Mobile responsive'] },
  { category: 'Documentation', items: ['25 Working Traits', 'Monetization plan', 'Pilot plan', 'Feature roadmap', 'Design upgrades', 'Project review', 'AI context', 'Progress tracker'] },
];

const phases: Phase[] = [
  {
    id: '1',
    name: 'Phase 1: Pilot Ready',
    description: 'Get the platform ready for 20-team pilot launch',
    status: 'in-progress',
    targetDate: 'January 2026',
    tasks: [
      { id: '1-1', title: 'Multi-sport (Basketball/Cheer positions)', status: 'done', priority: 'critical' },
      { id: '1-2', title: 'Multi-sport (Basketball/Cheer stats)', status: 'done', priority: 'critical' },
      { id: '1-3', title: 'Landing page (world-class)', status: 'done', priority: 'critical' },
      { id: '1-4', title: 'AI content moderation Phase 1', status: 'done', priority: 'critical' },
      { id: '1-5', title: 'Onboarding welcome modal', status: 'done', priority: 'critical' },
      { id: '1-6', title: 'Getting started checklist', status: 'done', priority: 'critical' },
      { id: '1-7', title: 'Empty states upgrade', status: 'done', priority: 'high' },
      { id: '1-8', title: 'Skeleton loaders', status: 'done', priority: 'high' },
      { id: '1-9', title: 'Error monitoring (Sentry)', status: 'done', priority: 'high' },
      { id: '1-10', title: 'Analytics (Firebase)', status: 'done', priority: 'high' },
      { id: '1-11', title: 'Feedback button', status: 'done', priority: 'high' },
      { id: '1-12', title: 'League-to-team rule sync', status: 'done', priority: 'high' },
      { id: '1-13', title: 'Team-only supplemental rules', status: 'done', priority: 'high' },
      { id: '1-14', title: 'Referee infraction system', status: 'done', priority: 'high' },
      { id: '1-15', title: '4-way infraction chat (League/Ref/Team/Coach)', status: 'done', priority: 'high' },
      { id: '1-16', title: 'Head coach infraction dashboard', status: 'done', priority: 'high' },
      { id: '1-17', title: 'Full testing pass', status: 'not-started', priority: 'critical' },
      { id: '1-18', title: 'Playbook monetization (5 free + credits)', status: 'done', priority: 'high' },
      { id: '1-19', title: 'Commissioner/Referee signup', status: 'done', priority: 'high' },
    ],
  },
  {
    id: '2',
    name: 'Phase 2: Revenue Foundation',
    description: 'Enable subscription revenue and payment processing',
    status: 'upcoming',
    targetDate: 'February 2026',
    tasks: [
      { id: '2-1', title: 'Stripe integration', status: 'not-started', priority: 'critical' },
      { id: '2-2', title: 'Coach subscription tiers', status: 'not-started', priority: 'critical' },
      { id: '2-3', title: 'Feature gating by tier', status: 'not-started', priority: 'critical' },
      { id: '2-4', title: 'Subscription management UI', status: 'not-started', priority: 'critical' },
      { id: '2-5', title: 'System playbook marketplace', status: 'not-started', priority: 'high' },
      { id: '2-6', title: 'Coach playbook sales', status: 'not-started', priority: 'high' },
      { id: '2-7', title: 'Trial period system', status: 'not-started', priority: 'high' },
    ],
  },
  {
    id: '3',
    name: 'Phase 3: Transaction Revenue',
    description: 'Launch fundraising and ticket sales',
    status: 'upcoming',
    targetDate: 'March 2026',
    tasks: [
      { id: '3-1', title: 'Fundraising campaign pages', status: 'not-started', priority: 'high' },
      { id: '3-2', title: 'Fundraising Stripe donations', status: 'not-started', priority: 'high' },
      { id: '3-3', title: 'Fundraising progress tracking', status: 'not-started', priority: 'high' },
      { id: '3-4', title: 'Fundraising social sharing', status: 'not-started', priority: 'high' },
      { id: '3-5', title: 'Digital ticket creation', status: 'not-started', priority: 'high' },
      { id: '3-6', title: 'Apple/Google Wallet tickets', status: 'not-started', priority: 'high' },
      { id: '3-7', title: 'Ticket scanner app', status: 'not-started', priority: 'high' },
      { id: '3-8', title: 'Season passes', status: 'not-started', priority: 'medium' },
    ],
  },
  {
    id: '4',
    name: 'Phase 4: Marketplace',
    description: 'Launch private coaching and NIL marketplace',
    status: 'upcoming',
    targetDate: 'Q2 2026',
    tasks: [
      { id: '4-1', title: 'Private coaching profiles', status: 'not-started', priority: 'medium' },
      { id: '4-2', title: 'Coaching availability calendar', status: 'not-started', priority: 'medium' },
      { id: '4-3', title: 'Coaching booking & payment', status: 'not-started', priority: 'medium' },
      { id: '4-4', title: 'Coaching reviews', status: 'not-started', priority: 'medium' },
      { id: '4-5', title: 'NIL player profiles', status: 'not-started', priority: 'medium' },
      { id: '4-6', title: 'NIL company accounts', status: 'not-started', priority: 'medium' },
      { id: '4-7', title: 'NIL deal listings', status: 'not-started', priority: 'medium' },
      { id: '4-8', title: 'NIL contract templates', status: 'not-started', priority: 'medium' },
      { id: '4-9', title: 'NIL payment escrow', status: 'not-started', priority: 'medium' },
    ],
  },
  {
    id: '5',
    name: 'Phase 5: League Management',
    description: 'Full league operations platform',
    status: 'upcoming',
    targetDate: 'Q2 2026',
    tasks: [
      { id: '5-1', title: 'League dashboard', status: 'in-progress', priority: 'medium' },
      { id: '5-2', title: 'Automatic standings', status: 'not-started', priority: 'medium' },
      { id: '5-3', title: 'Schedule builder', status: 'not-started', priority: 'medium' },
      { id: '5-4', title: 'AI stats from video', status: 'not-started', priority: 'medium' },
      { id: '5-5', title: 'Social sharing', status: 'not-started', priority: 'medium' },
      { id: '5-6', title: 'Playoff brackets', status: 'not-started', priority: 'medium' },
      { id: '5-7', title: 'League subscriptions', status: 'not-started', priority: 'medium' },
    ],
  },
  {
    id: '6',
    name: 'Phase 6: AI Features',
    description: 'AI-powered differentiation features',
    status: 'upcoming',
    targetDate: 'Q3 2026',
    tasks: [
      { id: '6-1', title: 'AI customer service chatbot', status: 'not-started', priority: 'high' },
      { id: '6-2', title: 'AI highlight reel generator', status: 'not-started', priority: 'medium' },
      { id: '6-3', title: 'AI play suggestion', status: 'not-started', priority: 'medium' },
      { id: '6-4', title: 'AI scouting reports', status: 'not-started', priority: 'medium' },
      { id: '6-5', title: 'AI recruiting portfolio', status: 'not-started', priority: 'medium' },
    ],
  },
  {
    id: '7',
    name: 'Phase 7: Scale & Polish',
    description: 'Prepare for large-scale growth and exit',
    status: 'upcoming',
    targetDate: 'Q4 2026',
    tasks: [
      { id: '7-1', title: 'Performance optimization', status: 'not-started', priority: 'medium' },
      { id: '7-2', title: 'Advanced analytics dashboard', status: 'not-started', priority: 'medium' },
      { id: '7-3', title: 'Referral system', status: 'not-started', priority: 'medium' },
      { id: '7-4', title: 'White-label option', status: 'not-started', priority: 'medium' },
      { id: '7-5', title: 'API for integrations', status: 'not-started', priority: 'medium' },
    ],
  },
];

const productionChecklist: Phase[] = [
  {
    id: 'prod-critical',
    name: 'Critical (Must Have)',
    description: 'Required before any production launch',
    status: 'in-progress',
    tasks: [
      { id: 'p1', title: 'PayPal Client ID (Netlify env)', status: 'not-started', priority: 'critical', category: 'Environment' },
      { id: 'p2', title: 'PayPal Client Secret (Netlify env)', status: 'not-started', priority: 'critical', category: 'Environment' },
      { id: 'p3', title: 'PayPal Mode = live', status: 'not-started', priority: 'critical', category: 'Environment' },
      { id: 'p4', title: 'Firebase Project ID', status: 'not-started', priority: 'critical', category: 'Environment' },
      { id: 'p5', title: 'Firebase Service Account', status: 'not-started', priority: 'critical', category: 'Environment' },
      { id: 'p6', title: 'Create PayPal Business Account', status: 'not-started', priority: 'critical', category: 'PayPal' },
      { id: 'p7', title: 'Create Live PayPal App', status: 'not-started', priority: 'critical', category: 'PayPal' },
      { id: 'p8', title: 'Set PayPal Webhook URLs', status: 'not-started', priority: 'critical', category: 'PayPal' },
      { id: 'p9', title: 'Test Live Payments', status: 'not-started', priority: 'critical', category: 'PayPal' },
      { id: 'p10', title: 'Firestore Rules Deployed', status: 'done', priority: 'critical', category: 'Security' },
      { id: 'p11', title: 'Credit self-crediting blocked', status: 'done', priority: 'critical', category: 'Security' },
      { id: 'p12', title: 'User credit field protection', status: 'done', priority: 'critical', category: 'Security' },
      { id: 'p13', title: 'Admin audit log immutable', status: 'done', priority: 'critical', category: 'Security' },
      { id: 'p14', title: 'Review all collection rules', status: 'not-started', priority: 'critical', category: 'Security' },
      { id: 'p15', title: 'Email/Password auth enabled', status: 'done', priority: 'critical', category: 'Auth' },
      { id: 'p16', title: 'Email verification required', status: 'not-started', priority: 'critical', category: 'Auth' },
      { id: 'p17', title: 'Password requirements set', status: 'not-started', priority: 'critical', category: 'Auth' },
      { id: 'p18', title: 'Rate limiting on auth', status: 'not-started', priority: 'critical', category: 'Auth' },
    ],
  },
  {
    id: 'prod-high',
    name: 'High Priority (Should Have)',
    description: 'Important for production reliability',
    status: 'in-progress',
    tasks: [
      { id: 'h1', title: 'Sentry error tracking', status: 'done', priority: 'high', category: 'Monitoring' },
      { id: 'h2', title: 'Firebase Analytics', status: 'done', priority: 'high', category: 'Monitoring' },
      { id: 'h3', title: 'Uptime monitoring', status: 'not-started', priority: 'high', category: 'Monitoring' },
      { id: 'h4', title: 'Performance monitoring', status: 'not-started', priority: 'high', category: 'Monitoring' },
      { id: 'h5', title: 'In-memory rate limiting', status: 'done', priority: 'high', category: 'Rate Limiting' },
      { id: 'h6', title: 'Redis rate limiting (scale)', status: 'not-started', priority: 'high', category: 'Rate Limiting' },
      { id: 'h7', title: 'API rate limiting', status: 'not-started', priority: 'high', category: 'Rate Limiting' },
      { id: 'h8', title: 'Production domain purchased', status: 'not-started', priority: 'high', category: 'Domain' },
      { id: 'h9', title: 'DNS configured', status: 'not-started', priority: 'high', category: 'Domain' },
      { id: 'h10', title: 'SSL certificate active', status: 'not-started', priority: 'high', category: 'Domain' },
      { id: 'h11', title: 'HTTP to HTTPS redirect', status: 'not-started', priority: 'high', category: 'Domain' },
      { id: 'h12', title: 'Transactional email service', status: 'not-started', priority: 'high', category: 'Email' },
      { id: 'h13', title: 'Email templates created', status: 'not-started', priority: 'high', category: 'Email' },
      { id: 'h14', title: 'SPF/DKIM/DMARC configured', status: 'not-started', priority: 'high', category: 'Email' },
    ],
  },
  {
    id: 'prod-medium',
    name: 'Medium Priority (Nice to Have)',
    description: 'Quality improvements',
    status: 'upcoming',
    tasks: [
      { id: 'm1', title: 'Bundle size optimized', status: 'not-started', priority: 'medium', category: 'Performance' },
      { id: 'm2', title: 'Images optimized', status: 'not-started', priority: 'medium', category: 'Performance' },
      { id: 'm3', title: 'CDN configured', status: 'done', priority: 'medium', category: 'Performance' },
      { id: 'm4', title: 'Caching headers set', status: 'not-started', priority: 'medium', category: 'Performance' },
      { id: 'm5', title: 'Firestore backup enabled', status: 'not-started', priority: 'medium', category: 'Backup' },
      { id: 'm6', title: 'Point-in-time recovery', status: 'not-started', priority: 'medium', category: 'Backup' },
      { id: 'm7', title: 'Disaster recovery plan', status: 'not-started', priority: 'medium', category: 'Backup' },
      { id: 'm8', title: 'Privacy Policy', status: 'not-started', priority: 'medium', category: 'Legal' },
      { id: 'm9', title: 'Terms of Service', status: 'not-started', priority: 'medium', category: 'Legal' },
      { id: 'm10', title: 'Cookie consent', status: 'not-started', priority: 'medium', category: 'Legal' },
      { id: 'm11', title: 'COPPA compliance', status: 'not-started', priority: 'medium', category: 'Legal', notes: 'Critical for youth sports' },
    ],
  },
];

const revenueStreams: RevenueStream[] = [
  { name: 'Event Registration (PayPal)', status: 'built', targetMRR: 200 },
  { name: 'Playbook Credits System', status: 'built', targetMRR: 300 },
  { name: 'Coach Subscriptions', status: 'not-built', targetMRR: 1500 },
  { name: 'Playbook Marketplace', status: 'not-built', targetMRR: 500 },
  { name: 'Fundraising Fees', status: 'not-built', targetMRR: 400 },
  { name: 'Ticket Sales', status: 'not-built', targetMRR: 600 },
  { name: 'Private Coaching', status: 'not-built', targetMRR: 500 },
  { name: 'NIL Marketplace', status: 'not-built', targetMRR: 300 },
  { name: 'League Subscriptions', status: 'not-built', targetMRR: 500 },
  { name: 'AI Features', status: 'not-built', targetMRR: 200 },
];

const recentFixes = [
  { title: 'Playbook.tsx JSX Syntax Error', status: 'resolved', date: 'Nov 30, 2025' },
  { title: 'Roster.tsx Contact Info Not Editable', status: 'resolved', date: 'Nov 30, 2025' },
  { title: 'Roster.tsx Missing Edit2 Import', status: 'resolved', date: 'Nov 30, 2025' },
  { title: 'Missing Labels in Add Player Form', status: 'resolved', date: 'Nov 30, 2025' },
  { title: '.gitignore Missing .env Protection', status: 'resolved', date: 'Nov 30, 2025' },
  { title: 'Playbook Fullscreen Mode Enhancement', status: 'resolved', date: 'Nov 30, 2025' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

const ProgressRing: React.FC<{ value: number; size?: number; strokeWidth?: number; color?: string; label?: string }> = ({
  value,
  size = 120,
  strokeWidth = 8,
  color = '#f97316',
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-800"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-white">{value}%</span>
        {label && <span className="text-xs text-slate-400 mt-1">{label}</span>}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const config = {
    done: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle, label: 'Done' },
    'in-progress': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Clock, label: 'In Progress' },
    'not-started': { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', icon: Circle, label: 'Not Started' },
    blocked: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: AlertTriangle, label: 'Blocked' },
  };
  
  const { bg, text, border, icon: Icon, label } = config[status];
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${bg} ${text} border ${border}`}>
      <Icon size={12} />
      {label}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const config = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    medium: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    low: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  };
  
  const { bg, text } = config[priority];
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {priority}
    </span>
  );
};

const PhaseCard: React.FC<{ phase: Phase; expanded: boolean; onToggle: () => void }> = ({ phase, expanded, onToggle }) => {
  const doneTasks = phase.tasks.filter(t => t.status === 'done').length;
  const inProgressTasks = phase.tasks.filter(t => t.status === 'in-progress').length;
  const totalTasks = phase.tasks.length;
  const progress = Math.round((doneTasks / totalTasks) * 100);
  
  const statusConfig = {
    complete: { color: 'border-green-500/30 bg-green-500/5', badge: 'bg-green-500/20 text-green-400' },
    'in-progress': { color: 'border-orange-500/30 bg-orange-500/5', badge: 'bg-orange-500/20 text-orange-400' },
    upcoming: { color: 'border-zinc-700 bg-zinc-900/50', badge: 'bg-zinc-700 text-zinc-400' },
  };
  
  const { color, badge } = statusConfig[phase.status];
  
  return (
    <div className={`rounded-xl border ${color} overflow-hidden transition-all duration-300`}>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{progress}%</span>
            </div>
            <svg className="absolute inset-0 w-12 h-12 -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-zinc-700"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#f97316"
                strokeWidth="3"
                strokeDasharray={125.6}
                strokeDashoffset={125.6 - (progress / 100) * 125.6}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-white">{phase.name}</h3>
            <p className="text-sm text-slate-400">{phase.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${badge}`}>
            {phase.status === 'complete' ? 'Complete' : phase.status === 'in-progress' ? 'In Progress' : 'Upcoming'}
          </span>
          {phase.targetDate && (
            <span className="text-xs text-slate-500">{phase.targetDate}</span>
          )}
          <div className="text-xs text-slate-400">
            {doneTasks}/{totalTasks}
          </div>
          {expanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-white/5 p-4 space-y-2">
          {phase.tasks.map(task => (
            <div key={task.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
              <div className="flex items-center gap-3">
                {task.status === 'done' ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : task.status === 'in-progress' ? (
                  <Clock size={16} className="text-yellow-400" />
                ) : (
                  <Circle size={16} className="text-slate-500" />
                )}
                <span className={`text-sm ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-white'}`}>
                  {task.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {task.priority && <PriorityBadge priority={task.priority} />}
                {task.category && (
                  <span className="text-xs text-slate-500">{task.category}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MilestoneTimeline: React.FC<{ milestones: Milestone[] }> = ({ milestones }) => {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute top-8 left-0 right-0 h-1 bg-zinc-800 rounded-full">
        <div 
          className="h-full bg-gradient-to-r from-green-500 to-orange-500 rounded-full transition-all duration-500"
          style={{ width: `${(milestones.filter(m => m.completed).length / milestones.length) * 100}%` }}
        />
      </div>
      
      {/* Milestones */}
      <div className="flex justify-between relative">
        {milestones.map((milestone, index) => (
          <div key={milestone.id} className="flex flex-col items-center" style={{ width: `${100 / milestones.length}%` }}>
            <div className={`
              w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300
              ${milestone.completed 
                ? 'bg-green-500 border-green-400' 
                : milestone.inProgress 
                  ? 'bg-orange-500 border-orange-400 animate-pulse' 
                  : 'bg-zinc-800 border-zinc-600'
              }
            `}>
              {milestone.completed && <CheckCircle size={12} className="text-white" />}
              {milestone.inProgress && <Activity size={12} className="text-white" />}
            </div>
            <span className={`text-xs mt-2 text-center ${milestone.completed || milestone.inProgress ? 'text-white font-medium' : 'text-slate-500'}`}>
              {milestone.title}
            </span>
            <span className="text-[10px] text-slate-600">{milestone.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProgressPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'roadmap' | 'production' | 'revenue'>('overview');
  const [expandedPhases, setExpandedPhases] = useState<string[]>(['1']);
  const [expandedProdPhases, setExpandedProdPhases] = useState<string[]>(['prod-critical']);
  const [filter, setFilter] = useState<'all' | 'done' | 'in-progress' | 'not-started'>('all');

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleProdPhase = (id: string) => {
    setExpandedProdPhases(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // Calculate totals
  const allTasks = phases.flatMap(p => p.tasks);
  const doneTasks = allTasks.filter(t => t.status === 'done').length;
  const inProgressTasks = allTasks.filter(t => t.status === 'in-progress').length;
  const totalTasks = allTasks.length;

  const prodAllTasks = productionChecklist.flatMap(p => p.tasks);
  const prodDoneTasks = prodAllTasks.filter(t => t.status === 'done').length;
  const prodTotalTasks = prodAllTasks.length;
  const prodProgress = Math.round((prodDoneTasks / prodTotalTasks) * 100);

  const revenueBuilt = revenueStreams.filter(r => r.status === 'built').reduce((a, b) => a + b.targetMRR, 0);
  const revenueTotal = revenueStreams.reduce((a, b) => a + b.targetMRR, 0);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-purple-500 bg-clip-text text-transparent">
            OSYS Progress Tracker
          </h1>
          <p className="text-slate-400 mt-2">The Operating System for Youth Sports</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center">
          <div className="inline-flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'roadmap', label: 'Roadmap', icon: Rocket },
              { id: 'production', label: 'Production', icon: Shield },
              { id: 'revenue', label: 'Revenue', icon: DollarSign },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Journey Timeline */}
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Flag className="text-orange-500" />
                The Journey Map
              </h2>
              <MilestoneTimeline milestones={journeyMilestones} />
            </div>

            {/* Progress Rings */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { label: 'Core Features', value: overallMetrics.coreFeatures, color: '#22c55e' },
                { label: 'Multi-Sport', value: overallMetrics.multiSport, color: '#f97316' },
                { label: 'Design/UX', value: overallMetrics.designUX, color: '#eab308' },
                { label: 'Monetization', value: overallMetrics.monetization, color: '#ef4444' },
                { label: 'Revenue', value: overallMetrics.revenueStreams, color: '#ec4899' },
                { label: 'Testing/QA', value: overallMetrics.testingQA, color: '#8b5cf6' },
                { label: 'Docs', value: overallMetrics.documentation, color: '#06b6d4' },
              ].map(metric => (
                <div key={metric.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex flex-col items-center">
                  <ProgressRing value={metric.value} size={80} strokeWidth={6} color={metric.color} />
                  <span className="text-xs text-slate-400 mt-2 text-center">{metric.label}</span>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl border border-green-500/30 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-400" size={24} />
                  <div>
                    <div className="text-2xl font-bold text-white">{doneTasks}</div>
                    <div className="text-sm text-green-400">Tasks Complete</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 rounded-xl border border-yellow-500/30 p-4">
                <div className="flex items-center gap-3">
                  <Clock className="text-yellow-400" size={24} />
                  <div>
                    <div className="text-2xl font-bold text-white">{inProgressTasks}</div>
                    <div className="text-sm text-yellow-400">In Progress</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-xl border border-blue-500/30 p-4">
                <div className="flex items-center gap-3">
                  <Target className="text-blue-400" size={24} />
                  <div>
                    <div className="text-2xl font-bold text-white">{totalTasks}</div>
                    <div className="text-sm text-blue-400">Total Tasks</div>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-xl border border-purple-500/30 p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="text-purple-400" size={24} />
                  <div>
                    <div className="text-2xl font-bold text-white">{Math.round((doneTasks / totalTasks) * 100)}%</div>
                    <div className="text-sm text-purple-400">Overall Progress</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Completed Features */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Star className="text-yellow-400" />
                Completed Features
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedFeatures.map((category, idx) => (
                  <div key={idx} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                    <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-400" />
                      {category.category}
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {category.items.map((item, itemIdx) => (
                        <span key={itemIdx} className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Fixes */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="text-orange-400" />
                Recent Fixes Applied
              </h2>
              <div className="space-y-2">
                {recentFixes.map((fix, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <CheckCircle size={14} className="text-green-400" />
                      <span className="text-sm text-white">{fix.title}</span>
                    </div>
                    <span className="text-xs text-slate-500">{fix.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Roadmap Tab */}
        {activeTab === 'roadmap' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="text-orange-500" />
                Development Phases
              </h2>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                {(['all', 'done', 'in-progress', 'not-started'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs transition-all ${
                      filter === f ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
            
            {phases.map(phase => (
              <PhaseCard
                key={phase.id}
                phase={{
                  ...phase,
                  tasks: filter === 'all' ? phase.tasks : phase.tasks.filter(t => t.status === filter),
                }}
                expanded={expandedPhases.includes(phase.id)}
                onToggle={() => togglePhase(phase.id)}
              />
            ))}
          </div>
        )}

        {/* Production Tab */}
        {activeTab === 'production' && (
          <div className="space-y-6">
            {/* Production Readiness Gauge */}
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl border border-white/10 p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Production Readiness</h2>
                  <p className="text-slate-400">
                    {prodDoneTasks} of {prodTotalTasks} checklist items complete
                  </p>
                </div>
                <ProgressRing value={prodProgress} size={160} strokeWidth={12} color={prodProgress < 50 ? '#ef4444' : prodProgress < 80 ? '#f97316' : '#22c55e'} label="Ready" />
              </div>
              
              {/* Critical Items Warning */}
              {prodProgress < 100 && (
                <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-red-400" />
                    <div>
                      <p className="font-medium text-red-400">Not Ready for Production</p>
                      <p className="text-sm text-red-400/70">
                        Complete all critical items before launching to production
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Production Checklists */}
            <div className="space-y-4">
              {productionChecklist.map(phase => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  expanded={expandedProdPhases.includes(phase.id)}
                  onToggle={() => toggleProdPhase(phase.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <div className="space-y-6">
            {/* Revenue Summary */}
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl border border-white/10 p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">$0</div>
                  <div className="text-slate-400">Current MRR</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-400">${revenueBuilt}</div>
                  <div className="text-slate-400">Revenue Streams Built (Target)</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-400">${revenueTotal}</div>
                  <div className="text-slate-400">Total Target MRR</div>
                </div>
              </div>
            </div>

            {/* Revenue Streams */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="text-green-400" />
                Revenue Streams
              </h2>
              <div className="space-y-3">
                {revenueStreams.map((stream, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                    <div className="flex items-center gap-3">
                      {stream.status === 'built' ? (
                        <CheckCircle size={18} className="text-green-400" />
                      ) : stream.status === 'in-progress' ? (
                        <Clock size={18} className="text-yellow-400" />
                      ) : (
                        <Circle size={18} className="text-slate-500" />
                      )}
                      <span className={stream.status === 'built' ? 'text-white' : 'text-slate-400'}>
                        {stream.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        stream.status === 'built' ? 'bg-green-500/20 text-green-400' :
                        stream.status === 'in-progress' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {stream.status === 'built' ? 'Built' : stream.status === 'in-progress' ? 'In Progress' : 'Not Built'}
                      </span>
                      <span className="text-sm font-medium text-slate-400">
                        ${stream.targetMRR}/mo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Milestones */}
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Target className="text-blue-400" />
                Revenue Milestones
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { target: '$100 MRR', date: 'Jan 2026', status: 'upcoming' },
                  { target: '$1,000 MRR', date: 'Feb 2026', status: 'upcoming' },
                  { target: '$5,000 MRR', date: 'Jun 2026', status: 'upcoming' },
                  { target: '$10,000 MRR', date: 'Dec 2026', status: 'upcoming' },
                  { target: '$50,000 MRR', date: '2027', status: 'upcoming' },
                ].map((milestone, idx) => (
                  <div key={idx} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 text-center">
                    <div className="text-lg font-bold text-white">{milestone.target}</div>
                    <div className="text-xs text-slate-500">{milestone.date}</div>
                    <div className="mt-2">
                      <Circle size={14} className="text-slate-500 mx-auto" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 pt-8 border-t border-zinc-800">
          <p>Last Updated: {new Date().toLocaleDateString()}</p>
          <p className="mt-1">Data sourced from PROGRESS.md, FEATURE_ROADMAP.md, PRODUCTION_CHECKLIST.md, FIXES_APPLIED.md</p>
        </div>
      </div>
    </div>
  );
};

export default ProgressPage;
