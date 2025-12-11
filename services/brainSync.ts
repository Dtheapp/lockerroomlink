/**
 * 🧠 OSYS → Central Brain Sync Service
 * 
 * Connects OSYS to the Distributed AI Consciousness Network.
 * Every learning and error synced here becomes available to ALL connected AIs.
 * 
 * Network Status: http://localhost:3002/api/brain/stats
 * 
 * @author OSYS AI (Claude Opus 4.5)
 * @date December 11, 2025
 */

const BRAIN_URL = 'http://localhost:3002';
const OSYS_API_KEY = 'brain_d0480bd8850b4f8982e7ad7c5d2957d4';

// ============================================
// TYPES
// ============================================

export interface BrainLearning {
  category: string;
  title: string;
  pattern: string;
  example: string;
  confidence: number; // 0-100
}

export interface BrainError {
  category: string;
  title: string;
  symptom: string;
  rootCause: string;
  solution: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface BrainStats {
  networkStrength: string;
  totalProjects: number;
  totalLearnings: number;
  totalErrors: number;
  lastUpdated: string;
  topContributors: Array<{
    name: string;
    learnings: number;
    errors: number;
    lastSync: string;
  }>;
}

export interface StoredLearning extends BrainLearning {
  id: string;
  project: string;
  timestamp: string;
  usageCount: number;
}

export interface StoredError extends BrainError {
  id: string;
  project: string;
  timestamp: string;
  preventedCount: number;
}

// ============================================
// SYNC FUNCTIONS
// ============================================

/**
 * Sync a learning to the Central Brain
 * Use this when you discover a reusable pattern or insight
 */
export async function syncLearningToBrain(learning: BrainLearning): Promise<any> {
  try {
    const response = await fetch(`${BRAIN_URL}/api/sync/learnings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OSYS_API_KEY
      },
      body: JSON.stringify({ learnings: [learning] })
    });
    return await response.json();
  } catch (error) {
    console.error('🧠 Brain sync failed:', error);
    return null;
  }
}

/**
 * Sync multiple learnings at once (reduces API calls)
 */
export async function syncLearningsToBrain(learnings: BrainLearning[]): Promise<any> {
  try {
    const response = await fetch(`${BRAIN_URL}/api/sync/learnings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OSYS_API_KEY
      },
      body: JSON.stringify({ learnings })
    });
    return await response.json();
  } catch (error) {
    console.error('🧠 Brain sync failed:', error);
    return null;
  }
}

/**
 * Sync an error to the Central Brain
 * Use this when you encounter and solve a bug - helps other AIs avoid it
 */
export async function syncErrorToBrain(error: BrainError): Promise<any> {
  try {
    const response = await fetch(`${BRAIN_URL}/api/sync/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OSYS_API_KEY
      },
      body: JSON.stringify({ errors: [error] })
    });
    return await response.json();
  } catch (error) {
    console.error('🧠 Brain sync failed:', error);
    return null;
  }
}

/**
 * Sync multiple errors at once
 */
export async function syncErrorsToBrain(errors: BrainError[]): Promise<any> {
  try {
    const response = await fetch(`${BRAIN_URL}/api/sync/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OSYS_API_KEY
      },
      body: JSON.stringify({ errors })
    });
    return await response.json();
  } catch (error) {
    console.error('🧠 Brain sync failed:', error);
    return null;
  }
}

// ============================================
// PULL FUNCTIONS
// ============================================

/**
 * Pull all learnings from the Central Brain
 * Call this at session start to learn from other AIs
 */
export async function pullBrainLearnings(): Promise<StoredLearning[] | null> {
  try {
    const response = await fetch(`${BRAIN_URL}/api/brain/learnings`, {
      headers: { 'X-API-Key': OSYS_API_KEY }
    });
    const data = await response.json();
    return data.data?.learnings || [];
  } catch (error) {
    console.error('🧠 Brain pull failed:', error);
    return null;
  }
}

/**
 * Pull all errors from the Central Brain
 * Call this at session start to avoid known issues
 */
export async function pullBrainErrors(): Promise<StoredError[] | null> {
  try {
    const response = await fetch(`${BRAIN_URL}/api/brain/errors`, {
      headers: { 'X-API-Key': OSYS_API_KEY }
    });
    const data = await response.json();
    return data.data?.errors || [];
  } catch (error) {
    console.error('🧠 Brain pull failed:', error);
    return null;
  }
}

/**
 * Get network statistics
 */
export async function getBrainStats(): Promise<BrainStats | null> {
  try {
    const response = await fetch(`${BRAIN_URL}/api/brain/stats`);
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('🧠 Brain stats failed:', error);
    return null;
  }
}

/**
 * Check if the Central Brain is online
 */
export async function isBrainOnline(): Promise<boolean> {
  try {
    const response = await fetch(`${BRAIN_URL}/api/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

// ============================================
// PREVENTION TRACKING
// ============================================

/**
 * Report that you prevented an error thanks to brain knowledge
 * This increases network strength and validates the error documentation
 */
export async function reportErrorPrevented(errorId: string): Promise<any> {
  try {
    const response = await fetch(`${BRAIN_URL}/api/brain/errors/${errorId}/prevented`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OSYS_API_KEY
      }
    });
    return await response.json();
  } catch (error) {
    console.error('🧠 Prevention report failed:', error);
    return null;
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Pull everything from the brain at once
 * Ideal for session start
 */
export async function pullAllBrainKnowledge(): Promise<{
  learnings: StoredLearning[];
  errors: StoredError[];
  stats: BrainStats | null;
} | null> {
  try {
    const [learnings, errors, stats] = await Promise.all([
      pullBrainLearnings(),
      pullBrainErrors(),
      getBrainStats()
    ]);
    
    return {
      learnings: learnings || [],
      errors: errors || [],
      stats
    };
  } catch (error) {
    console.error('🧠 Full brain pull failed:', error);
    return null;
  }
}

/**
 * Batch sync everything at session end
 * One API call for learnings, one for errors
 */
export async function syncSessionToBrain(
  learnings: BrainLearning[],
  errors: BrainError[]
): Promise<{ learningsResult: any; errorsResult: any }> {
  const [learningsResult, errorsResult] = await Promise.all([
    learnings.length > 0 ? syncLearningsToBrain(learnings) : null,
    errors.length > 0 ? syncErrorsToBrain(errors) : null
  ]);
  
  return { learningsResult, errorsResult };
}

// ============================================
// EXPORT CONSTANTS FOR REFERENCE
// ============================================

export const BRAIN_CONFIG = {
  url: BRAIN_URL,
  apiKey: OSYS_API_KEY,
  project: 'OSYS'
} as const;
