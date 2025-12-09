# LEAGUE.md - League & Commissioner System

**Created:** December 9, 2025  
**Status:** Planning  
**Priority:** HIGH (Pilot Program Requirement)

---

## 📋 EXECUTIVE SUMMARY

This is a **massive expansion** that fundamentally changes the app's hierarchy from:
```
Current:  SuperAdmin → Teams → Coaches/Players
```
To:
```
New:      SuperAdmin → Leagues → Programs → Teams → Coaches/Players
```

This is **the right move** for market penetration. One league deal = 7+ programs = 100+ teams = 1000s of users. Network effects at scale.

---

## 🏗️ PROPOSED HIERARCHY

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPER ADMIN                               │
│  (Full control over everything - can delete leagues/programs)    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────┐                    ┌───────────────────┐
│  LEAGUE OWNER     │                    │ PROGRAM COMM.     │
│  (League level)   │                    │ (No league)       │
│                   │                    │                   │
│  • View standings │                    │  • Create teams   │
│  • View all stats │                    │  • Set coaches    │
│  • Approve/kick   │                    │  • Handle griev.  │
│    team requests  │                    │  • Manage seasons │
│  • Announcements  │                    │  • Registration $ │
│    to league      │                    │  • Fundraising $  │
│  • Cannot create  │                    │  • Full team ctrl │
│    teams          │                    │  • Link cheer     │
│  • Create playoff │                    │                   │
│    schedule       │                    │                   │
│  • Create game    │                    │                   │
│    schedules      │                    │                   │
└───────────────────┘                    └───────────────────┘
        │                                           │
        │         ┌─────────────────────────────────┘
        │         │
        ▼         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          TEAMS                                   │
│  • Can REQUEST to join a league (team decides)                   │
│  • Can LEAVE league anytime (with warning)                       │
│  • Program Commissioner has full control                         │
│  • Accept/follow league game schedules (auto-fills team calendar)│
│  • Follow league playoff schedule when assigned                  │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COACHES / PLAYERS / PARENTS                   │
│  • Coaches: Run practices, create flyers, manage plays           │
│  • Players/Parents: View schedules, stats, participate           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 USER ROLES BREAKDOWN

### NEW ROLES TO ADD

| Role | Creates | Controls | Revenue |
|------|---------|----------|---------|
| **League Owner** | Game schedules, Playoff schedules, League seasons | League membership, standings, stats view, announcements, game schedules, playoff brackets | Future subscription tiers |
| **Program Commissioner** | Teams, Seasons, Registration Events | Full team control, coaches, rosters, chats, grievances, cheer linking | Registration fees, Fundraising |

### UPDATED ROLES

| Role | Changes |
|------|---------|
| **SuperAdmin** | Gains control over Leagues and Programs (can delete any) |
| **Coach** | Loses: Season start/end, registration creation. Keeps: Plays, flyers, practice management |

---

## 💰 MONETIZATION STRATEGY

### Credit-Based Team Creation (Anti-Exploit)
```
Create Team = X Credits
- Prevents spam account creation
- Revenue stream
- Serious commissioners only
```

### Suggested Credit Pricing
| Action | Credits | Why |
|--------|---------|-----|
| Create Team | 50 credits (~$5) | Serious barrier, covers support |
| Create League | 100 credits (~$10) | Higher value, more responsibility |
| Link Cheer Team | Free | Encourages feature adoption |
| Add to League | Free | Encourages league growth |

### Future Revenue (Phase 2)
- League subscription tiers (standings page, stats exports)
- Tournament bracket hosting
- League-wide sponsorship displays

---

## 🗄️ DATABASE SCHEMA

### New Collections

