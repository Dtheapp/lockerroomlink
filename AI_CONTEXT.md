# 🤖 AI Context - OSYS Project

**Last Updated:** December 6, 2025  
**Project:** OSYS - The Operating System for Youth Sports  
**Master Trainer:** See `../DISRUPTOR_AI.md` for who I am and how to work with me

---

## 🚨 GETTING STARTED

If you haven't already, read `DISRUPTOR_AI.md` first - it tells you who I am and how I think.

This file is **project-specific context** for OSYS.

---

## 🎯 THIS PROJECT'S DISRUPTION TARGET

### Industry: Youth Sports
**What's broken:**
- Parents use 5+ apps (TeamSnap, Hudl, GameChanger, GoFundMe, Ticketmaster...)
- Coaches waste hours on admin instead of coaching
- No app serves cheer teams at all (blue ocean!)
- Leagues use outdated tools like League Lineup
- NIL is chaotic with no marketplace
- Fundraising money goes to random platforms

### Our Solution: The Operating System
One platform that handles EVERYTHING:
- Team management, communication, video, stats
- Playbook design (BEST IN CLASS)
- Event registration with payments
- Fundraising (compete with GoFundMe)
- Game tickets (compete with Ticketmaster)
- Private coaching marketplace (compete with CoachUp)
- NIL marketplace (first mover)
- League management (replace League Lineup)

### The End Game
- 50,000+ teams on platform
- $10M+ ARR
- Acquisition or IPO as "Shopify of Youth Sports"

---

## 💰 REVENUE MODEL

### Who Pays What
| User Type | Cost | Why |
|-----------|------|-----|
| **Parents** | FREE | They're the product (engagement) |
| **Fans** | FREE | They drive viral growth |
| **Coaches** | $14.99-99.99/mo | They need the features |
| **Leagues** | $49-199/season | They need management tools |

### 9 Revenue Streams
1. **Coach Subscriptions** - Monthly recurring ($14.99-99.99)
2. **Playbook Marketplace** - Coaches sell plays (we take 30%)
3. **Event Registration** - Parents pay for events (we take 5%) ✅ BUILT
4. **Fundraising Platform** - Teams raise money (we take 3-5%)
5. **Digital Game Tickets** - Fans buy tickets (we take 5% + $0.50)
6. **Private Coaching** - Parents book sessions (we take 10-15%)
7. **NIL Marketplace** - Companies pay athletes (we take 10%)
8. **League Management** - Leagues subscribe ($49-199/season)
9. **AI Features** - Premium AI tools (pay per use)

### Year 3 Target: $704,000 ARR

---

## 🏈 CURRENT STATE

### Tech Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Firebase (Firestore, Auth, Storage) - Project: `gridironhub-3131`
- **Payments:** PayPal (events), Stripe (subscriptions - planned)
- **Hosting:** Netlify
- **Git:** `main` (production), `dev` (daily work - no Netlify builds)

### What's Built ✅
| Feature | Status | Quality |
|---------|--------|---------|
| Role-based auth (Coach, Parent, Fan, Admin) | ✅ Done | ⭐⭐⭐⭐⭐ |
| Dashboard with bulletin board | ✅ Done | ⭐⭐⭐⭐ |
| Roster management | ✅ Done | ⭐⭐⭐⭐ |
| Football playbook designer | ✅ Done | ⭐⭐⭐⭐⭐ BEST IN CLASS |
| Team chat with media | ✅ Done | ⭐⭐⭐⭐ |
| Video library (YouTube) | ✅ Done | ⭐⭐⭐⭐ |
| Stats system (football) | ✅ Done | ⭐⭐⭐⭐⭐ |
| Events & registration (PayPal) | ✅ Done | ⭐⭐⭐⭐ |
| Private messaging | ✅ Done | ⭐⭐⭐⭐ |
| Live streaming | ✅ Done | ⭐⭐⭐⭐ |
| Public profiles | ✅ Done | ⭐⭐⭐⭐ |
| Fan engagement (kudos, clips) | ✅ Done | ⭐⭐⭐⭐ |
| Admin dashboard | ✅ Done | ⭐⭐⭐⭐ |
| System playbook | ✅ Done | ⭐⭐⭐⭐ |
| Dark mode | ✅ Done | ⭐⭐⭐⭐ |
| Security (rate limiting, sanitization) | ✅ Done | ⭐⭐⭐⭐ |

