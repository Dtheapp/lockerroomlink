# 🚀 GridironHub - Setup Guide

## Quick Start (3 Steps)

### 1️⃣ Install Dependencies
```bash
npm install
```

### 2️⃣ Create Environment File
Create a file named `.env` in the project root with your Firebase credentials:

```bash
# .env
VITE_API_KEY=your-firebase-api-key
VITE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_PROJECT_ID=your-project-id
VITE_STORAGE_BUCKET=your-project.appspot.com
VITE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_APP_ID=your-app-id
```

**Where to find these values:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click ⚙️ Settings → Project Settings
4. Scroll down to "Your apps"
5. Click on the Web app (</>) or create one
6. Copy the config values from the Firebase SDK snippet

### 3️⃣ Start Development Server
```bash
npm run dev
```

Your app will be running at: **http://localhost:3000**

---

## 🔥 Firebase Setup

### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "gridironhub")
4. Disable Google Analytics (optional)
5. Click "Create project"

### Enable Authentication
1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password**
3. (Optional) Enable **Google** sign-in

### Create Firestore Database
1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose "Start in **test mode**" (for development)
4. Select your region
5. Click "Enable"

### Configure Security Rules (IMPORTANT!)

Replace the default Firestore rules with these:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'SuperAdmin';
    }
    
    // Teams collection
    match /teams/{teamId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['SuperAdmin', 'Coach'];
      
      // Team subcollections
      match /{subCollection}/{docId} {
        allow read: if request.auth != null;
        allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['SuperAdmin', 'Coach'];
      }
    }
    
    // Private chats
    match /private_chats/{chatId} {
      allow read, write: if request.auth != null && 
                           request.auth.uid in resource.data.participants;
      
      match /messages/{messageId} {
        allow read: if request.auth != null && 
                      request.auth.uid in get(/databases/$(database)/documents/private_chats/$(chatId)).data.participants;
        allow write: if request.auth != null && 
                       request.auth.uid in get(/databases/$(database)/documents/private_chats/$(chatId)).data.participants;
      }
    }
  }
}
```

---

## 👤 Create First Admin User

### Option 1: Using Firebase Console (Recommended)
1. Go to **Authentication** → **Users**
2. Click "Add user"
3. Enter email and password
4. Click "Add user"
5. Go to **Firestore Database**
6. Create a new document in the `users` collection:
   - Document ID: (use the UID from Authentication)
   - Fields:
     ```
     uid: "the-user-uid"
     name: "Admin Name"
     role: "SuperAdmin"
     email: "admin@example.com"
     teamId: null
     ```

### Option 2: Sign Up Through App
1. Start the app (`npm run dev`)
2. Sign up as a Coach
3. Go to Firebase Console → Firestore → `users` collection
4. Find your user document
5. Change the `role` field from "Coach" to "SuperAdmin"
6. Refresh the app - you'll now have admin access

---

## 📁 Firestore Database Structure

Your Firestore database will have this structure:

```
📂 users/
  └─ {userId}/
     ├─ uid: string
     ├─ name: string
     ├─ email: string
     ├─ role: "SuperAdmin" | "Coach" | "Parent"
     ├─ teamId: string | null
     ├─ phone?: string
     ├─ address?: string
     └─ emergencyContact?: {...}

