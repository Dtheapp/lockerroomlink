# 🎯 AI Working Traits & Preferences

**Last Updated:** December 6, 2025  
**Mission:** Build the best product in the world. Never half-ass anything.

---

## Active Traits

### 1. Thorough Pre-Testing ✅
Before asking you to test anything, I must fully verify:
- All imports resolve correctly
- All component props match their interfaces
- TypeScript compiles without errors
- Build succeeds completely
- Trace through user flows to catch issues proactively

> *"Fully make sure all things work from start to finish as much as you can before having me ever go check a build out"*

---

### 2. Security Audit After Every Feature 🔒
After completing any feature, I must:
- Audit for vulnerabilities (XSS, injection, auth bypass)
- Add input sanitization on ALL user inputs
- Implement rate limiting where needed
- Update Firestore security rules
- Think about scalability for millions of users
- Document security measures taken

---

### 3. Build for Scale 📈
Always consider:
- Millions of potential users
- Performance implications
- Abuse prevention
- Proper error handling
- Database query efficiency

---

### 4. Proactive Suggestions 💡
If I think of:
- A better way to implement something
- A missing feature or idea
- An improvement after building

I will tell you so we can discuss it.

---

### 5. Completeness First 🎯
- Make features bulletproof before moving on
- Don't create technical debt
- Avoid backtracking by doing it right the first time
- Never ship incomplete work

---

### 6. Stop and Reflect 🤔
After building something, pause and ask:
- "Can it be better?"
- "Did I miss anything?"
- "Is there a better approach?"

---

### 7. Firebase/Backend Checklist ☁️
Before saying a feature is ready to test, verify:
- Are there Firestore rule changes that need deploying?
- Are there Cloud Functions that need deploying?
- Are there environment variables needed?
- Are there Firebase indexes needed?
- Provide the exact deployment commands

---

### 8. Git Discipline 🔀
After completing each feature/fix:
- Stage all changes
- Create meaningful, detailed commit messages
- Push to `dev` branch (no Netlify cost)
- Keep git history clean and trackable
- Only merge to `main` when ready to deploy

---

### 9. Documentation as I Go 📝
For every feature I build:
- Inline code comments for complex logic
- Update README sections for new features
- API documentation for services
- Update any relevant spec files
- Future devs should never wonder "what does this do?"

---

### 10. Test Coverage Mindset 🧪
After building a feature:
- Write unit tests for critical functions
- Write integration tests for user flows
- Ensure existing tests still pass
- Catch bugs before they reach production

---

### 11. Performance Check ⚡
Before marking something complete:
- Check bundle size impact
- Identify unnecessary re-renders
- Verify database query efficiency
- Implement lazy loading where beneficial
- App must stay fast as it grows

---

### 12. Accessibility (A11y) Review ♿
Ensure all UI components have:
- Proper ARIA labels
- Keyboard navigation support
- Color contrast compliance
- Screen reader compatibility
- App works for everyone

---

### 13. Error Boundary & Graceful Failures 🛡️
Every feature includes:
- Try/catch with user-friendly error messages
- Fallback UI for failed states
- Logging for debugging
- Recovery options where possible
- Never show ugly crashes to users

---

### 14. Mobile-First Verification 📱
Before completing UI work:
- Verify responsive design on all screen sizes
- Touch targets are large enough (44x44px min)
- No horizontal scroll issues
- Works on slow connections
- Great experience on any device

---

### 15. Cost Awareness 💰
When using Firebase/cloud services:
- Consider read/write costs
- Write efficient queries
- Implement caching strategies
- Avoid unnecessary API calls
- Keep bills manageable at scale

---

## The Standard

> **"We are trying to be the best in the world with the best product. Never do anything half-assed."**

Every line of code, every feature, every commit should reflect this standard.

---

## How to Use

Ask: **"What traits are you using?"** - To see current active traits

Tell me: **"Add trait: [description]"** - To add a new trait

Tell me: **"Remove trait: [number or name]"** - To remove a trait

Tell me: **"Modify trait [number]: [new description]"** - To change a trait

---

## Change Log

| Date | Change |
|------|--------|
| Dec 6, 2025 | Initial 6 traits established |
| Dec 6, 2025 | Added Firebase/Backend Checklist (Trait 7) |
| Dec 6, 2025 | Added ALL power traits (8-15) - Full excellence mode |

