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
  Check,
  X,
  Sparkles,
  Award,
  Globe,
  Heart,
  Brain,
  Headphones,
  Database,
  Cpu,
  MessageCircle,
  BookOpen
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

// Comprehensive Bug Fix History by Category
const bugFixCategories = [
  {
    id: 'auth',
    name: 'Authentication & Permissions',
    icon: '🔐',
    color: 'red',
    count: 12,
    fixes: [
      { date: 'Dec 9', fix: 'Public read access for coach/league/program collections', impact: 'Public profiles work' },
      { date: 'Dec 9', fix: 'Public read for game/playerStats and filmRoom subcollections', impact: 'Athlete stats visible' },
      { date: 'Dec 9', fix: 'Allow public read access for athlete/coach/team profiles', impact: 'Public pages accessible' },
      { date: 'Dec 8', fix: 'Update isTeamCoach to check both teamId and teamIds', impact: 'Multi-team coach permissions' },
      { date: 'Dec 8', fix: 'Complete Firestore rules for all subcollections', impact: 'Dashboard/roster/playbook data' },
      { date: 'Dec 7', fix: 'Signup permission error - reorder auth flow', impact: 'Signup works' },
      { date: 'Nov', fix: 'Move role check to after authentication', impact: 'Permission error fix' },
      { date: 'Nov', fix: 'Password reset domain authorization error', impact: 'Password reset works' },
      { date: 'Oct', fix: 'Firebase env variables support both naming conventions', impact: 'Deployment works' },
      { date: 'Oct', fix: 'Firebase query variable naming (minification conflicts)', impact: 'Production stability' },
      { date: 'Sep', fix: 'Disable Netlify secrets scanning properly', impact: 'Build succeeds' },
      { date: 'Sep', fix: 'Service worker to skip chrome-extension URLs', impact: 'Extension compatibility' },
    ]
  },
  {
    id: 'stats',
    name: 'Stats System',
    icon: '📊',
    color: 'blue',
    count: 10,
    fixes: [
      { date: 'Nov', fix: 'Coach stats page - remove () from getSortedStats', impact: 'Stats render' },
      { date: 'Nov', fix: "'v is not a function' error - getSortedStats memoization", impact: 'Stats page works' },
      { date: 'Nov', fix: 'Parent Stats page race condition - loading state', impact: 'No blank screen' },
      { date: 'Nov', fix: 'Stats page rendering errors - empty state handling', impact: 'Graceful fallback' },
      { date: 'Nov', fix: 'Stats page blank screen for parents without players', impact: 'Better UX' },
      { date: 'Oct', fix: 'Game stats: allow 0 scores, fix Firestore index', impact: 'Score entry works' },
      { date: 'Oct', fix: 'Stat input to allow typing multiple digits', impact: 'No focus loss' },
      { date: 'Oct', fix: 'Stats input leading zeros and history modal', impact: 'Data accuracy' },
      { date: 'Oct', fix: 'Stats leaders query - remove orderBy (index issue)', impact: 'Leaders display' },
      { date: 'Oct', fix: 'Calendar timezone issues + 12-hour AM/PM format', impact: 'Correct times' },
    ]
  },
  {
    id: 'uiux',
    name: 'UI/UX & Visibility',
    icon: '🎨',
    color: 'purple',
    count: 15,
    fixes: [
      { date: 'Dec 9', fix: 'Dashboard visibility for light mode', impact: 'Light mode usable' },
      { date: 'Dec 9', fix: 'Landing page text visibility (CRITICAL)', impact: 'Text readable' },
      { date: 'Dec 9', fix: 'Light mode text on NIL Wallet and Fundraising', impact: 'Pages visible' },
      { date: 'Dec 9', fix: 'Theme-aware colors + add player bug', impact: 'Color consistency' },
      { date: 'Dec 8', fix: 'Move sidebar collapse button outside sidebar', impact: 'Button visible' },
      { date: 'Nov', fix: 'Always-visible edit/delete buttons, popup positioning', impact: 'Better UX' },
      { date: 'Nov', fix: 'Chat popup positioning, edit/delete in Messenger', impact: 'Better UX' },
      { date: 'Nov', fix: 'Mobile sidebar labels always visible', impact: 'Navigation clear' },
      { date: 'Nov', fix: 'Mobile sidebar scrolling for theme/logout', impact: 'Buttons accessible' },
      { date: 'Nov', fix: 'Team record modal - buttons not cut off on mobile', impact: 'Mobile usable' },
      { date: 'Oct', fix: 'Fullscreen field fills entire screen', impact: 'Full immersion' },
      { date: 'Oct', fix: 'Event filter case-insensitive', impact: 'Filter works' },
      { date: 'Oct', fix: 'Aggressive service worker caching (stale UI)', impact: 'Fresh content' },
      { date: 'Sep', fix: 'Mobile layout for athlete/team public profiles', impact: 'Mobile friendly' },
      { date: 'Sep', fix: 'LOCKERROOM branding consistency in Admin', impact: 'Brand alignment' },
    ]
  },
  {
    id: 'video',
    name: 'Video & Media',
    icon: '🎬',
    color: 'pink',
    count: 8,
    fixes: [
      { date: 'Dec 8', fix: 'AI-generated images in preview (black canvas)', impact: 'Images show' },
      { date: 'Dec 8', fix: 'Base64 for AI images (CORS issues)', impact: 'Cross-origin works' },
      { date: 'Dec 8', fix: 'Center AI image + auto-enable Import button', impact: 'Better flow' },
      { date: 'Dec 8', fix: 'Proper AI image import to editor + View Full Size', impact: 'Full functionality' },
      { date: 'Nov', fix: 'Video library live/unavailable handling', impact: 'Video reliability' },
      { date: 'Oct', fix: 'Firestore undefined field error in film room', impact: 'Saves work' },
      { date: 'Oct', fix: 'Double submission on video save', impact: 'Single save' },
      { date: 'Oct', fix: 'Team public page - client-side filtering for videos', impact: 'Videos display' },
    ]
  },
  {
    id: 'playbook',
    name: 'Playbook & Canvas',
    icon: '📝',
    color: 'orange',
    count: 12,
    fixes: [
      { date: 'Nov', fix: 'Glow effect clipped by clipPath on triangles', impact: 'Shapes glow' },
      { date: 'Nov', fix: 'Clone toggle - correct field name', impact: 'Cloning works' },
      { date: 'Nov', fix: 'Athlete highlight, trace zoom 1%, trace positioning', impact: 'Trace accurate' },
      { date: 'Nov', fix: 'Line/shape dragging - mousedown on SVG hitboxes', impact: 'Drag works' },
      { date: 'Nov', fix: "Line dragging - add 'line' type to dragTarget", impact: 'Lines movable' },
      { date: 'Nov', fix: 'Trace mode cancel clears background completely', impact: 'Clean cancel' },
      { date: 'Nov', fix: 'Trace mode cancel, tab switching warning', impact: 'UX improvement' },
      { date: 'Nov', fix: 'Show drawing tools for cloned plays', impact: 'Tools available' },
      { date: 'Nov', fix: 'Clone credits initialization bug', impact: 'Credits track' },
      { date: 'Oct', fix: 'Playbook mobile touch handling and position scaling', impact: 'Mobile works' },
      { date: 'Oct', fix: 'AdminPlaybook formation field background', impact: 'Theme support' },
      { date: 'Sep', fix: 'Auto-spread bunched players', impact: 'Layout clean' },
    ]
  },
  {
    id: 'chat',
    name: 'Chat & Messaging',
    icon: '💬',
    color: 'cyan',
    count: 8,
    fixes: [
      { date: 'Nov', fix: 'Public chat - allow all Fans and Parents', impact: 'Chat accessible' },
      { date: 'Nov', fix: 'Clip creation - remove undefined values', impact: 'Clips save' },
      { date: 'Nov', fix: 'Grievance system - chats correctly linked', impact: 'Grievances work' },
      { date: 'Nov', fix: 'Grievance message styling + admin notifications', impact: 'Better visibility' },
      { date: 'Nov', fix: 'Public pages open in new tab, grievance notes routing', impact: 'Correct flow' },
      { date: 'Oct', fix: 'Messenger unread badges work correctly', impact: 'Notifications accurate' },
      { date: 'Oct', fix: 'AppSettings graceful fallback to defaults', impact: 'No crashes' },
      { date: 'Sep', fix: 'FanDashboard navigation hash router paths', impact: 'Navigation works' },
    ]
  },
  {
    id: 'team',
    name: 'Team & Roster',
    icon: '👥',
    color: 'green',
    count: 10,
    fixes: [
      { date: 'Dec 8', fix: 'Pass rosterCount to SeasonManager (Activate button)', impact: 'Button shows' },
      { date: 'Nov', fix: 'Coach multi-team display - fetch fresh teamIds', impact: 'Teams display' },
      { date: 'Nov', fix: 'Coach multi-team display - query all teams', impact: 'Find all teams' },
      { date: 'Nov', fix: 'Head coach detection - use teamData from context', impact: 'Correct role' },
      { date: 'Nov', fix: 'Coaching staff display - query teamIds and teamId', impact: 'Staff shows' },
      { date: 'Nov', fix: 'Coaching staff query - include teamIds array', impact: 'All coaches' },
      { date: 'Nov', fix: 'Multi-team coach ref to prevent reload', impact: 'Stable UI' },
      { date: 'Nov', fix: 'Multi-team coach support - maintain teamIds array', impact: 'Data integrity' },
      { date: 'Oct', fix: 'Add headCoachId to Team type (build errors)', impact: 'Types correct' },
      { date: 'Oct', fix: 'Teams page crash - invalid query undefined limit', impact: 'No crash' },
    ]
  },
  {
    id: 'design',
    name: 'Design Studio',
    icon: '🎨',
    color: 'indigo',
    count: 10,
    fixes: [
      { date: 'Dec 8', fix: 'Stop credit migration loop', impact: 'No infinite loop' },
      { date: 'Dec 8', fix: 'Reduce AI generation to 1 image (timeout)', impact: 'Reliable generation' },
      { date: 'Dec 8', fix: 'Show AI errors instead of silent fallback', impact: 'Debug friendly' },
      { date: 'Dec 8', fix: 'AI Creator uses prompt data + unsaved warning', impact: 'Data preserved' },
      { date: 'Dec 8', fix: 'Marketing Hub & AI Creator canvas rendering', impact: 'Previews work' },
      { date: 'Dec 8', fix: 'Marketing Hub - fullscreen, previews, View/Edit', impact: 'Full functionality' },
      { date: 'Dec 8', fix: 'Preview mode correct canvas size, Edit button', impact: 'Correct display' },
      { date: 'Dec 7', fix: 'Design Studio Pro zoom with CSS transform', impact: 'Scaling works' },
      { date: 'Dec 7', fix: 'Fullscreen edit mode + preview aspect ratio', impact: 'Professional output' },
      { date: 'Dec 7', fix: 'Credit system with buy/gift modals', impact: 'Monetization ready' },
    ]
  },
  {
    id: 'typescript',
    name: 'TypeScript & Build',
    icon: '🔧',
    color: 'yellow',
    count: 8,
    fixes: [
      { date: 'Dec 9', fix: 'TypeScript errors in AICreatorModal', impact: 'Build passes' },
      { date: 'Dec 9', fix: 'Missing type properties (ageGroup, color, etc.)', impact: 'Types complete' },
      { date: 'Nov', fix: 'TypeScript errors in NIL components and MyTickets', impact: 'Build passes' },
      { date: 'Nov', fix: 'TypeScript type comparison warnings in AuthScreen', impact: 'Clean build' },
      { date: 'Nov', fix: 'TypeScript error: SuperAdmin instead of Admin', impact: 'Correct role' },
      { date: 'Oct', fix: 'Chunk load errors with cache headers', impact: 'Reliable loading' },
      { date: 'Oct', fix: 'Netlify functions redirect + error handling', impact: 'Deploy works' },
      { date: 'Sep', fix: 'Remove invalid netlify functions redirect', impact: 'Build succeeds' },
    ]
  },
];

