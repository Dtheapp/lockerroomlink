# 🏆 OSYS STATS ENGINE v2.0 - WORLD-CLASS ARCHITECTURE

> **Created:** December 21, 2025  
> **Status:** Planning Complete - Ready for Implementation  
> **Goal:** Build an NFL/MLB-grade stat tracking system that makes Hudl and GameChanger look basic

---

## 📋 BUILD PROGRESS TRACKER

### Phase 1: Foundation ✅ IN PROGRESS
- [x] Build sport-specific stat configs (`config/statSchemas.ts`) ✅
- [x] Add new stat interfaces to `types.ts` ✅
- [x] Create stats service (`services/statsServiceV2.ts`) ✅
- [x] Create stats hooks (`hooks/useStatsV2.ts`) ✅
- [x] Update Firestore security rules ✅
- [ ] Create Cloud Functions for sync (requires functions deployment)
- [ ] Migrate existing stats to new structure

### Phase 2: Entry UI ⏳ IN PROGRESS
- [x] Build new GameStatEntry component (single source writes) ✅ `GameStatsEntryV2.tsx`
- [ ] Post-game bulk entry form
- [ ] Quick stat buttons for live games
- [ ] Draft/auto-save functionality
- [x] Theme-aware styling ✅

### Phase 3: Import System
- [ ] CSV import wizard UI
- [ ] Hudl parser
- [ ] GameChanger parser
- [ ] MaxPreps parser
- [ ] Player matching algorithm
- [ ] Import preview & confirmation

### Phase 4: Display & Export ⏳ IN PROGRESS
- [x] StatLeadersWidget for dashboards ✅
- [x] PlayerQuickStats for player cards ✅
- [x] PlayerSeasonTotals component ✅
- [x] PlayerCareerBests component ✅
- [x] PlayerStatsDisplay (self-fetching wrapper) ✅
- [ ] Player stat profiles (career view)
- [ ] Team leaderboards full page
- [ ] Box score displays
- [ ] PDF/Image export
- [ ] Shareable stat cards

### Phase 5: Advanced Features
- [ ] Live game tracker
- [ ] Advanced calculated metrics
- [ ] Stat comparison tools
- [ ] Recruiting-ready profiles

### Phase 6: Full System Integration ⭐ IN PROGRESS
- [x] Coach Dashboard - stat leaders widget ✅ (NewOSYSDashboard.tsx)
- [x] Parent Profile (Profile.tsx) - PlayerStatsDisplay component ✅
- [x] Roster Pages - PlayerStatsDisplay component ✅
- [ ] Season summaries on dashboard
- [ ] OSYSAthleteProfile - real career stats (replace mockStats)
- [ ] PublicAthleteProfile - recruiter-friendly stats display
- [ ] OSYSTeamPage - team stat leaders section
- [ ] FanDashboard - favorite player stat tracking
- [ ] Commissioner Dashboard - league-wide analytics
- [ ] GameDayHub - live stat feed integration
- [ ] Notifications - stat milestone alerts

---

## 🎯 VISION

Build an NFL/MLB-grade stat tracking system that makes Hudl and GameChanger look basic. One source of truth, sport-specific depth, CSV import/export, and lifetime player stat histories.

---

## 🗂️ SINGLE SOURCE OF TRUTH - DATA ARCHITECTURE

### **THE GOLDEN RULE**
> All stats live in ONE place: `programs/{programId}/seasons/{seasonId}/games/{gameId}/stats/{playerId}`
> Everything else READS from this. No duplicates. No sync issues. Ever.

```
📁 FIRESTORE STRUCTURE

programs/{programId}/
├── seasons/{seasonId}/
│   ├── games/{gameId}/                      ← THE SOURCE OF TRUTH
│   │   ├── homeTeamId, awayTeamId
│   │   ├── homeScore, awayScore
│   │   ├── status: 'scheduled' | 'live' | 'completed'
│   │   ├── sport: 'football' | 'basketball' | 'soccer' | 'baseball' | 'cheer' | 'volleyball'
│   │   ├── quarter/period/inning tracking
│   │   └── stats/{playerId}/                ← PLAYER GAME STATS
│   │       ├── playerId, globalPlayerId     ← Links to global player
│   │       ├── teamId
│   │       ├── played: boolean
│   │       ├── minutesPlayed: number
│   │       └── {...sportSpecificStats}      ← Varies by sport
│   │
│   └── standings/                            ← Auto-calculated from games

players/{globalPlayerId}/                     ← GLOBAL PLAYER (cross-team identity)
├── userId: string                            ← Linked user account (if claimed)
├── name, dob, photoUrl
├── sports: ['football', 'basketball']        ← Sports they play
├── careerStats/
│   ├── football/
│   │   ├── allTime: {...aggregatedStats}
│   │   └── seasons/{year}_{programId}/
│   │       └── {...seasonStats}
│   ├── basketball/
│   │   └── ...
│   └── ...
└── gameLog/                                  ← Complete game-by-game history
    └── {gameId}: { date, opponent, stats, programId, seasonId }
```

