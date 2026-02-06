/**
 * Draft Day Service
 * Manages DraftEvent lifecycle: create, configure, run live drafts, picks (subcollection)
 * 
 * Structure:
 *   programs/{programId}/drafts/{draftId}              → DraftEvent document
 *   programs/{programId}/drafts/{draftId}/picks/{pid}  → Individual DraftPick docs
 *   programs/{programId}/drafts/{draftId}/warRoom/{coachId} → Coach rankings
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  increment,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DraftEvent, DraftPick, DraftTeamInfo, CoachWarRoom, SportType } from '../types';

// =============================================================================
// CREATE DRAFT EVENT
// =============================================================================

export interface CreateDraftParams {
  programId: string;
  seasonId: string;
  poolId: string;
  programName: string;
  sport: SportType;
  ageGroupLabel: string;
  scheduledDate: Date;
  location?: string;
  teams: DraftTeamInfo[];
  draftType: 'snake' | 'linear' | 'lottery';
  pickTimerSeconds: number;
  allowTrading: boolean;
  lotteryEnabled: boolean;
  totalPlayers: number;
  createdBy: string;
}

export async function createDraftEvent(params: CreateDraftParams): Promise<string> {
  const totalRounds = Math.ceil(params.totalPlayers / params.teams.length);
  
  const draftData: Omit<DraftEvent, 'id'> = {
    programId: params.programId,
    seasonId: params.seasonId,
    poolId: params.poolId,
    programName: params.programName,
    sport: params.sport,
    ageGroupLabel: params.ageGroupLabel,
    scheduledDate: Timestamp.fromDate(params.scheduledDate),
    location: params.location || '',
    teams: params.teams,
    draftType: params.draftType,
    totalRounds,
    pickTimerSeconds: params.pickTimerSeconds,
    allowTrading: params.allowTrading,
    lotteryEnabled: params.lotteryEnabled,
    lotteryCompleted: false,
    draftOrder: params.teams.map(t => t.teamId), // Default order, changed by lottery
    currentRound: 0,
    currentPick: 0,
    totalPlayers: params.totalPlayers,
    playersRemaining: params.totalPlayers,
    status: params.lotteryEnabled ? 'lottery_pending' : 'scheduled',
    picks: [], // Legacy - picks stored in subcollection
    createdBy: params.createdBy,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  const ref = await addDoc(
    collection(db, 'programs', params.programId, 'drafts'),
    draftData
  );

  return ref.id;
}

// =============================================================================
// READ DRAFT EVENTS
// =============================================================================

export async function getDraftEvents(programId: string): Promise<DraftEvent[]> {
  const q = query(
    collection(db, 'programs', programId, 'drafts'),
    orderBy('scheduledDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DraftEvent));
}

export async function getDraftEvent(programId: string, draftId: string): Promise<DraftEvent | null> {
  const snap = await getDoc(doc(db, 'programs', programId, 'drafts', draftId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DraftEvent;
}

/** Get all drafts across ALL programs for a coach (by checking teams array) */
export async function getDraftsForCoach(coachId: string, programIds: string[]): Promise<DraftEvent[]> {
  const allDrafts: DraftEvent[] = [];
  
  for (const programId of programIds) {
    const drafts = await getDraftEvents(programId);
    const coachDrafts = drafts.filter(d => 
      d.teams.some(t => t.coachId === coachId)
    );
    allDrafts.push(...coachDrafts);
  }
  
  return allDrafts.sort((a, b) => {
    const aDate = a.scheduledDate instanceof Timestamp ? a.scheduledDate.toMillis() : new Date(a.scheduledDate as any).getTime();
    const bDate = b.scheduledDate instanceof Timestamp ? b.scheduledDate.toMillis() : new Date(b.scheduledDate as any).getTime();
    return bDate - aDate;
  });
}

// =============================================================================
// REAL-TIME LISTENERS
// =============================================================================

/** Listen to a single draft event (for live draft) */
export function onDraftEvent(
  programId: string,
  draftId: string,
  callback: (draft: DraftEvent | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'programs', programId, 'drafts', draftId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback({ id: snap.id, ...snap.data() } as DraftEvent);
    }
  );
}

/** Listen to picks subcollection (streams individual picks efficiently) */
export function onDraftPicks(
  programId: string,
  draftId: string,
  callback: (picks: DraftPick[]) => void
): () => void {
  const q = query(
    collection(db, 'programs', programId, 'drafts', draftId, 'picks'),
    orderBy('pick', 'asc')
  );
  
  return onSnapshot(q, (snap) => {
    const picks = snap.docs.map(d => ({ id: d.id, ...d.data() } as DraftPick));
    callback(picks);
  });
}

