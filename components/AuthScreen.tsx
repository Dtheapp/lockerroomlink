import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { UserRole, UserProfile } from '../types';

type AuthMode = 'Parent' | 'Coach' | 'Admin';

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('Parent');
  const [isSignUp, setIsSignUp] = useState(false); // Now applies to EVERYONE

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [teamId, setTeamId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    // Default: Everyone defaults to Login mode initially
    setIsSignUp(false); 
  };

  const validateUsername = async (u: string) => {
      if (!/^[a-zA-Z0-9]+$/.test(u)) {
          throw new Error('Username can only contain letters and numbers (No spaces or symbols).');
      }
      const clean = u.trim().toLowerCase();
      const q = query(collection(db, 'users'), where('username', '==', clean));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
          throw new Error(`The Username "${clean}" is already taken.`);
      }
      return clean;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
        if (!email || !password) throw new Error('Email and Password are required.');

        if (isSignUp) {
            // --- GLOBAL SIGNUP VALIDATION ---
            if (!name) throw new Error('Full Name is required.');
            if (!username) throw new Error('Username is required.');
            
            // 1. Validate Username Uniqueness (For Parents AND Coaches)
            // (Admins technically don't use username in this logic, but safe to ignore)
            let cleanUsername = '';
            if (mode !== 'Admin') {
                cleanUsername = await validateUsername(username);
            }

            // 2. Validate Team ID (Parents Only)
            let verifiedTeamId = null;
            if (mode === 'Parent') {
                if (!teamId) throw new Error('Team ID is required to join.');
                
                // Check if Team Exists
                // NOTE: We rely on the exact string match (e.g. "Tigers24")
                // If you want case-insensitive Team IDs, we need a query logic here.
                const teamDoc = await getDoc(doc(db, 'teams', teamId));
                if (!teamDoc.exists()) {
                     throw new Error('Invalid Team ID. Please check the code given by your coach.');
                }
                verifiedTeamId = teamId;
            }

            // 3. Create Account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 4. Save Profile
            const userProfile: UserProfile = {
                uid: user.uid,
                name: name,
                email: email,
                role: mode === 'Admin' ? 'SuperAdmin' : mode,
                teamId: verifiedTeamId, // Parents get ID, Coach/Admin get null
                username: mode !== 'Admin' ? cleanUsername : undefined
            };
            
            await setDoc(doc(db, 'users', user.uid), userProfile);

        } else {
            // --- LOGIN (Universal) ---
            // IMPORTANT: Check role BEFORE we fully commit to login
            const userQuerySnapshot = await getDocs(query(collection(db, 'users'), where('email', '==', email.toLowerCase())));
            
            if (!userQuerySnapshot.empty) {
                const userDoc = userQuerySnapshot.docs[0];
                const userData = userDoc.data();
                
                // Map 'Admin' tab selection to 'SuperAdmin' role for comparison
                const expectedRole = mode === 'Admin' ? 'SuperAdmin' : mode;
                
                // Verify that the user's role matches the selected tab
                if (userData.role !== expectedRole) {
                    throw new Error(`This account is registered as a ${userData.role}. Please select the correct access tab.`);
                }
            }
            
            // Now that role is verified, authenticate
            await signInWithEmailAndPassword(auth, email, password);
        }

    } catch (err: any) {
      console.error('Auth Error:', err);
      const msg = err.code === 'auth/invalid-credential' ? 'Invalid email or password.' : err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };
  
  const renderForm = () => {
     // Shared Login View (Simple)
     if (!isSignUp) {
         return (
             <>
                <div>
                    <label className="block text-sm font-medium text-slate-300">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300">Password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500" />
                </div>
             </>
         );
     }

     // Signup Views (Complex)
    switch (mode) {
      case 'Parent':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Papa John" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-300">Parent Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. PapaJohn23" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white" />
            </div>
            <div className="pt-2 border-t border-slate-700">
              <label className="block text-sm font-bold text-orange-400">Team ID (Required)</label>
              <input type="text" value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="Enter ID from coach (e.g. TIGERS24)" className="mt-1 block w-full bg-slate-800 border border-orange-500/50 rounded-md shadow-sm py-2 px-3 text-white" />
            </div>
          </>
        );
      
      case 'Coach':
        return (
          <>
             <div>
                <label className="block text-sm font-medium text-slate-300">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Coach Taylor" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-300">Coach ID (Username)</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. CoachPrime" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white" />
            </div>
          </>
        );

      case 'Admin':
         return (
             <>
             {/* Admin usually just needs email/pass, keeping name optional for structure */}
             <div>
              <label className="block text-sm font-medium text-slate-300">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 block w-full bg-zinc-900 border border-zinc-700 rounded-md shadow-sm py-2 px-3 text-white" />
            </div>
             </>
         )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-white mb-2">
          Gridiron<span className="text-orange-500">Hub</span>
        </h1>
        <p className="text-center text-slate-400 mb-6">Your Team's Digital Locker Room</p>
        
        <div className="mb-6 grid grid-cols-3 gap-2 bg-black p-1 rounded-lg border border-zinc-800">
          {(['Parent', 'Coach', 'Admin'] as AuthMode[]).map(m => (
            <button key={m} type="button" onClick={() => switchMode(m)} className={`py-2 px-3 rounded-md text-sm font-semibold transition-colors ${mode === m ? 'bg-orange-600 text-white shadow-[0_0_15px_rgba(234,88,12,0.5)]' : 'text-slate-300 hover:bg-zinc-900'}`}>{m}</button>
          ))}
        </div>
        
        {error && <p className="bg-red-500/20 text-red-400 p-3 rounded-md mb-4 text-sm border border-red-500/50">{error}</p>}
        
        <form onSubmit={handleAuth} className="space-y-6">
          {renderForm()}
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-zinc-700 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-white"></div> : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </div>
          
          <div className="text-center mt-4">
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline">
                  {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;