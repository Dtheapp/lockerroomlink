// =============================================================================
// GAME SERVICE - CRUD operations for season game schedules
// =============================================================================

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Game, 
  GameFormData, 
  SeasonScheduleSummary, 
  GameStatus,
  GameResult,
  Opponent 
} from '../types/game';

// =============================================================================
// CREATE GAME
// =============================================================================

export async function createGame(
  teamId: string,
  seasonId: string,
  formData: GameFormData,
  userId: string
): Promise<string> {
  // Get current game count to set game number
  const existingGames = await getSeasonGames(teamId, seasonId);
  const regularSeasonGames = existingGames.filter(g => !g.isPlayoff);
  const playoffGames = existingGames.filter(g => g.isPlayoff);
  
  const gameNumber = formData.isPlayoff 
    ? playoffGames.length + 1 
    : regularSeasonGames.length + 1;

  const gameData: Omit<Game, 'id'> = {
    teamId,
    seasonId,
    gameNumber,
    opponent: formData.opponent,
    opponentLogoUrl: formData.opponentLogoUrl || '',
    date: formData.date,
    time: formData.time,
    location: formData.location,
    address: formData.address || '',
    isHome: formData.isHome,
    isPlayoff: formData.isPlayoff,
    playoffRound: formData.playoffRound,
    tags: formData.tags,
    notes: formData.notes || '',
    status: 'scheduled',
    ticketsEnabled: formData.ticketsEnabled,
    ticketPrice: formData.ticketPrice,
    statsEntered: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: userId,
  };

  const docRef = await addDoc(
    collection(db, 'teams', teamId, 'games'),
    gameData
  );

  // Update season document to indicate it has games
  await updateDoc(doc(db, 'teams', teamId, 'seasons', seasonId), {
    hasSchedule: true,
    updatedAt: Timestamp.now(),
  });

  return docRef.id;
}

// =============================================================================
// GET GAMES
// =============================================================================

export async function getSeasonGames(
  teamId: string,
  seasonId: string
): Promise<Game[]> {
  const q = query(
    collection(db, 'teams', teamId, 'games'),
    where('seasonId', '==', seasonId),
    orderBy('date', 'asc'),
    orderBy('time', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Game));
}

export async function getGame(
  teamId: string,
  gameId: string
): Promise<Game | null> {
  const docRef = doc(db, 'teams', teamId, 'games', gameId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data()
  } as Game;
}

export async function getUpcomingGames(
  teamId: string,
  limit: number = 3
): Promise<Game[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const q = query(
    collection(db, 'teams', teamId, 'games'),
    where('date', '>=', today),
    where('status', '==', 'scheduled'),
    orderBy('date', 'asc'),
    orderBy('time', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, limit).map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Game));
}

export async function getRecentCompletedGames(
  teamId: string,
  limit: number = 3
): Promise<Game[]> {
  const q = query(
    collection(db, 'teams', teamId, 'games'),
    where('status', '==', 'completed'),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, limit).map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Game));
}

// =============================================================================
// UPDATE GAME
// =============================================================================