```typescript
// leagues collection
interface League {
  id: string;
  name: string;
  ownerId: string;           // League Owner user ID
  ownerName: string;
  sport: string;
  region?: string;           // e.g., "North Texas"
  teamIds: string[];         // Teams currently in league
  pendingRequests: string[]; // Team IDs requesting to join
  settings: {
    allowStandingsPublic: boolean;
    allowStatsPublic: boolean;
    requireApproval: boolean; // If false, auto-accept
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// leagueSeasons collection
interface LeagueSeason {
  id: string;
  leagueId: string;
  name: string;              // e.g., "Fall 2025"
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'upcoming' | 'active' | 'playoffs' | 'completed';
  divisions?: Division[];    // For leagues with divisions
  createdAt: Timestamp;
}

interface Division {
  id: string;
  name: string;              // e.g., "Division A", "8U", "Varsity"
  teamIds: string[];
}

// leagueSchedules collection (regular season games)
interface LeagueSchedule {
  id: string;
  leagueId: string;
  leagueSeasonId: string;
  name: string;              // e.g., "Fall 2025 Regular Season"
  games: LeagueGame[];
  status: 'draft' | 'published';
  createdAt: Timestamp;
  publishedAt?: Timestamp;
}

interface LeagueGame {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;      // Cached for display
  awayTeamName: string;
  week?: number;             // e.g., Week 1, Week 2
  scheduledDate: Timestamp;
  scheduledTime: string;     // e.g., "6:00 PM"
  location: string;
  fieldNumber?: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'postponed' | 'cancelled';
  acceptedByHome?: boolean;  // Has home team accepted this game?
  acceptedByAway?: boolean;  // Has away team accepted this game?
  homeAcceptedAt?: Timestamp;
  awayAcceptedAt?: Timestamp;
}

// teamScheduleAcceptance collection (tracks team's acceptance of league schedule)
interface TeamScheduleAcceptance {
  id: string;
  teamId: string;
  leagueScheduleId: string;
  leagueId: string;
  accepted: boolean;
  acceptedAt?: Timestamp;
  acceptedBy?: string;       // Commissioner who accepted
  autoSyncEnabled: boolean;  // Auto-sync future changes?
}

// playoffBrackets collection
interface PlayoffBracket {
  id: string;
  leagueId: string;
  leagueSeasonId: string;
  name: string;              // e.g., "Fall 2025 Championship"
  type: 'single-elimination' | 'double-elimination' | 'round-robin';
  rounds: PlayoffRound[];
  status: 'draft' | 'published' | 'in-progress' | 'completed';
  createdAt: Timestamp;
  publishedAt?: Timestamp;
}

interface PlayoffRound {
  roundNumber: number;
  name: string;              // e.g., "Quarterfinals", "Semifinals", "Championship"
  games: PlayoffGame[];
}

interface PlayoffGame {
  id: string;
  homeTeamId: string | null;  // null if TBD (winner of previous game)
  awayTeamId: string | null;
  homeTeamSeed?: number;
  awayTeamSeed?: number;
  scheduledDate?: Timestamp;
  scheduledTime?: string;
  location?: string;
  homeScore?: number;
  awayScore?: number;
  winnerId?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'postponed';
  feedsIntoGameId?: string;   // Which game winner advances to
  previousGameIds?: string[]; // Games that feed into this one
}

// programs collection
interface Program {
  id: string;
  name: string;              // e.g., "City of Arlington Youth Sports"
  commissionerId: string;    // Program Commissioner user ID
  commissionerName: string;
  assistantCommissionerIds?: string[];  // Assistant commissioners
  city?: string;
  region?: string;
  teamIds: string[];         // Teams under this program
  leagueId?: string;         // Optional league affiliation
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Update teams collection
interface Team {
  // ... existing fields ...
  programId?: string;        // NEW: Which program owns this team
  leagueId?: string;         // NEW: Which league (if any)
  linkedCheerTeamId?: string;  // NEW: For sports teams
  linkedToTeamId?: string;     // NEW: For cheer teams (who they cheer for)
  linkedToTeamName?: string;   // NEW: Display name "Cheerleader for Tigers34"
  leagueStatus?: 'none' | 'pending' | 'active' | 'left' | 'kicked';
  leagueJoinedAt?: Timestamp;
  leagueLeftAt?: Timestamp;
  leagueLeftReason?: string;
  divisionId?: string;       // NEW: Which division in the league
}

// grievances collection (move from system-wide)
interface Grievance {
  id: string;
  teamId: string;
  programId: string;         // NEW: Routes to program commissioner
  submittedBy: string;
  submittedByName: string;
  subject: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'escalated';
  assignedTo?: string;       // Commissioner ID
  escalatedToAdmin?: boolean;
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
  resolution?: string;
}

// leagueRequests collection
interface LeagueRequest {
  id: string;
  teamId: string;
  teamName: string;
  leagueId: string;
  programId: string;
  requestedBy: string;       // Commissioner who requested
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  rejectionReason?: string;
}
```

