# 🔍 OSYS Codebase Audit — February 6, 2026

> **Audited by:** Claude Opus 4.6 (fresh eyes on 4.5-built codebase)  
> **Purpose:** Find real improvements to make the app world-class before pilot  
> **Rule:** Check off items as completed. Note the date + session.

---

## 📊 Summary

| Category | Count | Fixed |
|----------|-------|-------|
| 🔴 CRITICAL | 5 | 5 |
| 🟡 HIGH IMPACT | 7 | 4 |
| 🛢 NICE TO HAVE | 5 | 4 |
| **Total** | **17** | **13** |

---

## 🔴 CRITICAL (Security, Data Loss, Compliance)

### - [x] C1. CDN Supply Chain Attack Vector
**File:** `index.html` (lines 36, 57-65)  
**Problem:** Import maps loading React, Firebase, Lucide, React Router from `aistudiocdn.com` (Google AI Studio CDN). Also loading Tailwind Play CDN (`cdn.tailwindcss.com`) which is explicitly not for production. Vite already bundles all of this — these are dangerous leftovers.  
**Risk:** If that CDN is compromised, entire app is owned. Tailwind Play CDN is slow and generates CSS at runtime.  
**Fix:** Remove the `<script src="https://cdn.tailwindcss.com">` tag. Remove the entire `<script type="importmap">` block. Vite handles all of it.  
**Time:** 15 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [x] C2. `firebase-admin` in Client Dependencies
**File:** `package.json` (line 22)  
**Problem:** `firebase-admin` (^13.6.0) is a **server-side SDK** listed in production `dependencies`. It inflates the bundle massively and is a security anti-pattern.  
**Risk:** Bundle bloat, potential admin-level API exposure if accidentally imported.  
**Fix:** Remove from `dependencies`. If needed for Cloud Functions, put in a separate `/functions/package.json`.  
**Time:** 2 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [x] C3. Firestore Rules: Draft Pool Wide Open
**File:** `firestore.rules` (lines 351-364)  
**Problem:** Draft pool `create`, `update`, and `delete` all just check `isAuthenticated()`. Comments say "Commissioners, coaches or admin" but the actual rule lets ANY logged-in user modify/delete entries.  
**Risk:** Malicious parent could delete other players from draft pool, forge registrations, manipulate draft entries.  
**Fix:** Restrict `create` to the registering parent (`request.auth.uid == request.resource.data.registeredByUserId`). Restrict `update`/`delete` to `canManageProgram(programId) || isAdmin()`.  
**Time:** 30 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [x] C4. Debug Console.log Leaking PII in Production
**File:** `App.tsx` (line 252)  
**Problem:** `console.log('AppContent Debug:', { user: user?.email, userData: { role, name, uid } })` runs on **every render** in production, leaking user PII to anyone who opens DevTools.  
**Risk:** Privacy violation, PII exposure.  
**Fix:** Remove entirely, or guard with `if (import.meta.env.DEV)`.  
**Time:** 2 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [x] C5. Viewport Blocks Zooming (WCAG Violation)
**File:** `index.html` (line 8)  
**Problem:** `maximum-scale=1.0, user-scalable=no` prevents mobile users from zooming. WCAG 2.1 Level AA violation (1.4.4 Resize Text). Apple has deprecated this behavior.  
**Risk:** Accessibility legal liability for a youth sports app. Users with low vision can't zoom.  
**Fix:** Change to `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` (remove `maximum-scale` and `user-scalable`).  
**Time:** 2 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

## 🟡 HIGH IMPACT (Performance, UX, Scalability)

