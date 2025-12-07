# 🚀 Pilot Program Preparation Plan

**Created:** December 6, 2025  
**Updated:** December 6, 2025  
**Status:** Plan B Selected - Building Now  
**Target:** City Youth Sports Program - 20 Teams  
**Vision:** Operating System for Youth Sports

---

## 🎯 The Big Picture

This pilot is step one of building the **platform every youth sports organization depends on**:

```
Pilot (20 teams) → Prove value → Add revenue → Scale to 100s → 
Add fundraising/tickets → Scale to 1000s → Add NIL/leagues → 
Become the operating system → Exit or IPO
```

---

## Pilot Profile

| Detail | Info |
|--------|------|
| **Number of Teams** | 20 |
| **Sports** | Football, Basketball, Soccer, Baseball, **CHEER** 🎀 |
| **Timeline** | Basketball NOW, Football promo Feb → play July |
| **Key Contacts** | League President, Commissioner, You (Head Football Coach) |
| **Pricing** | Free pilot (charge later) |

---

## 🎯 CRITICAL INSIGHT: Cheer Market

**No app in the world facilitates cheer teams.** This is a blue ocean opportunity!

### Why Cheer Is Huge
- Every football/basketball program has a cheer squad
- Parents are EXTREMELY engaged (costumes, competitions, fundraising)
- Cheer competitions = events system perfect fit
- Routine videos = video library perfect fit
- No competition in this space

### Cheer-Specific Needs
| Feature | Notes |
|---------|-------|
| **Roster** | ✅ Works as-is |
| **Chat** | ✅ Works as-is |
| **Events** | ✅ Works as-is (competitions, practices) |
| **Video Library** | ✅ Works as-is (routines, practice videos) |
| **Stats** | ❌ Different - Competition scores, skills mastered |
| **Playbook** | 🔄 Could be "Routine Designer" - formations, transitions |
| **Positions** | Different - Flyer, Base, Back Spot, etc. |

---

## Timeline (Updated)

| Sport | Status | Priority | Target Ready |
|-------|--------|----------|--------------|
| **Basketball** 🏀 | Season NOW | 🔴 URGENT | ASAP |
| **Cheer** 🎀 | Season NOW (with basketball) | 🔴 URGENT | ASAP |
| **Football** 🏈 | Promo Feb, Play July | 🟡 HIGH | February 2026 |
| **Soccer** ⚽ | TBD | 🟢 MEDIUM | After pilot feedback |
| **Baseball** ⚾ | TBD | 🟢 MEDIUM | After pilot feedback |

---

## Plan B: Phased Sport Support

### Phase 1A: Basketball & Cheer Ready (THIS WEEK)
- Add sport type to Team model
- Sport selection in team creation
- Basketball stats template
- Cheer stats template (competition scores, skills)
- Basketball positions (PG, SG, SF, PF, C)
- Cheer positions (Flyer, Base, Back Spot, Tumbler, etc.)
- Hide playbook for non-football (or show generic)
- Core features work for all (roster, chat, events, video, messaging)

### Phase 1B: Pilot Polish & Design (NEXT WEEK)
- Onboarding flow (Welcome modal, getting started checklist)
- Error monitoring (Sentry)
- Basic analytics (PostHog)
- Feedback button
- Empty states upgrade (beautiful, actionable)
- Skeleton loaders (replace spinners)
- Success celebrations (confetti on key moments)
- Testing

### Phase 2: Football Enhancement (By February)
- Football is already built! ✅
- Polish based on basketball/cheer feedback
- Playbook already works for football

### Phase 3: Soccer & Baseball (After Pilot)
- Add based on demand
- Soccer pitch playbook
- Baseball diamond playbook

---

## Phase 1 Tasks (Pre-Pilot Critical)

### Multi-Sport Support
| Task | Priority | Est. Time | Status |
|------|----------|-----------|--------|
| Add sport type to Team model | Critical | 1 hour | ⬜ |
| Sport selection in team creation | Critical | 2 hours | ⬜ |
| Conditional feature visibility by sport | Critical | 3 hours | ⬜ |
| Basketball positions dropdown | Critical | 1 hour | ⬜ |
| Cheer positions dropdown | Critical | 1 hour | ⬜ |
| Basketball stats template | Critical | 2 hours | ⬜ |
| Cheer stats template | Critical | 2 hours | ⬜ |
| Test all flows for basketball/cheer | Critical | 2 hours | ⬜ |

### Design Upgrades (Trait #24 - Make Users Fall In Love)
| Task | Priority | Est. Time | Status |
|------|----------|-----------|--------|
| Onboarding welcome modal | Critical | 2 hours | ⬜ |
| Getting started checklist component | Critical | 3 hours | ⬜ |
| Empty states for all major screens | Critical | 3 hours | ⬜ |
| Skeleton loader component | High | 2 hours | ⬜ |
| Success celebration (confetti) | High | 2 hours | ⬜ |
| Better error states | High | 2 hours | ⬜ |

## Phase 2 Tasks (Pilot Polish)

| Task | Priority | Est. Time | Status |
|------|----------|-----------|--------|
| New user onboarding wizard | High | 4 hours | ⬜ |
| Add Sentry error monitoring | High | 1 hour | ⬜ |
| Add basic analytics (PostHog/Mixpanel) | High | 2 hours | ⬜ |
| Floating feedback button | High | 1 hour | ⬜ |
| Help/FAQ page | Medium | 2 hours | ⬜ |
| Full app testing walkthrough | High | 3 hours | ⬜ |

