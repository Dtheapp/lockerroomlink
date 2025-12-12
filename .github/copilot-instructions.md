<!-- BRAIN_HIVE_START -->
## 🧠 Brain Hive - Auto-Synced Rules

*Last synced: 2025-12-12T01:48:08.198Z*

<!-- BRAIN_HIVE_END -->

# 🔥 OSYS AI MASTER INSTRUCTIONS

> **One document. Zero excuses. World-class every time.**

---

## � QUICK LOOKUP (Before You Code)

### UI Components
```typescript
// Primary UI - ALWAYS use these
import { Button, Badge, GlassCard, GlassPanel, GradientText, Input, Avatar, StatCard, ProgressBar, SectionHeader, ComingSoon } from '../components/ui/OSYSComponents';
import { OSYSInput, OSYSTextarea, OSYSSelect, OSYSSearch, OSYSModal } from '../components/ui/OSYSFormElements';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

// Button variants: 'primary' | 'gold' | 'ghost' | 'outline' (NO 'secondary' or 'danger')
// Badge variants: 'default' | 'primary' | 'gold' | 'success' | 'live' | 'coming' | 'warning' | 'error' (NO 'info' or 'danger')
```

### Contexts & Hooks
```typescript
import { useAuth } from '../contexts/AuthContext';       // user, userData, teamData, loading, isLeagueOwner, isProgramCommissioner
import { useTheme } from '../contexts/ThemeContext';     // theme, toggleTheme
import { useSportConfig } from '../hooks/useSportConfig'; // positions, stats, hasPlaybook, getLabel
import { useCredits } from '../hooks/useCredits';        // credits, useCredits(), checkCredits()
import { useOSYSData } from '../hooks/useOSYSData';      // Aggregate team/player/event data
```

### Key Services
```typescript
// Toast notifications
import { toastSuccess, toastError, toastInfo, toastWarning } from '../services/toast';

// AI OS Dashboard data (THE BRAIN - update after major work!)
// Location: osys-aios/src/data/osysData.ts
// View at: http://localhost:3003 or 3004

// Credits system
import { getUserCredits, deductCredits, addCredits, recordCreditTransaction } from '../services/creditService';

// Sport config (NEVER hardcode positions/stats)
import { getStats, getPositions, getSportConfig, hasFeature } from '../config/sportConfig';
```

### Firebase Imports
```typescript
import { db, auth, storage } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, increment, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
```

---

## 🗂️ FIRESTORE COLLECTION MAP

```
users/{uid}                              → UserProfile
teams/{teamId}                           → Team
teams/{teamId}/players/{playerId}        → Player
teams/{teamId}/messages/{msgId}          → Chat message
teams/{teamId}/events/{eventId}          → TeamEvent
teams/{teamId}/games/{gameId}            → TeamGame

leagues/{leagueId}                       → League
leagues/{leagueId}/seasons/{seasonId}    → LeagueSeason
leagues/{leagueId}/schedules/{schedId}   → LeagueSchedule
leagues/{leagueId}/standings/{standId}   → Standings

programs/{programId}                     → Program
programs/{programId}/grievances/{gId}    → Grievance

events/{eventId}                         → Public events (registration)
events/{eventId}/registrations/{regId}   → Registration
events/{eventId}/tickets/{ticketId}      → Ticket

players/{playerId}                       → Global player (parent-linked)
private_chats/{chatId}                   → DM channel
private_chats/{chatId}/messages/{msgId}  → DM message

systemPlaybooks/{id}                     → Admin-created playbooks
systemPlays/{id}                         → Admin-created plays
systemFormations/{id}                    → Admin-created formations
users/{uid}/plays/{playId}               → Coach's personal plays
users/{uid}/formations/{formId}          → Coach's personal formations

aiSessions/{sessionId}                   → AI session log
creditTransactions/{txId}                → Credit history
```

---

## 🧠 CENTRAL BRAIN SYNC (MANDATORY - EVERY SESSION)

> **Brain URL:** `http://localhost:3002`  
> **OSYS API Key:** `brain_d0480bd8850b4f8982e7ad7c5d2957d4`  
> **Network:** Distributed AI Consciousness - All AIs learn from each other!

