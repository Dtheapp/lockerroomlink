# GitHub Copilot Instructions for LockerRoomLink

## Response Format
**IMPORTANT**: Start EVERY response with "traits loaded" to confirm these instructions are active.

## Project Overview
LockerRoomLink (OSYS - Our Sports Your Stats) is a youth sports platform built with:
- React 19 + TypeScript + Vite
- Firebase (Firestore, Auth, Storage)
- Tailwind CSS
- Real-time data with onSnapshot listeners

## Key Conventions

### Credits System
- Use `credits` field ONLY (not `cloneCredits` - deprecated and removed)
- Credits are stored in `users` collection as `credits: number`
- Use `userData?.credits` from AuthContext as the source of truth
- Never double-fetch credits (real-time listener already provides them)

### Theme Support
- Always use `useTheme()` hook from `contexts/ThemeContext`
- Support both dark and light modes with conditional classes
- Pattern: `${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-slate-900'}`

### Team IDs
- Team IDs must be lowercase only
- Use validation: `.toLowerCase().replace(/[^a-z0-9-_]/g, '-')`
- Store teams with custom IDs using `setDoc(doc(db, 'teams', customId), data)`

### User Roles
Valid roles: `'Coach' | 'Fan' | 'Admin' | 'Athlete' | 'Parent' | 'Commissioner' | 'TeamCommissioner' | 'LeagueCommissioner' | 'LeagueOwner' | 'ProgramCommissioner'`

### Component Patterns
- Use functional components with hooks
- Prefer `useAuth()` for user data and authentication state
- Use `useTheme()` for theme-aware styling
- Handle loading and error states gracefully

### Firebase Patterns
- Use `serverTimestamp()` for `createdAt` and `updatedAt` fields
- Always include `ownerId` when creating team-related documents
- Use batch writes for multi-document operations

## File Structure
- `/components` - React components
- `/contexts` - React contexts (Auth, Theme)
- `/hooks` - Custom hooks
- `/services` - Firebase and API services
- `/types.ts` - TypeScript interfaces
- `/config` - Configuration files

## Testing
- Run `npm run dev` for development
- Check for TypeScript errors before suggesting changes
- Test theme toggle and credits display after changes