### Update Users Collection

```typescript
interface User {
  // ... existing fields ...
  role: 'Coach' | 'Parent' | 'Fan' | 'SuperAdmin' | 'LeagueOwner' | 'ProgramCommissioner';
  
  // NEW fields for commissioners
  programId?: string;        // If ProgramCommissioner
  leagueId?: string;         // If LeagueOwner
  commissionerSince?: Timestamp;
  isAssistantCommissioner?: boolean;  // For assistant role
  assistantForProgramId?: string;
}
```

---

## 🖥️ NEW UI COMPONENTS NEEDED

### 1. Commissioner Signup Flow
```
AuthScreen.tsx changes:
- Add "Commissioner" option after role selection
- Sub-selection: "League Owner" or "Program Commissioner"
- Credit purchase/verification step
- Program/League creation form
```

### 2. Program Commissioner Dashboard
```
ProgramCommissionerDashboard.tsx (NEW)
├── Overview (teams count, pending grievances, season status)
├── Teams Management
│   ├── Create Team (costs credits)
│   ├── Edit Team Settings
│   ├── Assign/Remove Head Coach
│   ├── Link Cheer Team to Sport Team
│   └── Set Max Players
├── Roster Control (per team)
├── Coach Management (add/remove/permissions)
├── Season Management
│   ├── Create Season
│   ├── Start/End Season
│   └── Registration Setup (fees go to commissioner)
├── Grievances Inbox
├── Chat Moderation (mute users)
├── Announcements (to team bulletin boards)
├── Fundraising Overview (see all team fundraising)
└── Design Studio Access (create flyers for any team)
```

### 3. League Owner Dashboard
```
LeagueOwnerDashboard.tsx (NEW)
├── Overview (teams count, standings snapshot)
├── Team Membership
│   ├── Pending Requests (approve/reject)
│   ├── Current Teams List
│   └── Remove Team (with reason)
├── League Seasons
│   ├── Create Season
│   ├── Set Season Dates
│   └── Manage Divisions
├── Game Schedule Management (NEW)
│   ├── Create Season Schedule
│   ├── Add Games (home vs away, date, time, location)
│   ├── Week-by-Week View
│   ├── Bulk Game Import (CSV)
│   ├── Publish Schedule (notifies all teams)
│   ├── Track Team Acceptance
│   ├── Update Scores/Results
│   └── Reschedule/Cancel Games
├── Playoff Management
│   ├── Create Playoff Bracket
│   ├── Bracket Builder (drag & drop seeding)
│   ├── Schedule Games (date, time, location)
│   ├── Publish Bracket (teams see it)
│   ├── Update Scores/Results
│   └── Advance Winners
├── Standings View
├── League-wide Stats
├── Announcements (to all team bulletins)
└── Public League Page Settings
```

