# OSYS UI Migration Training Context

## Project: LockerRoomLink → OSYS (Operating System for Youth Sports)

## Current Status (December 7, 2025)

### ✅ COMPLETED Components (OSYS Dark Theme)
- **Chat.tsx** - Team chat with purple accents, glass morphism
- **Messenger.tsx** - Direct messaging, same styling
- **OSYSFormElements.tsx** - Created reusable OSYS-styled form components
- **NewOSYSDashboard.tsx** - Already OSYS styled (reference pattern)

### ⏳ REMAINING Components (Still Old UI)
Priority order:
1. **Roster.tsx** (2382 lines) - Team roster management
2. **Profile.tsx** - User profile
3. **Stats.tsx** - Statistics tracking
4. **VideoLibrary.tsx** - Film room
5. **Strategies.tsx** - Strategy discussions
6. **CoachPlaybook.tsx** (4591 lines) - Play designer (LARGEST)
7. **Playbook.tsx** - Player view of plays

---

## OSYS Design System Reference

### Color Palette
```
Primary: purple-500, purple-600 (was orange-500, orange-600)
Background: zinc-900, zinc-950, black/20
Glass: bg-white/5, bg-white/10, backdrop-blur-xl
Borders: border-white/10, border-white/20
Text: text-white, text-slate-400, text-slate-500
Accents: purple-400 (highlights), amber-400 (warnings), red-400 (errors), emerald-400 (success)
```

### Key Component Classes
```css
/* Container */
bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950
rounded-xl border border-white/10 shadow-2xl

/* Header/Footer bars */
bg-black/40 backdrop-blur-xl border-b border-white/10

/* Cards/Panels */
bg-white/5 border border-white/10 rounded-lg

/* Inputs */
bg-white/5 border border-white/10 rounded-lg px-4 py-2.5
text-white placeholder-slate-500
focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50

/* Buttons - Primary */
bg-gradient-to-r from-purple-600 to-purple-500
hover:from-purple-500 hover:to-purple-400

/* Buttons - Ghost */
bg-white/5 hover:bg-white/10 text-slate-300

/* Message bubbles - Own */
bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-br-none

/* Message bubbles - Others */
bg-white/10 backdrop-blur-sm text-white border border-white/10 rounded-bl-none

/* Modals */
bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950
border border-white/10 rounded-2xl shadow-2xl
```

### Migration Pattern (OLD → NEW)

```
# Backgrounds
bg-slate-50 dark:bg-zinc-950 → bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950
bg-white dark:bg-zinc-900 → bg-black/40 backdrop-blur-xl
bg-zinc-100 dark:bg-zinc-800 → bg-white/5

# Borders
border-slate-200 dark:border-zinc-800 → border-white/10
border-zinc-300 dark:border-zinc-700 → border-white/10

# Text
text-slate-900 dark:text-white → text-white
text-zinc-900 dark:text-white → text-white
text-slate-500 dark:text-zinc-400 → text-slate-400
text-zinc-500 dark:text-zinc-400 → text-slate-500

# Accent colors
text-orange-500 → text-purple-400
text-orange-600 dark:text-orange-400 → text-purple-400
bg-orange-600 → bg-gradient-to-r from-purple-600 to-purple-500
bg-orange-500 → bg-purple-500
hover:bg-orange-500 → hover:from-purple-500 hover:to-purple-400
border-orange-500 → border-purple-500
ring-orange-500 → ring-purple-500/50

# Selected/Active states
bg-orange-500 border-orange-500 → bg-purple-500 border-purple-500
border-l-orange-500 → border-l-purple-500

# Alerts/Warnings (keep amber)
bg-amber-50 dark:bg-amber-900/20 → bg-amber-500/10
border-amber-200 dark:border-amber-800 → border-amber-500/30
text-amber-600 dark:text-amber-400 → text-amber-400
```

---

## App.tsx Route Structure

```tsx
// Coach/Parent routes use NewOSYSLayout but OLD components:
<Route path="/" element={<NewOSYSLayout />}>
  <Route path="dashboard" element={<NewOSYSDashboard />} />  // ✅ OSYS
  <Route path="roster" element={<Roster />} />               // ❌ OLD
  <Route path="playbook" element={<Playbook />} />           // ❌ OLD
  <Route path="chat" element={<Chat />} />                   // ✅ OSYS (just migrated)
  <Route path="strategies" element={<Strategies />} />       // ❌ OLD
  <Route path="messenger" element={<Messenger />} />         // ✅ OSYS (just migrated)
  <Route path="videos" element={<VideoLibrary />} />         // ❌ OLD
  <Route path="profile" element={<Profile />} />             // ❌ OLD
  <Route path="stats" element={<Stats />} />                 // ❌ OLD
  <Route path="coaching" element={<Coaching />} />           // ❌ OLD (wraps CoachPlaybook)
</Route>
```

---

## Key Files Reference

- **OSYSComponents.tsx** - Core design system (GlassCard, Badge, Avatar, Button, etc.)
- **OSYSFormElements.tsx** - Form components (OSYSInput, OSYSModal, OSYSAlert, etc.)
- **NewOSYSDashboard.tsx** - Example of OSYS + Firebase integration pattern
- **index.css** - Contains `.osys-*` CSS classes

---

## Next Session Command

Start fresh chat and say:
```
Continue OSYS UI migration - migrate Roster.tsx to OSYS dark theme with purple accents
```

---

## Git Status
- Branch: `dev`
- Last commit: `feat: Migrate Chat and Messenger to OSYS dark theme`
- Pushed to origin: ✅