---

## 🏈 SPORT-SPECIFIC STAT SCHEMAS

### **FOOTBALL** (Youth/High School Level)
```typescript
interface FootballGameStats {
  // PARTICIPATION
  played: boolean;
  snapsOffense: number;
  snapsDefense: number;
  snapsSpecialTeams: number;
  
  // PASSING
  passAttempts: number;
  passCompletions: number;
  passYards: number;
  passTouchdowns: number;
  interceptions: number;
  passerRating: number;           // Auto-calculated
  longestPass: number;
  
  // RUSHING
  rushAttempts: number;
  rushYards: number;
  rushTouchdowns: number;
  yardsPerCarry: number;          // Auto-calculated
  longestRush: number;
  fumbles: number;
  fumblesLost: number;
  
  // RECEIVING
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
  targets: number;
  yardsPerReception: number;      // Auto-calculated
  longestReception: number;
  drops: number;
  
  // DEFENSE
  tackles: number;
  soloTackles: number;
  assistedTackles: number;
  tacklesForLoss: number;
  sacks: number;
  qbHits: number;
  interceptions: number;
  intReturnYards: number;
  intReturnTouchdowns: number;
  forcedFumbles: number;
  fumbleRecoveries: number;
  fumbleReturnYards: number;
  fumbleReturnTouchdowns: number;
  passesDefended: number;
  safeties: number;
  blockedKicks: number;
  
  // SPECIAL TEAMS - KICKING
  fgAttempts: number;
  fgMade: number;
  fgLong: number;
  xpAttempts: number;
  xpMade: number;
  punts: number;
  puntYards: number;
  puntAvg: number;                // Auto-calculated
  puntLong: number;
  puntInside20: number;
  puntTouchbacks: number;
  kickoffs: number;
  kickoffTouchbacks: number;
  
  // SPECIAL TEAMS - RETURNS
  kickReturns: number;
  kickReturnYards: number;
  kickReturnTouchdowns: number;
  kickReturnLong: number;
  puntReturns: number;
  puntReturnYards: number;
  puntReturnTouchdowns: number;
  puntReturnLong: number;
  puntReturnFairCatches: number;
  
  // TWO-POINT CONVERSIONS
  twoPointAttempts: number;
  twoPointConversions: number;
  
  // SPORTSMANSHIP & PENALTIES
  sportsmanshipPoints: number;
  penaltiesDrawn: number;
  penaltiesCommitted: number;
}
```

### **BASKETBALL**
```typescript
interface BasketballGameStats {
  played: boolean;
  minutesPlayed: number;
  gamesStarted: boolean;
  
  // SCORING
  points: number;
  fgAttempts: number;
  fgMade: number;
  fgPercentage: number;           // Auto-calculated
  threePointAttempts: number;
  threePointMade: number;
  threePointPercentage: number;   // Auto-calculated
  ftAttempts: number;
  ftMade: number;
  ftPercentage: number;           // Auto-calculated
  
  // REBOUNDS
  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;          // Auto-calculated
  
  // PLAYMAKING
  assists: number;
  turnovers: number;
  assistToTurnoverRatio: number;  // Auto-calculated
  
  // DEFENSE
  steals: number;
  blocks: number;
  personalFouls: number;
  technicalFouls: number;
  
  // ADVANCED (Auto-calculated)
  plusMinus: number;
  gameScore: number;              // Hollinger formula
  efficiency: number;             // PER-like calculation
  
  // HUSTLE
  chargesTaken: number;
  deflections: number;
  looseBallsRecovered: number;
}
```

