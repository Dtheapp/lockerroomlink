# 🎨 GridironHub Theme Standardization - In Progress

## Color Standards Applied

### Primary Colors:
- **Primary Buttons:** `bg-orange-600 hover:bg-orange-700` (was: sky/blue/cyan-600)
- **Secondary Buttons:** `bg-slate-600 hover:bg-slate-700` (gray)
- **Accent Color:** Orange (`#ea580c`)

### Background Colors:
- **Light Mode Cards:** `bg-slate-100` (was: bg-white) - Medium gray for better contrast
- **Dark Mode Cards:** `bg-zinc-950` (unchanged)
- **Light Mode Base:** `bg-slate-50`
- **Dark Mode Base:** `bg-black`

### Border Colors:
- **Light Mode:** `border-zinc-200`
- **Dark Mode:** `border-zinc-800`

---

## Components Updated ✅

### User Components:
- ✅ **AuthScreen.tsx** - Orange buttons
- ✅ **Dashboard.tsx** - Slate-100 cards, orange kept
- ✅ **Roster.tsx** - Orange buttons, slate-100 modals
- ✅ **Profile.tsx** - Orange buttons

### Stats Components:
- ✅ **EditableStatsBoard.tsx** - Orange add button
- ✅ **EditableEventsSchedule.tsx** - Orange buttons
- ✅ **EventAnnouncements.tsx** - Orange game badges

### Admin Components:
- ✅ **ManageTeams.tsx** - Orange create/save buttons
- ✅ **ManageUsers.tsx** - Orange assign button, orange filter
- ✅ **UserReport.tsx** - Orange filter tabs

---

## Components In Progress 🚧

- ⏳ **Chat.tsx** - Need to audit
- ⏳ **Messenger.tsx** - Need to audit
- ⏳ **VideoLibrary.tsx** - Need to audit
- ⏳ **Playbook.tsx** - Need to audit (keep orange floating button)
- ⏳ **AdminDashboard.tsx** - Need to audit
- ⏳ **Stats.tsx** wrapper - Need to audit
- ⏳ **StatsBoard.tsx** (read-only) - Need to audit

---

## Changes Made

### Button Color Replacements:
```
bg-sky-600 → bg-orange-600
bg-sky-500 → bg-orange-600
bg-cyan-600 → bg-orange-600
bg-blue-600 → bg-orange-600 (except Playbook player markers)

hover:bg-sky-700 → hover:bg-orange-700
hover:bg-cyan-500 → hover:bg-orange-700
```

### Card Background Replacements:
```
bg-white dark:bg-* → bg-slate-100 dark:bg-*
(For modal/card containers, NOT form inputs)
```

---

## What's Left:

1. Complete remaining component audits
2. Verify all modals use slate-100
3. Check all form buttons are orange
4. Ensure consistent dark mode across all pages
5. Test light/dark mode switching

---

**Goal:** Every page should look like Dashboard (Image 1) - consistent orange accents, better contrast in light mode.

