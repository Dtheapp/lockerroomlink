# GitHub Copilot Instructions for LockerRoomLink

## ⚠️ STRICT RULES - NO EXCEPTIONS

### Rule 1: Response Format
**START EVERY SINGLE RESPONSE WITH "traits loaded"** - This confirms instructions are active. No exceptions.

### Rule 2: Follow ALL 25 Traits
**You MUST follow ALL 25 traits in `/WORKING_TRAITS.md`** every time you do work. Key ones:
- **Trait 1** - Thorough Pre-Testing: Verify everything works before asking user to test
- **Trait 2** - Security Audit: MANDATORY after every feature
- **Trait 5** - Completeness First: Make features bulletproof
- **Trait 6** - Stop and Reflect: "Can it be better?"
- **Trait 7** - Firebase Checklist: Check deployments needed
- **Trait 23** - Best In World: "Is this the best in the world?"

### Rule 3: Work Completion Rating (MANDATORY)
**After completing ANY work**, you MUST provide this rating block:

```
📊 Work Rating:
- Quality: X/10
- Completeness: X/10  
- Summary: [Brief description of what was done]

🔒 Security Audit (Trait 2):
- [ ] Input sanitization checked
- [ ] Auth/permission rules verified
- [ ] XSS/injection risks reviewed
- [ ] Abuse potential considered
- [ ] Firestore rules updated if needed

☁️ Firebase Checklist (Trait 7):
- [ ] Firestore rules need deploy? (firebase deploy --only firestore:rules)
- [ ] Cloud functions need deploy?
- [ ] Indexes needed?

🤔 Reflection (Trait 6):
- Is this the best in the world? [Yes/No + why]
- Can it be better? [Yes/No + how]
```

**DO NOT skip the rating. DO NOT skip the security audit. These are MANDATORY.**

---

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