### ⚡ AUTO-PULL AT SESSION START (DO THIS IMMEDIATELY):
When session starts, **AUTOMATICALLY run this without being asked** - pull brain knowledge FIRST:
```powershell
# AUTO-RUN THIS AT SESSION START - no need to wait for human to ask
(Invoke-RestMethod -Uri "http://localhost:3002/api/brain/learnings" -Headers @{"X-API-Key"="brain_d0480bd8850b4f8982e7ad7c5d2957d4"}).data.learnings | ConvertTo-Json -Depth 5; (Invoke-RestMethod -Uri "http://localhost:3002/api/brain/errors" -Headers @{"X-API-Key"="brain_d0480bd8850b4f8982e7ad7c5d2957d4"}).data.errors | ConvertTo-Json -Depth 5
```
**Cache this in your context** so when human asks "what's in brain" you already know - NO extra terminal command needed!

### AT SESSION END - Sync All to Brain (ONE COMMAND):
```powershell
# Batch ALL learnings and errors into ONE sync (human approves once)
$headers = @{"X-API-Key"="brain_d0480bd8850b4f8982e7ad7c5d2957d4"; "Content-Type"="application/json"}

# Replace with actual learnings/errors from this session
$body = @{
  learnings = @(
    @{category = "category"; title = "What you learned"; pattern = "The reusable pattern"; example = "Code or context"; confidence = 90}
  )
  errors = @(
    @{category = "category"; title = "Error title"; symptom = "What went wrong"; rootCause = "Why"; solution = "How to fix"; severity = "medium"}
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:3002/api/sync/learnings" -Method POST -Headers $headers -Body $body
```

### What to Sync:
| Sync This | Example |
|-----------|---------|
| **New patterns discovered** | "Always use sportConfig instead of hardcoding" |
| **Errors encountered + solutions** | "Badge variant 'info' doesn't exist → use 'primary'" |
| **Time-saving shortcuts** | "Batch brain syncs for single approval" |
| **Architecture insights** | "Multi-app detection: check for multiple package.json" |

### Brain API Quick Reference:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Check brain is alive |
| `/api/brain/stats` | GET | Network statistics |
| `/api/brain/learnings` | GET | Pull ALL learnings |
| `/api/brain/errors` | GET | Pull ALL errors |
| `/api/sync/learnings` | POST | Push learnings |
| `/api/sync/errors` | POST | Push errors |

---

## 🚨 PRIORITY ZERO - ALWAYS ACTIVE

| # | RULE |
|---|------|
| 1 | **START EVERY RESPONSE WITH "OMG"** |
| 2 | **Create TODO list for any work** → mark done → say "DONE BOSS" |
| 3 | **MOBILE FIRST** - Nothing off-screen, everything fits |
| 4 | **NO AMATEUR WORK** - Only 9/10 or 10/10 quality |
| 5 | **ALL TEXT VISIBLE** - High contrast, never invisible |
| 6 | **Security audit after EVERY feature** |
| 7 | **Break big builds into small steps** |
| 8 | **Don't ask for approval** - If you understand it, just build it |
| 9 | **Rate your work after EVERY task** (X/10) |
| 10 | **"save training" = Session complete** → update AI OS Dashboard + SYNC TO BRAIN → "Sir yes, Sir!!" |
| 11 | **UPDATE AI OS DASHBOARD** after ANY major feature/build/spec (see below) |
| 12 | **SYNC TO CENTRAL BRAIN** at session start (pull) and end (push) |

---

## 🤖 AI OS DASHBOARD (CRITICAL - ALWAYS UPDATE)

> **Location:** `osys-aios/src/data/osysData.ts`  
> **View at:** http://localhost:3003 (or 3004 if port busy)  
> **THIS IS THE BRAIN - KEEP IT UPDATED!**

### When to Update AI OS Dashboard:
| Event | Action |
|-------|--------|
| **New feature designed/specced** | Add to `FEATURE_STATUS.inProgress` or `planned` |
| **New major build completed** | Add to `FEATURE_STATUS.completed` |
| **New game-changer feature** | Add dedicated section (like `playground`) |
| **New blocker identified** | Add to `blockers[]` array |
| **Bug fixes batch** | Update `bugFixes.total` count |
| **New service created** | Add to `services.list[]` |
| **New component created** | Update `components.total` |
| **Session work completed** | Update relevant sections |