### **SOCCER**
```typescript
interface SoccerGameStats {
  played: boolean;
  minutesPlayed: number;
  gamesStarted: boolean;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  
  // ATTACKING
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  shotAccuracy: number;           // Auto-calculated
  
  // PASSING
  passesAttempted: number;
  passesCompleted: number;
  passAccuracy: number;           // Auto-calculated
  keyPasses: number;
  throughBalls: number;
  crosses: number;
  crossAccuracy: number;
  
  // DRIBBLING
  dribbleAttempts: number;
  dribbleSuccess: number;
  
  // DEFENSE
  tackles: number;
  tackleSuccess: number;
  interceptions: number;
  clearances: number;
  blocks: number;
  
  // DISCIPLINE
  yellowCards: number;
  redCards: number;
  foulsCommitted: number;
  foulsDrawn: number;
  offsides: number;
  
  // GOALKEEPER ONLY
  saves: number;
  savePercentage: number;         // Auto-calculated
  goalsConceded: number;
  cleanSheet: boolean;
  penaltySaves: number;
  punches: number;
  highClaims: number;
  goalkicks: number;
}
```

### **BASEBALL/SOFTBALL**
```typescript
interface BaseballGameStats {
  played: boolean;
  gamesStarted: boolean;
  battingOrder: number;
  
  // BATTING
  atBats: number;
  runs: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  hitByPitch: number;
  sacrificeFlies: number;
  sacrificeBunts: number;
  stolenBases: number;
  caughtStealing: number;
  groundedIntoDoublePlay: number;
  battingAverage: number;         // Auto-calculated
  onBasePercentage: number;       // Auto-calculated
  sluggingPercentage: number;     // Auto-calculated
  ops: number;                    // Auto-calculated
  
  // PITCHING
  inningsPitched: number;
  pitchCount: number;
  strikes: number;
  balls: number;
  strikeoutsThrown: number;
  walksAllowed: number;
  hitsAllowed: number;
  runsAllowed: number;
  earnedRuns: number;
  homeRunsAllowed: number;
  era: number;                    // Auto-calculated
  whip: number;                   // Auto-calculated
  hitBatters: number;
  wildPitches: number;
  balks: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  
  // FIELDING
  putouts: number;
  assists: number;
  errors: number;
  fieldingPercentage: number;     // Auto-calculated
  doublePlays: number;
  passedBalls: number;            // Catcher only
  catchersCaughtStealing: number;
}
```

### **VOLLEYBALL**
```typescript
interface VolleyballGameStats {
  played: boolean;
  setsPlayed: number;
  gamesStarted: boolean;
  
  // ATTACK
  kills: number;
  attackAttempts: number;
  attackErrors: number;
  hittingPercentage: number;      // Auto-calculated
  
  // SERVING
  serviceAces: number;
  serviceAttempts: number;
  serviceErrors: number;
  
  // BLOCKING
  blockSolos: number;
  blockAssists: number;
  totalBlocks: number;            // Auto-calculated
  blockErrors: number;
  
  // SETTING
  assists: number;
  settingAttempts: number;
  settingErrors: number;
  
  // PASSING/DEFENSE
  digs: number;
  receptionAttempts: number;
  receptionErrors: number;
  passingPercentage: number;
  
  // BALL HANDLING
  ballHandlingErrors: number;
  
  // POINTS
  points: number;                 // Auto-calculated (kills + aces + blocks)
}
```

### **CHEER**
```typescript
interface CheerGameStats {
  performed: boolean;
  routineType: 'sideline' | 'halftime' | 'competition';
  
  // STUNTS
  stuntsAttempted: number;
  stuntsHit: number;
  stuntsFallen: number;
  stuntDifficulty: number;        // 1-10 scale
  
  // TUMBLING
  tumblingPasses: number;
  standingTumbling: number;
  runningTumbling: number;
  tumblingScore: number;
  
  // JUMPS
  jumpsAttempted: number;
  jumpsHit: number;
  jumpHeight: number;             // Rating 1-10
  jumpTechnique: number;          // Rating 1-10
  
  // DANCE/MOTION
  motionSharpness: number;        // 1-10
  danceScore: number;             // 1-10
  synchronization: number;        // 1-10
  
  // COMPETITION SCORING (if applicable)
  totalScore: number;
  deductions: number;
  placement: number;
  
  // SPIRIT
  crowdEngagement: number;        // 1-10
  energy: number;                 // 1-10
  spiritPoints: number;
}
```

