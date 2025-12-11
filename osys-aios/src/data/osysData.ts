// OSYS AIOS - Real extracted data from codebase scan
// Auto-generated from deep analysis of lockerroomlink codebase

export const OSYS_DATA = {
  project: {
    name: 'OSYS (LevelUp)',
    tagline: 'The Operating System for Youth Sports',
    version: '1.0.0',
    startDate: '2024-09-01',
    devDays: 110,
    progress: {
      overall: 40,
      mvp: 70,
      coreFeatures: 80,
      multiSport: 60,
      monetization: 30,
    },
    tech: {
      frontend: 'React 19 + TypeScript + Vite',
      styling: 'Tailwind CSS',
      backend: 'Firebase (Firestore, Auth, Storage)',
      payments: 'PayPal (events), Stripe (planned)',
      hosting: 'Netlify',
      devPort: 3001,
    }
  },

  // 12 User Roles discovered in types.ts
  userRoles: [
    'Coach', 'Parent', 'Fan', 'SuperAdmin', 'LeagueOwner', 
    'ProgramCommissioner', 'Referee', 'Commissioner', 'Ref', 
    'TeamCommissioner', 'LeagueCommissioner', 'Athlete'
  ],

  // 6 Sports supported via sportConfig.ts
  sports: ['football', 'basketball', 'soccer', 'baseball', 'cheer', 'volleyball'],

  // Age groups from types.ts
  ageGroups: [
    '5U', '6U', '7U', '8U', '9U', '10U', '11U', '12U',
    '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade',
    'Freshman', 'Sophomore', 'Junior', 'Senior',
    'Open', 'Adult', 'Masters', 'Seniors', 'Golden'
  ],

  // Firestore Collections discovered via grep
  collections: {
    core: ['users', 'teams', 'players', 'events', 'leagues', 'programs'],
    subcollections: [
      'teams/{teamId}/players',
      'teams/{teamId}/messages', 
      'teams/{teamId}/events',
      'teams/{teamId}/games',
      'leagues/{leagueId}/seasons',
      'leagues/{leagueId}/schedules',
      'leagues/{leagueId}/standings',
      'programs/{programId}/grievances',
      'events/{eventId}/registrations',
      'events/{eventId}/tickets',
      'private_chats/{chatId}/messages',
      'users/{uid}/plays',
      'users/{uid}/formations',
    ],
    system: ['aiSessions', 'creditTransactions', 'systemPlaybooks', 'systemPlays', 'systemFormations'],
    other: ['bulletin', 'seasonStats', 'adminActivityLog', 'infractions', 'simpleRegistrations', 'draftPool']
  },

  // 80+ Components discovered
  components: {
    total: 87,
    byCategory: {
      dashboard: ['NewOSYSDashboard', 'OSYSDashboard', 'Dashboard', 'FanDashboard'],
      roster: ['OSYSRoster', 'Roster', 'PlayerSelector'],
      playbook: ['OSYSPlaybook', 'Playbook', 'CoachPlaybook', 'TeamPlaybook', 'ClonePlayModal'],
      events: ['OSYSEvents', 'TicketManager', 'TicketPurchaseModal', 'MyTickets', 'TicketScanner'],
      chat: ['Chat', 'Messenger', 'OSYSMessenger'],
      auth: ['AuthScreen', 'ForcePasswordChange', 'ReleasedPlayerSetup'],
      profile: ['Profile', 'OSYSAthleteProfile', 'OSYSCoachProfile', 'FanProfile'],
      stats: ['Stats', 'ProgressPage', 'ComparisonPage'],
      media: ['OSYSLivestream', 'VideoLibrary', 'OptimizedImage'],
      monetization: ['FundraisingPage', 'NILMarketplace', 'NILWalletDashboard', 'DonateModal'],
      design: ['DesignStudio', 'MarketingHub', 'TeamColorPicker'],
      admin: ['AdminPanel', 'AdminPlaybook', 'ManageTeams', 'ManageCoaches', 'ManagePlayers', 'ManageEvents'],
      commissioner: ['CommissionerDashboard', 'CommissionerSeasonManager', 'CommissionerTeams'],
      league: ['LeagueDashboard', 'LeagueSettings', 'LeagueStandings', 'LeagueSchedule'],
      referee: ['RefereeDashboard', 'RefereeAssignment', 'RefereeGameView'],
      ui: ['OSYSComponents', 'OSYSFormElements', 'EmptyState', 'Skeleton', 'FeedbackButton', 'GettingStartedChecklist'],
      public: ['PublicAthleteProfile', 'PublicCoachProfile', 'PublicTeamPage', 'LandingPage'],
      misc: ['ErrorBoundary', 'InstallPrompt', 'AgeGroupSelector', 'StateSelector', 'TeamSelector', 'SeasonManager']
    }
  },

  // 25+ Services discovered
  services: {
    total: 26,
    list: [
      { name: 'firebase', purpose: 'Firebase app initialization (auth, db, storage)' },
      { name: 'eventService', purpose: 'Event CRUD, registration, promo codes' },
      { name: 'creditService', purpose: 'Credit system (get, deduct, add, record transactions)' },
      { name: 'leagueService', purpose: 'League management operations' },
      { name: 'tickets', purpose: 'Ticket creation, purchase, scanning' },
      { name: 'analytics', purpose: 'User behavior tracking' },
      { name: 'moderation', purpose: 'Content moderation and reporting' },
      { name: 'notificationService', purpose: 'Push and in-app notifications' },
      { name: 'toast', purpose: 'Toast notifications (success, error, info, warning)' },
      { name: 'aiLogService', purpose: 'AI session logging (createAISession, updateAISession)' },
      { name: 'refereeService', purpose: 'Referee assignment and management' },
      { name: 'activityLog', purpose: 'Admin activity logging' },
      { name: 'waiver', purpose: 'Waiver generation and signing' },
      { name: 'upload', purpose: 'File upload to Firebase Storage' },
      { name: 'api', purpose: 'External API calls (OpenAI, etc.)' },
      { name: 'seasonService', purpose: 'Season management (create, activate, end)' },
      { name: 'registrationService', purpose: 'Player registration flow' },
      { name: 'draftService', purpose: 'Draft pool and player assignment' },
      { name: 'playService', purpose: 'Play/formation CRUD operations' },
      { name: 'statsService', purpose: 'Player and team statistics' },
      { name: 'chatService', purpose: 'Team and private chat messaging' },
      { name: 'livestreamService', purpose: 'YouTube livestream integration' },
      { name: 'designService', purpose: 'Design studio templates and saves' },
      { name: 'exportService', purpose: 'Export data (PDF, images)' },
      { name: 'paymentService', purpose: 'PayPal integration' },
      { name: 'nilService', purpose: 'NIL marketplace operations' }
    ]
  },

  // 5 Hooks discovered
  hooks: [
    { name: 'useAuth', purpose: 'Auth state, user, team data, role checks', file: 'contexts/AuthContext.tsx' },
    { name: 'useTheme', purpose: 'Theme toggle (dark/light)', file: 'contexts/ThemeContext.tsx' },
    { name: 'useSportConfig', purpose: 'Sport-specific positions, stats, features', file: 'hooks/useSportConfig.ts' },
    { name: 'useCredits', purpose: 'Credit balance and operations', file: 'hooks/useCredits.ts' },
    { name: 'useOSYSData', purpose: 'Aggregate team/player/event data', file: 'hooks/useOSYSData.tsx' },
    { name: 'useUnreadMessages', purpose: 'Unread message count', file: 'hooks/useUnreadMessages.ts' },
    { name: 'useThemeColors', purpose: 'Theme-aware color utilities', file: 'hooks/useThemeColors.ts' }
  ],

  // 4 Contexts
  contexts: [
    { name: 'AuthContext', purpose: 'Global auth state, user profile, team data', file: 'contexts/AuthContext.tsx' },
    { name: 'ThemeContext', purpose: 'Dark/light theme management', file: 'contexts/ThemeContext.tsx' },
    { name: 'AppConfigContext', purpose: 'App-wide configuration', file: 'contexts/AppConfigContext.tsx' },
    { name: 'UnsavedChangesContext', purpose: 'Track unsaved form changes', file: 'contexts/UnsavedChangesContext.tsx' }
  ],

  // UI Component variants (from OSYSComponents.tsx)
  uiVariants: {
    button: ['primary', 'gold', 'ghost', 'outline'],
    badge: ['default', 'primary', 'gold', 'success', 'live', 'coming', 'warning', 'error'],
    invalid: {
      button: ['secondary', 'danger'],
      badge: ['info', 'danger']
    }
  },

  // TypeScript interfaces from types.ts
  interfaces: [
    'UserProfile', 'Team', 'Player', 'League', 'LeagueSeason', 'LeagueGame',
    'Program', 'Season', 'SeasonRegistration', 'DraftPoolEntry', 'Event',
    'Ticket', 'Infraction', 'Grievance', 'LiveStream', 'Play', 'Formation',
    'TeamGame', 'Message', 'PrivateChat', 'AISession', 'CreditTransaction',
    'RulesDocument', 'WaiverTemplate', 'PricingTier', 'PromoCode'
  ],

  // 110+ Bug Fixes documented
  bugFixes: {
    total: 110,
    byCategory: {
      'Authentication & Permissions': 17,
      'Stats System': 10,
      'UI/UX & Visibility': 22,
      'Video & Media': 8,
      'Playbook & Canvas': 12,
      'Chat & Messaging': 8,
      'Team & Roster': 10,
      'Design Studio': 14,
      'TypeScript & Build': 8,
      'PWA & Mobile': 5,
      'Events & Registration': 3,
      'Landing & Navigation': 5,
      'Miscellaneous': 4
    }
  },

  // Current blockers from PROGRESS.md
  blockers: [
    {
      id: 'P0-001',
      title: 'Team Age Groups & Draft System',
      status: 'blocker',
      priority: 'P0',
      description: 'Youth organizations need multi-grade teams and draft functionality',
      phases: ['Team Creation', 'Registration Pool', 'Auto-Assignment', 'Draft Day', 'Enhancements']
    }
  ],

  // Game Changer Feature - THE PLAYGROUND
  playground: {
    title: 'THE PLAYGROUND - Youth Social Platform',
    status: 'specs-complete',
    priority: 'P0',
    description: 'Youth-safe social platform that transforms OSYS from "coach\'s app" to "MY app" for kids',
    source: 'Pilot youth feedback: "We want FaceTime and hangout rooms with teammates!"',
    features: [
      { name: 'Voice/Video Calls', description: '1-on-1 calls with teammates via WebRTC', tech: 'simple-peer', weeks: 3 },
      { name: 'Playground Rooms', description: 'Group video hangouts (Zoom-style)', tech: 'WebRTC Mesh + Daily.co', weeks: 4 },
      { name: 'Virtual Film Room', description: 'Coach screen share + telestrator', tech: 'Screen Capture API', weeks: 2 },
      { name: 'AI Tutor "Coach Brain"', description: 'School/Sports/Life/Goals modes', tech: 'OpenAI GPT-4', weeks: 2 },
      { name: 'Parent Safety Dashboard', description: 'Call logs, time restrictions, alerts', tech: 'Firebase RTDB', weeks: 1 }
    ],
    timeline: '14 weeks total',
    monetization: {
      free: ['1-on-1 calls unlimited', 'Playground rooms (4 max)', 'AI Tutor (5 questions/day)'],
      premium: ['Playground rooms (12 max)', 'AI Tutor unlimited', 'Film Room creation'],
      price: '$4.99/mo',
      revenueProjection: '$748K/mo at 1M athletes (15% conversion)'
    },
    whyGameChanger: 'Only social platform where parents WANT their kids to spend time. Competes with Snapchat but safer.'
  },

  // Revenue streams from MONETIZATION_PLAN.md
  revenue: {
    streams: [
      { name: 'Coach Subscriptions', model: 'Monthly recurring', phase: 1 },
      { name: 'System Playbooks', model: 'One-time purchase', phase: 1 },
      { name: 'Event Registration', model: '5% of transaction', phase: 1 },
      { name: 'Fundraising Platform', model: '3-5% of donations', phase: 2 },
      { name: 'Game Tickets', model: '5% + $0.50/ticket', phase: 2 },
      { name: 'Private Coaching', model: '10-15% of booking', phase: 2 },
      { name: 'NIL Marketplace', model: '10% of deals', phase: 3 },
      { name: 'League Management', model: '$49-199/season', phase: 3 },
      { name: 'AI Features', model: 'Per-use pricing', phase: 3 }
    ],
    projections: {
      year1: 23500,
      year2: 155500,
      year3: 679000
    }
  },

  // Competitive landscape
  competitors: [
    { name: 'TeamSnap', weakness: 'No playbook, expensive' },
    { name: 'SportsEngine', weakness: 'Complex, enterprise-focused' },
    { name: 'GameChanger', weakness: 'Limited features, baseball-heavy' },
    { name: 'League Lineup', weakness: 'Outdated UI (2005 look)' }
  ],

  // Key errors documented in copilot-instructions.md
  commonErrors: [
    { id: 'ERR-001', title: 'Badge variant doesn\'t exist', wrong: 'variant="info"', right: 'variant="primary"' },
    { id: 'ERR-002', title: 'UserRole case mismatch', wrong: 'role === "coach"', right: 'role === "Coach"' },
    { id: 'ERR-003', title: 'Credits field wrong', wrong: 'userData?.cloneCredits', right: 'userData?.credits' },
    { id: 'ERR-004', title: 'Firestore permission denied', fix: 'Check firestore.rules + deploy' },
    { id: 'ERR-005', title: 'Chunk load error after deploy', fix: 'Handled by lazyWithRetry()' },
    { id: 'ERR-006', title: 'Sport-specific hardcoding', fix: 'Use sportConfig.ts' }
  ],

  // Learnings from project
  learnings: [
    { id: 'L001', title: 'CTA Intent', lesson: '"Get Started" → ?signup=true, not login' },
    { id: 'L004', title: 'Use sportConfig', lesson: 'Never hardcode positions/stats' },
    { id: 'L009', title: 'Check Props', lesson: 'Read component source before using' },
    { id: 'L010', title: 'Firebase Queries', lesson: 'Handle both new and legacy data' },
    { id: 'L011', title: 'Badge Variants', lesson: 'NO info or danger variants' },
    { id: 'L012', title: 'UserRole Case', lesson: 'Capital: Coach not coach' },
    { id: 'L014', title: 'Button Variants', lesson: 'NO outline or secondary' },
    { id: 'L015', title: 'Self-Rating', lesson: 'Rate X/10 after EVERY task' }
  ]
};

