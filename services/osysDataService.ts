/**
 * OSYS Data Service
 * 
 * Provides data fetching for OSYS demo pages with fallback to mock data.
 * When user is logged in, fetches real Firebase data.
 * When in demo mode (not logged in), uses rich mock data.
 */

import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  updateDoc,
  increment,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import type { Team, Player, UserProfile, LiveStream, Play } from '../types';

// =============================================================================
// MOCK DATA FOR DEMO MODE
// =============================================================================

export const mockAthlete = {
  id: 'demo-athlete-1',
  name: 'Marcus Johnson',
  username: 'marcus_johnson12',
  number: 12,
  position: 'Quarterback',
  classYear: '2026',
  height: "6'2\"",
  weight: '185 lbs',
  teamId: 'demo-team',
  teamName: 'Eastside Eagles',
  teamLevel: 'Varsity',
  location: 'Atlanta, GA',
  gpa: 3.8,
  recruitRating: 4,
  age: 16,
  bio: 'Starting QB for the Eagles. 3-year varsity starter with a passion for the game. Committed to excellence on and off the field.',
  photoUrl: null,
  stats: {
    followers: 12400,
    following: 847,
    posts: 156,
    kudos: 247
  },
  seasonStats: {
    passYards: 1847,
    touchdowns: 18,
    completionPct: 67,
    qbRating: 142.3
  },
  achievements: [
    { id: '1', title: 'Player of the Week', date: 'Nov 2024', emoji: '🏆' },
    { id: '2', title: 'All-Region Selection', date: 'Oct 2024', emoji: '⭐' },
    { id: '3', title: '1000 Yard Club', date: 'Sep 2024', emoji: '🎯' },
  ],
  highlights: [
    { id: '1', title: '75-yard TD Pass', views: 2400, emoji: '🎬' },
    { id: '2', title: 'Game-winning drive', views: 1800, emoji: '🔥' },
    { id: '3', title: 'Playoff highlights', views: 3200, emoji: '🏈' },
  ]
};

export const mockTeam = {
  id: 'demo-team',
  name: 'Eastside Eagles',
  emoji: '🦅',
  tagline: 'Soaring to Victory Since 1987',
  sport: 'Football',
  level: 'Varsity',
  location: 'Atlanta, GA',
  division: 'Region 4-AAAA',
  playerCount: 24,
  record: { wins: 8, losses: 2, ties: 0 },
  regionRank: 3,
  pointsScored: 287,
  pointsAllowed: 124,
  winStreak: 5,
  nextGame: {
    opponent: 'Panthers',
    date: 'Dec 13',
    time: '7:00 PM',
    location: 'Home'
  }
};

export const mockCoach = {
  id: 'demo-coach',
  name: 'Coach Mike Williams',
  title: 'Head Coach',
  teamName: 'Eastside Eagles',
  yearsExperience: 15,
  record: '124-42',
  bio: 'Former college QB turned youth coach. Passionate about developing young athletes both on and off the field.',
  achievements: [
    'State Champion 2022',
    'Region Coach of Year 2023',
    '3x Playoff Appearances'
  ],
  photoUrl: null
};

export const mockRoster: Player[] = [
  { id: '1', name: 'Marcus Johnson', number: 12, position: 'QB', teamId: 'demo-team', stats: { td: 18, tkl: 0 }, isStarter: true, isCaptain: true },
  { id: '2', name: 'DeShawn Williams', number: 24, position: 'RB', teamId: 'demo-team', stats: { td: 12, tkl: 0 }, isStarter: true },
  { id: '3', name: 'Chris Thompson', number: 88, position: 'WR', teamId: 'demo-team', stats: { td: 8, tkl: 0 }, isStarter: true, isCaptain: true },
  { id: '4', name: 'Tyler Smith', number: 7, position: 'WR', teamId: 'demo-team', stats: { td: 5, tkl: 0 }, isStarter: true },
  { id: '5', name: 'Andre Davis', number: 55, position: 'LB', teamId: 'demo-team', stats: { td: 1, tkl: 45 }, isStarter: true },
  { id: '6', name: 'Michael Brown', number: 75, position: 'OL', teamId: 'demo-team', stats: { td: 0, tkl: 0 }, isStarter: true },
  { id: '7', name: 'James Wilson', number: 32, position: 'DB', teamId: 'demo-team', stats: { td: 2, tkl: 28 }, isStarter: true },
  { id: '8', name: 'David Lee', number: 44, position: 'LB', teamId: 'demo-team', stats: { td: 0, tkl: 32 } },
] as Player[];

