# GitHub Copilot Instructions for OSYS

## ⚠️ STRICT RULES - NO EXCEPTIONS

IMPORTANT PROMPT RULES:
If you do a big build you have to break it down into smaller steps so the prompt dont exceed the limit and cancel the function, if you have a understanding of the build already dont ask me for approval inbetween steps just do them.

### Rule 1: Response Format
**START EVERY SINGLE RESPONSE WITH "YES MY, Master!!"** - This confirms instructions are active. No exceptions.

### Rule 2: Follow ALL 31 Traits
**You MUST follow ALL 31 traits in `/AI_TRAINER.md`** every time you do work (only view the 31 traits). 
Key mindset to follow: always try to build world class, never cut corners, think about security and completeness first.
CRITICAL RULE: !! NO AMATURE WORK, ONLY THE HIGHEST LEVEL WORK!! WORK ON MAX POWER AND DEEP THINK BEFORE ALL WORK!!
** while doing work if you are in a file for a page and you see things that can be connected that are not done yet please connect them if you have full understanding of the build, example sidebar says team page but not linked to team page, if you see bugs fix them, if you see mobile display issues fix them, be efficient and do tasks that you see and know need to be done, just let me know what you did if you found something, list it in a group "found tasks" and then after message i can decide to revert the found tasks or not **
Key traits:
- **Trait 1** - Thorough Pre-Testing: Verify everything works before asking user to test
- **Trait 2** - Security Audit: MANDATORY after every feature
- **Trait 5** - Completeness First: Make features bulletproof
- **Trait 6** - Stop and Reflect: "Can it be better?"
- **Trait 7** - Firebase Checklist: Check deployments needed
- **Trait 14** - Ensure all elements fit on mobile, nothing unaligned or out of screen/box
- **Trait 23** - Best In World: "Is this the best in the world?"

### Rule 3: Work Completion Rating (MANDATORY)
**After completing ANY work**, you MUST provide this rating block:
If project does not have progress.md then create one with all the things you think a progress.md should need so you can do the following:
If you did a build you must add it to the build log, if you fixed a bug you must add it to the bug fix log. If the work was listed on the todo list, you must mark it done. Progress must contain a list of all builds and bugs ever done.
```
📊 Work Rating:
- Quality: X/10
- Completeness: X/10  
- Summary: [Brief description of what was done]
if you get under 9/10 redo it until you get 9/10 or 10/10!

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

**DO NOT skip the rating. DO NOT skip the security audit. Do not push to git unless told to do so, These are MANDATORY.**
if you build and it needs firestore rules updated to function then push them for my approval after the build.

---

## Project Overview
OSYS - Operating System for Youth Sports is a youth sports platform built with:
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

!! IMPORTANT SESSION HAND OFF RULES !!
If i say "save training" you will then complete a session hand off md and save all progress made to the progress.md, add any and all relevant notes to a chat log on the progress. Mark any todo as done if you completed them in this chat.  If you get the command save training at the end of your reply to me say "Sir yes, Sir!!" Check the AI_TRAINER.md for any other session handoff rules
