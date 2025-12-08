# 🚀 OSYS Production Checklist

**Last Updated:** December 8, 2025  
**Status:** Pre-Production  
**Target:** Full Production Launch

---

## 📋 Overview

This checklist tracks everything needed before going full production. Items are organized by priority and category.

**Legend:** 📁 = File Reference | 🔗 = External Link | 📖 = Documentation

---

## 🔴 CRITICAL (Must Have Before Launch)

### Environment Variables - Netlify

| Variable | Status | Notes | Reference |
|----------|--------|-------|-----------|
| `PAYPAL_CLIENT_ID` | ⬜ TODO | Get from PayPal Developer Dashboard | 🔗 [PayPal Dev](https://developer.paypal.com) |
| `PAYPAL_CLIENT_SECRET` | ⬜ TODO | Get from PayPal Developer Dashboard | 🔗 [PayPal Dev](https://developer.paypal.com) |
| `PAYPAL_MODE` | ⬜ TODO | Set to `live` for production | 📁 `netlify/functions/create-credit-order.ts` |
| `FIREBASE_PROJECT_ID` | ⬜ TODO | `gridironhub-3131` | 📁 `firebase.json` |
| `FIREBASE_SERVICE_ACCOUNT` | ⬜ TODO | Full JSON from Firebase Console | 🔗 [Firebase Console](https://console.firebase.google.com) |

**Setup Script:** 📁 `scripts/setup-netlify-env.ps1`

```powershell
# Prerequisites
npm install -g netlify-cli
netlify login
netlify link

# Then edit and run:
.\scripts\setup-netlify-env.ps1
```

### PayPal Configuration

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Create PayPal Business Account | ⬜ TODO | Required for live payments | 🔗 [PayPal Business](https://www.paypal.com/business) |
| Create Live App in Developer Dashboard | ⬜ TODO | Get API credentials | 🔗 [PayPal Dev](https://developer.paypal.com) |
| Get Live Client ID | ⬜ TODO | Copy to Netlify env | 📁 `scripts/setup-netlify-env.ps1` |
| Get Live Client Secret | ⬜ TODO | Copy to Netlify env | 📁 `scripts/setup-netlify-env.ps1` |
| Set Webhook URLs | ⬜ TODO | Point to Netlify functions | 📁 `netlify/functions/capture-credit-order.ts` |
| Test Live Payments | ⬜ TODO | Small test transaction | 📁 `components/credits/BuyCreditsModal.tsx` |

### Firebase Security

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Firestore Rules Deployed | ✅ DONE | `firebase deploy --only firestore:rules` | 📁 `firestore.rules` |
| Credit self-crediting blocked | ✅ DONE | Rules require SuperAdmin | 📁 `firestore.rules` (line ~580) |
| User credit field protection | ✅ DONE | Users can't modify own credits | 📁 `firestore.rules` (line ~95) |
| Admin audit log immutable | ✅ DONE | No update/delete on adminAuditLog | 📁 `firestore.rules` (line ~620) |
| Review all collection rules | ⬜ TODO | Final security review | 📁 `firestore.rules` |

### Authentication

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Email/Password enabled | ✅ DONE | Primary auth method | 📁 `contexts/AuthContext.tsx` |
| Email verification required | ⬜ TODO | Consider enabling | 🔗 [Firebase Auth](https://console.firebase.google.com) |
| Password requirements set | ⬜ TODO | Min length, complexity | 📁 `components/AuthScreen.tsx` |
| Rate limiting on auth | ⬜ TODO | Prevent brute force | 🔗 Firebase Console → App Check |

---

## 🟠 HIGH PRIORITY (Should Have)

### Monitoring & Error Tracking

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Sentry error tracking | ⬜ TODO | Real-time error alerts | 🔗 [Sentry.io](https://sentry.io) |
| Firebase Analytics | ⬜ TODO | User behavior tracking | 🔗 [Firebase Analytics](https://console.firebase.google.com) |
| Uptime monitoring | ⬜ TODO | Pingdom, UptimeRobot, etc. | 🔗 [UptimeRobot](https://uptimerobot.com) |
| Performance monitoring | ⬜ TODO | Core Web Vitals | 📁 `vite.config.ts` |

### Rate Limiting (Production Scale)

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| In-memory rate limiting | ✅ DONE | Works for single server | 📁 `services/creditService.ts` (line ~25-60) |
| Redis rate limiting | ⬜ TODO | For production scale | 📁 `services/creditService.ts` (RATE_LIMITS) |
| API rate limiting | ⬜ TODO | Netlify Functions | 📁 `netlify.toml` |

### Domain & SSL

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Production domain purchased | ⬜ TODO | e.g., osys.app | 🔗 [Namecheap](https://namecheap.com) |
| DNS configured | ⬜ TODO | Point to Netlify | 📁 `netlify.toml` |
| SSL certificate active | ⬜ TODO | Netlify auto-provisions | 🔗 Netlify Dashboard |
| Redirect HTTP to HTTPS | ⬜ TODO | Force secure connections | 📁 `netlify.toml` |

### Email Configuration

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Transactional email service | ⬜ TODO | SendGrid, Mailgun, etc. | 📁 `netlify/functions/send-ticket-email.ts` |
| Email templates created | ⬜ TODO | Welcome, password reset, etc. | 📁 `netlify/functions/send-ticket-email.ts` |
| SPF/DKIM/DMARC configured | ⬜ TODO | Email deliverability | 🔗 DNS provider |
| Unsubscribe links working | ⬜ TODO | CAN-SPAM compliance | 📁 `netlify/functions/send-ticket-email.ts` |

---

## 🟡 MEDIUM PRIORITY (Nice to Have)

### Performance Optimization

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Bundle size optimized | ⬜ TODO | Code splitting, tree shaking | 📁 `vite.config.ts` |
| Images optimized | ⬜ TODO | WebP, lazy loading | 📁 `components/OptimizedImage.tsx` |
| CDN configured | ✅ DONE | Netlify CDN | 📁 `netlify.toml` |
| Caching headers set | ⬜ TODO | Static assets | 📁 `netlify.toml` |

### Backup & Recovery

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Firestore backup enabled | ⬜ TODO | Daily automated backups | 🔗 [Firebase Console](https://console.firebase.google.com) |
| Point-in-time recovery | ⬜ TODO | Firebase Blaze plan | 🔗 Firebase Console → Backups |
| Disaster recovery plan | ⬜ TODO | Document procedures | 📖 Create `DISASTER_RECOVERY.md` |

### Legal & Compliance

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Privacy Policy | ⬜ TODO | COPPA compliance for youth | 📁 `components/LandingPage.tsx` (footer) |
| Terms of Service | ⬜ TODO | Legal agreement | 📁 `components/LandingPage.tsx` (footer) |
| Cookie consent | ⬜ TODO | GDPR if EU users | 📁 `App.tsx` |
| COPPA compliance | ⬜ TODO | **CRITICAL** for youth sports | 📖 [FTC COPPA](https://www.ftc.gov/coppa) |
| Data retention policy | ⬜ TODO | Document data lifecycle | 📖 Create `DATA_POLICY.md` |

### Content Moderation

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Profanity filter | ⬜ TODO | Chat/comments | 📁 `components/Chat.tsx`, `components/Messenger.tsx` |
| Report button | ⬜ TODO | User reporting system | 📁 `components/Chat.tsx` |
| Admin moderation queue | ⬜ TODO | Review flagged content | 📁 `components/admin/` |
| AI content moderation | ⬜ TODO | Automated detection | 📖 `PILOT_PREP_PLAN.md` (Phase 1B) |

---

## 🟢 LOW PRIORITY (Post-Launch)

### Testing

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Unit tests | ⬜ TODO | Jest + React Testing Library | 📁 `tests/`, `vitest.config.ts` |
| Integration tests | ⬜ TODO | API testing | 📁 `tests/` |
| E2E tests | ⬜ TODO | Playwright or Cypress | 📖 Create `e2e/` folder |
| Load testing | ⬜ TODO | Performance under stress | 📖 `LOAD_TESTING.md` |

### PWA Features

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Service worker | ⬜ TODO | Offline support | 📁 `public/` |
| App manifest | ⬜ TODO | Install prompt | 📁 `public/manifest.json` |
| Push notifications | ⬜ TODO | Engagement feature | 📁 `components/InstallPrompt.tsx` |

### App Store Submission

| Task | Status | Notes | Reference |
|------|--------|-------|-----------|
| Apple Developer Account | ⬜ TODO | $99/year | 🔗 [Apple Developer](https://developer.apple.com) |
| Google Play Developer Account | ⬜ TODO | $25 one-time | 🔗 [Google Play Console](https://play.google.com/console) |
| App icons/screenshots | ⬜ TODO | All required sizes | 📁 `public/` |
| App descriptions | ⬜ TODO | Marketing copy | 📖 `INVESTOR_DECK.md` |
| Age rating questionnaire | ⬜ TODO | Youth-focused app | 🔗 App Store Connect |

---

## 📦 Netlify Functions Status

| Function | Purpose | Status | File |
|----------|---------|--------|------|
| `create-credit-order.ts` | Create PayPal order for credits | ✅ DONE | 📁 `netlify/functions/create-credit-order.ts` |
| `capture-credit-order.ts` | Verify payment, add credits | ✅ DONE | 📁 `netlify/functions/capture-credit-order.ts` |
| `create-paypal-order.ts` | General PayPal orders | ✅ EXISTS | 📁 `netlify/functions/create-paypal-order.ts` |
| `capture-paypal-order.ts` | General payment capture | ✅ EXISTS | 📁 `netlify/functions/capture-paypal-order.ts` |
| `create-ticket-order.ts` | Event ticket purchases | ✅ EXISTS | 📁 `netlify/functions/create-ticket-order.ts` |
| `capture-ticket-order.ts` | Ticket payment capture | ✅ EXISTS | 📁 `netlify/functions/capture-ticket-order.ts` |
| `create-donation-order.ts` | Fundraising donations | ✅ EXISTS | 📁 `netlify/functions/create-donation-order.ts` |
| `process-paypal-refund.ts` | Handle refunds | ✅ EXISTS | 📁 `netlify/functions/process-paypal-refund.ts` |
| `send-ticket-email.ts` | Email ticket confirmations | ✅ EXISTS | 📁 `netlify/functions/send-ticket-email.ts` |
| `generate-wallet-pass.ts` | Apple/Google Wallet passes | ✅ EXISTS | 📁 `netlify/functions/generate-wallet-pass.ts` |
| `clone-play.ts` | Clone plays from library | ✅ EXISTS | 📁 `netlify/functions/clone-play.ts` |

---

## 🔐 Security Checklist

### Credits System Security (COMPLETED)

| Item | Reference |
|------|-----------|
| ✅ Server-side payment verification | 📁 `netlify/functions/capture-credit-order.ts` |
| ✅ Blocked client-side credit addition | 📁 `services/creditService.ts` |
| ✅ Gift sender validation (authenticatedUserId) | 📁 `services/creditService.ts` → `giftCredits()` |
| ✅ Rate limiting on gifts (10/hr, 50/day) | 📁 `services/creditService.ts` → `RATE_LIMITS` |
| ✅ Rate limiting on promo codes (5/hr, 10/day) | 📁 `services/creditService.ts` → `RATE_LIMITS` |
| ✅ Daily gift credit limits (1000/day) | 📁 `services/creditService.ts` → `GIFT_LIMITS` |
| ✅ Max gift amount per transaction (500) | 📁 `services/creditService.ts` → `GIFT_LIMITS` |
| ✅ Promo code race condition fixed (transactions) | 📁 `services/creditService.ts` → `redeemPromoCode()` |
| ✅ Fail-closed on errors | 📁 `services/creditService.ts` |
| ✅ Admin action audit logging | 📁 `services/creditService.ts` → `logAdminAction()` |
| ✅ Immutable audit log (no updates/deletes) | 📁 `firestore.rules` → `adminAuditLog` |

### General Security

| Item | Reference |
|------|-----------|
| ✅ Firestore rules deployed | 📁 `firestore.rules` |
| ✅ User can't modify own credit fields | 📁 `firestore.rules` (line ~95) |
| ⬜ HTTPS enforced | 📁 `netlify.toml` |
| ⬜ Security headers configured | 📁 `netlify.toml` → `[[headers]]` |
| ⬜ XSS protection | 📁 `netlify.toml` → Content-Security-Policy |
| ⬜ CSRF protection | 📁 `netlify/functions/*.ts` |
| ⬜ Input validation on all forms | 📁 `components/**/*.tsx` |
| ✅ SQL injection N/A (Firestore) | N/A

---

## 🚀 Launch Day Checklist

### Pre-Launch (1 Week Before)

| Task | Reference |
|------|-----------|
| ⬜ All CRITICAL items complete | 📖 See above |
| ⬜ Staging environment tested | 🔗 Netlify Deploy Previews |
| ⬜ Load testing passed | 📖 `LOAD_TESTING.md` |
| ⬜ Security audit passed | 📖 `AUDIT_REPORT.md` |
| ⬜ Backup procedures tested | 🔗 Firebase Console |

### Launch Day

| Task | Reference |
|------|-----------|
| ⬜ DNS propagation complete | 🔗 DNS provider |
| ⬜ SSL working | 🔗 Netlify Dashboard |
| ⬜ All payment flows tested | 📁 `components/credits/BuyCreditsModal.tsx` |
| ⬜ Monitoring dashboards ready | 🔗 Sentry, Firebase Analytics |
| ⬜ Support channels ready | 📁 `components/Chat.tsx` |
| ⬜ Rollback plan documented | 📖 Create `ROLLBACK.md` |

### Post-Launch (First 48 Hours)

| Task | Reference |
|------|-----------|
| ⬜ Monitor error rates | 🔗 Sentry Dashboard |
| ⬜ Monitor payment success rates | 🔗 PayPal Dashboard |
| ⬜ Monitor server performance | 🔗 Netlify Analytics |
| ⬜ Respond to user issues | 📁 `components/admin/` |
| ⬜ Check analytics data | 🔗 Firebase Analytics |

---

## 📞 Support & Contacts

| Role | Contact | Notes |
|------|---------|-------|
| Firebase Support | 🔗 [Firebase Console](https://console.firebase.google.com) | Support tickets |
| Netlify Support | 🔗 [Netlify Dashboard](https://app.netlify.com) | Support tickets |
| PayPal Support | 🔗 [PayPal Business](https://www.paypal.com/business) | Merchant support |
| Domain Registrar | TBD | DNS issues |

---

## 📝 Quick Commands

```bash
# Build and verify
npm run build

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy to Netlify (preview)
netlify deploy

# Deploy to Netlify (production)
netlify deploy --prod

# Check Netlify env vars
netlify env:list

# Set Netlify env var
netlify env:set VAR_NAME "value" --context production
```

---

## 🗂️ Related Documentation

| Document | Purpose |
|----------|---------|
| 📖 `SETUP_GUIDE.md` | Initial setup and configuration |
| 📖 `AUDIT_REPORT.md` | Security audit findings |
| 📖 `LOAD_TESTING.md` | Performance testing guide |
| 📖 `PILOT_PREP_PLAN.md` | Pilot program phases |
| 📖 `MIGRATION_PLAN.md` | Data migration procedures |
| 📖 `AI_TRAINER.md` | AI training and context |
| 📖 `INVESTOR_DECK.md` | Business documentation |

---

## 📊 Progress Summary

| Category | Complete | Total | Progress |
|----------|----------|-------|----------|
| Critical | 4 | 9 | 44% |
| High Priority | 1 | 12 | 8% |
| Medium Priority | 1 | 15 | 7% |
| Low Priority | 0 | 10 | 0% |
| **Overall** | **6** | **46** | **13%** |

---

*Last security audit: December 8, 2025*  
*Last build verification: December 8, 2025*