### - [x] H1. AuthContext Fetches ALL Teams in Database
**File:** `contexts/AuthContext.tsx` (line 664)  
**Problem:** `getDocs(collection(db, 'teams'))` downloads **every team in Firestore**, then filters client-side with `.includes()`. At 1,000 teams, every coach login downloads all 1,000 docs.  
**Risk:** O(n) Firestore reads that grow with user count. Slow logins. Costs money.  
**Fix:** Use individual `getDoc()` calls per team ID, or batch with `where(documentId(), 'in', teamIds)` (max 30 per query).  
**Time:** 15 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [ ] H2. AuthContext is 1,082-Line God Object
**File:** `contexts/AuthContext.tsx` (entire file)  
**Problem:** 15+ state variables, nested real-time listeners inside listeners, async operations inside `onSnapshot` callbacks with no cancellation. Every state change re-renders ALL consumers.  
**Risk:** Performance bottleneck #1. Memory leaks from uncleared nested listeners. Race conditions from un-cancelled async ops.  
**Fix:** Split into `AuthContext` (auth only), `TeamContext` (team data), `RoleContext` (permissions). Add AbortController for async cleanup.  
**Time:** 2-3 hours  
**Fixed:** ⬜ | **Date:** | **Session:**

---

### - [ ] H3. NewOSYSDashboard is 5,247 Lines / 60+ State Variables
**File:** `components/NewOSYSDashboard.tsx`  
**Problem:** One component managing roster, events, plays, bulletin, streams, coaching staff, seasons, draft pool, leagues, registrations, kudos, and CRUD. Every state update re-renders all 5K lines.  
**Risk:** Terrible render performance. Impossible to test or maintain. One Firestore error crashes the entire dashboard.  
**Fix:** Extract into focused sub-components: `BulletinBoard`, `RosterWidget`, `GameDaySection`, `SeasonSection`, `DraftPoolSection` — each with their own data fetching + error boundaries.  
**Time:** 3-4 hours  
**Fixed:** ⬜ | **Date:** | **Session:**

---

### - [x] H4. Zero Accessibility on Modal + UI Components
**File:** `components/ui/OSYSFormElements.tsx` and `components/ui/OSYSComponents.tsx`  
**Problem:** `OSYSModal` has no `aria-modal`, no focus trapping, no Escape key handler, no return-focus-on-close. Buttons/Inputs have no `forwardRef`. Form inputs have no label association via `htmlFor`.  
**Risk:** Screen readers can't navigate the app. Keyboard users can't close modals. Legal liability (ADA compliance).  
**Fix:** Add `role="dialog"`, `aria-modal="true"`, focus trap, Escape handler to modal. Add `forwardRef` to Button/Input. Associate labels with `htmlFor`/`id`.  
**Time:** 1-2 hours  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [x] H5. No Firestore Offline Persistence
**File:** `services/firebase.ts` (line 20)  
**Problem:** `getFirestore(app)` with no cache config. No offline support at all.  
**Risk:** Youth sports apps are used at fields with terrible cell signal. Without persistence, the app shows spinners/errors when connectivity drops. Users lose unsaved data.  
**Fix:** Replace `getFirestore(app)` with `initializeFirestore(app, { localCache: persistentLocalCache({}) })`.  
**Time:** 15 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [x] H6. No Vite Code Splitting / Compression
**File:** `vite.config.ts`  
**Problem:** No `manualChunks` config — Firebase (~200KB), Recharts, and other heavy libs bundled unpredictably. No brotli/gzip pre-compression for Netlify deploys.  
**Risk:** First load likely 1MB+. Slow Time To Interactive, especially on mobile.  
**Fix:** Add `manualChunks` to split `firebase`, `recharts`, `lucide-react` into separate vendor chunks. Add `vite-plugin-compression` for brotli.  
**Time:** 30 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [x] H7. HashRouter Instead of BrowserRouter
**File:** `App.tsx`, `vite.config.ts`, `netlify.toml`, `manifest.json`, 15+ component files  
**Problem:** All URLs have `/#/` (e.g., `app.com/#/dashboard`). Kills SEO for public pages (athlete profiles, events, leagues), breaks social media link previews, looks unprofessional.  
**Risk:** Public pages won't be indexed by Google. Share links look bad. Vite has a custom plugin trying to redirect non-hash routes — adding complexity.  
**Fix:** Migrated to `BrowserRouter`. Removed hash-redirect Vite plugin. Simplified netlify.toml to single SPA catch-all `/* → /index.html 200`. Updated PWA manifest shortcuts. Fixed 30+ `/#/` URL references across CommissionerDashboard, CommissionerRegistrations, NewOSYSDashboard, SeasonManager, LeagueSettings, LeagueSeasons, LeagueSignup, ComparisonPage, DraftDayShowcase, FanDashboard, ProgressPage, Profile, Dashboard, Roster, TicketManager, ErrorBoundary, DraftPool.  
**Time:** 1 hour  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