---

## 🔄 DATA FLOW ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STAT ENTRY POINTS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   COACH     │    │ LIVE GAME   │    │ CSV IMPORT  │    │  SCOREKEEPER│  │
│  │   ENTRY     │    │   TRACKER   │    │  (Hudl/GC)  │    │   (Future)  │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │         │
│         └──────────────────┴─────────┬────────┴──────────────────┘         │
│                                      │                                      │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │              🏆 SINGLE SOURCE OF TRUTH                                │  │
│  │    programs/{programId}/seasons/{seasonId}/games/{gameId}/stats/      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│         ┌────────────────────────────┼────────────────────────────┐        │
│         │                            │                            │        │
│         ▼                            ▼                            ▼        │
│  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐   │
│  │ Cloud Func   │           │  Cloud Func  │           │  Cloud Func  │   │
│  │ onStatWrite  │           │ onGameComplete│          │ onSeasonEnd  │   │
│  └──────┬───────┘           └──────┬───────┘           └──────┬───────┘   │
│         │                          │                          │           │
│         ▼                          ▼                          ▼           │
│  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐   │
│  │ Update Global│           │ Update Team  │           │  Calculate   │   │
│  │ Player Stats │           │   Record     │           │   Awards     │   │
│  └──────────────┘           └──────────────┘           └──────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              ▼ READS FROM SOURCE ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                           STAT CONSUMERS (READ-ONLY)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   COACH     │  │  ATHLETE    │  │   PARENT    │  │   PUBLIC    │        │
│  │  DASHBOARD  │  │   PROFILE   │  │    VIEW     │  │  PROFILE    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ LEADERBOARD │  │  STANDINGS  │  │ STAT EXPORT │  │  RECRUITING │        │
│  │   WIDGETS   │  │   & RANKS   │  │   CSV/PDF   │  │   PROFILES  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📥 CSV IMPORT SYSTEM

### **Supported Import Sources**
- Hudl
- GameChanger
- MaxPreps
- TeamSnap
- Custom CSV

### **Import Flow**
```typescript
interface StatImport {
  id: string;
  programId: string;
  seasonId: string;
  source: 'hudl' | 'gamechanger' | 'maxpreps' | 'teamsnap' | 'custom';
  sport: SportType;
  uploadedBy: string;
  uploadedAt: Timestamp;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Mapping config
  columnMappings: {
    playerName: string;      // Which column has player names
    playerNumber: string;    // Which column has jersey numbers
    gameDate: string;        // Game date column
    opponent: string;        // Opponent column
    statMappings: Record<string, string>;  // Our stat key → CSV column
  };
  
  // Results
  gamesImported: number;
  playersMatched: number;
  playersUnmatched: string[];
  errors: string[];
}
```

### **Smart Player Matching**
```typescript
// Fuzzy match players by:
// 1. Exact jersey number + team match
// 2. Name similarity (Levenshtein distance)
// 3. Manual override for unmatched

function matchImportedPlayer(csvRow: CsvRow, roster: Player[]): Player | null {
  // First: Exact number match
  const byNumber = roster.find(p => p.number === csvRow.number);
  if (byNumber) return byNumber;
  
  // Second: Fuzzy name match
  const byName = roster.find(p => 
    levenshtein(p.name.toLowerCase(), csvRow.name.toLowerCase()) < 3
  );
  if (byName) return byName;
  
  // Third: Return null for manual mapping
  return null;
}
```

---

## 📊 AUTO-CALCULATED STATS & ADVANCED METRICS