export async function updateGame(
  teamId: string,
  gameId: string,
  updates: Partial<Game>
): Promise<void> {
  const docRef = doc(db, 'teams', teamId, 'games', gameId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

export async function updateGameStatus(
  teamId: string,
  gameId: string,
  status: GameStatus
): Promise<void> {
  await updateGame(teamId, gameId, { status });
}

export async function enterGameResult(
  teamId: string,
  gameId: string,
  ourScore: number,
  opponentScore: number
): Promise<void> {
  let result: GameResult;
  if (ourScore > opponentScore) {
    result = 'win';
  } else if (ourScore < opponentScore) {
    result = 'loss';
  } else {
    result = 'tie';
  }

  await updateGame(teamId, gameId, {
    status: 'completed',
    ourScore,
    opponentScore,
    result,
  });
}

export async function linkTicketDesign(
  teamId: string,
  gameId: string,
  ticketDesignId: string
): Promise<void> {
  await updateGame(teamId, gameId, { ticketDesignId });
}

export async function linkGameStats(
  teamId: string,
  gameId: string,
  statsId: string
): Promise<void> {
  await updateGame(teamId, gameId, { 
    statsId, 
    statsEntered: true 
  });
}

// =============================================================================
// DELETE GAME
// =============================================================================

export async function deleteGame(
  teamId: string,
  gameId: string
): Promise<void> {
  const docRef = doc(db, 'teams', teamId, 'games', gameId);
  await deleteDoc(docRef);
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

export async function createMultipleGames(
  teamId: string,
  seasonId: string,
  games: GameFormData[],
  userId: string
): Promise<string[]> {
  const gameIds: string[] = [];
  
  // Create games sequentially to maintain proper game numbers
  for (const formData of games) {
    const id = await createGame(teamId, seasonId, formData, userId);
    gameIds.push(id);
  }

  return gameIds;
}

export async function deleteSeasonGames(
  teamId: string,
  seasonId: string
): Promise<void> {
  const games = await getSeasonGames(teamId, seasonId);
  const batch = writeBatch(db);
  
  games.forEach(game => {
    const docRef = doc(db, 'teams', teamId, 'games', game.id);
    batch.delete(docRef);
  });

  await batch.commit();
}

// =============================================================================
// SCHEDULE SUMMARY / STATISTICS
// =============================================================================

export async function getSeasonScheduleSummary(
  teamId: string,
  seasonId: string
): Promise<SeasonScheduleSummary> {
  const games = await getSeasonGames(teamId, seasonId);
  
  const regularGames = games.filter(g => !g.isPlayoff);
  const playoffGames = games.filter(g => g.isPlayoff);
  const completedGames = games.filter(g => g.status === 'completed');
  const upcomingGames = games.filter(g => g.status === 'scheduled');
  
  const wins = completedGames.filter(g => g.result === 'win').length;
  const losses = completedGames.filter(g => g.result === 'loss').length;
  const ties = completedGames.filter(g => g.result === 'tie').length;
  
  const pointsFor = completedGames.reduce((sum, g) => sum + (g.ourScore || 0), 0);
  const pointsAgainst = completedGames.reduce((sum, g) => sum + (g.opponentScore || 0), 0);
  
  // Calculate current streak
  const sortedCompleted = [...completedGames].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  let currentStreak = { type: 'W' as 'W' | 'L' | 'T', count: 0 };
  if (sortedCompleted.length > 0) {
    const firstResult = sortedCompleted[0].result;
    if (firstResult) {
      currentStreak.type = firstResult === 'win' ? 'W' : firstResult === 'loss' ? 'L' : 'T';
      for (const game of sortedCompleted) {
        if (game.result === firstResult) {
          currentStreak.count++;
        } else {
          break;
        }
      }
    }
  }

  // Get next upcoming game
  const sortedUpcoming = [...upcomingGames].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const nextGame = sortedUpcoming[0];

  // Get last completed game
  const lastGame = sortedCompleted[0];

  return {
    totalGames: regularGames.length,
    gamesPlayed: completedGames.filter(g => !g.isPlayoff).length,
    gamesRemaining: upcomingGames.filter(g => !g.isPlayoff).length,
    wins,
    losses,
    ties,
    winPercentage: completedGames.length > 0 
      ? Math.round((wins / completedGames.length) * 100) 
      : 0,
    pointsFor,
    pointsAgainst,
    currentStreak,
    nextGame,
    lastGame,
    isInPlayoffs: playoffGames.length > 0,
    playoffGames: playoffGames.length,
  };
}

// =============================================================================
// OPPONENTS (for autocomplete)
// =============================================================================

export async function getTeamOpponents(teamId: string): Promise<Opponent[]> {
  // Get all games for this team to extract unique opponents
  const q = query(collection(db, 'teams', teamId, 'games'));
  const snapshot = await getDocs(q);
  
  const opponentMap = new Map<string, Opponent>();
  
  snapshot.docs.forEach(doc => {
    const game = doc.data() as Game;
    const existing = opponentMap.get(game.opponent);
    
    if (!existing) {
      opponentMap.set(game.opponent, {
        name: game.opponent,
        logoUrl: game.opponentLogoUrl,
        lastPlayed: game.date,
        allTimeRecord: {
          wins: game.result === 'win' ? 1 : 0,
          losses: game.result === 'loss' ? 1 : 0,
          ties: game.result === 'tie' ? 1 : 0,
        }
      });
    } else {
      // Update existing opponent record
      if (game.date > (existing.lastPlayed || '')) {
        existing.lastPlayed = game.date;
      }
      if (existing.allTimeRecord && game.result) {
        if (game.result === 'win') existing.allTimeRecord.wins++;
        else if (game.result === 'loss') existing.allTimeRecord.losses++;
        else existing.allTimeRecord.ties++;
      }
    }
  });

  return Array.from(opponentMap.values()).sort((a, b) => 
    a.name.localeCompare(b.name)
  );
}

// =============================================================================
// HELPERS
// =============================================================================

export function formatGameDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatGameTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function getGameDatetime(game: Game): Date {
  return new Date(`${game.date}T${game.time}`);
}

export function isGameToday(game: Game): boolean {
  const today = new Date().toISOString().split('T')[0];
  return game.date === today;
}

export function isGamePast(game: Game): boolean {
  const gameDate = new Date(`${game.date}T${game.time}`);
  return gameDate < new Date();
}

export function getCountdownToGame(game: Game): {
  days: number;
  hours: number;
  minutes: number;
  isToday: boolean;
  isPast: boolean;
} {
  const now = new Date();
  const gameDate = getGameDatetime(game);
  const diff = gameDate.getTime() - now.getTime();
  
  if (diff < 0) {
    return { days: 0, hours: 0, minutes: 0, isToday: false, isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    days,
    hours,
    minutes,
    isToday: isGameToday(game),
    isPast: false,
  };
}