// Feature completion tracking
export const FEATURE_STATUS = {
  completed: [
    { name: 'Multi-Sport Support', status: 'complete', progress: 100 },
    { name: 'Team Management', status: 'complete', progress: 100 },
    { name: 'Player Roster', status: 'complete', progress: 100 },
    { name: 'Chat & Messaging', status: 'complete', progress: 100 },
    { name: 'Playbook Builder', status: 'complete', progress: 100 },
    { name: 'Video Library', status: 'complete', progress: 100 },
    { name: 'Stats Tracking', status: 'complete', progress: 100 },
    { name: 'Event Registration', status: 'complete', progress: 95 },
    { name: 'Ticket System', status: 'complete', progress: 100 },
    { name: 'Design Studio', status: 'complete', progress: 100 },
    { name: 'Public Profiles', status: 'complete', progress: 100 },
    { name: 'Livestreaming', status: 'complete', progress: 100 },
    { name: 'Firestore Rules', status: 'complete', progress: 95 },
    { name: 'Auth System', status: 'complete', progress: 100 },
    { name: 'Role-Based Access', status: 'complete', progress: 100 },
  ],
  inProgress: [
    { name: 'Draft System', status: 'in-progress', progress: 20, blocker: true },
    { name: '🎮 THE PLAYGROUND', status: 'in-progress', progress: 10, gameChanger: true },
    { name: 'Stripe Integration', status: 'in-progress', progress: 10 },
    { name: 'Mobile Polish', status: 'in-progress', progress: 60 },
    { name: 'NIL Marketplace', status: 'in-progress', progress: 40 },
  ],
  planned: [
    { name: 'Playground Voice/Video', status: 'planned', progress: 0, parent: 'THE PLAYGROUND' },
    { name: 'Playground Rooms', status: 'planned', progress: 0, parent: 'THE PLAYGROUND' },
    { name: 'AI Tutor Coach Brain', status: 'planned', progress: 0, parent: 'THE PLAYGROUND' },
    { name: 'AI Stats from Video', status: 'planned', progress: 0 },
    { name: 'White-Label', status: 'planned', progress: 0 },
    { name: 'Coach Hiring', status: 'planned', progress: 0 },
    { name: 'Advanced Analytics', status: 'planned', progress: 0 },
  ]
};