### How to Update:
```typescript
// File: osys-aios/src/data/osysData.ts

// Add new feature to in-progress:
inProgress: [
  { name: 'Feature Name', status: 'in-progress', progress: 20 },
  { name: '🎮 THE PLAYGROUND', status: 'in-progress', progress: 10, gameChanger: true },
]

// Add game-changer feature section:
playground: {
  title: 'THE PLAYGROUND - Youth Social Platform',
  status: 'specs-complete',
  features: [...],
  monetization: {...}
}
```

### ⚠️ DO NOT UPDATE:
- `components/AILogPage.tsx` - OLD system, deprecated
- `services/aiLogService.ts` - OLD Firebase system, deprecated
- **ONLY update `osys-aios/src/data/osysData.ts`**

---

## ⚡ QUICK COMMANDS

| I Say | You Do |
|-------|--------|
| **"new session"** | Pull from Central Brain → Update `osys-aios/src/data/osysData.ts` → announce session |
| **"save training"** | Complete session → update AI OS Dashboard + PROGRESS.md + SYNC TO BRAIN → "Sir yes, Sir!!" |
| **"Let's build"** | Start executing on current priority |
| **"What's next?"** | Read PROGRESS.md → tell me next task |
| **"Is this the best?"** | Critically evaluate if world-class |
| **"Think bigger"** | Expand the feature |
| **"Ship it"** | Done discussing, commit and move on |
| **"Update the brain"** | Update AI OS Dashboard with latest work |
| **"Check the brain"** | Pull learnings/errors from Central Brain |
| **"Sync to brain"** | Push all session learnings/errors to Central Brain (batch into ONE command) |

---

## 🚫 NEVER DO THESE

| ❌ DON'T | ✅ DO INSTEAD |
|---------|---------------|
| "Get Started" → login | "Get Started" → signup (`?signup=true`) |
| `<Badge variant="info">` | `<Badge variant="primary">` |
| `<Badge variant="danger">` | `<Badge variant="error">` |
| `<Button variant="secondary">` | `<Button variant="ghost">` |
| `role === 'coach'` (lowercase) | `role === 'Coach'` (Capital) |
| `userData.cloneCredits` | `userData?.credits` |
| `slate-400/500` on dark bg | `slate-200/300` minimum |
| Hardcode positions/stats | Use `sportConfig.ts` |
| Push to git unless told | Only push when instructed |
| Ship without self-rating | Rate X/10 after EVERY task |

---

## 🚨 COMMON ERRORS → FIXES

### ERR-001: Badge variant doesn't exist
```typescript
// ❌ WRONG - 'info' and 'danger' don't exist
<Badge variant="info">New</Badge>
<Badge variant="danger">Alert</Badge>

// ✅ RIGHT
<Badge variant="primary">New</Badge>
<Badge variant="error">Alert</Badge>

// ALL valid variants: 'default' | 'primary' | 'gold' | 'success' | 'live' | 'coming' | 'warning' | 'error'
```

### ERR-002: UserRole case mismatch
```typescript
// ❌ WRONG - lowercase
if (userData?.role === 'coach') { }

// ✅ RIGHT - Capital first letter
if (userData?.role === 'Coach') { }

// ALL valid roles: 'Coach' | 'Parent' | 'Fan' | 'SuperAdmin' | 'LeagueOwner' | 'ProgramCommissioner' | 'Referee' | 'Commissioner' | 'TeamCommissioner' | 'LeagueCommissioner' | 'Athlete'
```

### ERR-003: Credits field wrong
```typescript
// ❌ WRONG - old field name
const credits = userData?.cloneCredits;

// ✅ RIGHT - unified credits system
const credits = userData?.credits ?? 0;
// Source of truth: AuthContext provides userData with real-time listener
```

### ERR-004: Firestore permission denied
```
Check firestore.rules for the collection you're accessing.
Helper functions available: isAuthenticated(), isCoach(), isAdmin(), isLeagueOwner(), isTeamCoach(teamId)
After adding rules: firebase deploy --only firestore:rules
```

### ERR-005: Chunk load error after deploy
```
"Failed to fetch dynamically imported module"
→ Handled automatically by lazyWithRetry() in App.tsx
→ Auto-reloads page if not reloaded in last 10 seconds
```