### What's NOT Built Yet ❌
| Feature | Priority | Phase |
|---------|----------|-------|
| Multi-sport support | 🔴 CRITICAL | 1 |
| **Landing page (world-class)** | 🔴 CRITICAL | 1 |
| **AI content moderation (child safety)** | 🔴 CRITICAL | 1 |
| Onboarding flow | 🔴 CRITICAL | 1 |
| Coach subscriptions (Stripe) | 🔴 CRITICAL | 2 |
| Feature gating | 🔴 CRITICAL | 2 |
| Fundraising platform | 🟡 HIGH | 2 |
| Digital tickets | 🟡 HIGH | 2 |
| **AI customer service** | 🟡 HIGH | 2 |
| Private coaching bookings | 🟡 HIGH | 3 |
| NIL marketplace | 🟢 MEDIUM | 3 |
| League management | 🟢 MEDIUM | 3 |
| AI features | 🟢 MEDIUM | 4 |

---

## 🎯 PILOT PROGRAM

### Details
- **Teams:** 20 teams
- **Sports:** Football, Basketball, Soccer, Baseball, CHEER
- **Timeline:** Basketball & Cheer NOW, Football promo Feb → play July
- **Location:** City Youth Sports Program
- **Contacts:** League President, Commissioner, Owner (head football coach)
- **Pricing:** Free during pilot, then introduce subscriptions

### Why Cheer is Blue Ocean 🎀
**No app in the world serves cheer teams!** This is a $0 competition market with high-spending parents. Cheer competitions, routine videos, practice schedules - we can own this.

### Sports Support Needed
| Sport | Positions | Stats | Playbook |
|-------|-----------|-------|----------|
| Football 🏈 | ✅ Done | ✅ Done | ✅ Done |
| Basketball 🏀 | ⬜ Needed | ⬜ Needed | Later |
| Cheer 🎀 | ⬜ Needed | ⬜ Needed | Routine Designer (future) |
| Soccer ⚽ | ⬜ Needed | ⬜ Needed | Later |
| Baseball ⚾ | ⬜ Needed | ⬜ Needed | Later |

---

## 📋 25 WORKING TRAITS

These are the standards for all development. Reference `WORKING_TRAITS.md` for full details.

### Core Traits (Always Apply)
1. **Thorough Pre-Testing** - Verify everything before having user test
2. **Security Audit** - After every feature
3. **Build for Scale** - Millions of users mindset
4. **Proactive Suggestions** - Speak up if you see a better way
5. **Git Workflow** - Use dev branch, meaningful commits
6. **Documentation** - Update MD files automatically
7. **Firebase Checklist** - Rules, indexes, security

### Excellence Traits
8. **Code Excellence** - TypeScript strict, no shortcuts
9. **Performance First** - Optimize queries, lazy load
10. **Error Handling** - Graceful degradation
11. **Accessibility** - ARIA, keyboard nav
12. **Test Coverage** - Critical paths covered
13. **Clean Architecture** - Separation of concerns

### Business Traits
14. **User-Centric** - Solve real problems
15. **Analytics Ready** - Track everything
16. **Monetization Mindset** - Build for revenue
17. **Growth Mindset** - Viral features, shareability
18. **Data Moat** - Accumulate valuable data
19. **Network Effects** - More users = more value

### Ultimate Traits
20. **Competitive Awareness** - Know and beat competitors
21. **Simplicity** - Complex inside, simple outside
22. **Delight Users** - Exceed expectations
23. **Best In The World** - If it's not, make it be
24. **Design That Makes Users Fall In Love** - Premium UX
25. **Platform Dependency** - Own everything they need

---

## 📁 KEY FILES TO KNOW