// Route structure from App.tsx
export const ROUTES = {
  public: [
    { path: '/', component: 'LandingPage' },
    { path: '/athlete/:username', component: 'PublicAthleteProfile' },
    { path: '/coach/:coachId', component: 'PublicCoachProfile' },
    { path: '/team/:teamId', component: 'PublicTeamPage' },
    { path: '/event/:eventId', component: 'PublicEventPage' },
  ],
  auth: [
    { path: '/login', component: 'AuthScreen' },
    { path: '/signup', component: 'AuthScreen' },
  ],
  dashboard: [
    { path: '/dashboard', component: 'NewOSYSDashboard', roles: ['all'] },
    { path: '/roster', component: 'OSYSRoster', roles: ['Coach', 'Parent'] },
    { path: '/playbook', component: 'OSYSPlaybook', roles: ['Coach'] },
    { path: '/events', component: 'OSYSEvents', roles: ['all'] },
    { path: '/chat', component: 'Chat', roles: ['Coach', 'Parent'] },
    { path: '/stats', component: 'Stats', roles: ['Coach', 'Parent'] },
    { path: '/profile', component: 'Profile', roles: ['all'] },
    { path: '/design-studio', component: 'DesignStudio', roles: ['Coach', 'Parent'] },
    { path: '/marketing', component: 'MarketingHub', roles: ['Coach'] },
    { path: '/fundraising', component: 'FundraisingPage', roles: ['Coach'] },
    { path: '/livestream', component: 'OSYSLivestream', roles: ['Coach'] },
    { path: '/messenger', component: 'OSYSMessenger', roles: ['all'] },
  ],
  admin: [
    { path: '/admin', component: 'AdminPanel', roles: ['SuperAdmin'] },
    { path: '/admin/playbook', component: 'AdminPlaybook', roles: ['SuperAdmin'] },
    { path: '/admin/teams', component: 'ManageTeams', roles: ['SuperAdmin'] },
    { path: '/admin/events', component: 'ManageEvents', roles: ['SuperAdmin'] },
  ],
  commissioner: [
    { path: '/commissioner', component: 'CommissionerDashboard', roles: ['Commissioner', 'ProgramCommissioner'] },
    { path: '/commissioner/teams', component: 'CommissionerTeams', roles: ['Commissioner'] },
    { path: '/commissioner/seasons', component: 'CommissionerSeasonManager', roles: ['Commissioner'] },
  ],
  league: [
    { path: '/league', component: 'LeagueDashboard', roles: ['LeagueOwner', 'LeagueCommissioner'] },
    { path: '/league/settings', component: 'LeagueSettings', roles: ['LeagueOwner'] },
    { path: '/league/standings', component: 'LeagueStandings', roles: ['LeagueOwner'] },
  ],
  referee: [
    { path: '/referee', component: 'RefereeDashboard', roles: ['Referee', 'Ref'] },
    { path: '/referee/games', component: 'RefereeGameView', roles: ['Referee'] },
  ],
  fan: [
    { path: '/fan', component: 'FanDashboard', roles: ['Fan'] },
    { path: '/fan/hub', component: 'OSYSFanHub', roles: ['Fan'] },
    { path: '/tickets', component: 'MyTickets', roles: ['Fan', 'Parent'] },
  ]
};