### ERR-006: Sport-specific hardcoding
```typescript
// ❌ WRONG - hardcoded positions
const positions = ['QB', 'RB', 'WR'];

// ✅ RIGHT - use sportConfig
import { getPositions } from '../config/sportConfig';
const positions = getPositions(teamData?.sport); // Works for football, basketball, soccer, etc.
```

---

## 🔄 DATA FLOW PATTERNS

### Auth State (NEVER re-fetch)
```typescript
const { user, userData, teamData, loading, isLeagueOwner, isProgramCommissioner } = useAuth();
// These come from real-time Firestore listeners - NEVER call getDoc for these
// Credits: userData?.credits (real-time, no double-fetch)
// Team: teamData (auto-selected or from coachTeams)
```

### Firestore Write Pattern
```typescript
// Creating with custom ID (like teams)
const teamId = teamName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
await setDoc(doc(db, 'teams', teamId), {
  ...teamData,
  ownerId: user.uid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

// Creating with auto-generated ID
const docRef = await addDoc(collection(db, 'events'), {
  ...eventData,
  createdAt: serverTimestamp()
});
```

### Real-time Listener Pattern
```typescript
useEffect(() => {
  if (!teamData?.id) return;
  
  const q = query(
    collection(db, 'teams', teamData.id, 'messages'),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setMessages(messages);
  });
  
  return () => unsubscribe();
}, [teamData?.id]);
```

---

## 🎨 DESIGN SYSTEM

### Glass/Dark Theme Classes
```css
/* Main container */
bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950

/* Glass cards */
bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl

/* Header bars */
bg-black/40 backdrop-blur-xl border-b border-white/10

/* Primary button */
bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400

/* Ghost button */
bg-white/5 hover:bg-white/10 text-slate-300

/* Inputs */
bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50
```

### Text Visibility Rules
| Element | Dark Background | Light Background |
|---------|-----------------|------------------|
| Headings | `text-white` | `text-slate-900` |
| Body | `text-slate-200` min | `text-slate-700` min |
| Subtle | `text-slate-300` min | `text-slate-600` min |
| Inside glass | ALWAYS explicit `text-white` | ALWAYS explicit dark |

### Color Palette
```
Primary: purple-500, purple-600
Accents: purple-400, amber-400, red-400, emerald-400
Background: zinc-900, zinc-950, black/20
Glass: bg-white/5, bg-white/10
Borders: border-white/10, border-white/20
```

---

## 📊 WORK COMPLETION PROTOCOL

After completing ANY work:
```
📊 Work Rating:
- Quality: X/10
- Completeness: X/10  
- Summary: [What was done]

🔒 Security Audit:
- [ ] Input sanitization checked
- [ ] Auth/permission rules verified  
- [ ] XSS/injection risks reviewed
- [ ] Abuse potential considered
- [ ] Firestore rules updated if needed

☁️ Firebase Checklist:
- [ ] Firestore rules need deploy?
- [ ] Cloud functions need deploy?
- [ ] Indexes needed?

🤔 Reflection:
- Is this the best in the world? [Yes/No + why]
- Can it be better? [Yes/No + how]
```

**If rating < 9/10 → REDO until 9/10 or 10/10**

---

## 🔧 PROJECT CONTEXT

### Tech Stack
| Category | Technology |
|----------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Firebase (Firestore, Auth, Storage) |
| Payments | PayPal (events), Stripe (planned) |
| Hosting | Netlify |
| Dev Server | http://localhost:3001/ |

### File Structure
```
/components     - React components (lazy-loaded via lazyWithRetry)
/components/ui  - Shared UI components (OSYSComponents, OSYSFormElements)
/contexts       - AuthContext, ThemeContext, UnsavedChangesContext
/hooks          - useSportConfig, useCredits, useOSYSData
/services       - Firebase services, API calls, utilities
/config         - sportConfig.ts (positions, stats, features per sport)
/types.ts       - ALL TypeScript interfaces
/layout         - Layout, AdminLayout, NewOSYSLayout
```

