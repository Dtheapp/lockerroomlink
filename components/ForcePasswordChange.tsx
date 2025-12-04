import React, { useState } from 'react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Key, Eye, EyeOff, AlertTriangle, Check, Shield } from 'lucide-react';

interface ForcePasswordChangeProps {
  onComplete: () => void;
}

const ForcePasswordChange: React.FC<ForcePasswordChangeProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword.trim()) {
      setError('Please enter your current (temporary) password');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from temporary password');
      return;
    }

    setSaving(true);

    try {
      if (!user || !user.email) {
        throw new Error('User not found');
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update the password
      await updatePassword(user, newPassword);

      // Remove the mustChangePassword flag from Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        mustChangePassword: false
      });

      onComplete();
    } catch (err: any) {
      console.error('Password change error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Current password is incorrect');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('Session expired. Please log out and log back in, then try again.');
      } else {
        setError(err.message || 'Failed to change password. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4 z-[100]">
      <div className="bg-zinc-950 border border-orange-500/30 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-orange-900/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center">Welcome!</h1>
          <p className="text-slate-400 text-center mt-2">
            For your security, please set a new password to continue.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Temporary Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-black p-3 pr-10 rounded-lg border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter the password you were given"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black p-3 pr-10 rounded-lg border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Create your new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Password Requirements */}
            <div className="mt-2 space-y-1">
              <p className={`text-xs flex items-center gap-1 ${newPassword.length >= 8 ? 'text-green-400' : 'text-slate-500'}`}>
                {newPassword.length >= 8 ? <Check className="w-3 h-3" /> : <span className="w-3 h-3">•</span>}
                At least 8 characters
              </p>
              <p className={`text-xs flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                {/[A-Z]/.test(newPassword) ? <Check className="w-3 h-3" /> : <span className="w-3 h-3">•</span>}
                One uppercase letter
              </p>
              <p className={`text-xs flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                {/[a-z]/.test(newPassword) ? <Check className="w-3 h-3" /> : <span className="w-3 h-3">•</span>}
                One lowercase letter
              </p>
              <p className={`text-xs flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'}`}>
                {/[0-9]/.test(newPassword) ? <Check className="w-3 h-3" /> : <span className="w-3 h-3">•</span>}
                One number
              </p>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black p-3 pr-10 rounded-lg border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Re-enter your new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Passwords do not match
              </p>
            )}
            {confirmPassword && newPassword === confirmPassword && newPassword.length > 0 && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Passwords match
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-900/30"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Key className="w-5 h-5" />
                Set New Password
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <p className="text-xs text-slate-500 text-center mt-4">
          This is a one-time security step. You won't be asked again.
        </p>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
