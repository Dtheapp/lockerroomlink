import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, confirmPasswordReset } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { ArrowLeft, CheckCircle, Download, Share, PlusSquare, Smartphone, X, Trophy, Users, Star, Zap, TrendingUp, Play, Eye, EyeOff } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type SignUpRole = 'Parent' | 'Coach' | 'Fan' | 'Commissioner' | 'Ref';
type CommissionerType = 'league' | 'team';

// Floating sport icons for background animation
const FloatingIcon: React.FC<{ icon: string; delay: number; duration: number; left: string; size: string }> = ({ icon, delay, duration, left, size }) => (
  <div 
    className="absolute opacity-10 pointer-events-none"
    style={{ 
      left, 
      animation: `float ${duration}s linear infinite`,
      animationDelay: `${delay}s`,
      fontSize: size
    }}
  >
    {icon}
  </div>
);

// Stats ticker component
const StatsTicker: React.FC = () => {
  const stats = [
    { label: 'Athletes', value: '10,000+', icon: '🏃' },
    { label: 'Teams', value: '500+', icon: '🏆' },
    { label: 'Games Tracked', value: '25,000+', icon: '📊' },
    { label: 'Highlights', value: '50,000+', icon: '🎬' },
  ];

  return (
    <div className="flex gap-6" style={{ animation: 'slide-left 30s linear infinite' }}>
      {[...stats, ...stats].map((stat, i) => (
        <div key={i} className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-lg">{stat.icon}</span>
          <span className="text-white font-bold">{stat.value}</span>
          <span className="text-white/60">{stat.label}</span>
        </div>
      ))}
    </div>
  );
};

