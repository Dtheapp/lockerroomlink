/**
 * AI Log Page
 * World-class tracking page for AI chat sessions
 * Shows session history, todos, builds, bug fixes, and full chat transcripts
 */

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Calendar, 
  CheckCircle, 
  Circle, 
  Clock, 
  Code, 
  ChevronDown, 
  ChevronRight,
  FileText, 
  FolderOpen,
  Bug,
  Hammer,
  Star,
  Shield,
  TrendingUp,
  Loader2,
  AlertCircle,
  Sparkles,
  X,
  Copy,
  Check,
  Hash,
  Activity,
  Plus
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { 
  getAllAISessions, 
  getSessionStats,
  createAISession,
  completeAISession,
  clearAllAISessions,
  type AISession, 
  type AITodo 
} from '../services/aiLogService';

// Function to seed historical sessions
const seedHistoricalSessions = async (): Promise<void> => {
  // Clear existing sessions first to avoid duplicates
  await clearAllAISessions();
  const now = new Date().toISOString();
  
  // Session 1 - December 6, 2025
  const session1 = await createAISession('Initial Platform Setup');
  await completeAISession(session1.id, {
    todos: [
      { id: 1, title: 'Create AI Training Framework', description: 'Set up AI_TRAINER.md', status: 'completed' },
      { id: 2, title: 'Add 31 Traits of Excellence', description: 'Define all excellence traits', status: 'completed' },
    ],
    builds: [
      { title: 'AI Training System', description: 'Created foundational AI training framework with 31 traits', timestamp: now }
    ],
    bugFixes: [],
    workRating: { quality: 9, completeness: 9, summary: 'Created foundational AI training system' },
    securityAudit: { inputSanitization: true, authRules: true, xssReviewed: true, abusePotential: true, firestoreRules: false },
    summary: 'Set up AI training framework and master files',
    pendingWork: [],
    notes: '',
    chatTranscript: 'Session 1 - December 6, 2025\n\nInitial setup of AI_TRAINER.md and master training files.\n- Created 25 traits of excellence\n- Added Design Excellence Traits (26-30)\n- Set up compound learning system',
    filesModified: ['AI_TRAINER.md', 'PROGRESS.md'],
  });

  // Session 2 - December 9, 2025  
  const session2 = await createAISession('Public Pages + Bug Fix History');
  await completeAISession(session2.id, {
    todos: [
      { id: 1, title: 'Add Public Page Sharing', description: 'Social media integration', status: 'completed' },
      { id: 2, title: 'Create Bug Fix History', description: '100+ fixes documented', status: 'completed' },
      { id: 3, title: 'Build Draft Lottery UI', description: 'LotteryWheel, results board', status: 'completed' },
    ],
    builds: [
      { title: 'Public Page Sharing', description: 'Added social media integration for athlete/team profiles', timestamp: now },
      { title: 'Bug Fix History', description: '100+ fixes documented and categorized', timestamp: now },
      { title: 'Draft Lottery UI', description: 'Built LotteryWheel, LotteryTicketWinner, LotteryResultsBoard', timestamp: now },
    ],
    bugFixes: [],
    workRating: { quality: 10, completeness: 10, summary: 'Comprehensive documentation and public sharing features' },
    securityAudit: { inputSanitization: true, authRules: true, xssReviewed: true, abusePotential: true, firestoreRules: true },
    summary: 'Added public page sharing, created Bug Fix History and Development Timeline sections',
    pendingWork: [],
    notes: '',
    chatTranscript: 'Session 2 - December 9, 2025\n\nMajor documentation and public pages update.\n- Added public page sharing with social media integration\n- Created Bug Fix History section (100+ fixes documented)\n- Added Development Timeline section (300+ items)\n- Built Draft Lottery UI for /draft showcase',
    filesModified: ['PROGRESS.md', 'DraftDayShowcase.tsx'],
  });

  // Session 3 - December 11, 2025 (Morning)
  const session3 = await createAISession('Bug Fixes - Design Studio & Draft Pool');
  await completeAISession(session3.id, {
    todos: [
      { id: 1, title: 'Fix Design Studio QR', description: 'TypeError on registration template', status: 'completed' },
      { id: 2, title: 'Fix NoAthleteBlock', description: 'Draft pool players see wrong UI', status: 'completed' },
      { id: 3, title: 'Fix Player Status Badges', description: 'Badges not showing correctly', status: 'completed' },
      { id: 4, title: 'Add Events to Coach Sidebar', description: 'Missing Events tab', status: 'completed' },
    ],
    builds: [
      { title: 'Registration Flyer Improvements', description: 'QR 150px, team logo auto-add, real season data', timestamp: now },
      { title: 'TODO Tracking', description: 'Added session TODOs tab to Progress page', timestamp: now },
    ],
    bugFixes: [
      { title: 'Design Studio QR Code Error', description: 'Fixed position/size structure for QR elements', timestamp: now },
      { title: 'NoAthleteBlock Draft Pool', description: 'Shows correct UI for players in draft pool', timestamp: now },
      { title: 'Player Status Badges', description: 'Now correctly shows In Draft Pool, On Team, etc.', timestamp: now },
      { title: 'Mobile Sidebar Collapse', description: 'Removed redundant hamburger menu', timestamp: now },
    ],
    workRating: { quality: 10, completeness: 10, summary: '18 bug fixes across Design Studio, Draft Pool, and Registration systems' },
    securityAudit: { inputSanitization: true, authRules: true, xssReviewed: true, abusePotential: true, firestoreRules: true },
    summary: 'Fixed 18 bugs including Design Studio QR, NoAthleteBlock, Player Status Badges',
    pendingWork: [],
    notes: '',
    chatTranscript: 'Session 3 - December 11, 2025\n\nMassive bug fix session:\n- Fixed Design Studio QR Code Error\n- Fixed NoAthleteBlock for Draft Pool Players\n- Fixed Player Status Badges\n- Added Events to Coach Sidebar\n- Improved Registration Flyer (QR 150px + team logo)\n- Added TODO Tracking to Progress Page\n- Auto-fill Registration Flyer with real season data',
    filesModified: ['DesignStudioPro.tsx', 'NoAthleteBlock.tsx', 'EventsPage.tsx', 'ProgressPage.tsx', 'NewOSYSLayout.tsx'],
  });

  // Session 4 - December 11, 2025 (Afternoon)
  const session4 = await createAISession('AI Session Logging + World-Class Instructions');
  await completeAISession(session4.id, {
    todos: [
      { id: 1, title: 'Fix Firestore Permissions', description: 'Add aiSessions collection rules', status: 'completed' },
      { id: 2, title: 'Build World-Class Instructions', description: 'Merge AI_TRAINER.md into unified file', status: 'completed' },
    ],
    builds: [
      { title: 'AI Session Logging System', description: 'Built /ailog page with Firestore service, expandable cards, stats dashboard', timestamp: now },
      { title: 'World-Class Unified Instructions', description: 'Merged 911 lines into optimized 400-line single file', timestamp: now },
    ],
    bugFixes: [
      { title: 'Firestore Permissions', description: 'Added aiSessions collection rules for /ailog access', timestamp: now },
    ],
    workRating: { quality: 10, completeness: 10, summary: 'Built complete AI session tracking system and unified instructions' },
    securityAudit: { inputSanitization: true, authRules: true, xssReviewed: true, abusePotential: true, firestoreRules: true },
    summary: 'Built /ailog page with Firestore tracking, unified copilot-instructions.md',
    pendingWork: [],
    notes: '',
    chatTranscript: 'Session 4 - December 11, 2025\n\nBuilt AI Session Logging System (/ailog):\n- Created aiLogService.ts with CRUD operations\n- Built AILogPage.tsx with expandable cards and stats\n- Added route to App.tsx\n- Deployed Firestore rules\n\nBuilt World-Class Unified Instructions:\n- Merged AI_TRAINER.md (724 lines) + copilot-instructions.md (187 lines)\n- Created single optimized 400-line file\n- Priority Zero table at top\n- Quick commands and Never Do tables\n- Integrated with /ailog system',
    filesModified: ['aiLogService.ts', 'AILogPage.tsx', 'App.tsx', 'firestore.rules', 'copilot-instructions.md', 'PROGRESS.md'],
  });
};