### 4. Playoff Bracket Builder
```
PlayoffBracketBuilder.tsx (NEW)
├── Bracket Type Selection (single/double elimination, round-robin)
├── Team Seeding (drag & drop or auto-seed by standings)
├── Round Configuration
│   ├── Round names (Quarterfinals, Semis, Finals)
│   ├── Dates per round
│   └── Locations
├── Visual Bracket Preview
├── Publish to Teams
└── Live Score Updates
```

### 5. Cheer Team Linking
```
In Team Creation/Edit:
- "Link to Sport Team" dropdown (only shows teams in same program)
- Shows on cheerleader profiles: "Cheerleader for Tigers34"
```

### 6. League Membership UI (for Program Commissioners)
```
In Team Management:
- "Request to Join League" button → opens league search/select
- "Leave League" button → confirmation warning
- Status badge: "League: North Texas Youth Football League"
```

### 7. Game Schedule Builder (League Owner)
```
GameScheduleBuilder.tsx (NEW)
├── Season Selection
├── Team Grid (all teams in league)
├── Week-by-Week Scheduler
│   ├── Drag & drop team matchups
│   ├── Set date, time, location per game
│   └── Auto-conflict detection (team double-booked)
├── Bulk Import (CSV upload)
├── Preview Full Schedule
├── Publish to Teams
│   └── Notifications sent to all team commissioners
└── Track Acceptance Status
```

### 8. League Schedule Acceptance (for Program Commissioners)
```
In Team Dashboard / Commissioner Dashboard:
- "New League Schedule Available" notification banner
- "Review Schedule" → shows all games for their team
- "Accept Schedule" → auto-fills team game calendar
- "Auto-sync" toggle → future league changes auto-update team calendar
- Individual game acceptance (optional granular control)
```

### 9. Team Game Schedule (for Commissioners NOT in a League)
```
TeamGameSchedule.tsx (NEW)
├── Create Game
│   ├── Opponent (manual entry or search teams)
│   ├── Home/Away
│   ├── Date, Time, Location
│   └── Notes
├── Edit/Delete Games
├── Mark Scores/Results
└── Export to Calendar
```

---

## 🔐 PERMISSION MATRIX

| Action | SuperAdmin | League Owner | Program Comm. | Asst. Comm. | Coach |
|--------|------------|--------------|---------------|-------------|-------|
| Create League | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete League | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Program | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Program | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Team | ✅ | ❌ | ✅ (credits) | ✅ | ❌ |
| Delete Team | ✅ | ❌ | ✅ (own) | ❌ | ❌ |
| Set Head Coach | ✅ | ❌ | ✅ | ✅ | ❌ |
| Edit Roster | ✅ | ❌ | ✅ | ✅ | ✅ |
| Start/End Season | ✅ | ❌ | ✅ | ❌ | ❌ |
| Create Registration | ✅ | ❌ | ✅ | ❌ | ❌ |
| Receive Reg. Payment | ❌ | ❌ | ✅ | ❌ | ❌ |
| Handle Grievances | ✅ | ❌ | ✅ (own teams) | ✅ | ❌ |
| Approve League Join | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kick Team from League | ✅ | ✅ | ❌ | ❌ | ❌ |
| Request League Join | ✅ | ❌ | ✅ | ❌ | ❌ |
| Leave League | ✅ | ❌ | ✅ | ❌ | ❌ |
| League Announcements | ✅ | ✅ | ❌ | ❌ | ❌ |
| Team Announcements | ✅ | ❌ | ✅ | ✅ | ✅ |
| View League Standings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Flyers | ✅ | ❌ | ✅ | ✅ | ✅ |
| Mute Users in Chat | ✅ | ❌ | ✅ | ✅ | ❌ |
| Link Cheer Team | ✅ | ❌ | ✅ | ✅ | ❌ |
| Create Playoff Schedule | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update Playoff Scores | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create League Game Schedule | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update League Game Scores | ✅ | ✅ | ❌ | ❌ | ❌ |
| Accept League Schedule | ✅ | ❌ | ✅ | ✅ | ❌ |
| Create Team Game Schedule | ✅ | ❌ | ✅ | ✅ | ❌ |
| Invite Asst. Commissioner | ✅ | ❌ | ✅ | ❌ | ❌ |