// Development Timeline / Build History
const buildTimeline = [
  {
    month: 'December 2025',
    sessions: [
      {
        date: 'Dec 9 (Evening)',
        focus: '🎉 PILOT CONFIRMED - Feature Planning',
        highlights: [
          'PILOT PROGRAM CONFIRMED with 20-team organization',
          'Designed DRAFT DAY SYSTEM architecture (5 phases, 8 components)',
          'Designed COACH & REFEREE CERTIFICATION CENTER (8 components)',
          'Designed MULTI-LANGUAGE SYSTEM (hybrid translation approach)',
          'Designed WELLNESS CENTER AI (meal plans, fitness, practice planning)',
          'Designed OSYS COMMAND CENTER analytics dashboard (13 components)',
          'Created Sports Readiness Matrix for 5 pilot sports',
        ],
        components: 30,
      },
      {
        date: 'Dec 9 (Late Night)',
        focus: 'AI Support Center - World-Class Customer Service',
        highlights: [
          'Designed OSYS AI Support Center architecture',
          'AI Chat with contextual awareness (knows user, page, role, team)',
          'Voice Message Support (Whisper + TTS)',
          'Proactive assistance (detects struggling users)',
          'Human escalation system (Email, Live Chat, Video)',
          'Knowledge base schema for training AI',
        ],
        components: 11,
      },
      {
        date: 'Dec 9',
        focus: 'Public Profile Fixes & Dashboard',
        highlights: [
          'Fixed Firestore rules for public profile access',
          'Added Public Page Link Banner to dashboard',
          'Social media sharing (Facebook, Twitter, LinkedIn)',
          'Created Bug Fix History section (100+ fixes)',
          'Created Development Timeline section',
          'Deployed Firestore rules to Firebase',
        ],
        components: 0,
      },
      {
        date: 'Dec 6',
        focus: 'Vision Day - Foundation & Planning',
        highlights: [
          'Established 25 working traits for excellence',
          'Completed full project review',
          'Defined pilot program (20 teams, 5 sports)',
          'Created comprehensive monetization plan (9 revenue streams)',
          'Created AI_CONTEXT.md, PROGRESS.md',
        ],
        components: 0,
      },
    ]
  },
  {
    month: 'November 2025',
    sessions: [
      {
        date: 'Nov (Multiple)',
        focus: 'OSYS Migration & League System',
        highlights: [
          'Rebranded from LockerRoomLink to OSYS',
          'Complete League & Commissioner System (9 phases)',
          'Complete Referee System (5 phases)',
          'Rules & Code of Conduct system',
          'World-class competitor comparison page',
          'NewOSYSDashboard - complete rebuild',
        ],
        components: 25,
      },
    ]
  },
  {
    month: 'October 2025',
    sessions: [
      {
        date: 'Oct (Multiple)',
        focus: 'OSYS Design System & Theme Migration',
        highlights: [
          'OSYS Design System v2.0 with glassmorphism',
          'Animated orbs background effect',
          'GlassCard, Button, Modal components',
          'Complete dual-theme migration',
          'Glass-morphism UI redesign (8 components)',
          'Self-Rating Communication system',
        ],
        components: 15,
      },
    ]
  },
  {
    month: 'September 2025',
    sessions: [
      {
        date: 'Sep (Multiple)',
        focus: 'NIL Marketplace & Fundraising',
        highlights: [
          'NIL Marketplace - full athlete/fan system',
          'Zero-Fee Fundraising System',
          'PayPal integration for direct payments',
          'Campaign pages, discovery, filters',
          'NILWalletDashboard for athlete earnings',
        ],
        components: 8,
      },
    ]
  },
  {
    month: 'August 2025',
    sessions: [
      {
        date: 'Aug (Multiple)',
        focus: 'Landing Page & Content Moderation',
        highlights: [
          'Enhanced landing page with How It Works',
          'AI safety monitoring features',
          'Full play traceability showcase',
          'Content moderation system',
        ],
        components: 5,
      },
    ]
  },
];