## Phase 3 Tasks (Engagement)

| Task | Priority | Est. Time | Status |
|------|----------|-----------|--------|
| Firebase Cloud Messaging setup | Medium | 2 hours | ⬜ |
| Push notification triggers | Medium | 3 hours | ⬜ |
| Email service integration (SendGrid) | Medium | 2 hours | ⬜ |
| Transactional email templates | Medium | 2 hours | ⬜ |

## Phase 4 Tasks (Post-Pilot / Before Football Feb)

| Task | Priority | Est. Time | Status |
|------|----------|-----------|--------|
| Soccer positions & stats | Medium | 2 hours | ⬜ |
| Baseball positions & stats | Medium | 2 hours | ⬜ |
| Basketball court playbook | Low | 4 hours | ⬜ |
| Cheer routine designer 🔥 | High | 8 hours | ⬜ |
| Soccer pitch playbook | Low | 4 hours | ⬜ |
| Baseball diamond playbook | Low | 4 hours | ⬜ |
| Subscription system (Stripe) | Medium | 8 hours | ⬜ |
| Premium feature gating | Medium | 4 hours | ⬜ |

---

## Sport-Specific Requirements

### Stats by Sport

| Sport | Key Stats |
|-------|-----------|
| **Football** 🏈 | TDs, Rush Yards, Rec Yards, Pass Yards, Tackles, Sacks, INTs |
| **Basketball** 🏀 | Points, Rebounds, Assists, Steals, Blocks, FG%, FT%, 3PT% |
| **Cheer** 🎀 | Competition Score, Skills Mastered, Stunts Landed, Attendance |
| **Soccer** ⚽ | Goals, Assists, Saves, Shots, Shots on Goal, Clean Sheets |
| **Baseball** ⚾ | Hits, RBIs, Runs, HRs, Batting Avg, ERA, Strikeouts |

### Positions by Sport

| Sport | Positions |
|-------|-----------|
| **Football** 🏈 | QB, RB, FB, WR, TE, OL, DL, LB, CB, S, K, P |
| **Basketball** 🏀 | PG, SG, SF, PF, C, 6th Man |
| **Cheer** 🎀 | Flyer, Base, Back Spot, Front Spot, Tumbler, Captain |
| **Soccer** ⚽ | GK, CB, LB, RB, CDM, CM, CAM, LW, RW, ST |
| **Baseball** ⚾ | P, C, 1B, 2B, SS, 3B, LF, CF, RF, DH |

### Playbook/Designer by Sport

| Sport | Surface | Status | Notes |
|-------|---------|--------|-------|
| **Football** 🏈 | Field | ✅ DONE | Full playbook system |
| **Cheer** 🎀 | Formation Mat | 🔥 PLANNED | "Routine Designer" - UNIQUE! |
| **Basketball** 🏀 | Court | Later | Could add Phase 4 |
| **Soccer** ⚽ | Pitch | Later | Could add Phase 4 |
| **Baseball** ⚾ | Diamond | Later | Could add Phase 4 |

---

## 🎀 Cheer = Blue Ocean Opportunity

**No app in the world facilitates cheer teams properly!**

### Why This Matters
- Every football/basketball program has cheer
- Cheer parents are EXTREMELY engaged
- Cheer competitions = Events system perfect fit
- Routine videos = Video Library perfect fit
- Zero competition in this market

### Future: Cheer Routine Designer 🚀
This could be our killer feature for cheer:
- Mat/floor layout
- Formation positions with drag-drop
- Transition animations
- Music sync points (count: 1-8)
- Stunt positions & groups
- Export routine sheets for judges

**This is a $0 competition market with high-spending parents!**

---

## Success Metrics for Pilot

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Teams onboarded | 20/20 | Firebase user count |
| Daily active users | 50%+ of registered | Analytics |
| Features used | Track top 5 | Analytics |
| Bug reports | < 10 critical | Feedback system |
| Coach satisfaction | 8+/10 | Survey after 2 weeks |
| Parent engagement | 60%+ login weekly | Analytics |

---

## Post-Pilot Plan

1. **Collect feedback** - Survey coaches and parents
2. **Analyze usage** - What features are loved/ignored?
3. **Fix top issues** - Address critical feedback
4. **Introduce pricing** - "Thanks for piloting! Here's our plans..."
5. **Case study** - "Used by City of X Youth Sports"
6. **Expand** - Use success story to get more leagues
7. **Add fundraising** - Teams raise money through us
8. **Add tickets** - Sell game tickets through us
9. **Add private coaching** - Coaches offer sessions through us
10. **League mode** - Leagues manage standings through us

---

## Revenue Opportunity from Pilot

| If Pilot Teams Use... | Potential Revenue |
|----------------------|-------------------|
| 10 coaches subscribe ($15/mo) | $150/mo |
| 20 teams fundraise $500 each (4% fee) | $400 one-time |
| 100 tickets sold/week ($0.75 each) | $75/week |
| 5 coaches offer training ($100/session, 12%) | $60/month |
| **Year 1 from just pilot teams** | **~$3,000-5,000** |

Small start, but proves the model. Then we scale.

---

## Change Log

| Date | Change |
|------|--------|
| Dec 6, 2025 | Initial plan created |
| Dec 6, 2025 | Updated: Plan B selected, added Cheer as 5th sport |
| Dec 6, 2025 | Updated: Basketball & Cheer NOW priority, Football Feb |
| Dec 6, 2025 | Added: Cheer blue ocean opportunity analysis |
| Dec 6, 2025 | Added: Sport-specific stats & positions tables |