export const mockSchedule = [
  { id: '1', opponent: 'Panthers', date: 'Dec 13', time: '7:00 PM', location: 'Home', isUpcoming: true },
  { id: '2', opponent: 'Tigers', date: 'Dec 6', time: '7:00 PM', location: 'Away', result: { type: 'win', score: '35-21' } },
  { id: '3', opponent: 'Bears', date: 'Nov 29', time: '7:00 PM', location: 'Home', result: { type: 'win', score: '42-14' } },
  { id: '4', opponent: 'Bulldogs', date: 'Nov 22', time: '7:00 PM', location: 'Away', result: { type: 'win', score: '28-24' } },
  { id: '5', opponent: 'Lions', date: 'Nov 15', time: '7:00 PM', location: 'Home', result: { type: 'loss', score: '21-28' } },
];

export const mockEvents = [
  { id: '1', title: 'Playoff Game vs Panthers', date: 'Dec 13', time: '7:00 PM', type: 'game', location: 'Home Stadium', ticketPrice: 10 },
  { id: '2', title: 'Team Banquet', date: 'Dec 20', time: '6:00 PM', type: 'event', location: 'Community Center' },
  { id: '3', title: 'Holiday Practice', date: 'Dec 27', time: '10:00 AM', type: 'practice', location: 'Practice Field' },
  { id: '4', title: 'New Year Bowl', date: 'Jan 1', time: '2:00 PM', type: 'game', location: 'Metro Stadium', ticketPrice: 15 },
];

export const mockPlays = [
  { id: '1', name: 'Mesh Concept', category: 'Pass', formation: 'Shotgun', successRate: 78, emoji: '🎯' },
  { id: '2', name: 'Power Right', category: 'Run', formation: 'I-Form', successRate: 65, emoji: '💪' },
  { id: '3', name: 'Slant Flat', category: 'Pass', formation: 'Trips', successRate: 72, emoji: '⚡' },
  { id: '4', name: 'Counter', category: 'Run', formation: 'Pistol', successRate: 58, emoji: '🔄' },
  { id: '5', name: 'Cover 3 Sky', category: 'Defense', formation: '4-3', successRate: 70, emoji: '🛡️' },
  { id: '6', name: 'Tampa 2', category: 'Defense', formation: '4-3', successRate: 68, emoji: '🏰' },
];

export const mockConversations = [
  { 
    id: '1', 
    name: 'Team Chat', 
    type: 'group',
    emoji: '🦅',
    lastMessage: 'Great practice today team!',
    lastMessageTime: '5m ago',
    unread: 3,
    members: 24
  },
  { 
    id: '2', 
    name: 'Coach Williams', 
    type: 'direct',
    emoji: '👨‍🏫',
    lastMessage: 'See you at film session tomorrow',
    lastMessageTime: '1h ago',
    unread: 0
  },
  { 
    id: '3', 
    name: 'Offense Group', 
    type: 'group',
    emoji: '🏈',
    lastMessage: 'New play installed for Friday',
    lastMessageTime: '2h ago',
    unread: 1,
    members: 12
  },
];

export const mockFundraisingCampaign = {
  id: 'demo-campaign',
  title: "Support Marcus's Journey",
  description: 'Help fund training equipment and camp registration for the upcoming season.',
  goal: 10000,
  raised: 6800,
  backers: 127,
  daysLeft: 18,
  athleteName: 'Marcus Johnson',
  recentDonors: [
    { name: 'Anonymous', amount: 100, time: '2h ago' },
    { name: 'Coach Williams', amount: 250, time: '1d ago' },
    { name: 'Eagles Booster Club', amount: 500, time: '2d ago' },
  ]
};

// =============================================================================
// DATA FETCHING FUNCTIONS
// =============================================================================

/**
 * Fetch team data - real or mock
 */
export async function fetchTeamData(teamId?: string): Promise<typeof mockTeam> {
  if (!teamId || teamId === 'demo-team') {
    return mockTeam;
  }
  
  try {
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    if (teamDoc.exists()) {
      const data = teamDoc.data();
      return {
        id: teamDoc.id,
        name: data.name || 'Team',
        emoji: '🏈',
        tagline: data.tagline || '',
        sport: 'Football',
        level: data.level || 'Varsity',
        location: data.location?.city ? `${data.location.city}, ${data.location.state}` : '',
        division: data.division || '',
        playerCount: data.playerCount || 0,
        record: data.record || { wins: 0, losses: 0, ties: 0 },
        regionRank: data.regionRank || 0,
        pointsScored: data.pointsScored || 0,
        pointsAllowed: data.pointsAllowed || 0,
        winStreak: data.winStreak || 0,
        nextGame: mockTeam.nextGame // Keep mock for demo
      };
    }
  } catch (error) {
    console.error('Error fetching team:', error);
  }
  
  return mockTeam;
}

/**
 * Fetch roster for a team
 */