/** Listen to all drafts for a program */
export function onProgramDrafts(
  programId: string,
  callback: (drafts: DraftEvent[]) => void
): () => void {
  const q = query(
    collection(db, 'programs', programId, 'drafts'),
    orderBy('scheduledDate', 'desc')
  );
  
  return onSnapshot(q, (snap) => {
    const drafts = snap.docs.map(d => ({ id: d.id, ...d.data() } as DraftEvent));
    callback(drafts);
  });
}

// =============================================================================
// DRAFT LIFECYCLE
// =============================================================================

/** Start the draft (move from scheduled → in_progress) */
export async function startDraft(programId: string, draftId: string): Promise<void> {
  const draftRef = doc(db, 'programs', programId, 'drafts', draftId);
  const draftSnap = await getDoc(draftRef);
  if (!draftSnap.exists()) throw new Error('Draft not found');
  
  const draft = draftSnap.data() as DraftEvent;
  const firstTeamId = draft.draftOrder[0];
  
  await updateDoc(draftRef, {
    status: 'in_progress',
    currentRound: 1,
    currentPick: 1,
    currentTeamId: firstTeamId,
    currentPickDeadline: Timestamp.fromDate(
      new Date(Date.now() + (draft.pickTimerSeconds * 1000))
    ),
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Pause/Resume the draft */
export async function togglePauseDraft(
  programId: string, 
  draftId: string, 
  pause: boolean,
  reason?: string
): Promise<void> {
  const updates: any = {
    status: pause ? 'paused' : 'in_progress',
    updatedAt: serverTimestamp(),
  };
  
  if (pause) {
    updates.pausedAt = serverTimestamp();
    updates.pauseReason = reason || 'Commissioner paused the draft';
  } else {
    // Reset timer when resuming
    const draftSnap = await getDoc(doc(db, 'programs', programId, 'drafts', draftId));
    const draft = draftSnap.data() as DraftEvent;
    updates.currentPickDeadline = Timestamp.fromDate(
      new Date(Date.now() + (draft.pickTimerSeconds * 1000))
    );
  }
  
  await updateDoc(doc(db, 'programs', programId, 'drafts', draftId), updates);
}

// =============================================================================
// MAKE A PICK (Subcollection)
// =============================================================================

export async function makePick(
  programId: string,
  draftId: string,
  pick: Omit<DraftPick, 'id' | 'pickedAt'>
): Promise<string> {
  const draftRef = doc(db, 'programs', programId, 'drafts', draftId);
  const draftSnap = await getDoc(draftRef);
  if (!draftSnap.exists()) throw new Error('Draft not found');
  
  const draft = draftSnap.data() as DraftEvent;
  const teamCount = draft.teams.length;
  
  // Add pick to subcollection
  const pickRef = await addDoc(
    collection(db, 'programs', programId, 'drafts', draftId, 'picks'),
    {
      ...pick,
      pickedAt: serverTimestamp(),
    }
  );
  
  // Calculate next pick
  const nextPick = pick.pick + 1;
  const nextRound = Math.ceil(nextPick / teamCount);
  const pickInNextRound = ((nextPick - 1) % teamCount);
  
  // Snake draft: reverse order on even rounds
  let nextTeamIndex: number;
  if (draft.draftType === 'snake') {
    nextTeamIndex = nextRound % 2 === 1 
      ? pickInNextRound 
      : (teamCount - 1 - pickInNextRound);
  } else {
    nextTeamIndex = pickInNextRound;
  }
  
  const isComplete = pick.pick >= draft.totalPlayers || nextRound > draft.totalRounds;
  
  const updates: any = {
    playersRemaining: increment(-1),
    updatedAt: serverTimestamp(),
  };
  
  if (isComplete) {
    updates.status = 'completed';
    updates.completedAt = serverTimestamp();
    updates.currentTeamId = null;
    updates.currentPickDeadline = null;
  } else {
    const nextTeamId = draft.draftOrder[nextTeamIndex];
    updates.currentRound = nextRound;
    updates.currentPick = nextPick;
    updates.currentTeamId = nextTeamId;
    updates.currentPickDeadline = Timestamp.fromDate(
      new Date(Date.now() + (draft.pickTimerSeconds * 1000))
    );
  }
  
  await updateDoc(draftRef, updates);
  
  return pickRef.id;
}

// =============================================================================
// COMMISSIONER CONTROLS
// =============================================================================

/** Undo the last pick */
export async function undoLastPick(
  programId: string,
  draftId: string,
  performedBy: string
): Promise<void> {
  const picksQuery = query(
    collection(db, 'programs', programId, 'drafts', draftId, 'picks'),
    orderBy('pick', 'desc'),
    limit(1)
  );
  
  const snap = await getDocs(picksQuery);
  if (snap.empty) throw new Error('No picks to undo');
  
  const lastPick = snap.docs[0];
  const pickData = lastPick.data() as DraftPick;
  
  // Mark pick as undone (don't delete for audit trail)
  await updateDoc(lastPick.ref, { isUndone: true });
  
  // Revert draft state
  const draftRef = doc(db, 'programs', programId, 'drafts', draftId);
  await updateDoc(draftRef, {
    currentRound: pickData.round,
    currentPick: pickData.pick,
    currentTeamId: pickData.teamId,
    playersRemaining: increment(1),
    currentPickDeadline: Timestamp.fromDate(
      new Date(Date.now() + 120 * 1000) // Reset with 2 min
    ),
    updatedAt: serverTimestamp(),
  });
}

/** Skip a team's pick (auto-pick or pass) */
export async function skipTeamPick(
  programId: string,
  draftId: string,
  performedBy: string
): Promise<void> {
  const draftRef = doc(db, 'programs', programId, 'drafts', draftId);
  const draftSnap = await getDoc(draftRef);
  if (!draftSnap.exists()) throw new Error('Draft not found');
  
  const draft = draftSnap.data() as DraftEvent;
  const teamCount = draft.teams.length;
  const nextPick = draft.currentPick + 1;
  const nextRound = Math.ceil(nextPick / teamCount);
  const pickInNextRound = ((nextPick - 1) % teamCount);
  
  let nextTeamIndex: number;
  if (draft.draftType === 'snake') {
    nextTeamIndex = nextRound % 2 === 1 
      ? pickInNextRound 
      : (teamCount - 1 - pickInNextRound);
  } else {
    nextTeamIndex = pickInNextRound;
  }
  
  const nextTeamId = draft.draftOrder[nextTeamIndex];
  
  await updateDoc(draftRef, {
    currentRound: nextRound,
    currentPick: nextPick,
    currentTeamId: nextTeamId,
    currentPickDeadline: Timestamp.fromDate(
      new Date(Date.now() + (draft.pickTimerSeconds * 1000))
    ),
    updatedAt: serverTimestamp(),
  });
}

/** Extend the pick timer */
export async function extendTimer(
  programId: string,
  draftId: string,
  extraSeconds: number = 60
): Promise<void> {
  const draftRef = doc(db, 'programs', programId, 'drafts', draftId);
  const draftSnap = await getDoc(draftRef);
  if (!draftSnap.exists()) throw new Error('Draft not found');
  
  const draft = draftSnap.data() as DraftEvent;
  const currentDeadline = draft.currentPickDeadline instanceof Timestamp 
    ? draft.currentPickDeadline.toMillis() 
    : Date.now();
  
  await updateDoc(draftRef, {
    currentPickDeadline: Timestamp.fromDate(
      new Date(Math.max(currentDeadline, Date.now()) + (extraSeconds * 1000))
    ),
    updatedAt: serverTimestamp(),
  });
}

// =============================================================================
// LOTTERY
// =============================================================================

export async function runLottery(programId: string, draftId: string): Promise<string[]> {
  const draftRef = doc(db, 'programs', programId, 'drafts', draftId);
  const draftSnap = await getDoc(draftRef);
  if (!draftSnap.exists()) throw new Error('Draft not found');
  
  const draft = draftSnap.data() as DraftEvent;
  
  // Shuffle team order randomly
  const shuffled = [...draft.teams].sort(() => Math.random() - 0.5);
  const lotteryResults = shuffled.map((team, i) => ({
    position: i + 1,
    teamId: team.teamId,
    teamName: team.teamName,
    coachId: team.coachId,
    drawnAt: Timestamp.now(),
  }));
  
  const newOrder = shuffled.map(t => t.teamId);
  
  await updateDoc(draftRef, {
    lotteryCompleted: true,
    lotteryResults,
    draftOrder: newOrder,
    status: 'scheduled',
    updatedAt: serverTimestamp(),
  });
  
  return newOrder;
}

// =============================================================================
// WAR ROOM (Coach Pre-Draft)
// =============================================================================

export async function getWarRoom(
  programId: string,
  draftId: string,
  coachId: string
): Promise<CoachWarRoom | null> {
  const snap = await getDoc(
    doc(db, 'programs', programId, 'drafts', draftId, 'warRoom', coachId)
  );
  if (!snap.exists()) return null;
  return snap.data() as CoachWarRoom;
}

export async function saveWarRoom(
  programId: string,
  draftId: string,
  warRoom: CoachWarRoom
): Promise<void> {
  const ref = doc(db, 'programs', programId, 'drafts', draftId, 'warRoom', warRoom.coachId);
  const existing = await getDoc(ref);
  
  const data = {
    ...warRoom,
    updatedAt: serverTimestamp(),
  };
  
  if (existing.exists()) {
    await updateDoc(ref, data);
  } else {
    const { default: setDoc } = await import('firebase/firestore').then(m => ({ default: m.setDoc }));
    await setDoc(ref, data);
  }
}

// =============================================================================
// DELETE / CANCEL
// =============================================================================

export async function cancelDraft(programId: string, draftId: string): Promise<void> {
  await updateDoc(doc(db, 'programs', programId, 'drafts', draftId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDraft(programId: string, draftId: string): Promise<void> {
  // Delete picks subcollection first
  const picksSnap = await getDocs(
    collection(db, 'programs', programId, 'drafts', draftId, 'picks')
  );
  
  const batch = writeBatch(db);
  picksSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'programs', programId, 'drafts', draftId));
  await batch.commit();
}

// =============================================================================
// FINALIZE DRAFT (Post-Draft → Auto-Roster All Picks)
// =============================================================================

/**
 * After a draft completes, move all drafted players from pool to their team rosters.
 * Sends "You've Been Drafted" notifications to parents.
 * Returns count of successful/failed roster additions.
 */
export async function finalizeDraft(
  programId: string,
  draftId: string,
  finalizedBy: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  const { draftToRoster } = await import('./draftPoolService');
  const { createNotification } = await import('./notificationService');
  
  const draftRef = doc(db, 'programs', programId, 'drafts', draftId);
  const draftSnap = await getDoc(draftRef);
  if (!draftSnap.exists()) throw new Error('Draft not found');
  
  const draft = { id: draftSnap.id, ...draftSnap.data() } as DraftEvent;
  if (draft.status !== 'completed') throw new Error('Draft must be completed before finalizing');
  
  // Get all non-undone picks
  const picksSnap = await getDocs(
    query(
      collection(db, 'programs', programId, 'drafts', draftId, 'picks'),
      orderBy('pick', 'asc')
    )
  );
  
  const picks = picksSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as DraftPick))
    .filter(p => !p.isUndone);
  
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  
  // Process each pick → add player to team roster
  for (const pick of picks) {
    try {
      // draftToRoster uses the commissioner's team as source (where pool lives)
      // We need the team that owns the draft pool
      const team = draft.teams.find(t => t.teamId === pick.teamId);
      if (!team) {
        errors.push(`Team not found for pick #${pick.pick}: ${pick.playerName}`);
        failed++;
        continue;
      }
      
      // The pool entry ID is the pick.playerId (which is the draft pool entry ID)
      // Source team for pool is the first team (commissioner's team that owns the pool)
      // Target team is pick.teamId
      const result = await draftToRoster(
        draft.teams[0].teamId, // Source pool team (commissioner's team)
        pick.playerId,         // Draft pool entry ID
        finalizedBy,           // Who finalized
        pick.teamId            // Target team (the team that drafted this player)
      );
      
      if (result.success) {
        success++;
      } else {
        errors.push(`Failed for ${pick.playerName}: ${result.error}`);
        failed++;
      }
    } catch (err: any) {
      errors.push(`Error for ${pick.playerName}: ${err.message}`);
      failed++;
    }
  }
  
  // Mark draft as finalized
  await updateDoc(draftRef, {
    finalized: true,
    finalizedAt: serverTimestamp(),
    finalizedBy,
    rosterResults: { success, failed, errors },
    updatedAt: serverTimestamp(),
  });
  
  // Notify all coaches that draft is finalized
  for (const team of draft.teams) {
    try {
      const teamPicks = picks.filter(p => p.teamId === team.teamId);
      await createNotification(
        team.coachId,
        'draft_complete',
        '🏆 Draft Complete — Rosters Updated!',
        `The ${draft.ageGroupLabel} draft is finalized. ${teamPicks.length} player${teamPicks.length !== 1 ? 's' : ''} have been added to ${team.teamName}'s roster.`,
        {
          link: '/roster',
          metadata: {
            draftId: draft.id,
            programId,
            teamId: team.teamId,
            playerCount: teamPicks.length,
          },
          priority: 'high',
          category: 'team',
        }
      );
    } catch (notifErr) {
      console.error('Failed to notify coach:', notifErr);
    }
  }
  
  return { success, failed, errors };
}

// =============================================================================
// DRAFT NOTIFICATIONS
// =============================================================================

/** Notify all coaches that a draft is about to start */
export async function notifyDraftStarting(
  draft: DraftEvent
): Promise<void> {
  const { createNotification } = await import('./notificationService');
  
  for (const team of draft.teams) {
    try {
      await createNotification(
        team.coachId,
        'draft_starting',
        '🏈 Draft Day is HERE!',
        `The ${draft.ageGroupLabel} draft is starting now! Get to the War Room and prepare your picks.`,
        {
          link: `/draft-day/${draft.id}`,
          metadata: {
            draftId: draft.id,
            programId: draft.programId,
          },
          priority: 'urgent',
          category: 'team',
        }
      );
    } catch (err) {
      console.error('Failed to notify coach of draft start:', err);
    }
  }
}