### **Cloud Function: Calculate Derived Stats**
```typescript
// Runs on every stat write
export const calculateDerivedStats = functions.firestore
  .document('programs/{programId}/seasons/{seasonId}/games/{gameId}/stats/{playerId}')
  .onWrite(async (change, context) => {
    const stats = change.after.data();
    const sport = context.params.sport;
    
    const derived = calculateDerivedForSport(sport, stats);
    
    await change.after.ref.update(derived);
  });

function calculateDerivedForSport(sport: string, stats: any) {
  switch (sport) {
    case 'football':
      return {
        yardsPerCarry: stats.rushAttempts > 0 
          ? (stats.rushYards / stats.rushAttempts).toFixed(1) 
          : 0,
        yardsPerReception: stats.receptions > 0 
          ? (stats.receivingYards / stats.receptions).toFixed(1) 
          : 0,
        completionPercentage: stats.passAttempts > 0 
          ? ((stats.passCompletions / stats.passAttempts) * 100).toFixed(1) 
          : 0,
        passerRating: calculatePasserRating(stats),
        totalTouchdowns: (stats.rushTouchdowns || 0) + 
                         (stats.passTouchdowns || 0) + 
                         (stats.receivingTouchdowns || 0),
        totalYards: (stats.rushYards || 0) + 
                    (stats.receivingYards || 0) + 
                    (stats.passYards || 0),
      };
      
    case 'basketball':
      return {
        fgPercentage: stats.fgAttempts > 0 
          ? ((stats.fgMade / stats.fgAttempts) * 100).toFixed(1) 
          : 0,
        threePointPercentage: stats.threePointAttempts > 0 
          ? ((stats.threePointMade / stats.threePointAttempts) * 100).toFixed(1) 
          : 0,
        ftPercentage: stats.ftAttempts > 0 
          ? ((stats.ftMade / stats.ftAttempts) * 100).toFixed(1) 
          : 0,
        totalRebounds: (stats.offensiveRebounds || 0) + (stats.defensiveRebounds || 0),
        assistToTurnoverRatio: stats.turnovers > 0 
          ? (stats.assists / stats.turnovers).toFixed(2) 
          : stats.assists,
        gameScore: calculateGameScore(stats),  // Hollinger's Game Score
        efficiency: calculateEfficiency(stats), // (PTS + REB + AST + STL + BLK - Missed FG - Missed FT - TO)
      };
      
    case 'baseball':
      return {
        battingAverage: stats.atBats > 0 
          ? (stats.hits / stats.atBats).toFixed(3) 
          : '.000',
        onBasePercentage: calculateOBP(stats),
        sluggingPercentage: calculateSLG(stats),
        ops: calculateOPS(stats),
        era: calculateERA(stats),
        whip: calculateWHIP(stats),
      };
      
    // ... other sports
  }
}
```

---

## 🏅 GLOBAL PLAYER STATS SYNC

### **Cloud Function: Sync to Global Player**
```typescript
export const syncToGlobalPlayer = functions.firestore
  .document('programs/{programId}/seasons/{seasonId}/games/{gameId}/stats/{playerId}')
  .onWrite(async (change, context) => {
    const { programId, seasonId, gameId, playerId } = context.params;
    const stats = change.after.data();
    
    // Get player doc to find globalPlayerId
    const playerDoc = await db.collection('teams').doc(stats.teamId)
      .collection('players').doc(playerId).get();
    
    const globalPlayerId = playerDoc.data()?.globalPlayerId;
    if (!globalPlayerId) return;
    
    // Get game info
    const gameDoc = await db.doc(`programs/${programId}/seasons/${seasonId}/games/${gameId}`).get();
    const game = gameDoc.data();
    
    // Update global player's game log
    await db.collection('players').doc(globalPlayerId)
      .collection('gameLog').doc(gameId).set({
        gameId,
        programId,
        seasonId,
        date: game.weekDate,
        opponent: stats.isHome ? game.awayTeamName : game.homeTeamName,
        sport: game.sport,
        teamId: stats.teamId,
        teamName: stats.teamName,
        stats: stats,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    
    // Recalculate season aggregates
    await recalculatePlayerSeasonStats(globalPlayerId, seasonId, game.sport);
    
    // Recalculate all-time career stats
    await recalculatePlayerCareerStats(globalPlayerId, game.sport);
  });
```

---

## 📱 UI COMPONENTS TO BUILD

### **1. Live Game Stat Tracker (Coach)**
- Real-time play-by-play entry
- Quick-tap stat buttons (TD, Tackle, INT, etc.)
- Substitution tracking
- Quarter/Period transitions
- Undo last entry

### **2. Post-Game Entry Form**
- Player roster with checkboxes
- Bulk stat entry grid
- Per-player detail expansion
- Auto-save drafts

### **3. Stat Import Wizard**
- Drag-drop CSV upload
- Source selection (Hudl, GameChanger, etc.)
- Column mapping UI
- Player matching review
- Preview before import
- Import confirmation

