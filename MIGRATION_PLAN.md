# 🔄 Infrastructure Migration Plan

**Created:** December 6, 2025  
**Status:** Future Planning (Not Urgent)  
**Trigger:** When costs exceed ~$200-500/month

---

## Current Infrastructure

| Service | Purpose | Current Cost | Notes |
|---------|---------|--------------|-------|
| **Firebase** | Auth, Firestore, Storage | ~$20/month | Reasonable for now |
| **Netlify** | Hosting, Functions | ~$75/3 days → Fixed | Using `dev` branch now |
| **Total** | | ~$30-50/month expected | After Netlify fix |

---

## Why Migrate Eventually?

| Reason | Details |
|--------|---------|
| **Cost at scale** | Firebase charges per read/write - gets expensive |
| **Control** | Own your data and infrastructure |
| **Performance** | Self-hosted can be faster |
| **No vendor lock-in** | Not dependent on Google/Netlify |

---

## Migration Phases

### Phase 1: Stay on Firebase/Netlify (NOW)
**Timeline:** Until costs hit ~$100-200/month

- ✅ Focus on building features
- ✅ Focus on getting revenue
- ✅ Use `dev` branch to avoid Netlify costs
- ✅ Firebase free tier is generous

**Action:** No migration needed. Build the product.

---

### Phase 2: Hybrid Migration (MEDIUM TERM)
**Trigger:** Costs hit ~$200/month OR need specific features

#### Move Storage to Cloudflare R2
- **Why:** Zero egress fees (Firebase charges for downloads)
- **Savings:** Could be 50-80% on storage costs
- **Effort:** Medium (update storage service)

#### Keep Firebase Auth + Firestore
- **Why:** Still works, migration is complex
- **When to reconsider:** If Firestore costs spike

#### Move Hosting to Vercel
- **Why:** Better DX, generous free tier, faster builds
- **Effort:** Low (just connect repo)

---

### Phase 3: Full Migration (LONG TERM)
**Trigger:** Costs hit ~$500+/month OR need full control

#### Database: PostgreSQL
**Options:**
| Service | Pros | Cons | Cost |
|---------|------|------|------|
| **Supabase** | Firebase-like DX, realtime, auth | Managed = some cost | Free tier, then $25+/mo |
| **PlanetScale** | MySQL, branching, scale | No realtime built-in | Free tier, then $29+/mo |
| **Railway PostgreSQL** | Simple, cheap | Less features | $5+/mo |
| **Self-hosted** | Full control, cheapest | Need DevOps skills | $5-20/mo VPS |

**Recommendation:** Supabase (easiest Firebase replacement)

#### Auth: Options
| Service | Pros | Cons |
|---------|------|------|
| **Supabase Auth** | Comes with Supabase | Tied to Supabase |
| **Auth.js (NextAuth)** | Flexible, many providers | Need to set up |
| **Clerk** | Beautiful UI, easy | Paid at scale |
| **Custom JWT** | Full control | Most work |

**Recommendation:** Supabase Auth (if using Supabase) or Auth.js

#### Storage: Options
| Service | Pros | Cons | Cost |
|---------|------|------|------|
| **Cloudflare R2** | No egress fees! | Cloudflare ecosystem | $0.015/GB stored |
| **AWS S3** | Industry standard | Egress fees | $0.023/GB + egress |
| **Backblaze B2** | Cheap | Less features | $0.005/GB |
| **MinIO (self-hosted)** | Free, S3-compatible | Need server | VPS cost only |

**Recommendation:** Cloudflare R2 (no egress = huge savings)

#### Hosting: Options
| Service | Pros | Cons | Cost |
|---------|------|------|------|
| **Vercel** | Best DX, fast | Can get expensive | Free tier, then $20+/mo |
| **Railway** | Simple, cheap | Less features | $5+/mo |
| **Hetzner VPS** | Incredibly cheap, powerful | Need DevOps | €4-20/mo |
| **DigitalOcean** | Good middle ground | Not cheapest | $5+/mo |

**Recommendation:** Vercel for ease, Hetzner for cost

#### Realtime: Options
| Service | Pros | Cons |
|---------|------|------|
| **Supabase Realtime** | Built-in with Supabase | Tied to Supabase |
| **Pusher** | Easy, reliable | Paid |
| **Socket.io (self-hosted)** | Free, flexible | Need server |
| **Ably** | Reliable | Paid |

---

## Code Preparation (Do Now)

Create abstraction layers so migration is easy later:

### Current Architecture
```
Component → Firebase SDK directly
```

### Better Architecture
```
Component → Service Layer → Firebase (now) / Supabase (later)
```

### Files to Abstract

| File | Current | Abstraction Needed |
|------|---------|-------------------|
| `services/firebase.ts` | Firebase init | Keep as-is |
| `services/auth.ts` | N/A | Create: wrap Firebase Auth |
| `services/database.ts` | N/A | Create: wrap Firestore |
| `services/storage.ts` | ✅ Exists | Already abstracted! |
| `services/realtime.ts` | N/A | Create: wrap onSnapshot |

---

## Namecheap Shared Hosting

**Your current Namecheap shared hosting limitations:**

| Can Do | Cannot Do |
|--------|-----------|
| Host static files | Run Node.js |
| MySQL database | WebSockets/realtime |
| PHP scripts | Background jobs |
| Basic file storage | Custom server processes |

**Verdict:** Can host the built React app (static files) but CANNOT replace Firebase's backend features.

**Use for:** 
- Landing page / marketing site
- Static asset hosting
- NOT the main app

---

## Migration Checklist (When Ready)

### Pre-Migration
- [ ] Abstract auth into service layer
- [ ] Abstract database into service layer
- [ ] Abstract realtime into service layer
- [ ] Document all Firestore collections/structure
- [ ] Export current data

### Database Migration
- [ ] Set up PostgreSQL (Supabase/Railway)
- [ ] Create schema matching Firestore structure
- [ ] Write migration scripts
- [ ] Test with copy of production data
- [ ] Update service layer to use new DB

### Auth Migration
- [ ] Set up new auth provider
- [ ] Handle existing user migration
- [ ] Update all auth calls
- [ ] Test all auth flows

### Storage Migration
- [ ] Set up Cloudflare R2 / S3
- [ ] Migrate existing files
- [ ] Update storage service
- [ ] Update all file URLs in database

### Hosting Migration
- [ ] Set up new hosting
- [ ] Configure build pipeline
- [ ] Set up environment variables
- [ ] DNS cutover
- [ ] Monitor for issues

---

## Estimated Costs After Full Migration

| Service | Cost |
|---------|------|
| Hetzner VPS (or Railway) | $10-20/mo |
| Cloudflare R2 | $5-10/mo |
| Domain | $15/year |
| **Total** | ~$20-35/month |

**vs Current:** ~$30-50/month (after Netlify fix)
**vs Scale:** Firebase/Netlify could be $500+/month at scale

---

## When to Actually Migrate

| Signal | Action |
|--------|--------|
| Costs < $100/mo | Stay on Firebase/Netlify |
| Costs $100-200/mo | Consider R2 for storage |
| Costs $200-500/mo | Serious planning |
| Costs > $500/mo | Execute migration |
| Need specific feature | Migrate that piece |

---

## Change Log

| Date | Change |
|------|--------|
| Dec 6, 2025 | Initial plan created |
