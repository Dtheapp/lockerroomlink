import React, { useState } from 'react';
import { updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Key, Eye, EyeOff, Mail, Check, Shield, User, Sparkles } from 'lucide-react';

interface ReleasedPlayerSetupProps {
  onComplete: () => void;
  playerName: string;
}

const ReleasedPlayerSetup: React.FC<ReleasedPlayerSetupProps> = ({ onComplete, playerName }) => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'password' | 'email' | 'newPassword'>('password');

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const validateEmail = (email: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const checkEmailAvailable = async (email: string): Promise<boolean> => {
    const usersQuery = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
    const snapshot = await getDocs(usersQuery);
    return snapshot.empty;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Step 1: Verify current (parent's) password
    if (step === 'password') {
      if (!currentPassword.trim()) {
        setError('Please enter your parent\'s password');
        return;
      }

      setSaving(true);
      try {
        if (!user || !user.email) {
          throw new Error('User not found');
        }

        // Re-authenticate with current password to verify
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        // Password verified, move to email step
        setStep('email');
      } catch (err: any) {
        console.error('Auth error:', err);
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError('Password is incorrect. Use the password your parent used.');
        } else {
          setError(err.message || 'Failed to verify password');
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    // Step 2: Set new email
    if (step === 'email') {
      const emailError = validateEmail(newEmail);
      if (emailError) {
        setError(emailError);
        return;
      }

      setSaving(true);
      try {
        // Check if email is already in use
        const isAvailable = await checkEmailAvailable(newEmail);
        if (!isAvailable) {
          setError('This email is already in use. Please use a different email.');
          setSaving(false);
          return;
        }

        // Move to password step
        setStep('newPassword');
      } catch (err: any) {
        setError(err.message || 'Failed to verify email');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Step 3: Set new password and complete
    if (step === 'newPassword') {
      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (newPassword === currentPassword) {
        setError('New password must be different from the previous password');
        return;
      }

      setSaving(true);
      try {
        if (!user) {
          throw new Error('User not found');
        }

        // Re-authenticate again before making changes
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // NOTE: Firebase requires email verification before changing auth email.
        // For now, we skip updating Firebase Auth email and just store the player's
        // preferred email in Firestore. They continue to log in with their username.
        // TODO (PRODUCTION): Enable email verification flow or use Admin SDK to change email
        // See: https://firebase.google.com/docs/auth/web/manage-users#update_a_users_email_address
        
        // Skip: await updateEmail(user, newEmail.toLowerCase());
        // The player will continue using username@player.osys.team for Firebase Auth
        // but their preferred email is stored in Firestore for communication

        // Update password
        await updatePassword(user, newPassword);

        // Update user profile in Firestore with their real email
        // The email field is what shows on profile - set it to their entered email
        await updateDoc(doc(db, 'users', user.uid), {
          email: newEmail.toLowerCase(), // Their real email for profile display
          authEmail: user.email, // Keep the @player.osys.team for auth reference
          forceAccountSetup: false,
          accountSetupCompletedAt: new Date()
        });

        onComplete();
      } catch (err: any) {
        console.error('Setup error:', err);
        if (err.code === 'auth/email-already-in-use') {
          setError('This email is already in use');
          setStep('email');
        } else if (err.code === 'auth/requires-recent-login') {
          setError('Session expired. Please refresh and try again.');
        } else if (err.code === 'auth/weak-password') {
          setError('Password is too weak. Please choose a stronger password.');
        } else if (err.code === 'auth/operation-not-allowed') {
          // Email verification required - skip for now, just update password
          setError('Email change requires verification. Contact support if needed.');
        } else {
          setError(err.message || 'Failed to complete setup. Please try again.');
        }
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-purple-950 to-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-orange-500 rounded-2xl mb-4 shadow-lg shadow-purple-500/30">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Welcome, {playerName}!</h1>
          <p className="text-white/60">Your parent has released your account. Let's set up your own login.</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step === 'password' ? 'bg-purple-500 text-white' : 'bg-green-500 text-white'
          }`}>
            {step === 'password' ? '1' : <Check className="w-4 h-4" />}
          </div>
          <div className={`w-12 h-1 ${step !== 'password' ? 'bg-green-500' : 'bg-white/20'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step === 'email' ? 'bg-purple-500 text-white' : step === 'newPassword' ? 'bg-green-500 text-white' : 'bg-white/20 text-white/50'
          }`}>
            {step === 'newPassword' ? <Check className="w-4 h-4" /> : '2'}
          </div>
          <div className={`w-12 h-1 ${step === 'newPassword' ? 'bg-purple-500' : 'bg-white/20'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step === 'newPassword' ? 'bg-purple-500 text-white' : 'bg-white/20 text-white/50'
          }`}>
            3
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Step 1: Verify Parent Password */}
            {step === 'password' && (
              <>
                <div className="text-center mb-4">
                  <Key className="w-12 h-12 text-purple-400 mx-auto mb-2" />
                  <h2 className="text-xl font-bold text-white">Verify Access</h2>
                  <p className="text-white/60 text-sm">Enter the password your parent used</p>
                </div>
                
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-white/70">Parent's Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 pr-12 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Set New Email */}
            {step === 'email' && (
              <>
                <div className="text-center mb-4">
                  <Mail className="w-12 h-12 text-purple-400 mx-auto mb-2" />
                  <h2 className="text-xl font-bold text-white">Your Email</h2>
                  <p className="text-white/60 text-sm">Enter YOUR email address for your account</p>
                </div>
                
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-white/70">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                </div>
              </>
            )}

            {/* Step 3: Set New Password */}
            {step === 'newPassword' && (
              <>
                <div className="text-center mb-4">
                  <Shield className="w-12 h-12 text-purple-400 mx-auto mb-2" />
                  <h2 className="text-xl font-bold text-white">Create Password</h2>
                  <p className="text-white/60 text-sm">Choose a strong password for your account</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-white/70">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 pr-12 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-white/70">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 pr-12 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Requirements */}
                  <div className="bg-white/5 rounded-lg p-3 text-xs text-white/60 space-y-1">
                    <p className={newPassword.length >= 8 ? 'text-green-400' : ''}>• At least 8 characters</p>
                    <p className={/[A-Z]/.test(newPassword) ? 'text-green-400' : ''}>• One uppercase letter</p>
                    <p className={/[a-z]/.test(newPassword) ? 'text-green-400' : ''}>• One lowercase letter</p>
                    <p className={/[0-9]/.test(newPassword) ? 'text-green-400' : ''}>• One number</p>
                  </div>
                </div>
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : step === 'newPassword' ? (
                <>
                  <Check className="w-5 h-5" />
                  Complete Setup
                </>
              ) : (
                'Continue'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-6">
          Your account will be independent from your parent's account after setup.
        </p>
      </div>
    </div>
  );
};

export default ReleasedPlayerSetup;