### **4. Player Stat Profile**
- Career totals header
- Season-by-season breakdown
- Game log with expandable details
- Stat graphs/charts
- Comparison to league averages
- Shareable stat cards

### **5. Team Leaderboards**
- Dynamic stat category selection
- Season/All-time toggle
- Position filters
- Sortable columns
- Export to image/PDF

### **6. Public Stat Displays**
- Embeddable widgets
- Box scores
- Player cards
- Leaderboards

---

## 🔒 SECURITY RULES

```javascript
// Stats write permissions
match /programs/{programId}/seasons/{seasonId}/games/{gameId}/stats/{playerId} {
  allow read: if true;  // Public read
  
  allow write: if 
    // Commissioner of this program
    isProgramCommissioner(programId) ||
    // Coach of either team in this game
    isGameTeamCoach(programId, seasonId, gameId) ||
    // Admin
    isAdmin();
}

// Global player stats are READ-ONLY (written by Cloud Functions)
match /players/{globalPlayerId}/gameLog/{gameId} {
  allow read: if true;
  allow write: if false;  // Only Cloud Functions
}

match /players/{globalPlayerId}/careerStats/{sport} {
  allow read: if true;
  allow write: if false;  // Only Cloud Functions
}
```

---

## 💰 MONETIZATION OPPORTUNITIES

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Basic stat entry | ✅ | ✅ | ✅ |
| Season totals | ✅ | ✅ | ✅ |
| CSV Import (5/season) | ✅ | ✅ | ✅ |
| Unlimited CSV Import | ❌ | ✅ | ✅ |
| Advanced metrics | ❌ | ✅ | ✅ |
| Public stat profiles | ❌ | ✅ | ✅ |
| Stat cards for recruiting | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ |
| White-label embeds | ❌ | ❌ | ✅ |

---

## 📝 IMPLEMENTATION NOTES

### Files to Create/Modify
- `config/statSchemas.ts` - Sport-specific stat definitions
- `types.ts` - New stat interfaces
- `components/stats/` - Rebuild stat components
- `functions/src/stats/` - Cloud functions for sync
- `firestore.rules` - Update security rules

### Migration Strategy
1. Create new schema alongside old
2. Build new components that write to new location
3. Migrate old data with one-time script
4. Deprecate old stat collections
5. Remove old code

---

## 🔗 FULL SYSTEM INTEGRATION DETAILS

### **1. Parent Profile (Profile.tsx) - PRIORITY HIGH**
**Current:** Shows basic `player.stats?.td` and `player.stats?.tkl` only
**After v2.0:**
```typescript
// Replace hardcoded stats with sport-specific stats from v2.0
// Location: Profile.tsx lines 1627-1633

// OLD:
<Sword className="w-3 h-3" /> <span>{player.stats?.td || 0}</span> TD
<Shield className="w-3 h-3" /> <span>{player.stats?.tkl || 0}</span> TKL

// NEW: Dynamic sport-specific quick stats
const quickStats = getQuickStats(player.sport, player.seasonStats);
{quickStats.map(stat => (
  <div key={stat.key}>
    <stat.icon className="w-3 h-3" /> 
    <span className="font-bold">{stat.value}</span> {stat.label}
  </div>
))}
```
**Features to add:**
- [ ] Career totals header on each player card
- [ ] Season selector dropdown
- [ ] Game-by-game expandable history
- [ ] Stat trend indicators (↑ improving, ↓ declining)
- [ ] "View Full Stats" → opens PlayerStatsModal with v2.0 data

### **2. Coach Dashboard (NewOSYSDashboard.tsx)**
**Current:** Shows W-L record only
**After v2.0:**
```typescript
// Add stat leaders widget
<StatLeadersWidget teamId={teamData.id} sport={teamData.sport} />

// Features:
// - Top 3 in each category (Passing, Rushing, Receiving for football)
// - Click to see full leaderboard
// - "Enter Game Stats" CTA if games have no stats
```
**Features to add:**
- [ ] Team stat leaders widget (top 3 per category)
- [ ] Season totals summary (Total TDs, Yards, etc.)
- [ ] Quick stat entry button for recent games
- [ ] Stat completion percentage indicator