// Feature Plans with detailed breakdowns
interface FeaturePlan {
  id: string;
  name: string;
  icon: React.ElementType;
  emoji: string;
  status: 'planned' | 'in-progress' | 'complete';
  color: string;
  gradient: string;
  tagline: string;
  vision: string;
  components: string[];
  phases: { name: string; tasks: string[] }[];
  databases?: string[];
  apis?: string[];
  estimatedCost?: string;
}

const featurePlans: FeaturePlan[] = [
  {
    id: 'draft-day',
    name: 'Draft Day System',
    icon: Award,
    emoji: '🏆',
    status: 'planned',
    color: 'orange',
    gradient: 'from-orange-500 to-amber-500',
    tagline: 'Fantasy-style player draft experience',
    vision: 'Transform youth sports team building with an exciting, gamified draft experience that makes team formation feel like the NFL Draft. Creates buzz, engagement, and fair team building.',
    components: [
      'DraftLobby.tsx - Real-time draft room with timer',
      'DraftBoard.tsx - Visual player board with stats',
      'DraftPick.tsx - Pick announcement animations',
      'DraftResults.tsx - Post-draft team rosters',
      'DraftHistory.tsx - Historical draft records',
      'DraftSettings.tsx - Commissioner draft configuration'
    ],
    phases: [
      { name: 'Phase 1: Core Draft', tasks: ['Draft room real-time sync', 'Pick timer system', 'Snake/linear draft order', 'Player pool management'] },
      { name: 'Phase 2: Experience', tasks: ['Pick animations', 'Sound effects', 'Live chat during draft', 'Mobile optimization'] },
      { name: 'Phase 3: Intelligence', tasks: ['AI draft suggestions', 'Player rankings', 'Need-based recommendations', 'Trade proposals'] }
    ],
    databases: ['drafts', 'draftPicks', 'draftSettings', 'playerRankings'],
    estimatedCost: '$0 (Firebase included)'
  },
  {
    id: 'certification',
    name: 'Coach & Referee Certification',
    icon: Award,
    emoji: '🎖️',
    status: 'planned',
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
    tagline: 'Professional credentialing system',
    vision: 'Create a trusted certification ecosystem where coaches and referees can earn, display, and maintain professional credentials. Builds trust with parents and ensures quality standards.',
    components: [
      'CertificationDashboard.tsx - Progress tracking',
      'CourseLibrary.tsx - Training modules',
      'ExamCenter.tsx - Certification tests',
      'BadgeDisplay.tsx - Digital credentials',
      'CertificationVerifier.tsx - Public verification',
      'AdminCertifications.tsx - Admin management'
    ],
    phases: [
      { name: 'Phase 1: Infrastructure', tasks: ['Certification database schema', 'Course content system', 'Progress tracking', 'Badge generation'] },
      { name: 'Phase 2: Learning', tasks: ['Video course player', 'Quiz engine', 'Certificate generation', 'Email notifications'] },
      { name: 'Phase 3: Verification', tasks: ['Public badge verification', 'QR code scanning', 'League integration', 'Renewal reminders'] }
    ],
    databases: ['certifications', 'courses', 'courseProgress', 'examResults', 'badges'],
    estimatedCost: '$0 (Firebase included)'
  },
  {
    id: 'multi-language',
    name: 'Multi-Language System',
    icon: Globe,
    emoji: '🌍',
    status: 'planned',
    color: 'cyan',
    gradient: 'from-cyan-500 to-blue-500',
    tagline: 'Break down language barriers',
    vision: 'Make OSYS accessible to every community regardless of language. Support the diverse families in youth sports with native language interfaces and real-time translation.',
    components: [
      'LanguageProvider.tsx - i18n context',
      'LanguageSwitcher.tsx - UI language toggle',
      'TranslatedText.tsx - Auto-translation wrapper',
      'ChatTranslator.tsx - Real-time message translation',
      'AdminTranslations.tsx - Translation management'
    ],
    phases: [
      { name: 'Phase 1: Core i18n', tasks: ['react-i18next setup', 'Language detection', 'UI string extraction', 'Spanish translations'] },
      { name: 'Phase 2: Expansion', tasks: ['French, German, Portuguese', 'RTL support (Arabic)', 'Date/time localization', 'Currency formatting'] },
      { name: 'Phase 3: AI Translation', tasks: ['Real-time chat translation', 'Document translation', 'Voice message translation', 'Custom terminology'] }
    ],
    apis: ['Google Translate API', 'DeepL API (optional)'],
    estimatedCost: '~$50/month for translation API'
  },
  {
    id: 'wellness',
    name: 'Wellness Center (AI Powered)',
    icon: Heart,
    emoji: '💪',
    status: 'planned',
    color: 'pink',
    gradient: 'from-pink-500 to-rose-500',
    tagline: 'Complete athlete health management',
    vision: 'Revolutionize youth athlete wellness with AI-powered health tracking, injury prevention, and mental health support. Keep young athletes healthy, happy, and performing their best.',
    components: [
      'WellnessDashboard.tsx - Health overview',
      'InjuryTracker.tsx - Injury logging & recovery',
      'MentalHealthCheck.tsx - Mood & wellness surveys',
      'NutritionGuide.tsx - Age-appropriate nutrition',
      'SleepTracker.tsx - Rest & recovery tracking',
      'AIWellnessCoach.tsx - Personalized recommendations'
    ],
    phases: [
      { name: 'Phase 1: Tracking', tasks: ['Injury logging', 'Recovery timelines', 'Medical clearance workflow', 'Parent notifications'] },
      { name: 'Phase 2: Mental Health', tasks: ['Mood check-ins', 'Stress indicators', 'Burnout detection', 'Resource recommendations'] },
      { name: 'Phase 3: AI Coach', tasks: ['Personalized wellness plans', 'Injury prevention alerts', 'Sleep optimization', 'Nutrition suggestions'] }
    ],
    databases: ['wellness', 'injuries', 'moodCheckins', 'sleepLogs', 'nutritionPlans'],
    apis: ['OpenAI GPT-4 for recommendations'],
    estimatedCost: '~$100/month for AI'
  },
  {
    id: 'command-center',
    name: 'OSYS Command Center',
    icon: Cpu,
    emoji: '📊',
    status: 'planned',
    color: 'purple',
    gradient: 'from-purple-500 to-violet-500',
    tagline: 'Analytics & insights dashboard',
    vision: 'Give coaches, commissioners, and admins a powerful analytics command center with real-time insights, performance metrics, and predictive intelligence.',
    components: [
      'CommandCenter.tsx - Main dashboard hub',
      'AnalyticsWidgets.tsx - Customizable metric cards',
      'PerformanceCharts.tsx - Visual data representations',
      'AlertsPanel.tsx - Smart notifications',
      'ReportGenerator.tsx - Custom report builder',
      'PredictiveInsights.tsx - AI-powered forecasts'
    ],
    phases: [
      { name: 'Phase 1: Core Analytics', tasks: ['Team performance metrics', 'Player stat aggregation', 'Attendance tracking', 'Engagement scores'] },
      { name: 'Phase 2: Visualization', tasks: ['Interactive charts', 'Custom dashboards', 'Export to PDF/Excel', 'Scheduled reports'] },
      { name: 'Phase 3: AI Insights', tasks: ['Trend detection', 'Performance predictions', 'Injury risk analysis', 'Roster optimization'] }
    ],
    databases: ['analytics', 'reports', 'dashboardConfigs', 'alerts'],
    apis: ['Chart.js', 'OpenAI for insights'],
    estimatedCost: '~$50/month for AI analysis'
  },
  {
    id: 'ai-support',
    name: 'AI Support Center',
    icon: Headphones,
    emoji: '🤖',
    status: 'planned',
    color: 'indigo',
    gradient: 'from-indigo-500 to-blue-500',
    tagline: 'World-class AI customer service',
    vision: 'Provide instant, intelligent customer support through AI chat, voice messages, and proactive assistance. Help users succeed with 24/7 availability and personalized guidance.',
    components: [
      'AISupportChat.tsx - Conversational AI interface',
      'VoiceSupport.tsx - Voice message handling',
      'ActionPlanSaver.tsx - Save solutions for later',
      'ProactiveHelper.tsx - Detects when users struggle',
      'SupportHistory.tsx - Past conversations',
      'EscalationFlow.tsx - Human handoff system'
    ],
    phases: [
      { name: 'Phase 1: AI Chat', tasks: ['GPT-4 integration', 'Context-aware responses', 'App knowledge base', 'Conversation history'] },
      { name: 'Phase 2: Voice', tasks: ['Whisper speech-to-text', 'Text-to-speech responses', 'Voice message UI', 'Multi-language voice'] },
      { name: 'Phase 3: Proactive', tasks: ['Struggle detection', 'Push notification follow-ups', 'Saved action plans', 'Human escalation'] }
    ],
    databases: ['supportConversations', 'actionPlans', 'supportKnowledge'],
    apis: ['OpenAI GPT-4', 'Whisper API', 'ElevenLabs/Google TTS'],
    estimatedCost: '~$500/month at scale'
  }
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
  const [activeTab, setActiveTab] = useState<'overview' | 'roadmap' | 'plans' | 'production' | 'revenue' | 'fulllog'>('overview');
  const [selectedPlan, setSelectedPlan] = useState<FeaturePlan | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<string[]>(['1']);
  const [expandedProdPhases, setExpandedProdPhases] = useState<string[]>(['prod-critical']);
  const [filter, setFilter] = useState<'all' | 'done' | 'in-progress' | 'not-started'>('all');
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownSearch, setMarkdownSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [logSubTab, setLogSubTab] = useState<'bugfixes' | 'timeline' | 'features' | 'rawlog'>('bugfixes');
  const [expandedBugCategory, setExpandedBugCategory] = useState<string | null>('auth');

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
              { id: 'plans', label: 'Feature Plans', icon: Sparkles },
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

        {/* Feature Plans Tab - World-Class Design */}
        {activeTab === 'plans' && (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600/20 via-pink-600/20 to-orange-600/20 border border-white/10 p-8">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/30">
                    <Sparkles size={32} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white">Feature Plans</h2>
                    <p className="text-slate-300 text-lg">Detailed architecture & implementation roadmaps</p>
                  </div>
                </div>
                <p className="text-slate-400 max-w-2xl">
                  Click any feature card below to see the complete breakdown: vision, components needed, 
                  implementation phases, database schemas, and estimated costs.
                </p>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 backdrop-blur-md rounded-2xl border border-purple-500/30 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <BookOpen size={18} className="text-purple-400" />
                  </div>
                  <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">Total Plans</span>
                </div>
                <div className="text-4xl font-bold text-white">{featurePlans.length}</div>
                <div className="text-xs text-slate-400 mt-1">detailed breakdowns</div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 backdrop-blur-md rounded-2xl border border-blue-500/30 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Code size={18} className="text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Components</span>
                </div>
                <div className="text-4xl font-bold text-white">{featurePlans.reduce((a, p) => a + p.components.length, 0)}</div>
                <div className="text-xs text-slate-400 mt-1">to be built</div>
              </div>
              
              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 backdrop-blur-md rounded-2xl border border-green-500/30 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Database size={18} className="text-green-400" />
                  </div>
                  <span className="text-xs font-medium text-green-400 uppercase tracking-wider">Collections</span>
                </div>
                <div className="text-4xl font-bold text-white">{featurePlans.reduce((a, p) => a + (p.databases?.length || 0), 0)}</div>
                <div className="text-xs text-slate-400 mt-1">new Firestore collections</div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 backdrop-blur-md rounded-2xl border border-orange-500/30 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <Layers size={18} className="text-orange-400" />
                  </div>
                  <span className="text-xs font-medium text-orange-400 uppercase tracking-wider">Phases</span>
                </div>
                <div className="text-4xl font-bold text-white">{featurePlans.reduce((a, p) => a + p.phases.length, 0)}</div>
                <div className="text-xs text-slate-400 mt-1">implementation phases</div>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featurePlans.map(plan => {
                const colorClasses: Record<string, { border: string; bg: string; text: string; glow: string }> = {
                  orange: { border: 'border-orange-500/30 hover:border-orange-400', bg: 'from-orange-500/10 to-orange-500/5', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
                  green: { border: 'border-green-500/30 hover:border-green-400', bg: 'from-green-500/10 to-green-500/5', text: 'text-green-400', glow: 'shadow-green-500/20' },
                  cyan: { border: 'border-cyan-500/30 hover:border-cyan-400', bg: 'from-cyan-500/10 to-cyan-500/5', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
                  pink: { border: 'border-pink-500/30 hover:border-pink-400', bg: 'from-pink-500/10 to-pink-500/5', text: 'text-pink-400', glow: 'shadow-pink-500/20' },
                  purple: { border: 'border-purple-500/30 hover:border-purple-400', bg: 'from-purple-500/10 to-purple-500/5', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
                  indigo: { border: 'border-indigo-500/30 hover:border-indigo-400', bg: 'from-indigo-500/10 to-indigo-500/5', text: 'text-indigo-400', glow: 'shadow-indigo-500/20' },
                };
                const colors = colorClasses[plan.color] || colorClasses.orange;
                
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`group relative overflow-hidden bg-gradient-to-br ${colors.bg} backdrop-blur-md rounded-2xl border ${colors.border} p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${colors.glow}`}
                  >
                    {/* Animated Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Plan Indicator */}
                    <div className="absolute top-4 right-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${plan.gradient} text-white shadow-lg`}>
                        📋 Plan Ready
                      </span>
                    </div>
                    
                    <div className="relative z-10">
                      {/* Icon & Title */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-3 bg-gradient-to-br ${plan.gradient} rounded-xl shadow-lg`}>
                          <span className="text-2xl">{plan.emoji}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                          <p className={`text-sm ${colors.text}`}>{plan.tagline}</p>
                        </div>
                      </div>
                      
                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-black/30 rounded-lg px-3 py-2 text-center">
                          <div className="text-lg font-bold text-white">{plan.components.length}</div>
                          <div className="text-[10px] text-slate-400 uppercase">Components</div>
                        </div>
                        <div className="bg-black/30 rounded-lg px-3 py-2 text-center">
                          <div className="text-lg font-bold text-white">{plan.phases.length}</div>
                          <div className="text-[10px] text-slate-400 uppercase">Phases</div>
                        </div>
                        <div className="bg-black/30 rounded-lg px-3 py-2 text-center">
                          <div className="text-lg font-bold text-white">{plan.databases?.length || 0}</div>
                          <div className="text-[10px] text-slate-400 uppercase">Collections</div>
                        </div>
                      </div>
                      
                      {/* Preview Text */}
                      <p className="text-sm text-slate-400 line-clamp-2 mb-4">{plan.vision}</p>
                      
                      {/* Click to View */}
                      <div className="flex items-center gap-2 text-sm font-medium text-white group-hover:gap-3 transition-all">
                        <span>View Full Breakdown</span>
                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Modal for Feature Plan Details */}
            {selectedPlan && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <div 
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                  onClick={() => setSelectedPlan(null)}
                />
                
                {/* Modal Content */}
                <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl border border-white/10 shadow-2xl">
                  {/* Header */}
                  <div className={`sticky top-0 z-10 bg-gradient-to-r ${selectedPlan.gradient} p-6 border-b border-white/10`}>
                    <button
                      onClick={() => setSelectedPlan(null)}
                      className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 rounded-full transition-colors"
                    >
                      <X size={20} className="text-white" />
                    </button>
                    
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl">
                        <span className="text-4xl">{selectedPlan.emoji}</span>
                      </div>
                      <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-white">{selectedPlan.name}</h2>
                        <p className="text-white/80 text-lg">{selectedPlan.tagline}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 md:p-8 space-y-8">
                    {/* Vision Section */}
                    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                          <Target size={20} className="text-orange-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Vision</h3>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{selectedPlan.vision}</p>
                    </div>
                    
                    {/* Components Section */}
                    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Code size={20} className="text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Components to Build</h3>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">{selectedPlan.components.length} files</span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        {selectedPlan.components.map((comp, idx) => (
                          <div key={idx} className="flex items-start gap-3 bg-black/30 rounded-xl p-4">
                            <div className="p-1.5 bg-blue-500/20 rounded-lg mt-0.5">
                              <FileText size={14} className="text-blue-400" />
                            </div>
                            <div>
                              <div className="font-mono text-sm text-white">{comp.split(' - ')[0]}</div>
                              {comp.includes(' - ') && (
                                <div className="text-xs text-slate-400 mt-1">{comp.split(' - ')[1]}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Implementation Phases */}
                    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                          <Layers size={20} className="text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Implementation Phases</h3>
                      </div>
                      <div className="space-y-4">
                        {selectedPlan.phases.map((phase, idx) => (
                          <div key={idx} className="relative pl-8 pb-4 border-l-2 border-purple-500/30 last:border-transparent last:pb-0">
                            <div className="absolute left-[-9px] top-0 w-4 h-4 bg-purple-500 rounded-full border-4 border-zinc-800" />
                            <div className="bg-black/30 rounded-xl p-4">
                              <h4 className="font-bold text-white mb-3">{phase.name}</h4>
                              <div className="flex flex-wrap gap-2">
                                {phase.tasks.map((task, tidx) => (
                                  <span key={tidx} className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-slate-300">
                                    {task}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Technical Details Row */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Databases */}
                      {selectedPlan.databases && selectedPlan.databases.length > 0 && (
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                              <Database size={20} className="text-green-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Firestore Collections</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedPlan.databases.map((db, idx) => (
                              <span key={idx} className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg font-mono text-sm text-green-400">
                                {db}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* APIs */}
                      {selectedPlan.apis && selectedPlan.apis.length > 0 && (
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-500/20 rounded-lg">
                              <Cpu size={20} className="text-cyan-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">APIs & Integrations</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedPlan.apis.map((api, idx) => (
                              <span key={idx} className="px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-sm text-cyan-400">
                                {api}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Cost Estimate */}
                    {selectedPlan.estimatedCost && (
                      <div className="bg-gradient-to-r from-orange-500/10 to-pink-500/10 rounded-2xl border border-orange-500/20 p-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-500/20 rounded-lg">
                            <DollarSign size={20} className="text-orange-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">Estimated Monthly Cost</h3>
                            <p className="text-xl text-orange-400 font-bold">{selectedPlan.estimatedCost}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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

        {/* Full Log Tab - World-Class Organized Design */}
        {activeTab === 'fulllog' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600/20 via-purple-600/20 to-pink-600/20 border border-white/10 p-6 md:p-8">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl shadow-lg shadow-orange-500/30">
                        <FileText size={24} />
                      </div>
                      Development History
                    </h2>
                    <p className="text-slate-300 mt-1">Complete bug fixes, build history, and feature timeline</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyMarkdown}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl text-white text-sm font-medium transition-all"
                    >
                      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <a
                      href="/PROGRESS.md"
                      download="PROGRESS.md"
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl text-white text-sm font-medium transition-all hover:scale-105"
                    >
                      <Download size={16} />
                      Download
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Tab Navigation */}
            <div className="flex justify-center">
              <div className="inline-flex bg-zinc-900/80 backdrop-blur-md rounded-2xl p-1.5 border border-white/10">
                {[
                  { id: 'bugfixes', label: 'Bug Fixes', icon: '🐛', count: bugFixCategories.reduce((a, c) => a + c.count, 0) },
                  { id: 'timeline', label: 'Build History', icon: '📅', count: buildTimeline.reduce((a, m) => a + m.sessions.length, 0) },
                  { id: 'features', label: 'Features Built', icon: '✨', count: completedFeatures.length },
                  { id: 'rawlog', label: 'Raw Log', icon: '📄', count: null },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setLogSubTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      logSubTab === tab.id
                        ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.count !== null && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        logSubTab === tab.id ? 'bg-white/20' : 'bg-zinc-700'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Bug Fixes Sub-Tab */}
            {logSubTab === 'bugfixes' && (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 rounded-2xl border border-red-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🐛</span>
                      <span className="text-xs text-red-400 uppercase tracking-wider font-medium">Total Fixes</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{bugFixCategories.reduce((a, c) => a + c.count, 0)}+</div>
                    <div className="text-xs text-slate-400 mt-1">bugs squashed</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl border border-green-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">📁</span>
                      <span className="text-xs text-green-400 uppercase tracking-wider font-medium">Categories</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{bugFixCategories.length}</div>
                    <div className="text-xs text-slate-400 mt-1">areas covered</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl border border-blue-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">📈</span>
                      <span className="text-xs text-blue-400 uppercase tracking-wider font-medium">Avg/Month</span>
                    </div>
                    <div className="text-4xl font-bold text-white">~25</div>
                    <div className="text-xs text-slate-400 mt-1">fixes per month</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-2xl border border-purple-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">💪</span>
                      <span className="text-xs text-purple-400 uppercase tracking-wider font-medium">Stability</span>
                    </div>
                    <div className="text-4xl font-bold text-white">90%</div>
                    <div className="text-xs text-slate-400 mt-1">platform stable</div>
                  </div>
                </div>

                {/* Category Accordions */}
                <div className="space-y-3">
                  {bugFixCategories.map(category => {
                    const colorMap: Record<string, { border: string; bg: string; text: string }> = {
                      red: { border: 'border-red-500/30 hover:border-red-500/50', bg: 'bg-red-500/10', text: 'text-red-400' },
                      blue: { border: 'border-blue-500/30 hover:border-blue-500/50', bg: 'bg-blue-500/10', text: 'text-blue-400' },
                      purple: { border: 'border-purple-500/30 hover:border-purple-500/50', bg: 'bg-purple-500/10', text: 'text-purple-400' },
                      pink: { border: 'border-pink-500/30 hover:border-pink-500/50', bg: 'bg-pink-500/10', text: 'text-pink-400' },
                      orange: { border: 'border-orange-500/30 hover:border-orange-500/50', bg: 'bg-orange-500/10', text: 'text-orange-400' },
                      cyan: { border: 'border-cyan-500/30 hover:border-cyan-500/50', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
                      green: { border: 'border-green-500/30 hover:border-green-500/50', bg: 'bg-green-500/10', text: 'text-green-400' },
                      indigo: { border: 'border-indigo-500/30 hover:border-indigo-500/50', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
                      yellow: { border: 'border-yellow-500/30 hover:border-yellow-500/50', bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
                    };
                    const colors = colorMap[category.color] || colorMap.blue;
                    const isExpanded = expandedBugCategory === category.id;
                    
                    return (
                      <div key={category.id} className={`bg-zinc-900/50 backdrop-blur-md rounded-2xl border ${colors.border} overflow-hidden transition-all`}>
                        <button
                          onClick={() => setExpandedBugCategory(isExpanded ? null : category.id)}
                          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-2xl">{category.icon}</span>
                            <div className="text-left">
                              <h3 className="font-semibold text-white">{category.name}</h3>
                              <p className={`text-sm ${colors.text}`}>{category.count} fixes</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                              {category.count} fixes
                            </span>
                            {isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                          </div>
                        </button>
                        
                        {isExpanded && (
                          <div className="border-t border-white/5 p-4">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-white/10">
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Date</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Fix</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Impact</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {category.fixes.map((fix, idx) => (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{fix.date}</td>
                                      <td className="py-2.5 px-3 text-white">{fix.fix}</td>
                                      <td className="py-2.5 px-3">
                                        <span className={`px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
                                          {fix.impact}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Build History Sub-Tab */}
            {logSubTab === 'timeline' && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl border border-blue-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">📅</span>
                      <span className="text-xs text-blue-400 uppercase tracking-wider font-medium">Sessions</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{buildTimeline.reduce((a, m) => a + m.sessions.length, 0)}</div>
                    <div className="text-xs text-slate-400 mt-1">dev sessions logged</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-2xl border border-purple-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">⚛️</span>
                      <span className="text-xs text-purple-400 uppercase tracking-wider font-medium">Components</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{buildTimeline.reduce((a, m) => a + m.sessions.reduce((b, s) => b + s.components, 0), 0)}+</div>
                    <div className="text-xs text-slate-400 mt-1">components built</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl border border-green-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">📆</span>
                      <span className="text-xs text-green-400 uppercase tracking-wider font-medium">Months</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{buildTimeline.length}</div>
                    <div className="text-xs text-slate-400 mt-1">of active development</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl border border-orange-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">✅</span>
                      <span className="text-xs text-orange-400 uppercase tracking-wider font-medium">Items</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{buildTimeline.reduce((a, m) => a + m.sessions.reduce((b, s) => b + s.highlights.length, 0), 0)}</div>
                    <div className="text-xs text-slate-400 mt-1">work items completed</div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 via-purple-500 to-blue-500" />
                  
                  <div className="space-y-8">
                    {buildTimeline.map((month, midx) => (
                      <div key={midx} className="relative pl-16">
                        {/* Month marker */}
                        <div className="absolute left-4 w-5 h-5 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full border-4 border-zinc-900 -translate-x-1/2" />
                        
                        <div className="mb-4">
                          <h3 className="text-xl font-bold text-white">{month.month}</h3>
                        </div>
                        
                        <div className="space-y-4">
                          {month.sessions.map((session, sidx) => (
                            <div key={sidx} className="bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-5 hover:border-orange-500/30 transition-all">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                                <div>
                                  <span className="text-sm text-slate-500">{session.date}</span>
                                  <h4 className="text-lg font-semibold text-white">{session.focus}</h4>
                                </div>
                                {session.components > 0 && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs text-purple-400 font-medium">
                                    <Code size={12} />
                                    {session.components} components
                                  </span>
                                )}
                              </div>
                              
                              <ul className="space-y-2">
                                {session.highlights.map((highlight, hidx) => (
                                  <li key={hidx} className="flex items-start gap-3 text-sm">
                                    <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                                    <span className="text-slate-300">{highlight}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Features Built Sub-Tab */}
            {logSubTab === 'features' && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl border border-green-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">✨</span>
                      <span className="text-xs text-green-400 uppercase tracking-wider font-medium">Categories</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{completedFeatures.length}</div>
                    <div className="text-xs text-slate-400 mt-1">feature categories</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl border border-blue-500/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🚀</span>
                      <span className="text-xs text-blue-400 uppercase tracking-wider font-medium">Features</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{completedFeatures.reduce((a, c) => a + c.items.length, 0)}</div>
                    <div className="text-xs text-slate-400 mt-1">individual features</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-2xl border border-purple-500/30 p-5 md:col-span-1 col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">💎</span>
                      <span className="text-xs text-purple-400 uppercase tracking-wider font-medium">Status</span>
                    </div>
                    <div className="text-4xl font-bold text-white">100%</div>
                    <div className="text-xs text-slate-400 mt-1">all core features complete</div>
                  </div>
                </div>

                {/* Feature Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedFeatures.map((category, idx) => (
                    <div key={idx} className="bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-5 hover:border-green-500/30 transition-all">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                          <CheckCircle size={18} className="text-green-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{category.category}</h3>
                          <span className="text-xs text-green-400">{category.items.length} features</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {category.items.map((item, itemIdx) => (
                          <span key={itemIdx} className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-lg border border-green-500/20">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Log Sub-Tab */}
            {logSubTab === 'rawlog' && (
              <div className="space-y-6">
                {/* Search Bar */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-pink-500/30 rounded-2xl blur-xl opacity-30" />
                  <div className="relative flex items-center bg-zinc-900/80 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden">
                    <Search className="ml-5 text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search bugs, fixes, features, timeline, components..."
                      value={markdownSearch}
                      onChange={(e) => setMarkdownSearch(e.target.value)}
                      className="flex-1 px-4 py-4 bg-transparent text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    {markdownSearch && (
                      <button 
                        onClick={() => setMarkdownSearch('')}
                        className="mr-4 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-slate-400 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Filters */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Bug Fix History', icon: '🐛' },
                    { label: 'Development Timeline', icon: '📅' },
                    { label: 'Draft Day System', icon: '🎯' },
                    { label: 'Certification Center', icon: '🎓' },
                    { label: 'Wellness Center', icon: '💪' },
                    { label: 'Command Center', icon: '📊' },
                    { label: 'Production Checklist', icon: '✅' },
                  ].map(section => (
                    <button
                      key={section.label}
                      onClick={() => setMarkdownSearch(section.label)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        markdownSearch === section.label 
                          ? 'bg-orange-500/20 border border-orange-500/30 text-orange-400' 
                          : 'bg-zinc-800/50 border border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span>{section.icon}</span>
                      {section.label}
                    </button>
                  ))}
                </div>

                {/* Markdown Content */}
                <div className="bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <span className="text-sm text-slate-400 font-mono">PROGRESS.md</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {filteredMarkdown ? `${filteredMarkdown.split('\n').length.toLocaleString()} lines` : 'Loading...'}
                    </span>
                  </div>
                  
                  <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {markdownLoading ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-orange-500/30 rounded-full" />
                          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-orange-500 rounded-full animate-spin" />
                        </div>
                        <span className="mt-4 text-slate-400">Loading documentation...</span>
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-orange max-w-none 
                        prose-headings:text-white prose-headings:font-bold
                        prose-h1:text-3xl prose-h1:bg-gradient-to-r prose-h1:from-orange-400 prose-h1:to-pink-400 prose-h1:bg-clip-text prose-h1:text-transparent prose-h1:border-b prose-h1:border-white/10 prose-h1:pb-4 prose-h1:mb-6
                        prose-h2:text-xl prose-h2:text-orange-400 prose-h2:mt-8 prose-h2:mb-4
                        prose-h3:text-lg prose-h3:text-slate-200 prose-h3:mt-6 prose-h3:mb-3
                        prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-sm
                        prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
                        prose-strong:text-white
                        prose-code:text-orange-300 prose-code:bg-orange-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                        prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:text-xs
                        prose-blockquote:border-l-4 prose-blockquote:border-orange-500 prose-blockquote:bg-orange-500/10 prose-blockquote:rounded-r-xl prose-blockquote:py-2 prose-blockquote:px-4
                        prose-ul:text-slate-300 prose-ol:text-slate-300 prose-li:marker:text-orange-500 prose-li:my-0.5 prose-li:text-sm
                        prose-table:text-sm prose-th:bg-zinc-800 prose-th:text-white prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border-white/5"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {filteredMarkdown || '# No matches found\n\nTry a different search term or clear the filter.'}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