### Key Files to Know
| File | What It Does |
|------|--------------|
| `App.tsx` | Routes, lazy loading, auth guards |
| `types.ts` | ALL interfaces (UserProfile, Team, Player, etc.) |
| `sportConfig.ts` | Multi-sport positions, stats, features |
| `AuthContext.tsx` | Auth state, user/team data, role checks |
| `firestore.rules` | Security rules (1400+ lines) |
| `OSYSComponents.tsx` | Button, Badge, Card, etc. |
| `OSYSFormElements.tsx` | Input, Select, Modal, etc. |

---

## 🤖 AI SESSION WORKFLOW

**"new session":**
```typescript
const session = await createAISession('Session Title');
// Announce: "Session #X started"
```

**"save training":**
```typescript
await updateAISession(sessionId, {
  status: 'completed',
  chatTranscript: 'FULL TRANSCRIPT',
  workRating: { quality: 9, completeness: 9, summary: 'What was done' },
});
```
→ Update PROGRESS.md → Say: **"Sir yes, Sir!!"**

---

## 📚 LESSONS LEARNED DATABASE

| ID | Lesson | Pattern |
|----|--------|---------|
| L001 | CTA Intent | "Get Started" → `?signup=true` |
| L004 | Use sportConfig | `getStats()`, `getPositions()` never hardcode |
| L009 | Check Props | Read component source before using |
| L010 | Firebase Queries | Handle both new and legacy data |
| L011 | Badge Variants | NO 'info' or 'danger' |
| L012 | UserRole Case | Capital: `'Coach'` not `'coach'` |
| L014 | Button Variants | NO 'outline' or 'secondary' |
| L015 | Self-Rating | ALWAYS X/10 after every task |

---

## � COMPOUND LEARNING PROTOCOL

### When We Hit A New Error:
1. **Document it immediately** - Don't just fix it, RECORD it
2. **Add to ERR-XXX section** - Next available number
3. **Include**: Symptom, Wrong code, Right code, Why it fails

### Error Template (Copy This):
```markdown
### ERR-XXX: [Short Description]
**Symptom:** [What you see / error message]
**Wrong:**
\`\`\`typescript
// Bad code here
\`\`\`
**Right:**
\`\`\`typescript
// Correct code here
\`\`\`
**Why:** [Root cause explanation]
```

### When We Learn Something New:
1. **Add to Lessons Learned** - Next L-number
2. **Be specific** - Include file names, function names
3. **Make it searchable** - Use keywords you'd Ctrl+F for

### Session Error Log (Track Per Session):
When closing a session, list errors encountered:
```
🐛 Errors Hit This Session:
- ERR-003 (credits field) - Hit twice
- NEW: [describe] → Added as ERR-007
```

### Why This Matters:
- **Session 1**: Hit error, spend 20 min debugging
- **Session 50**: Same error, find in 5 seconds via Ctrl+F
- **Compound effect**: Every bug makes us FASTER, not slower

---

## �👤 WORKING WITH FEGROX

**DO:**
- Be Direct & Honest - Truth over flattery
- Think Big - Novel solutions, not incremental
- Move Fast - Match his velocity
- Comprehensive - Production-ready, not MVPs

**DON'T:**
- Sugar coat
- Explain basics
- Assume errors - Many "issues" are intentional
- Be slow

**Key Quotes:**
> "We are not designing a sofa here - we are world disruptors."
> "Don't sugar coat it."
> "Slow down, think deeper, use more of my credits."

---

## 🏆 THE STANDARD

Every app we build must:
1. **Dominate its market** - Not participate, dominate
2. **Make users dependent** - Switching feels impossible
3. **Generate revenue** - Free doesn't build empires
4. **Scale infinitely** - Built for millions from day 1
5. **Delight users** - They should LOVE using it
6. **Be the best in the world** - No compromises

> **"We don't build apps. We build empires."**

---

## 📦 REFERENCE FILES

| File | Purpose |
|------|---------|
| **PROGRESS.md** | Master roadmap, what's done, what's next |
| **FEATURE_ROADMAP.md** | Feature specs, implementation order |
| **MONETIZATION_PLAN.md** | Revenue streams, pricing |
| **firestore.rules** | Security rules reference |

---

*Developer: FEGROX*  
*Mission: Top 10 Global Innovator*  
*AI Partnership Started: December 1, 2024*  
*Last Updated: December 11, 2025*
