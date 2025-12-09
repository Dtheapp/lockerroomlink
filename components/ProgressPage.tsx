/**
 * Progress Tracking Dashboard
 * A professional, Google-style progress management page
 * Shows project status, milestones, and production readiness
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  Layers,
  FileText,
  Search,
  Download,
  Copy,
  Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  { category: 'Notification System', items: ['In-app notification center', 'Push notifications', 'Notification preferences', 'Real-time updates', 'Notification bell UI', 'Mark read/unread', 'Clear notifications'] },
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
  const [activeTab, setActiveTab] = useState<'overview' | 'roadmap' | 'production' | 'revenue' | 'fulllog'>('overview');
  const [expandedPhases, setExpandedPhases] = useState<string[]>(['1']);
  const [expandedProdPhases, setExpandedProdPhases] = useState<string[]>(['prod-critical']);
  const [filter, setFilter] = useState<'all' | 'done' | 'in-progress' | 'not-started'>('all');
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownSearch, setMarkdownSearch] = useState('');
  const [copied, setCopied] = useState(false);

  // Fetch PROGRESS.md when Full Log tab is active
  useEffect(() => {
    if (activeTab === 'fulllog' && !markdownContent) {
      setMarkdownLoading(true);
      fetch('/PROGRESS.md')
        .then(res => res.text())
        .then(text => {
          setMarkdownContent(text);
          setMarkdownLoading(false);
        })
        .catch(() => {
          setMarkdownContent('# Error loading PROGRESS.md\n\nCould not load the progress file.');
          setMarkdownLoading(false);
        });
    }
  }, [activeTab, markdownContent]);

  // Filter markdown content by search
  const filteredMarkdown = useMemo(() => {
    if (!markdownSearch.trim()) return markdownContent;
    const lines = markdownContent.split('\n');
    const searchLower = markdownSearch.toLowerCase();
    const matchingLines: string[] = [];
    let inMatchingSection = false;
    let currentHeader = '';
    
    for (const line of lines) {
      if (line.startsWith('#')) {
        currentHeader = line;
        inMatchingSection = line.toLowerCase().includes(searchLower);
        if (inMatchingSection) matchingLines.push(line);
      } else if (line.toLowerCase().includes(searchLower)) {
        if (!matchingLines.includes(currentHeader) && currentHeader) {
          matchingLines.push(currentHeader);
        }
        matchingLines.push(line);
        inMatchingSection = true;
      } else if (inMatchingSection && line.trim() !== '') {
        matchingLines.push(line);
      }
    }
    return matchingLines.join('\n');
  }, [markdownContent, markdownSearch]);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <div className="inline-flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 flex-wrap justify-center gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'roadmap', label: 'Roadmap', icon: Rocket },
              { id: 'production', label: 'Production', icon: Shield },
              { id: 'revenue', label: 'Revenue', icon: DollarSign },
              { id: 'fulllog', label: 'Full Log', icon: FileText },
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
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">$0</div>
                  <div className="text-slate-400">Actual MRR</div>
                  <div className="text-xs text-slate-500 mt-1">Pre-launch</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-400">{revenueStreams.filter(r => r.status === 'built').length}</div>
                  <div className="text-slate-400">Streams Built</div>
                  <div className="text-xs text-slate-500 mt-1">of {revenueStreams.length} total</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-400">${revenueBuilt.toLocaleString()}</div>
                  <div className="text-slate-400">Built Streams Target</div>
                  <div className="text-xs text-slate-500 mt-1">Monthly potential</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-400">${revenueTotal.toLocaleString()}</div>
                  <div className="text-slate-400">Total Target MRR</div>
                  <div className="text-xs text-slate-500 mt-1">All streams</div>
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
                10-Year Revenue Projections (from REVENUE_PROJECTIONS.md)
              </h2>
              <div className="space-y-6">
                {/* Key Metrics Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-xl border border-purple-500/30 p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400">500K</div>
                    <div className="text-xs text-slate-400">Teams by Y10</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl border border-green-500/30 p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">$285M</div>
                    <div className="text-xs text-slate-400">ARR by Y10</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500/20 to-orange-500/5 rounded-xl border border-orange-500/30 p-4 text-center">
                    <div className="text-2xl font-bold text-orange-400">29M</div>
                    <div className="text-xs text-slate-400">Users by Y10</div>
                  </div>
                  <div className="bg-gradient-to-br from-pink-500/20 to-pink-500/5 rounded-xl border border-pink-500/30 p-4 text-center">
                    <div className="text-2xl font-bold text-pink-400">$1.4B</div>
                    <div className="text-xs text-slate-400">Valuation (5x ARR)</div>
                  </div>
                </div>
                
                {/* Year by Year Projections */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-700">
                        <th className="text-left py-2 text-slate-400 font-medium">Year</th>
                        <th className="text-right py-2 text-slate-400 font-medium">Teams</th>
                        <th className="text-right py-2 text-slate-400 font-medium">Users</th>
                        <th className="text-right py-2 text-slate-400 font-medium">Revenue</th>
                        <th className="text-right py-2 text-slate-400 font-medium">Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { year: 'Y1', teams: '500', users: '29K', revenue: '$89K', growth: '-' },
                        { year: 'Y2', teams: '2,500', users: '145K', revenue: '$770K', growth: '765%' },
                        { year: 'Y3', teams: '10,000', users: '580K', revenue: '$4.2M', growth: '445%' },
                        { year: 'Y4', teams: '30,000', users: '1.7M', revenue: '$15.6M', growth: '271%' },
                        { year: 'Y5', teams: '75,000', users: '4.4M', revenue: '$37M', growth: '137%' },
                        { year: 'Y6', teams: '140,000', users: '8.1M', revenue: '$84M', growth: '127%' },
                        { year: 'Y7', teams: '225,000', users: '13M', revenue: '$134M', growth: '60%' },
                        { year: 'Y8', teams: '325,000', users: '19M', revenue: '$194M', growth: '45%' },
                        { year: 'Y9', teams: '425,000', users: '25M', revenue: '$254M', growth: '31%' },
                        { year: 'Y10', teams: '500,000', users: '29M', revenue: '$285M', growth: '12%' },
                      ].map((row, idx) => (
                        <tr key={row.year} className={`border-b border-zinc-800 ${idx < 1 ? 'bg-green-500/10' : ''}`}>
                          <td className="py-2 text-white font-medium">{row.year}</td>
                          <td className="py-2 text-right text-slate-300">{row.teams}</td>
                          <td className="py-2 text-right text-slate-300">{row.users}</td>
                          <td className="py-2 text-right text-green-400 font-medium">{row.revenue}</td>
                          <td className="py-2 text-right text-orange-400">{row.growth}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Revenue Stream Breakdown */}
                <div className="mt-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <h4 className="font-semibold text-white mb-3">Revenue Stream Breakdown (Y5)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { stream: 'Subscriptions', pct: '43%', amt: '$15.8M' },
                      { stream: 'Transactions', pct: '29%', amt: '$10.7M' },
                      { stream: 'Marketplace', pct: '12%', amt: '$4.4M' },
                      { stream: 'Enterprise', pct: '16%', amt: '$5.9M' },
                    ].map(s => (
                      <div key={s.stream} className="text-center">
                        <div className="text-lg font-bold text-white">{s.pct}</div>
                        <div className="text-xs text-green-400">{s.amt}</div>
                        <div className="text-xs text-slate-500">{s.stream}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full Log Tab - World-Class Glass-Morphism Design */}
        {activeTab === 'fulllog' && (
          <div className="space-y-8">
            {/* Hero Section with Gradient */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600/20 via-purple-600/20 to-pink-600/20 border border-white/10 p-8">
              {/* Animated Background Orbs */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
              </div>
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl shadow-lg shadow-orange-500/30">
                        <FileText size={28} />
                      </div>
                      Complete Development Log
                    </h2>
                    <p className="text-slate-300 mt-2 text-lg">
                      Every bug fix, feature, and milestone — fully searchable
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCopyMarkdown}
                      className="group flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl text-white font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-white/10"
                    >
                      {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="group-hover:rotate-12 transition-transform" />}
                      {copied ? 'Copied!' : 'Copy All'}
                    </button>
                    <a
                      href="/PROGRESS.md"
                      download="PROGRESS.md"
                      className="group flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 rounded-xl text-white font-medium transition-all hover:scale-105 shadow-lg shadow-orange-500/30"
                    >
                      <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                      Download
                    </a>
                  </div>
                </div>
                
                {/* Search Bar - Premium Design */}
                <div className="mt-8 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/50 to-pink-500/50 rounded-2xl blur-xl opacity-30" />
                  <div className="relative flex items-center bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden">
                    <Search className="ml-5 text-slate-400" size={22} />
                    <input
                      type="text"
                      placeholder="Search bugs, fixes, features, timeline, components..."
                      value={markdownSearch}
                      onChange={(e) => setMarkdownSearch(e.target.value)}
                      className="flex-1 px-4 py-4 bg-transparent text-white text-lg placeholder:text-slate-500 focus:outline-none"
                    />
                    {markdownSearch && (
                      <button 
                        onClick={() => setMarkdownSearch('')}
                        className="mr-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <span className="text-slate-400 text-sm">Clear</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards - Premium Glass Design */}
            {markdownContent && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="group relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-orange-500/5 backdrop-blur-md rounded-2xl border border-orange-500/30 p-6 hover:border-orange-500/50 transition-all hover:scale-[1.02]">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <FileText size={18} className="text-orange-400" />
                      </div>
                      <span className="text-xs font-medium text-orange-400 uppercase tracking-wider">Lines</span>
                    </div>
                    <div className="text-4xl font-bold text-white">
                      {markdownContent.split('\n').length.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">of documentation</div>
                  </div>
                </div>
                
                <div className="group relative overflow-hidden bg-gradient-to-br from-green-500/10 to-green-500/5 backdrop-blur-md rounded-2xl border border-green-500/30 p-6 hover:border-green-500/50 transition-all hover:scale-[1.02]">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <CheckCircle size={18} className="text-green-400" />
                      </div>
                      <span className="text-xs font-medium text-green-400 uppercase tracking-wider">Done</span>
                    </div>
                    <div className="text-4xl font-bold text-white">
                      {(markdownContent.match(/✅/g) || []).length}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">completed items</div>
                  </div>
                </div>
                
                <div className="group relative overflow-hidden bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 backdrop-blur-md rounded-2xl border border-yellow-500/30 p-6 hover:border-yellow-500/50 transition-all hover:scale-[1.02]">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-yellow-500/20 rounded-lg">
                        <Clock size={18} className="text-yellow-400" />
                      </div>
                      <span className="text-xs font-medium text-yellow-400 uppercase tracking-wider">Pending</span>
                    </div>
                    <div className="text-4xl font-bold text-white">
                      {(markdownContent.match(/⬜/g) || []).length}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">items remaining</div>
                  </div>
                </div>
                
                <div className="group relative overflow-hidden bg-gradient-to-br from-purple-500/10 to-purple-500/5 backdrop-blur-md rounded-2xl border border-purple-500/30 p-6 hover:border-purple-500/50 transition-all hover:scale-[1.02]">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Layers size={18} className="text-purple-400" />
                      </div>
                      <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">Sections</span>
                    </div>
                    <div className="text-4xl font-bold text-white">
                      {(markdownContent.match(/^#{1,3} /gm) || []).length}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">major sections</div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Jump Section - Premium Pills */}
            <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-800/50 to-zinc-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                  <Zap size={18} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Quick Jump</h3>
                <span className="text-xs text-slate-500">Click to filter</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Bug Fix History', icon: '🐛', color: 'from-red-500/20 to-red-500/10 border-red-500/30 hover:border-red-400' },
                  { label: 'Development Timeline', icon: '📅', color: 'from-blue-500/20 to-blue-500/10 border-blue-500/30 hover:border-blue-400' },
                  { label: 'Draft Day System', icon: '🎯', color: 'from-orange-500/20 to-orange-500/10 border-orange-500/30 hover:border-orange-400' },
                  { label: 'Certification Center', icon: '🎓', color: 'from-green-500/20 to-green-500/10 border-green-500/30 hover:border-green-400' },
                  { label: 'Multi-Language', icon: '🌍', color: 'from-cyan-500/20 to-cyan-500/10 border-cyan-500/30 hover:border-cyan-400' },
                  { label: 'Wellness Center', icon: '💪', color: 'from-pink-500/20 to-pink-500/10 border-pink-500/30 hover:border-pink-400' },
                  { label: 'Command Center', icon: '📊', color: 'from-purple-500/20 to-purple-500/10 border-purple-500/30 hover:border-purple-400' },
                  { label: 'AI Support Center', icon: '🤖', color: 'from-indigo-500/20 to-indigo-500/10 border-indigo-500/30 hover:border-indigo-400' },
                  { label: 'Production Checklist', icon: '✅', color: 'from-emerald-500/20 to-emerald-500/10 border-emerald-500/30 hover:border-emerald-400' },
                  { label: 'Revenue Streams', icon: '💰', color: 'from-yellow-500/20 to-yellow-500/10 border-yellow-500/30 hover:border-yellow-400' },
                ].map(section => (
                  <button
                    key={section.label}
                    onClick={() => setMarkdownSearch(section.label)}
                    className={`group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r ${section.color} backdrop-blur-sm border rounded-xl text-sm text-white font-medium transition-all hover:scale-105 hover:shadow-lg`}
                  >
                    <span className="text-lg">{section.icon}</span>
                    {section.label}
                  </button>
                ))}
              </div>
              {markdownSearch && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm text-slate-400">Filtering by:</span>
                  <span className="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-sm text-orange-400 font-medium">
                    "{markdownSearch}"
                  </span>
                  <button 
                    onClick={() => setMarkdownSearch('')}
                    className="text-xs text-slate-500 hover:text-white transition-colors"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </div>

            {/* Main Content - Premium Glass Card */}
            <div className="relative">
              {/* Glow Effect Behind Card */}
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl opacity-50" />
              
              <div className="relative bg-gradient-to-br from-zinc-900/95 via-zinc-800/90 to-zinc-900/95 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
                {/* Card Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-black/20">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-sm text-slate-400 font-mono">PROGRESS.md</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">
                      {filteredMarkdown ? `${filteredMarkdown.split('\n').length.toLocaleString()} lines` : 'Loading...'}
                    </span>
                  </div>
                </div>
                
                {/* Content Area */}
                <div className="p-8 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20">
                  {markdownLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-orange-500/30 rounded-full" />
                        <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-orange-500 rounded-full animate-spin" />
                      </div>
                      <span className="mt-4 text-slate-400 text-lg">Loading documentation...</span>
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-orange max-w-none 
                      prose-headings:text-white prose-headings:font-bold
                      prose-h1:text-4xl prose-h1:bg-gradient-to-r prose-h1:from-orange-400 prose-h1:to-pink-400 prose-h1:bg-clip-text prose-h1:text-transparent prose-h1:border-b prose-h1:border-white/10 prose-h1:pb-6 prose-h1:mb-8
                      prose-h2:text-2xl prose-h2:text-orange-400 prose-h2:mt-12 prose-h2:mb-6 prose-h2:flex prose-h2:items-center prose-h2:gap-3
                      prose-h3:text-xl prose-h3:text-slate-200 prose-h3:mt-8 prose-h3:mb-4
                      prose-h4:text-lg prose-h4:text-slate-300 prose-h4:mt-6
                      prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-base
                      prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300 hover:prose-a:underline
                      prose-strong:text-white prose-strong:font-semibold
                      prose-code:text-orange-300 prose-code:bg-orange-500/10 prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:border prose-code:border-orange-500/20
                      prose-pre:bg-black/40 prose-pre:backdrop-blur-md prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
                      prose-blockquote:border-l-4 prose-blockquote:border-orange-500 prose-blockquote:bg-orange-500/10 prose-blockquote:rounded-r-xl prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:italic
                      prose-ul:text-slate-300 prose-ol:text-slate-300
                      prose-li:marker:text-orange-500 prose-li:my-1
                      prose-table:border-separate prose-table:border-spacing-0 prose-table:overflow-hidden prose-table:rounded-xl
                      prose-th:bg-gradient-to-r prose-th:from-zinc-800 prose-th:to-zinc-700 prose-th:text-white prose-th:font-semibold prose-th:border prose-th:border-white/10 prose-th:px-4 prose-th:py-3 prose-th:text-left
                      prose-td:bg-zinc-800/50 prose-td:border prose-td:border-white/5 prose-td:px-4 prose-td:py-3 prose-td:text-slate-300
                      prose-hr:border-white/10 prose-hr:my-12
                      prose-img:rounded-xl prose-img:shadow-xl"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {filteredMarkdown || '# No matches found\n\nTry a different search term or clear the filter to see all content.'}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 pt-8 border-t border-zinc-800">
          <p>Last Updated: {new Date().toLocaleDateString()}</p>
          <p className="mt-1">Data sourced from PROGRESS.md, FEATURE_ROADMAP.md, PRODUCTION_CHECKLIST.md, REVENUE_PROJECTIONS.md</p>
          <a 
            href="/#/compare" 
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            <BarChart3 size={16} />
            See How OSYS Compares to Competitors
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default ProgressPage;