const AuthScreen: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Check if URL has signup param - "Get Started Free" should open signup, not login
  const initialSignUp = searchParams.get('signup') === 'true' || searchParams.get('mode') === 'signup';
  const [isSignUp, setIsSignUp] = useState(initialSignUp);
  const [signUpRole, setSignUpRole] = useState<SignUpRole>('Parent');
  const [commissionerType, setCommissionerType] = useState<CommissionerType>('team');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [teamId, setTeamId] = useState('');
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

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);
    const dismissed = sessionStorage.getItem('installBannerDismissed');
    if (dismissed) setShowInstallBanner(false);
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const canShowInstall = !isInstalled && (deferredPrompt || (isIOS && isSafari));

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else if (isIOS && isSafari) {
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

  // Validate username format only (no DB check - that happens after auth)
  const validateUsernameFormat = (u: string) => {
    if (!/^[a-zA-Z0-9]+$/.test(u)) {
      throw new Error('Username can only contain letters and numbers.');
    }
    if (u.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    if (u.length > 20) {
      throw new Error('Username must be 20 characters or less.');
    }
    return u.trim().toLowerCase();
  };

  // Check if username is taken (only call AFTER user is authenticated)
  const checkUsernameAvailable = async (u: string) => {
    const usernameQuery = query(collection(db, 'users'), where('username', '==', u));
    const querySnapshot = await getDocs(usernameQuery);
    if (!querySnapshot.empty) {
      throw new Error(`The Username "${u}" is already taken.`);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!email || !password) throw new Error('Email and Password are required.');

      if (isSignUp) {
        if (!name) throw new Error('Full Name is required.');
        if (!username) throw new Error('Username is required.');
        
        // Validate format first (no DB call - user not authenticated yet)
        const cleanUsername = validateUsernameFormat(username);

        // Create the Firebase Auth user FIRST
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // NOW we're authenticated, so we can query the database
        try {
          // Check if username is available
          await checkUsernameAvailable(cleanUsername);
          
          let verifiedTeamId = null;
          if (signUpRole === 'Coach' && teamId) {
            const teamDoc = await getDoc(doc(db, 'teams', teamId));
            if (teamDoc.exists()) verifiedTeamId = teamId;
          }

          // Map UI role to database role
          // Commissioner type: 'team' -> TeamCommissioner, 'league' -> LeagueCommissioner
          // Ref -> Referee
          const dbRole = signUpRole === 'Commissioner' 
                       ? (commissionerType === 'team' ? 'TeamCommissioner' : 'LeagueCommissioner')
                       : signUpRole === 'Ref' ? 'Referee' 
                       : signUpRole;
          
          const userProfile: any = {
            uid: user.uid,
            name,
            email,
            role: dbRole,
            teamId: verifiedTeamId,
            username: cleanUsername,
            credits: 10,
            createdAt: serverTimestamp(),
          };
          
          if (signUpRole === 'Fan') {
            userProfile.followedAthletes = [];
            userProfile.kudosGiven = {};
            userProfile.favoriteTeams = [];
            userProfile.isBanned = false;
          }
          
          if (signUpRole === 'Commissioner') {
            userProfile.commissionerType = commissionerType;
            userProfile.commissionerSince = new Date();
          }
          
          console.log('Creating user profile with credits:', userProfile.credits, userProfile);
          await setDoc(doc(db, 'users', user.uid), userProfile);
        } catch (dbErr: any) {
          // If database operations fail, delete the auth user we just created
          console.error('Database error during signup:', dbErr);
          await user.delete();
          throw dbErr;
        }
      } else {
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true); setError(''); setSuccessMessage('');
    
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Check your email! We sent you a link to reset your password.');
    } catch (err: any) { 
      const msg = err.code === 'auth/user-not-found' 
        ? 'No account found with this email. Please sign up first.'
        : err.message;
      setError(msg); 
    } finally { setLoading(false); }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !oobCode) return;
    setLoading(true); setError('');
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccessMessage('Password Reset Successfully! Please login.');
      setTimeout(() => { setIsConfirmingReset(false); setOobCode(null); }, 2000);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const renderLoginForm = () => (
    <>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-white/70">Email</label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="your@email.com" 
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-white/70">Password</label>
        <div className="relative">
          <input 
            type={showPassword ? 'text' : 'password'}
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="••••••••" 
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 pr-12 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex justify-end mt-2">
          <button 
            type="button" 
            onClick={() => { setIsResettingPassword(true); setError(''); setSuccessMessage(''); }} 
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </>
  );

  const renderSignUpForm = () => (
    <>
      {/* Role selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white/70">I am a...</label>
        <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          {(['Parent', 'Coach', 'Fan'] as SignUpRole[]).map(role => (
            <button 
              key={role} 
              type="button" 
              onClick={() => setSignUpRole(role)} 
              className={`py-2.5 px-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                signUpRole === role 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {role === 'Parent' && '👨‍👩‍👧 '}{role === 'Coach' && '🏈 '}{role === 'Fan' && '📣 '}{role}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          {(['Commissioner', 'Ref'] as SignUpRole[]).map(role => (
            <button 
              key={role} 
              type="button" 
              onClick={() => setSignUpRole(role)} 
              className={`py-2.5 px-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                signUpRole === role 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {role === 'Commissioner' && '🏆 '}{role === 'Ref' && '🦓 '}{role}
            </button>
          ))}
        </div>
        {signUpRole === 'Fan' && (
          <p className="text-xs text-purple-400 mt-2">🎉 Follow athletes, give kudos, and engage with the community!</p>
        )}
        {signUpRole === 'Commissioner' && (
          <>
            <p className="text-xs text-purple-400 mt-2 mb-3">🏆 Manage leagues or teams and oversee your youth sports organization!</p>
            
            {/* Commissioner Type Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/70">Commissioner Type</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                <button 
                  type="button" 
                  onClick={() => setCommissionerType('team')} 
                  className={`py-3 px-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                    commissionerType === 'team' 
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg' 
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <div className="text-lg mb-1">🏈</div>
                  Team Commissioner
                </button>
                <button 
                  type="button" 
                  onClick={() => setCommissionerType('league')} 
                  className={`py-3 px-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                    commissionerType === 'league' 
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg' 
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <div className="text-lg mb-1">🏆</div>
                  League Commissioner
                </button>
              </div>
              <p className="text-xs text-white/50">
                {commissionerType === 'team' 
                  ? '👉 Create and manage individual teams within a league' 
                  : '👉 Create and manage entire leagues with multiple teams'}
              </p>
            </div>
          </>
        )}
        {signUpRole === 'Ref' && (
          <p className="text-xs text-purple-400 mt-2">🦓 Get assigned to games, manage schedules, and officiate matches!</p>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-white/70">{signUpRole === 'Fan' ? 'Display Name' : 'Full Name'}</label>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder={signUpRole === 'Coach' ? "Coach Taylor" : signUpRole === 'Fan' ? "SportsFan2024" : signUpRole === 'Commissioner' ? "Commissioner Jones" : signUpRole === 'Ref' ? "Ref Williams" : "John Smith"} 
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-white/70">{signUpRole === 'Coach' ? 'Coach ID' : signUpRole === 'Fan' ? 'Fan Handle' : signUpRole === 'Commissioner' ? 'Commissioner ID' : signUpRole === 'Ref' ? 'Ref ID' : 'Username'}</label>
        <input 
          type="text" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          placeholder={signUpRole === 'Coach' ? "CoachPrime" : signUpRole === 'Fan' ? "SuperFan23" : signUpRole === 'Commissioner' ? "CommishJones" : signUpRole === 'Ref' ? "RefWilliams" : "PapaJohn23"} 
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder-white/30 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-white/70">Email</label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="your@email.com" 
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-white/70">Password</label>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          placeholder="••••••••" 
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        />
      </div>
    </>
  );

  // Inline styles for animations
  const animationStyles = `
    @keyframes float {
      0%, 100% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
      10% { opacity: 0.1; }
      90% { opacity: 0.1; }
      100% { transform: translateY(-100px) rotate(360deg); opacity: 0; }
    }
    @keyframes slide-left {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @keyframes gradient-shift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
      50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.6); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .shimmer-text {
      background: linear-gradient(90deg, #fff 0%, #a78bfa 50%, #fff 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer 3s linear infinite;
    }
  `;

  return (
    <>
      <style>{animationStyles}</style>
      <div className="min-h-[100dvh] w-full flex bg-[#0a0a0f] overflow-hidden relative">
        
        {/* Animated gradient background */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #1a1a2e 75%, #16213e 100%)',
            backgroundSize: '400% 400%',
            animation: 'gradient-shift 8s ease infinite'
          }}
        />

        {/* Floating sport icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {['🏈', '🏀', '⚽', '🎾', '🏐', '🏆', '⭐', '🔥'].map((icon, i) => (
            <FloatingIcon 
              key={i} 
              icon={icon} 
              delay={i * 2} 
              duration={15 + i * 2} 
              left={`${10 + i * 12}%`} 
              size={`${24 + i * 4}px`}
            />
          ))}
        </div>

        {/* LEFT SIDE - Brand Story (hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative z-10">
          {/* Logo and tagline */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg" style={{ boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)' }}>
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">OSYS</span>
                </h1>
              </div>
            </div>
            <p className="text-white/70 text-sm tracking-wide font-medium">OSYS — The Operating System For Youth Sports!</p>
          </div>

          {/* Hero content */}
          <div className="space-y-8">
            <h2 className="text-5xl font-black text-white leading-tight">
              Where<br />
              <span className="shimmer-text">Champions</span><br />
              Are Made
            </h2>
            <p className="text-white/80 text-lg max-w-md">
              The complete platform for youth sports teams. Track stats, share highlights, connect with fans, and build your legacy.
            </p>
            
            {/* Feature highlights */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <TrendingUp className="w-5 h-5" />, label: 'Live Stats', desc: 'Real-time tracking' },
                { icon: <Play className="w-5 h-5" />, label: 'Highlights', desc: 'Auto-generated clips' },
                { icon: <Users className="w-5 h-5" />, label: 'Team Hub', desc: 'All-in-one platform' },
                { icon: <Star className="w-5 h-5" />, label: 'Social Media & more', desc: 'Build your following' },
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center text-purple-400">
                    {feature.icon}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{feature.label}</div>
                    <div className="text-white/70 text-xs">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats ticker */}
          <div className="overflow-hidden py-4 border-t border-white/10">
            <StatsTicker />
          </div>
        </div>

        {/* RIGHT SIDE - Auth Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative z-10">
          <div className="w-full max-w-md">
            
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">OSYS</span>
                </h1>
              </div>
              <p className="text-white/70 text-xs tracking-wide">OSYS — The Operating System For Youth Sports!</p>
            </div>

            {/* Install banner */}
            {canShowInstall && showInstallBanner && (
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-4 mb-6 shadow-lg relative">
                <button onClick={dismissInstallBanner} className="absolute top-3 right-3 text-white/60 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-sm">Get the App</h3>
                    <p className="text-white/80 text-xs">Install for the best experience</p>
                  </div>
                  <button onClick={handleInstallClick} className="bg-white text-purple-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-50 transition-colors flex items-center gap-1.5">
                    <Download className="w-4 h-4" />
                    Install
                  </button>
                </div>
              </div>
            )}

            {/* Glass card for form */}
            <div className="relative">
              {/* Glow effect */}
              <div 
                className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur-xl opacity-20"
                style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
              />
              
              <div className="relative bg-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
                
                {/* Password Reset Confirmation */}
                {isConfirmingReset && (
                  <>
                    <h2 className="text-2xl font-black text-white mb-6">Create New Password</h2>
                    <form onSubmit={handleConfirmReset} className="space-y-4">
                      {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm border border-red-500/20">{error}</div>}
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-white/70">New Password</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white focus:ring-2 focus:ring-purple-500" required />
                      </div>
                      <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50">
                        {loading ? 'Updating...' : 'Update Password'}
                      </button>
                    </form>
                  </>
                )}

                {/* Password Reset Request */}
                {!isConfirmingReset && isResettingPassword && (
                  <>
                    <h2 className="text-2xl font-black text-white mb-2">Reset Password</h2>
                    <p className="text-white/70 text-sm mb-6">Enter your email to receive a reset link.</p>
                    {successMessage ? (
                      <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl text-green-400 flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 flex-shrink-0" />
                        <span>{successMessage}</span>
                      </div>
                    ) : (
                      <form onSubmit={handleResetPassword} className="space-y-4">
                        {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm border border-red-500/20">{error}</div>}
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-white/70">Email Address</label>
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white focus:ring-2 focus:ring-purple-500" required />
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50">
                          {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                      </form>
                    )}
                    <button onClick={() => setIsResettingPassword(false)} className="w-full mt-4 flex items-center justify-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
                      <ArrowLeft className="w-4 h-4" /> Back to Sign In
                    </button>
                  </>
                )}

                {/* Main Auth Form */}
                {!isConfirmingReset && !isResettingPassword && (
                  <>
                    <h2 className="text-2xl font-black text-white mb-1">
                      {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p className="text-white/70 text-sm mb-6">
                      {isSignUp ? 'Join thousands of athletes and coaches' : 'Sign in to continue to your dashboard'}
                    </p>

                    {error && (
                      <div className="bg-red-500/10 text-red-400 p-3 rounded-xl mb-4 text-sm border border-red-500/20 text-center">
                        {error}
                      </div>
                    )}
                    
                    <form onSubmit={handleAuth} className="space-y-4">
                      {isSignUp ? renderSignUpForm() : renderLoginForm()}
                      
                      <button 
                        type="submit" 
                        disabled={loading} 
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
                        style={{ boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)' }}
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            {isSignUp ? 'Create Account' : 'Sign In'}
                            <Zap className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 text-center">
                      <button 
                        type="button" 
                        onClick={() => { setIsSignUp(!isSignUp); setError(''); }} 
                        className="text-sm text-white/70 hover:text-white transition-colors"
                      >
                        {isSignUp ? 'Already have an account? ' : 'Need an account? '}
                        <span className="text-purple-400 font-semibold hover:underline">
                          {isSignUp ? 'Sign In' : 'Sign Up'}
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Social proof */}
            <div className="mt-8 text-center">
              <p className="text-white/60 text-xs mb-3">Trusted by teams across the nation</p>
              <div className="flex justify-center items-center gap-6 opacity-40">
                {['🏈', '🏀', '⚽', '🏐', '📣'].map((emoji, i) => (
                  <span key={i} className="text-2xl">{emoji}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* iOS Install Instructions Modal */}
        {showIOSInstall && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowIOSInstall(false)}>
            <div className="w-full max-w-md bg-[#12121a] rounded-2xl p-6 border border-white/10" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">Install OSYS</h3>
                <button onClick={() => setShowIOSInstall(false)} className="text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-white/50 text-sm mb-4">To install on your iPhone/iPad:</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                    <Share className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Step 1</p>
                    <p className="text-white/50 text-xs">Tap the Share button</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center text-green-400">
                    <PlusSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Step 2</p>
                    <p className="text-white/50 text-xs">Add to Home Screen</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Step 3</p>
                    <p className="text-white/50 text-xs">Tap Add to install</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowIOSInstall(false)} className="w-full mt-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors">
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AuthScreen;