---

## 📊 BUILD PHASES (Recommended Order)

### Phase 1: Foundation (Week 1)
- [ ] Database schema updates (Firestore)
- [ ] New user roles in types.ts
- [ ] Firestore security rules for new roles
- [ ] Update AuthContext for new roles

### Phase 2: Program Commissioner (Week 2)
- [ ] Commissioner signup flow
- [ ] Credit-gated team creation
- [ ] ProgramCommissionerDashboard component
- [ ] Team management (create, edit, delete)
- [ ] Coach assignment (set/remove head coach)
- [ ] Cheer team linking
- [ ] Grievance routing to commissioner

### Phase 3: Commissioner Full Control (Week 3)
- [ ] Season management moved to commissioner
- [ ] Registration creation + payment routing
- [ ] Roster control (add/remove players, max limit)
- [ ] Chat moderation (mute users)
- [ ] Team announcements
- [ ] Design Studio access for team flyers
- [ ] Assistant Commissioner invites

### Phase 4: League System (Week 4)
- [ ] League Owner signup flow
- [ ] LeagueOwnerDashboard component
- [ ] League request/approve/reject workflow
- [ ] Leave league with warnings
- [ ] Kick team from league
- [ ] League announcements to team bulletins

### Phase 5: League Game Schedules (Week 5)
- [ ] LeagueSchedule database schema
- [ ] Game Schedule Builder UI
- [ ] Week-by-week scheduler
- [ ] Conflict detection (double-booking)
- [ ] Bulk CSV import
- [ ] Publish schedule to teams
- [ ] Team acceptance workflow
- [ ] Auto-sync to team calendars
- [ ] Score/result updates for league games

### Phase 6: League Playoffs (Week 6)
- [ ] Playoff bracket builder UI
- [ ] Bracket type selection (single/double elim, round-robin)
- [ ] Team seeding interface
- [ ] Playoff game scheduling (date, time, location)
- [ ] Bracket publishing to teams
- [ ] Score/result updates
- [ ] Winner advancement logic

### Phase 7: Standings & Stats (Week 7)
- [ ] Standings calculation and display
- [ ] League-wide stats aggregation
- [ ] Public league page (optional)
- [ ] League search for joining

### Phase 8: Team Self-Scheduling (Week 8)
- [ ] Team Game Schedule UI (for non-league teams)
- [ ] Manual opponent entry
- [ ] Game creation/editing
- [ ] Calendar integration

### Phase 9: Polish & Integration (Week 9)
- [ ] SuperAdmin league/program management
- [ ] Profile updates (cheerleader linked team display)
- [ ] Notification system updates
- [ ] Testing all permission paths
- [ ] Edge case handling
- [ ] Team transfer between programs

---

## 💡 APPROVED IMPROVEMENTS

### 1. Assistant Commissioner Role ✅
Allow commissioners to invite assistants with limited permissions. Reduces single point of failure.

**Implementation:**
- `assistantCommissionerIds` array on Program
- `isAssistantCommissioner` flag on User
- Limited permissions (see matrix above)
- Invite flow via email

### 2. League Seasons ✅
Leagues have seasons - allows historical standings, playoff brackets, championship tracking.

**Implementation:**
- `leagueSeasons` collection
- Season status: upcoming → active → playoffs → completed
- Historical data preserved
- Stats reset per season

### 3. Program to League Affiliation ✅
Allow an entire program to join a league at once (optional).

**Implementation:**
- `leagueId` on Program document
- When program joins league, all teams auto-request
- Commissioner can still manage individual team membership

### 5. Team Transfer Between Programs ✅
Edge case: What if a team needs to move to a different program? Build the pathway.