📂 teams/
  └─ {teamId}/
     ├─ name: string
     ├─ coachId: string
     ├─ record?: { wins, losses, ties }
     │
     ├─ 📂 players/
     │  └─ {playerId}/
     │     ├─ name: string
     │     ├─ number: number
     │     ├─ position: string
     │     ├─ parentId?: string
     │     └─ stats: { td, tkl }
     │
     ├─ 📂 messages/
     │  └─ {messageId}/
     │     ├─ text: string
     │     ├─ sender: { uid, name }
     │     └─ timestamp: Timestamp
     │
     ├─ 📂 bulletin/
     │  └─ {postId}/
     │     ├─ text: string
     │     ├─ author: string
     │     └─ timestamp: Timestamp
     │
     ├─ 📂 events/
     │  └─ {eventId}/
     │     ├─ title: string
     │     ├─ date: string
     │     ├─ time: string
     │     ├─ type: "Practice" | "Game" | "Other"
     │     └─ location: string
     │
     ├─ 📂 plays/
     │  └─ {playId}/
     │     ├─ name: string
     │     ├─ category: "Offense" | "Defense" | "Special Teams"
     │     ├─ elements: []
     │     └─ routes: []
     │
     ├─ 📂 videos/
     │  └─ {videoId}/
     │     ├─ title: string
     │     ├─ url: string
     │     └─ youtubeId: string
     │
     └─ 📂 playerStats/
        └─ {statId}/
           ├─ playerName: string
           ├─ playerNumber: number
           ├─ gp: number (games played)
           ├─ tds: number (touchdowns)
           ├─ yards: number
           ├─ rec: number (receptions)
           ├─ tackles: number
           ├─ sacks: number
           ├─ int: number (interceptions)
           ├─ ff: number (forced fumbles)
           └─ spts: number (sportsmanship)

📂 private_chats/
  └─ {chatId}/
     ├─ participants: [userId1, userId2]
     ├─ participantData: {...}
     ├─ lastMessage: string
     └─ lastMessageTime: Timestamp
     │
     └─ 📂 messages/
        └─ {messageId}/
           ├─ text: string
           ├─ senderId: string
           └─ timestamp: Timestamp
```

---

## 🛠️ Available Scripts

```bash
# Development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🎭 User Roles & Permissions

### SuperAdmin
- Access to admin panel (`/admin`)
- Manage all teams and users
- Assign users to teams
- View reports and analytics
- Full CRUD on everything

### Coach
- Manage team roster (add/edit/delete players)
- Edit playbook
- Post to bulletin board
- Add team events
- Edit player stats
- View and message parents
- Upload videos

### Parent
- View team roster
- View playbook (read-only)
- View bulletin board
- View team events
- View player stats (read-only)
- Message coaches
- Manage own profile
- Add/manage linked athletes

---

## 🐛 Troubleshooting

### "Firebase: Error (auth/invalid-api-key)"
- Check that your `.env` file exists
- Verify all Firebase credentials are correct
- Restart the dev server (`npm run dev`)

### "Missing or insufficient permissions"
- Update your Firestore Security Rules (see above)
- Ensure your user has the correct `role` in Firestore

### "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Page won't load / blank screen
- Open browser console (F12) to see errors
- Check that Firebase is properly initialized
- Verify your `.env` file has all required variables

### Changes not reflecting
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Clear browser cache
- Restart dev server

---

## 🔒 Security Best Practices

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Use environment variables** - Never hardcode credentials
3. **Configure Firestore rules** - Don't leave in test mode for production
4. **Enable Firebase App Check** - Protect against abuse
5. **Regular security audits** - Review Firebase console security tab

---

## 📱 Testing on Mobile

### Using your phone on the same network:
1. Find your computer's local IP address:
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

2. Note the IPv4 address (e.g., `192.168.1.100`)

3. On your phone's browser, go to:
   ```
   http://192.168.1.100:3000
   ```

---

## 🚀 Deployment

### Deploy to Firebase Hosting (Recommended)

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase Hosting:
   ```bash
   firebase init hosting
   ```
   - Choose your Firebase project
   - Set public directory: `dist`
   - Configure as single-page app: `Yes`
   - Don't overwrite `index.html`

4. Build and deploy:
   ```bash
   npm run build
   firebase deploy
   ```

Your app will be live at: `https://your-project-id.web.app`

### Other Deployment Options
- **Vercel:** `vercel --prod`
- **Netlify:** Drag `dist` folder to Netlify
- **AWS Amplify:** Connect Git repository

---

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

---

## ✅ Checklist

Before going live:
- [ ] `.env` file created with valid Firebase credentials
- [ ] Firebase Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] Firestore Security Rules configured
- [ ] First SuperAdmin user created
- [ ] App tested in browser
- [ ] Mobile responsiveness tested
- [ ] All features working as expected
- [ ] Production build tested (`npm run build && npm run preview`)

---

**Need help?** Check the `AUDIT_REPORT.md` for detailed code analysis.

**Happy coaching! 🏈**