## 🟢 NICE TO HAVE (Polish, Best Practices)

### - [x] N1. ~500 Lines of Inline CSS in index.html
**File:** `index.html`  
**Problem:** Entire OSYS design system (~500 lines) inlined in `<style>` tags. Duplicates external CSS file. Not cacheable separately.  
**Fix:** Move all inline CSS to the external CSS file processed by Vite.  
**Time:** 30 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [x] N2. Credits Service TOCTOU Race Condition
**File:** `services/creditService.ts`  
**Problem:** `checkCredits()` does a read, then `deductCredits()` does a separate write. Between check and deduction, balance could change. Two browser tabs could both pass the check and both deduct.  
**Fix:** Merge check-and-deduct into a single Firestore transaction.  
**Time:** 20 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [x] N3. Toast Service Has No Max Limit
**File:** `services/toast.ts`  
**Problem:** Toasts push to an unbounded array. Rapid-fire errors (e.g., Firestore listener error in a loop) can stack hundreds of toasts with hundreds of timers.  
**Fix:** Add `MAX_TOASTS = 5`, remove oldest when exceeded.  
**Time:** 10 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1

---

### - [ ] N4. Rate Limiting is Client-Side Only
**File:** `services/creditService.ts`  
**Problem:** Rate limiting uses in-memory Map on the client. Refreshing the page resets all limits. Comment says "use Redis in production" but this IS the client.  
**Risk:** Any user can bypass rate limits by refreshing. Promo code brute-forcing, gift spam unprotected.  
**Fix:** Move rate limiting to Firestore rules or Cloud Functions.  
**Time:** 1-2 hours  
**Fixed:** ⬜ | **Date:** | **Session:**

---

### - [x] N5. Types.ts Uses `any` for ~20+ Date Fields
**File:** `types.ts`  
**Problem:** Date fields typed inconsistently — some `Timestamp`, some `Date`, some `any`. No type safety on date comparisons or `.toDate()` calls.  
**Fix:** Replace all date `any` types with `Timestamp | Date` or a utility type.  
**Time:** 30 min  
**Fixed:** ✅ | **Date:** Feb 6, 2026 | **Session:** Audit Fixes #1 (Quick Wins First)

| Order | ID | Fix | Time | Impact |
|-------|------|-----|------|--------|
| 1 | C1 | Remove CDN scripts + import maps | 15 min | 🔴 Security + Perf |
| 2 | C2 | Remove `firebase-admin` from deps | 2 min | 🔴 Bundle + Security |
| 3 | C4 | Remove PII console.log | 2 min | 🔴 Privacy |
| 4 | C5 | Fix viewport zoom blocking | 2 min | 🔴 Accessibility |
| 5 | H1 | Fix ALL teams query in AuthContext | 15 min | 🟡 Scale blocker |
| 6 | C3 | Lock down Firestore draft pool rules | 30 min | 🔴 Data integrity |
| 7 | H5 | Add Firestore offline persistence | 15 min | 🟡 Field UX |
| 8 | H6 | Add Vite code splitting + compression | 30 min | 🟡 Load speed |
| 9 | N3 | Toast max limit | 10 min | 🟢 Stability |
| 10 | H4 | Modal accessibility | 1-2 hr | 🟡 Compliance |
| 11 | N2 | Credits race condition | 20 min | 🟢 Data integrity |
| 12 | N5 | Fix date `any` types | 30 min | 🟢 Type safety |
| 13 | H7 | BrowserRouter migration | 1 hr | 🟡 SEO |
| 14 | N1 | Remove inline CSS from index.html | 30 min | 🟢 Maintainability |
| 15 | N4 | Server-side rate limiting | 1-2 hr | 🟢 Security |
| 16 | H2 | Split AuthContext | 2-3 hr | 🟡 Performance |
| 17 | H3 | Split Dashboard | 3-4 hr | 🟡 Performance |

---

*Last Updated: February 6, 2026*  
*Next Review: After pilot launch*