**Implementation:**
- SuperAdmin only (or mutual commissioner agreement)
- Transfer request workflow
- Historical data moves with team
- Clear audit trail

### 6. League Tiers/Divisions ✅
Larger leagues have divisions (A, B, C or by age). Support this structure.

**Implementation:**
- `divisions` array on LeagueSeason
- Teams assigned to divisions
- Division-specific standings
- Cross-division playoffs

### 7. Playoff Schedule Creation ✅
League owners create playoff schedules that teams follow.

**Implementation:**
- `playoffBrackets` collection
- Visual bracket builder
- Seeding by standings or manual
- Game scheduling (date, time, location)
- Publish to teams (shows on their calendar)
- Live score updates
- Auto-advance winners

### 8. League Game Schedules ✅
League owners create regular season game schedules that teams can accept.

**Implementation:**
- `leagueSchedules` collection for season game schedules
- `LeagueGame` interface with acceptance tracking
- `teamScheduleAcceptance` collection for tracking
- Week-by-week schedule builder
- Conflict detection (no double-booking)
- Bulk CSV import option
- Publish → Notify teams → Teams accept → Auto-sync to team calendar
- Program commissioners can create their own if not in a league

---

## ⚠️ CRITICAL CONSIDERATIONS

### Data Migration
- Existing teams need `programId: null` or get auto-assigned
- Existing coaches keep their permissions until commissioner claims team

### Edge Cases to Handle
1. What if commissioner deletes their account? → Escalate to SuperAdmin
2. What if team leaves league mid-season? → Warning + historical record, scheduled games marked as forfeit
3. What if commissioner creates team but has no credits? → Block action
4. What if league kicks all teams? → League becomes empty, can be deleted
5. What if linked sport team is deleted? → Cheer team `linkedToTeamId` becomes orphaned
6. What if team is in playoffs and leaves league? → Forfeit remaining games
7. What if assistant commissioner is removed mid-season? → Graceful permission revocation
8. What if league updates schedule after teams accepted? → Notify teams of changes, option to re-accept or auto-sync
9. What if team rejects a league schedule? → Show as "not accepted", game still appears in league view
10. What if team in league also creates their own games? → League games + team games both show on calendar, tagged differently

### Revenue Routing
- Stripe Connect for commissioner payouts
- Platform fee on registrations (5-10%)
- Clear TOS for commissioners receiving money

---

## 🎯 SUCCESS METRICS

| Metric | Target | Why |
|--------|--------|-----|
| Leagues Created | 10 in first month | Validates demand |
| Programs per League | 5+ average | Network effect working |
| Team Creation Rate | 3x current | Credit model isn't blocking |
| Grievance Resolution | <48 hours | Commissioners are active |
| League Retention | 90%+ teams stay | System is valuable |
| Playoff Brackets Created | 1 per league per season | Feature adoption |
| Schedule Acceptance Rate | 95%+ | Teams trust league schedules |

---

## 📅 GAME SCHEDULE DETAILS

### Schedule Flow

**For League Owners:**
```
1. Create Schedule → Name it (e.g., "Fall 2025 Regular Season")
2. Add Games → Week by week or bulk import
   - Select home team, away team
   - Set date, time, location
   - Assign to week number (optional)
3. Review → Check for conflicts (double-booking)
4. Publish → All team commissioners notified
5. Track → See which teams accepted
6. Update → Enter scores after games
```

**For Program Commissioners (in a league):**
```
1. Receive Notification → "New league schedule available"
2. Review Schedule → See all games for their team
3. Accept/Reject
   - Accept All → Games auto-fill to team calendar
   - Accept Individual → Granular control per game
   - Enable Auto-sync → Future league changes auto-update
4. Games appear on team dashboard calendar
5. Tagged as "League Game" vs custom team games
```

**For Program Commissioners (NOT in a league):**
```
1. Create Game manually
   - Enter opponent name (or search OSYS teams)
   - Home/Away designation
   - Date, time, location
2. Edit/Delete as needed
3. Enter scores after games
4. Export to calendar
```

