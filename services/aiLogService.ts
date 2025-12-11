/**
 * AI Log Service
 * Handles saving and loading AI chat sessions to/from Firestore
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================================
// TYPES
// ============================================================================

export interface AITodo {
  id: number;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'not-started';
}

export interface AISessionBuild {
  title: string;
  description: string;
  timestamp: string;
}

export interface AISessionBugFix {
  title: string;
  description: string;
  timestamp: string;
}

export interface AIWorkRating {
  quality: number;
  completeness: number;
  summary: string;
}

export interface AISecurityAudit {
  inputSanitization: boolean;
  authRules: boolean;
  xssReviewed: boolean;
  abusePotential: boolean;
  firestoreRules: boolean;
  notes?: string;
}

export interface AISession {
  id: string;
  sessionNumber: number;
  title: string;
  date: string;
  timestamp: Timestamp | null;
  status: 'active' | 'completed';
  
  // Work tracking
  todos: AITodo[];
  builds: AISessionBuild[];
  bugFixes: AISessionBugFix[];
  
  // Ratings & Audits
  workRating?: AIWorkRating;
  securityAudit?: AISecurityAudit;
  
  // Notes
  summary: string;
  pendingWork: string[];
  notes: string;
  
  // Full chat transcript
  chatTranscript: string;
  
  // Stats
  filesModified: string[];
  
  // Metadata
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ============================================================================
// FUNCTIONS
// ============================================================================

const AI_SESSIONS_COLLECTION = 'aiSessions';

/**
 * Generate a unique session ID
 */
export const generateSessionId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `session-${timestamp}-${random}`;
};

/**
 * Get the next session number
 */
export const getNextSessionNumber = async (): Promise<number> => {
  const sessionsRef = collection(db, AI_SESSIONS_COLLECTION);
  const q = query(sessionsRef, orderBy('sessionNumber', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return 1;
  }
  
  const lastSession = snapshot.docs[0].data() as AISession;
  return (lastSession.sessionNumber || 0) + 1;
};

/**
 * Create a new AI session
 */
export const createAISession = async (title: string): Promise<AISession> => {
  const id = generateSessionId();
  const sessionNumber = await getNextSessionNumber();
  const now = new Date();
  
  const session: AISession = {
    id,
    sessionNumber,
    title,
    date: now.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    }),
    timestamp: null, // Will be set by serverTimestamp
    status: 'active',
    todos: [],
    builds: [],
    bugFixes: [],
    summary: '',
    pendingWork: [],
    notes: '',
    chatTranscript: '',
    filesModified: [],
    createdAt: null,
    updatedAt: null,
  };
  
  await setDoc(doc(db, AI_SESSIONS_COLLECTION, id), {
    ...session,
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return session;
};

/**
 * Update an AI session
 */
export const updateAISession = async (
  sessionId: string, 
  updates: Partial<AISession>
): Promise<void> => {
  const docRef = doc(db, AI_SESSIONS_COLLECTION, sessionId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Complete an AI session (called on "save training")
 */
export const completeAISession = async (
  sessionId: string,
  finalData: {
    todos: AITodo[];
    builds: AISessionBuild[];
    bugFixes: AISessionBugFix[];
    workRating: AIWorkRating;
    securityAudit?: AISecurityAudit;
    summary: string;
    pendingWork: string[];
    notes: string;
    chatTranscript: string;
    filesModified: string[];
  }
): Promise<void> => {
  await updateAISession(sessionId, {
    ...finalData,
    status: 'completed',
  });
};

/**
 * Get a single AI session
 */
export const getAISession = async (sessionId: string): Promise<AISession | null> => {
  const docRef = doc(db, AI_SESSIONS_COLLECTION, sessionId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return { id: snapshot.id, ...snapshot.data() } as AISession;
};

/**
 * Get all AI sessions
 */
export const getAllAISessions = async (): Promise<AISession[]> => {
  const sessionsRef = collection(db, AI_SESSIONS_COLLECTION);
  const q = query(sessionsRef, orderBy('sessionNumber', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as AISession[];
};

/**
 * Delete an AI session
 */
export const deleteAISession = async (sessionId: string): Promise<void> => {
  await deleteDoc(doc(db, AI_SESSIONS_COLLECTION, sessionId));
};

/**
 * Clear ALL AI sessions (for re-seeding)
 */
export const clearAllAISessions = async (): Promise<void> => {
  const sessions = await getAllAISessions();
  await Promise.all(sessions.map(s => deleteAISession(s.id)));
};

/**
 * Get session statistics
 */
export const getSessionStats = async (): Promise<{
  totalSessions: number;
  completedSessions: number;
  totalTodos: number;
  completedTodos: number;
  totalBuilds: number;
  totalBugFixes: number;
  averageQuality: number;
}> => {
  const sessions = await getAllAISessions();
  
  let totalTodos = 0;
  let completedTodos = 0;
  let totalBuilds = 0;
  let totalBugFixes = 0;
  let qualitySum = 0;
  let qualityCount = 0;
  
  sessions.forEach(session => {
    totalTodos += session.todos.length;
    completedTodos += session.todos.filter(t => t.status === 'completed').length;
    totalBuilds += session.builds.length;
    totalBugFixes += session.bugFixes.length;
    
    if (session.workRating?.quality) {
      qualitySum += session.workRating.quality;
      qualityCount++;
    }
  });
  
  return {
    totalSessions: sessions.length,
    completedSessions: sessions.filter(s => s.status === 'completed').length,
    totalTodos,
    completedTodos,
    totalBuilds,
    totalBugFixes,
    averageQuality: qualityCount > 0 ? Math.round((qualitySum / qualityCount) * 10) / 10 : 0,
  };
};