### **3. Roster Pages (Roster.tsx, OSYSRoster.tsx, CommissionerRoster.tsx)**
**Current:** Shows mock data or basic info
**After v2.0:**
```typescript
// Add sortable stat columns
<RosterTable 
  players={players}
  columns={['name', 'number', 'position', ...getKeyStatColumns(sport)]}
  sortable={true}
  defaultSort="totalPoints"
/>
```
**Features to add:**
- [ ] Stat columns (sport-specific key stats)
- [ ] Sort by any stat column
- [ ] Filter by position
- [ ] Export roster with stats (PDF/CSV)
- [ ] Inline quick stats preview on hover

### **4. Athlete Profile (OSYSAthleteProfile.tsx)**
**Current:** Mock data (`mockStats`)
**After v2.0:**
```typescript
// Real career stats from global player profile
const { careerStats, gameLog } = usePlayerStats(globalPlayerId, sport);
```
**Features to add:**
- [ ] Career totals hero section
- [ ] Season-by-season breakdown tabs
- [ ] Game log with expandable details
- [ ] Personal records/bests highlights
- [ ] Comparison to league averages
- [ ] Shareable stat card generator
- [ ] Recruiting profile export

### **5. Public Athlete Profile (PublicAthleteProfile.tsx, PublicAthleteProfileV2.tsx)**
**Features to add:**
- [ ] Clean, recruiter-friendly stat display
- [ ] Video highlights linked to stat performances
- [ ] Verified stats badge (entered by coach)
- [ ] Season/career toggle
- [ ] Contact coach button
- [ ] Download stat sheet PDF

### **6. Team Page (OSYSTeamPage.tsx)**
**Features to add:**
- [ ] Team stat leaders section
- [ ] Team totals (points scored, points allowed)
- [ ] Record and standings
- [ ] Recent game box scores
- [ ] Schedule with results

### **7. Game Day Hub (GameDayHub.tsx)**
**Features to add:**
- [ ] Live stat entry during games
- [ ] Real-time stat feed
- [ ] Play-by-play log
- [ ] Quick-tap stat buttons
- [ ] Live leaderboard updates

### **8. Fan Dashboard (FanDashboard.tsx)**
**Features to add:**
- [ ] Favorite player stat tracking
- [ ] Player stat alerts/notifications
- [ ] League-wide stat leaders
- [ ] Game recaps with stats

### **9. Commissioner Dashboard**
**Features to add:**
- [ ] Program-wide stat leaders
- [ ] Team comparison analytics
- [ ] Stat entry compliance tracking
- [ ] Export league stats for awards

### **10. Stats Components to Rebuild**
| Current Component | Status | Action |
|-------------------|--------|--------|
| `PlayerStatsCard.tsx` | Uses legacy collections | Rebuild to read from v2.0 source |
| `PlayerStatsModal.tsx` | Uses legacy collections | Rebuild to read from v2.0 source |
| `GameStatsEntry.tsx` | Partially updated | Complete v2.0 integration |
| `StatsBoard.tsx` | Uses legacy `playerStats` | Deprecate, use new components |
| `TeamStatsBoard.tsx` | May use legacy | Update to v2.0 |
| `CoachStatsEntry.tsx` | Legacy | Rebuild or deprecate |

### **11. New Components to Create**
| Component | Purpose |
|-----------|---------|
| `StatLeadersWidget.tsx` | Dashboard widget showing top performers |
| `CareerStatsCard.tsx` | Compact career summary for profiles |
| `GameBoxScore.tsx` | Full box score display for games |
| `StatComparisonTool.tsx` | Compare two players side-by-side |
| `StatTrendChart.tsx` | Visual stat progression over time |
| `ShareableStatCard.tsx` | Social media ready stat graphics |
| `StatImportWizard.tsx` | CSV import UI |
| `LiveStatTracker.tsx` | Real-time game stat entry |

### **12. Hooks to Create**
```typescript
// New hooks for v2.0 stats
usePlayerStats(playerId, sport) → { careerStats, seasonStats, gameLog }
useTeamStats(teamId, seasonId) → { teamTotals, leaderboards }
useGameStats(gameId) → { boxScore, playByPlay }
useLiveStats(gameId) → { realTimeStats, lastPlay }
useStatLeaders(programId, category) → { leaders[] }
```

---

## 🔗 RELATED DOCS
- [PROGRESS.md](PROGRESS.md) - Overall project progress
- [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) - Feature prioritization
- [types.ts](types.ts) - Current type definitions

---

*Last Updated: December 21, 2025*