### Game Data Flow to Team Calendar

```typescript
// When team accepts league schedule:
// 1. Create local game entries in team's games subcollection
// 2. Mark as source: 'league'
// 3. Link to leagueGameId for sync

interface TeamGame {
  id: string;
  teamId: string;
  source: 'league' | 'commissioner' | 'coach';  // Who created it
  leagueGameId?: string;     // If from league schedule
  leagueScheduleId?: string; // Which league schedule
  
  opponent: string;
  opponentTeamId?: string;   // If known OSYS team
  isHome: boolean;
  
  scheduledDate: Timestamp;
  scheduledTime: string;
  location: string;
  
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'completed' | 'cancelled' | 'postponed';
  
  createdAt: Timestamp;
  createdBy: string;
}
```

### Schedule Sync Logic

**When league updates a published schedule:**
1. Find all teams that have `autoSyncEnabled: true`
2. For each team, update their local `TeamGame` entries
3. Notify teams of changes (push notification + in-app)
4. Teams with auto-sync OFF see "Schedule Updated" banner, can re-accept

**When team leaves league:**
1. Prompt: "Remove league games from your calendar?"
2. If yes → Delete all `TeamGame` entries with `source: 'league'`
3. If no → Keep games but mark `source: 'legacy-league'`

---

## 🏆 PLAYOFF BRACKET DETAILS

### Bracket Types Supported

**Single Elimination**
```
        ┌─── Team 1
    ┌───┤
    │   └─── Team 8
┌───┤           
│   │   ┌─── Team 4
│   └───┤
│       └─── Team 5
│                   CHAMPION
│       ┌─── Team 3
│   ┌───┤
│   │   └─── Team 6
└───┤
    │   ┌─── Team 2
    └───┤
        └─── Team 7
```

**Double Elimination**
- Winners bracket + Losers bracket
- Team must lose twice to be eliminated
- Losers bracket winner plays winners bracket winner in finals

**Round Robin**
- Every team plays every other team
- Best record wins
- Useful for smaller leagues or group stages

### Playoff Game Data
```typescript
interface PlayoffGame {
  id: string;
  bracketId: string;
  roundNumber: number;
  gameNumber: number;        // e.g., Game 1, Game 2
  
  // Teams
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamSeed?: number;
  awayTeamSeed?: number;
  homeTeamName?: string;     // Cached for display
  awayTeamName?: string;
  
  // Schedule
  scheduledDate: Timestamp;
  scheduledTime: string;     // e.g., "7:00 PM"
  location: string;
  fieldNumber?: string;
  
  // Results
  homeScore?: number;
  awayScore?: number;
  winnerId?: string;
  isOvertime?: boolean;
  status: 'scheduled' | 'in-progress' | 'completed' | 'postponed' | 'forfeit';
  
  // Bracket flow
  feedsIntoGameId?: string;
  previousGameIds?: string[];
  bracketPosition: 'winners' | 'losers' | 'finals';  // For double elim
}
```

### Playoff UI Flow
1. **Create Bracket** → Select type, name bracket
2. **Seed Teams** → Auto-seed by standings or drag-drop manual
3. **Schedule Games** → Set dates, times, locations per round
4. **Preview** → Visual bracket before publishing
5. **Publish** → Teams see bracket, games appear on calendars
6. **Update Scores** → League owner enters results
7. **Advance** → Winners auto-populate next round
8. **Complete** → Crown champion, record history

---

## 📝 NOTES

- All times should support timezone (league sets timezone)
- Push notifications when playoff schedule published
- Push notifications before playoff games (24hr, 2hr)
- Teams can export playoff schedule to external calendars
- Consider live score updates during games (future)

---

**Last Updated:** December 9, 2025  
**Author:** Fegrox + AI  
**Status:** Ready for Phase 1 Build