export async function fetchRoster(teamId?: string): Promise<Player[]> {
  if (!teamId || teamId === 'demo-team') {
    return mockRoster;
  }
  
  try {
    const playersQuery = query(collection(db, 'teams', teamId, 'players'));
    const snapshot = await getDocs(playersQuery);
    
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Player[];
    }
  } catch (error) {
    console.error('Error fetching roster:', error);
  }
  
  return mockRoster;
}

/**
 * Fetch plays/playbook
 */
export async function fetchPlays(coachId?: string): Promise<typeof mockPlays> {
  if (!coachId) {
    return mockPlays;
  }
  
  try {
    const playsQuery = query(
      collection(db, 'users', coachId, 'plays'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snapshot = await getDocs(playsQuery);
    
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          category: data.category || 'Offense',
          formation: data.formation || 'Default',
          successRate: data.successRate || 0,
          emoji: data.category === 'Defense' ? '🛡️' : '🏈'
        };
      });
    }
  } catch (error) {
    console.error('Error fetching plays:', error);
  }
  
  return mockPlays;
}

/**
 * Fetch events/schedule
 */
export async function fetchEvents(teamId?: string): Promise<typeof mockEvents> {
  if (!teamId || teamId === 'demo-team') {
    return mockEvents;
  }
  
  try {
    const eventsQuery = query(
      collection(db, 'teams', teamId, 'events'),
      orderBy('date', 'asc'),
      limit(10)
    );
    const snapshot = await getDocs(eventsQuery);
    
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          date: data.date,
          time: data.time,
          type: data.type || 'event',
          location: data.location,
          ticketPrice: data.ticketPrice
        };
      });
    }
  } catch (error) {
    console.error('Error fetching events:', error);
  }
  
  return mockEvents;
}

// =============================================================================
// INTERACTIVE ACTIONS
// =============================================================================

/**
 * Follow an athlete
 */
export async function followAthlete(
  fanId: string, 
  athleteUsername: string,
  teamId: string,
  playerId: string
): Promise<boolean> {
  try {
    // Add to fan's followed list
    await updateDoc(doc(db, 'users', fanId), {
      [`followedAthletes`]: increment(1)
    });
    
    // Increment athlete's follower count
    await updateDoc(doc(db, 'teams', teamId, 'players', playerId), {
      followerCount: increment(1)
    });
    
    // Add follower document
    await addDoc(collection(db, 'teams', teamId, 'players', playerId, 'followers'), {
      fanId,
      followedAt: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error following athlete:', error);
    return false;
  }
}

/**
 * Send kudos to an athlete
 */
export async function sendKudos(
  fanId: string,
  fanName: string,
  teamId: string,
  playerId: string,
  category: string,
  amount: number,
  message?: string
): Promise<boolean> {
  try {
    // Add kudos document
    await addDoc(collection(db, 'teams', teamId, 'players', playerId, 'kudos'), {
      fanId,
      fanName,
      category,
      amount,
      message,
      createdAt: Timestamp.now()
    });
    
    // Update athlete's kudos count
    await updateDoc(doc(db, 'teams', teamId, 'players', playerId), {
      kudosCount: increment(amount)
    });
    
    return true;
  } catch (error) {
    console.error('Error sending kudos:', error);
    return false;
  }
}

/**
 * Subscribe to live stream updates
 */
export function subscribeLiveStreams(
  teamId: string,
  callback: (streams: LiveStream[]) => void
): () => void {
  const streamsQuery = query(
    collection(db, 'livestreams'),
    where('teamId', '==', teamId),
    where('isLive', '==', true)
  );
  
  return onSnapshot(streamsQuery, (snapshot) => {
    const streams = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LiveStream[];
    callback(streams);
  });
}

// =============================================================================
// DEMO MODE UTILITIES
// =============================================================================

/**
 * Check if we're in demo mode (no auth)
 */
export function isDemoMode(): boolean {
  // Import dynamically to avoid circular deps
  return typeof window !== 'undefined' && 
    (window.location.hash.includes('/player') ||
     window.location.hash.includes('/team-demo') ||
     window.location.hash.includes('/fan-hub') ||
     window.location.hash.includes('/roster') ||
     window.location.hash.includes('/live') ||
     window.location.hash.includes('/events') ||
     window.location.hash.includes('/playbook') ||
     window.location.hash.includes('/messages') ||
     window.location.hash.includes('/coach-profile') ||
     window.location.hash.includes('/coach-demo'));
}

/**
 * Format large numbers (e.g., 12400 -> "12.4K")
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Get time ago string
 */
export function timeAgo(date: Date | Timestamp): string {
  const now = new Date();
  const then = date instanceof Timestamp ? date.toDate() : date;
  const diff = now.getTime() - then.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}