### Documentation
| File | Purpose |
|------|---------|
| `PROGRESS.md` | Master progress tracker - CHECK THIS FIRST |
| `AI_CONTEXT.md` | This file - training for new AI chats |
| `WORKING_TRAITS.md` | 25 development excellence traits |
| `MONETIZATION_PLAN.md` | Full revenue strategy |
| `PILOT_PREP_PLAN.md` | 20-team pilot preparation |
| `PROJECT_REVIEW.md` | Codebase assessment |
| `FEATURE_ROADMAP.md` | All planned features |
| `DESIGN_UPGRADES.md` | UI/UX improvements |

### Key Code Files
| File | Purpose |
|------|---------|
| `App.tsx` | Main app router and auth |
| `types.ts` | TypeScript interfaces |
| `services/firebase.ts` | Firebase configuration |
| `contexts/AuthContext.tsx` | Authentication state |
| `components/Dashboard.tsx` | Main coach dashboard |
| `components/Playbook.tsx` | Play designer (best feature) |
| `components/Stats.tsx` | Stats tracking |

### Firebase
- Project: `gridironhub-3131`
- Firestore rules: `firestore.rules`
- Deploy: `firebase deploy --only firestore:rules`

---

## 🔄 CURRENT PRIORITIES

### Immediate (This Week)
1. **Multi-sport support** - Add sportType to Team, basketball/cheer positions & stats
2. **Test all flows** - Ensure basketball/cheer teams work end-to-end

### Next (Next Week)
3. **Onboarding flow** - Welcome modal, getting started checklist
4. **Design polish** - Empty states, skeleton loaders

### Soon (This Month)
5. **Error monitoring** - Sentry integration
6. **Analytics** - PostHog integration
7. **Feedback system** - In-app bug reporting

### After Pilot
8. **Subscriptions** - Stripe, tiers, feature gating
9. **Fundraising** - Team fundraiser pages
10. **Tickets** - Digital game tickets with QR codes

---

## 🚨 IMPORTANT REMINDERS

### Git Workflow
- **Always work on `dev` branch** (saves Netlify build costs)
- Meaningful commit messages
- Only merge to `main` when ready to deploy

### Before Any Feature
1. Check if it aligns with the vision
2. Consider scale (millions of users)
3. Think about monetization angle
4. Plan security from the start

### After Any Feature
1. TypeScript compile check
2. Build verification
3. Security audit
4. Update relevant MD files
5. Commit with meaningful message

### Design Standards
- Mobile-first
- Dark mode support
- Orange/zinc color scheme
- Skeleton loaders (not spinners)
- Beautiful empty states
- Celebration moments (confetti on achievements)

---

## 📞 OWNER CONTEXT

- **Role:** Head football coach with insider access
- **Connections:** League president, commissioner
- **Advantage:** Can get 20 teams immediately for pilot
- **Sports insight:** Cheer is underserved market
- **Goal:** Build billion-dollar company, not just an app

---

## ✅ HOW TO START A NEW SESSION

When you receive this file, respond with:

1. **Confirm understanding** of the vision (Operating System for Youth Sports)
2. **Check current progress** by reading `PROGRESS.md`
3. **Ask what to work on** or suggest based on priorities
4. **Start working** - don't ask permission, just execute

Example first response:
> "Got it! I'm your AI development partner for OSYS - the Operating System for Youth Sports. I've reviewed the context and see we're at 65% platform ready. Current priority is multi-sport support (Basketball/Cheer) for the pilot. Ready to start on that, or do you have something else in mind?"

---

## 🔄 KEEPING THIS FILE UPDATED

**AI Instructions:** After each significant work session, update this file with:
- New features completed (move from "Not Built" to "Built")
- Changed priorities
- New context the next AI needs to know
- Updated progress percentage

This file should always reflect the TRUE current state of the project.

---

## Change Log

| Date | Change |
|------|--------|
| Dec 6, 2025 | Initial AI context file created |
| Dec 6, 2025 | Added all 25 traits, revenue model, pilot info |
| Dec 6, 2025 | Added file references and code structure |
