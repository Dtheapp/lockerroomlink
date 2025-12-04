import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, confirmPasswordReset } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { UserProfile } from '../types';
import { Mail, ArrowLeft, CheckCircle, Lock, Download, Share, PlusSquare, Smartphone, X } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type AuthMode = 'Parent' | 'Coach' | 'Admin';
const ADMIN_MODE: AuthMode = 'Admin';
const COACH_MODE: AuthMode = 'Coach';
const PARENT_MODE: AuthMode = 'Parent';

const AuthScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('Parent');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [teamId, setTeamId] = useState(''); // Only used for Coach signup now
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState(''); 
  const [loading, setLoading] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSInstall, setShowIOSInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(true);

  // Check if already installed as PWA
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);
    
    // Check if user dismissed banner before (for this session only)
    const dismissed = sessionStorage.getItem('installBannerDismissed');
    if (dismissed) setShowInstallBanner(false);
  }, []);

  // Listen for Android/Chrome install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const canShowInstall = !isInstalled && (deferredPrompt || (isIOS && isSafari));

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Android/Chrome - trigger native prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS && isSafari) {
      // iOS - show instructions
      setShowIOSInstall(true);
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('installBannerDismissed', 'true');
  };

  useEffect(() => {
      const mode = searchParams.get('mode');
      const code = searchParams.get('oobCode');
      if (mode === 'resetPassword' && code) {
          setOobCode(code);
          setIsConfirmingReset(true);
      }
  }, [searchParams]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
    setIsSignUp(false); 
    setIsResettingPassword(false);
  };

  const validateUsername = async (u: string) => {
      if (!/^[a-zA-Z0-9]+$/.test(u)) {
          throw new Error('Username can only contain letters and numbers.');
      }
      const clean = u.trim().toLowerCase();
      const usernameQuery = query(collection(db, 'users'), where('username', '==', clean));
      const querySnapshot = await getDocs(usernameQuery);
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
            // SECURITY FIX: Prevent Admin Sign Up via UI
            if (mode === 'Admin') {
                throw new Error('Admin accounts cannot be created publicly.');
            }

            // --- SIGN UP LOGIC ---
            if (!name) throw new Error('Full Name is required.');
            if (!username) throw new Error('Username is required.');
            
            const cleanUsername = await validateUsername(username);

            // Parents no longer need teamId during signup - they'll add players with teamIds later
            let verifiedTeamId = null;
            if (mode === COACH_MODE) {
                // Coaches can optionally provide a teamId during signup, or create one later
                // This allows flexibility - we'll keep it optional for now
                if (teamId) {
                    const teamDoc = await getDoc(doc(db, 'teams', teamId));
                    if (teamDoc.exists()) {
                        verifiedTeamId = teamId;
                    }
                }
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userProfile: any = {
                uid: user.uid,
                name,
                email,
                role: mode,
                teamId: verifiedTeamId, // null for Parents, optional for Coaches
                username: cleanUsername
            };
            
            await setDoc(doc(db, 'users', user.uid), userProfile);

        } else {
            // --- SIGN IN LOGIC ---
            // Sign in first, then verify role after authentication
            await signInWithEmailAndPassword(auth, email, password);
            
            // POST-LOGIN: Verify role matches selected tab
            const currentUser = auth.currentUser;
            if (currentUser) {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    const actualRole = userData.role;
                    const targetRole = mode === 'Admin' ? 'SuperAdmin' : mode;
                    
                    // Check role mismatch
                    if (actualRole) {
                        let roleMismatch = false;
                        if (mode === 'Admin') {
                            if (actualRole !== 'SuperAdmin' && actualRole !== 'Admin') {
                                roleMismatch = true;
                            }
                        } else if (actualRole !== targetRole) {
                            roleMismatch = true;
                        }
                        
                        if (roleMismatch) {
                            // Sign out and show error
                            await auth.signOut();
                            throw new Error(`This account is registered as a ${actualRole}. Please select the correct access tab.`);
                        }
                    }
                }
            }
        }

    } catch (err: any) {
      console.error('Auth Error:', err);
      const msg = err.code === 'auth/invalid-credential' ? 'Invalid email or password.' : err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) { setError('Please enter your email address.'); return; }
      setLoading(true); setError(''); setSuccessMessage('');
      
      try {
          const actionCodeSettings = { url: window.location.href, handleCodeInApp: true };
          await sendPasswordResetEmail(auth, email, actionCodeSettings);
          setSuccessMessage('Check your email! We sent you a link to reset your password.');
      } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }

  const handleConfirmReset = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPassword || !oobCode) return;
      setLoading(true); setError('');
      try {
          await confirmPasswordReset(auth, oobCode, newPassword);
          setSuccessMessage('Password Reset Successfully! Please login.');
          setTimeout(() => { setIsConfirmingReset(false); setOobCode(null); }, 2000);
      } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }
  
  const getButtonText = () => {
      if (loading) return null;
      if (mode === PARENT_MODE) return isSignUp ? 'Join Team' : 'Sign In';
      return isSignUp ? 'Create Account' : 'Sign In';
  };

  const renderForm = () => {
     if (!isSignUp) {
         return (
             <>
               <div><label className="block text-sm font-medium text-zinc-400 mb-1">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500" /></div>
               <div>
                   <label className="block text-sm font-medium text-zinc-400 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                   <div className="flex justify-end mt-2"><button type="button" onClick={() => { setIsResettingPassword(true); setError(''); setSuccessMessage(''); }} className="text-xs text-zinc-500 hover:text-orange-400">Forgot Password?</button></div>
               </div>
             </>
         );
     }
    switch (mode) {
      case 'Parent': return (
          <>
            <div><label className="block text-sm font-medium text-zinc-400 mb-1">Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Papa John" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white focus:ring-orange-500" /></div>
            <div><label className="block text-sm font-medium text-zinc-400 mb-1">Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. PapaJohn23" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white font-mono focus:ring-orange-500" /></div>
            <div><label className="block text-sm font-medium text-zinc-400 mb-1">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white focus:ring-orange-500" /></div>
            <div><label className="block text-sm font-medium text-zinc-400 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white focus:ring-orange-500" /></div>
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 italic">You'll add your players and their teams after signing up</p>
            </div>
          </>
      );
      case 'Coach': return (
          <>
             <div><label className="block text-sm font-medium text-zinc-400 mb-1">Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Coach Taylor" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white focus:ring-orange-500" /></div>
             <div><label className="block text-sm font-medium text-zinc-400 mb-1">Coach ID (Username)</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. CoachPrime" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white font-mono focus:ring-orange-500" /></div>
             <div><label className="block text-sm font-medium text-zinc-400 mb-1">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white focus:ring-orange-500" /></div>
             <div><label className="block text-sm font-medium text-zinc-400 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm py-3 px-4 text-white focus:ring-orange-500" /></div>
          </>
      );
      // SECURITY FIX: Removed Admin Sign Up Inputs
      case 'Admin': return null; 
    }
  }

  // --- RENDER ---
  // UX FIX: Changed min-h-screen to min-h-[100dvh] and added overflow-y-auto to prevent mobile keyboard issues
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-black p-4 font-sans overflow-y-auto">
      
      {/* RESET PASSWORD CONFIRMATION */}
      {isConfirmingReset && (
        <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-8 relative overflow-hidden my-auto">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>
                <h2 className="text-2xl font-black text-white mb-4">Create New Password</h2>
                <form onSubmit={handleConfirmReset} className="space-y-4">
                    {error && <p className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm border border-red-500/20">{error}</p>}
                    <div><label className="block text-sm font-medium text-zinc-400 mb-1">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:ring-orange-500" required /></div>
                    <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">{loading ? 'Updating...' : 'Update Password'}</button>
                </form>
        </div>
      )}

      {/* RESET PASSWORD REQUEST */}
      {!isConfirmingReset && isResettingPassword && (
        <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-8 relative overflow-hidden animate-in fade-in zoom-in duration-300 my-auto">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>
                <h2 className="text-2xl font-black text-white mb-2">Reset Password</h2>
                <p className="text-zinc-500 text-sm mb-6">Enter your email to receive a reset link.</p>
                {successMessage ? (
                    <div className="bg-green-900/20 border border-green-900/50 p-4 rounded-lg text-green-400 mb-6 flex items-center gap-3"><CheckCircle className="w-6 h-6" /><span>{successMessage}</span></div>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        {error && <p className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm border border-red-500/20">{error}</p>}
                        <div><label className="block text-sm font-medium text-zinc-400 mb-1">Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:ring-orange-500" required /></div>
                        <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">{loading ? 'Sending...' : 'Send Reset Link'}</button>
                    </form>
                )}
                <button onClick={() => setIsResettingPassword(false)} className="w-full mt-4 flex items-center justify-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm"><ArrowLeft className="w-4 h-4" /> Back to Sign In</button>
        </div>
      )}

      {/* MAIN AUTH FORM */}
      {!isConfirmingReset && !isResettingPassword && (
        <div className="w-full max-w-md my-auto">
          
          {/* INSTALL APP BANNER */}
          {canShowInstall && showInstallBanner && (
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl p-4 mb-4 shadow-lg relative">
              <button 
                onClick={dismissInstallBanner}
                className="absolute top-2 right-2 text-white/60 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-sm">Get the App Experience</h3>
                  <p className="text-white/80 text-xs">Install LockerRoom for quick access</p>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="bg-white text-orange-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-50 transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Install
                </button>
              </div>
            </div>
          )}

          {/* iOS INSTALL INSTRUCTIONS MODAL */}
          {showIOSInstall && (
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowIOSInstall(false)}>
              <div 
                className="w-full max-w-md bg-zinc-900 rounded-2xl p-6 border border-zinc-800 animate-slide-up"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-lg">Install LockerRoom</h3>
                  <button onClick={() => setShowIOSInstall(false)} className="text-zinc-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-zinc-400 text-sm mb-4">To install on your iPhone/iPad:</p>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Share className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Step 1</p>
                      <p className="text-zinc-400 text-xs">Tap the <strong className="text-blue-400">Share</strong> button at the bottom of Safari</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <PlusSquare className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Step 2</p>
                      <p className="text-zinc-400 text-xs">Scroll down and tap <strong className="text-green-400">"Add to Home Screen"</strong></p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-3">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Step 3</p>
                      <p className="text-zinc-400 text-xs">Tap <strong className="text-orange-400">"Add"</strong> to install</p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowIOSInstall(false)}
                  className="w-full mt-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          )}

        <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-8 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>
          <h1 className="text-3xl font-black tracking-tighter text-center text-white mb-2">LOCKER<span className="text-orange-500">ROOM</span></h1>
          <p className="text-center text-zinc-500 mb-8 text-sm uppercase tracking-widest font-bold">Digital Locker Room</p>
          
          <div className="mb-8 grid grid-cols-3 gap-2 bg-black p-1 rounded-xl border border-zinc-800">
            {(['Parent', 'Coach', 'Admin'] as AuthMode[]).map(m => (
              <button key={m} type="button" onClick={() => switchMode(m)} className={`py-2 px-3 rounded-lg text-sm font-bold transition-all duration-200 ${mode === m ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>{m}</button>
            ))}
          </div>

          {error && <p className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-6 text-sm border border-red-500/20 text-center font-medium">{error}</p>}
          
          <form onSubmit={handleAuth} className="space-y-5">
            {renderForm()}
            <div className="pt-2">
              <button type="submit" disabled={loading} className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-[0_0_20px_rgba(234,88,12,0.3)] text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-zinc-700 disabled:cursor-not-allowed transition-all uppercase tracking-wide">
                {loading ? <div className="w-5 h-5 border-2 border-zinc-900 border-t-white rounded-full animate-spin"></div> : getButtonText()}
              </button>
            </div>
            
            {/* SECURITY FIX: Do not show Sign Up toggle for Admins */}
            {mode !== 'Admin' && (
                <div className="text-center mt-6">
                    <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-zinc-400 hover:text-white transition-colors hover:underline">
                        {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                    </button>
                </div>
            )}
          </form>
        </div>
        </div>
      )}
    </div>
  );
};

export default AuthScreen;