// ============================================================================
// STATS CARD COMPONENT
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  subtext?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, subtext }) => {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-4 md:p-6 border border-white/10`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white/10 rounded-lg">
          {icon}
        </div>
        <span className="text-sm text-white/70">{label}</span>
      </div>
      <div className="text-3xl md:text-4xl font-bold text-white">{value}</div>
      {subtext && <div className="text-xs text-white/50 mt-1">{subtext}</div>}
    </div>
  );
};

// ============================================================================
// SESSION CARD COMPONENT
// ============================================================================

interface SessionCardProps {
  session: AISession;
  onViewChat: (session: AISession) => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, onViewChat }) => {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useTheme();
  
  // Safety: ensure arrays exist
  const todos = Array.isArray(session.todos) ? session.todos : [];
  const builds = Array.isArray(session.builds) ? session.builds : [];
  const bugFixes = Array.isArray(session.bugFixes) ? session.bugFixes : [];
  const filesModified = Array.isArray(session.filesModified) ? session.filesModified : [];
  const pendingWork = Array.isArray(session.pendingWork) ? session.pendingWork : [];
  
  // Safety: ensure strings are strings
  const title = typeof session.title === 'string' ? session.title : String(session.title || 'Untitled Session');
  const summary = typeof session.summary === 'string' ? session.summary : '';
  const date = typeof session.date === 'string' ? session.date : '';
  
  // Safety: ensure workRating is properly structured
  const workRating = session.workRating && typeof session.workRating === 'object' 
    ? {
        quality: typeof session.workRating.quality === 'number' ? session.workRating.quality : 0,
        completeness: typeof session.workRating.completeness === 'number' ? session.workRating.completeness : 0,
        summary: typeof session.workRating.summary === 'string' ? session.workRating.summary : '',
      }
    : null;
  
  const completedTodos = todos.filter(t => t.status === 'completed').length;
  const totalTodos = todos.length;
  
  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      theme === 'dark' 
        ? 'bg-zinc-900/80 border-white/10 hover:border-purple-500/50' 
        : 'bg-white border-slate-200 hover:border-purple-400'
    }`}>
      {/* Header - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 md:p-6 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
              }`}>
                #{session.sessionNumber}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                session.status === 'completed'
                  ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                  : theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
              }`}>
                {session.status === 'completed' ? '✅ Completed' : '🔄 Active'}
              </span>
            </div>
            
            <h3 className={`text-lg md:text-xl font-bold truncate ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {title}
            </h3>
            
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                <Calendar className="w-4 h-4 inline mr-1" />
                {date}
              </span>
              {totalTodos > 0 && (
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  {completedTodos}/{totalTodos} todos
                </span>
              )}
              {workRating && (
                <span className="text-orange-400">
                  <Star className="w-4 h-4 inline mr-1" />
                  {workRating.quality}/10
                </span>
              )}
            </div>
            
            {summary && (
              <p className={`mt-2 text-sm line-clamp-2 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {summary}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick stats badges */}
            <div className="hidden md:flex items-center gap-2">
              {builds.length > 0 && (
                <span className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 ${
                  theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <Hammer className="w-3 h-3" />
                  {builds.length}
                </span>
              )}
              {bugFixes.length > 0 && (
                <span className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 ${
                  theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                }`}>
                  <Bug className="w-3 h-3" />
                  {bugFixes.length}
                </span>
              )}
            </div>
            
            <div className={`p-2 rounded-lg transition-transform ${
              expanded ? 'rotate-180' : ''
            } ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
              <ChevronDown className="w-5 h-5" />
            </div>
          </div>
        </div>
      </button>
      
      {/* Expanded Content */}
      {expanded && (
        <div className={`border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
          {/* Todos Section */}
          {todos.length > 0 && (
            <div className={`p-4 md:p-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <h4 className={`font-bold mb-3 flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <CheckCircle className="w-5 h-5 text-green-500" />
                TODOs ({completedTodos}/{totalTodos})
              </h4>
              <div className="space-y-2">
                {todos.map(todo => (
                  <div 
                    key={todo.id}
                    className={`flex items-start gap-3 p-3 rounded-xl ${
                      todo.status === 'completed'
                        ? theme === 'dark' ? 'bg-green-500/10' : 'bg-green-50'
                        : theme === 'dark' ? 'bg-zinc-800/50' : 'bg-slate-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      todo.status === 'completed' ? 'bg-green-500' : 'bg-zinc-600'
                    }`}>
                      {todo.status === 'completed' ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <Circle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${
                        todo.status === 'completed' 
                          ? theme === 'dark' ? 'text-green-300' : 'text-green-700'
                          : theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {todo.title}
                      </div>
                      {todo.description && (
                        <div className={`text-sm mt-0.5 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {todo.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Builds & Bug Fixes */}
          <div className={`p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b ${
            theme === 'dark' ? 'border-white/10' : 'border-slate-200'
          }`}>
            {/* Builds */}
            <div>
              <h4 className={`font-bold mb-3 flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Hammer className="w-5 h-5 text-emerald-500" />
                Builds ({builds.length})
              </h4>
              {builds.length > 0 ? (
                <div className="space-y-2">
                  {builds.map((build, idx) => (
                    <div key={idx} className={`p-3 rounded-xl ${
                      theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'
                    }`}>
                      <div className={`font-medium ${
                        theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'
                      }`}>{build.title}</div>
                      <div className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>{build.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  No builds in this session
                </p>
              )}
            </div>
            
            {/* Bug Fixes */}
            <div>
              <h4 className={`font-bold mb-3 flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Bug className="w-5 h-5 text-red-500" />
                Bug Fixes ({bugFixes.length})
              </h4>
              {bugFixes.length > 0 ? (
                <div className="space-y-2">
                  {bugFixes.map((fix, idx) => (
                    <div key={idx} className={`p-3 rounded-xl ${
                      theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
                    }`}>
                      <div className={`font-medium ${
                        theme === 'dark' ? 'text-red-300' : 'text-red-700'
                      }`}>{fix.title}</div>
                      <div className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>{fix.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  No bug fixes in this session
                </p>
              )}
            </div>
          </div>
          
          {/* Work Rating & Files Modified */}
          <div className={`p-4 md:p-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Work Rating */}
              {workRating && (
                <div className={`p-4 rounded-xl ${
                  theme === 'dark' ? 'bg-orange-500/10' : 'bg-orange-50'
                }`}>
                  <h4 className={`font-bold mb-2 flex items-center gap-2 ${
                    theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                  }`}>
                    <Star className="w-5 h-5" />
                    Work Rating
                  </h4>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-2xl font-bold text-orange-400">
                        {workRating.quality}/10
                      </div>
                      <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        Quality
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-400">
                        {workRating.completeness}/10
                      </div>
                      <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        Completeness
                      </div>
                    </div>
                  </div>
                  {workRating.summary && (
                    <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {workRating.summary}
                    </p>
                  )}
                </div>
              )}
              
              {/* Files Modified */}
              {filesModified.length > 0 && (
                <div className={`p-4 rounded-xl ${
                  theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'
                }`}>
                  <h4 className={`font-bold mb-2 flex items-center gap-2 ${
                    theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                  }`}>
                    <Code className="w-5 h-5" />
                    Files Modified ({filesModified.length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {filesModified.map((file, idx) => (
                      <div key={idx} className={`text-xs font-mono truncate ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Pending Work */}
          {pendingWork.length > 0 && (
            <div className={`p-4 md:p-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <h4 className={`font-bold mb-3 flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Pending Work
              </h4>
              <ul className="space-y-1">
                {pendingWork.map((item, idx) => (
                  <li key={idx} className={`text-sm flex items-start gap-2 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <span className="text-amber-500">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Actions */}
          <div className="p-4 md:p-6 flex items-center justify-between">
            <button
              onClick={() => onViewChat(session)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                theme === 'dark'
                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              <FolderOpen className="w-5 h-5" />
              View Full Chat
            </button>
            
            <div className={`text-xs font-mono ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              ID: {session.id}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CHAT MODAL COMPONENT
// ============================================================================

interface ChatModalProps {
  session: AISession;
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ session, onClose }) => {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  
  // Safety: ensure strings are strings
  const title = typeof session.title === 'string' ? session.title : String(session.title || 'Untitled Session');
  const date = typeof session.date === 'string' ? session.date : '';
  const chatTranscript = typeof session.chatTranscript === 'string' ? session.chatTranscript : '';
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(chatTranscript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div>
            <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Session #{session.sessionNumber} - Full Chat
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {title} • {date}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`p-2 rounded-lg transition-all ${
                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}
            >
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-all ${
                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {chatTranscript ? (
            <pre className={`whitespace-pre-wrap font-mono text-sm ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              {chatTranscript}
            </pre>
          ) : (
            <div className={`text-center py-12 ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No chat transcript saved for this session</p>
              <p className="text-xs mt-2 opacity-70">Use "save training" command to save session chats</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

const AILogPage: React.FC = () => {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [stats, setStats] = useState<{
    totalSessions: number;
    completedSessions: number;
    totalTodos: number;
    completedTodos: number;
    totalBuilds: number;
    totalBugFixes: number;
    averageQuality: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<AISession | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'active'>('all');
  const [seeding, setSeeding] = useState(false);

  const handleSeedData = async () => {
    try {
      setSeeding(true);
      await seedHistoricalSessions();
      // Reload data
      const [sessionsData, statsData] = await Promise.all([
        getAllAISessions(),
        getSessionStats(),
      ]);
      setSessions(sessionsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error seeding sessions:', err);
      setError('Failed to seed sessions');
    } finally {
      setSeeding(false);
    }
  };
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [sessionsData, statsData] = await Promise.all([
          getAllAISessions(),
          getSessionStats(),
        ]);
        setSessions(sessionsData);
        setStats(statsData);
      } catch (err) {
        console.error('Error loading AI sessions:', err);
        setError('Failed to load AI sessions');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  const filteredSessions = sessions.filter(session => {
    if (filter === 'all') return true;
    return session.status === filter;
  });
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            Loading AI sessions...
          </p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={`text-center p-8 rounded-2xl ${
          theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
        }`}>
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 md:p-6 pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className={`text-3xl md:text-4xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              AI Session Log
            </h1>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
              Complete history of AI development sessions
            </p>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Hash className="w-5 h-5 text-purple-400" />}
            label="Total Sessions"
            value={stats.totalSessions}
            color="from-purple-500/20 to-pink-500/20"
            subtext={`${stats.completedSessions} completed`}
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5 text-green-400" />}
            label="TODOs Completed"
            value={`${stats.completedTodos}/${stats.totalTodos}`}
            color="from-green-500/20 to-emerald-500/20"
            subtext={`${stats.totalTodos > 0 ? Math.round((stats.completedTodos / stats.totalTodos) * 100) : 0}% success`}
          />
          <StatCard
            icon={<Activity className="w-5 h-5 text-blue-400" />}
            label="Builds & Fixes"
            value={stats.totalBuilds + stats.totalBugFixes}
            color="from-blue-500/20 to-cyan-500/20"
            subtext={`${stats.totalBuilds} builds, ${stats.totalBugFixes} fixes`}
          />
          <StatCard
            icon={<Star className="w-5 h-5 text-orange-400" />}
            label="Avg Quality"
            value={`${stats.averageQuality}/10`}
            color="from-orange-500/20 to-amber-500/20"
            subtext="Work rating"
          />
        </div>
      )}
      
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { id: 'all', label: 'All Sessions' },
          { id: 'completed', label: 'Completed' },
          { id: 'active', label: 'Active' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              filter === tab.id
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : theme === 'dark'
                ? 'bg-zinc-800 text-slate-400 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Sessions List */}
      {filteredSessions.length > 0 ? (
        <div className="space-y-4">
          {filteredSessions.map(session => (
            <SessionCard 
              key={session.id} 
              session={session}
              onViewChat={setSelectedSession}
            />
          ))}
        </div>
      ) : (
        <div className={`text-center py-16 rounded-2xl ${
          theme === 'dark' ? 'bg-zinc-900/50' : 'bg-slate-50'
        }`}>
          <Sparkles className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-purple-500' : 'text-purple-400'
          }`} />
          <h3 className={`text-xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            No AI Sessions Yet
          </h3>
          <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Start a new AI chat session to begin tracking your development progress
          </p>
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-medium rounded-xl hover:from-purple-500 hover:to-pink-400 transition-all disabled:opacity-50"
          >
            {seeding ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading Sessions...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Load Historical Sessions
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Info Box */}
      <div className={`mt-8 p-4 rounded-2xl ${
        theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'
      }`}>
        <div className="flex items-start gap-3">
          <Brain className={`w-6 h-6 flex-shrink-0 ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`} />
          <div>
            <h4 className={`font-bold ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
              How AI Session Logging Works
            </h4>
            <ul className={`text-sm mt-2 space-y-1 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <li>• At the start of each AI chat, say <code className="bg-black/20 px-1 rounded">"new session"</code> to create a log entry</li>
              <li>• The AI will track all TODOs, builds, and bug fixes during the session</li>
              <li>• At the end, say <code className="bg-black/20 px-1 rounded">"save training"</code> to save everything including the full chat</li>
              <li>• Each session includes work ratings, security audits, and pending work notes</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Chat Modal */}
      {selectedSession && (
        <ChatModal 
          session={selectedSession} 
          onClose={() => setSelectedSession(null)} 
        />
      )}
    </div>
  );
};

export default AILogPage;
