/**
 * Commissioner Signup Component
 * Allows users to sign up as a Program Commissioner
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { signUpAsCommissioner } from '../../services/leagueService';
import { deductCredits, getUserCreditBalance } from '../../services/creditService';
import { Trophy, Users, Shield, ChevronRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SPORT_CONFIGS, getSportOptions } from '../../config/sportConfig';
import type { SportType } from '../../types';

const COMMISSIONER_SIGNUP_COST = 100; // Credits required to become a commissioner

export const CommissionerSignup: React.FC = () => {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form data
  const [programName, setProgramName] = useState('');
  const [sport, setSport] = useState<SportType>('football');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;
    
    if (!agreedToTerms) {
      setError('Please agree to the Commissioner Terms & Responsibilities');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Check credits
      const credits = await getUserCreditBalance(user.uid);
      if (credits < COMMISSIONER_SIGNUP_COST) {
        setError(`Not enough credits. You need ${COMMISSIONER_SIGNUP_COST} credits to become a commissioner. You have ${credits}.`);
        setLoading(false);
        return;
      }
      
      // Deduct credits
      const deductResult = await deductCredits(user.uid, COMMISSIONER_SIGNUP_COST, 'commissioner_signup', 'Commissioner signup fee');
      if (!deductResult.success) {
        setError(deductResult.error || 'Failed to process signup fee. Please try again.');
        setLoading(false);
        return;
      }
      
      // Create program and assign commissioner role
      await signUpAsCommissioner(user.uid, programName, sport, city, state);
      
      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/commissioner');
      }, 2000);
      
    } catch (err: any) {
      console.error('Commissioner signup error:', err);
      setError(err.message || 'Failed to complete signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome, Commissioner!</h2>
          <p className="text-gray-400 mb-4">
            Your program "{programName}" has been created successfully.
          </p>
          <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-purple-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Become a Commissioner</h1>
          <p className="text-gray-400">
            Create your program and manage teams, schedules, and more
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <ChevronRight className={`w-5 h-5 mx-1 ${
                  step > s ? 'text-purple-500' : 'text-gray-600'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-gray-800 rounded-xl p-6 md:p-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Program Info */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white mb-4">Program Information</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Program Name *
                  </label>
                  <input
                    type="text"
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    placeholder="e.g., Northside Youth Football"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sport *
                  </label>
                  <select
                    value={sport}
                    onChange={(e) => setSport(e.target.value as SportType)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {getSportOptions().map((sportOption) => (
                      <option key={sportOption.value} value={sportOption.value}>
                        {sportOption.emoji} {sportOption.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      State *
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                      maxLength={2}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                      required
                    />
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!programName || !city || !state}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Benefits & Responsibilities */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white mb-4">Commissioner Benefits</h2>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-gray-700/50 rounded-lg p-4">
                    <Users className="w-5 h-5 text-purple-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-white">Team Management</h3>
                      <p className="text-sm text-gray-400">Create and manage multiple teams under your program</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 bg-gray-700/50 rounded-lg p-4">
                    <Trophy className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-white">Schedule Control</h3>
                      <p className="text-sm text-gray-400">Create game schedules and manage seasons</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 bg-gray-700/50 rounded-lg p-4">
                    <Shield className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-white">Grievance Handling</h3>
                      <p className="text-sm text-gray-400">Review and resolve disputes between teams</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-400 mb-2">Responsibilities</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Maintain fair play and sportsmanship standards</li>
                    <li>• Respond to grievances within 48 hours</li>
                    <li>• Keep schedules and standings updated</li>
                    <li>• Manage coach and team registrations</li>
                  </ul>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white mb-4">Confirm & Submit</h2>
                
                <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Program Name</span>
                    <span className="text-white font-medium">{programName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sport</span>
                    <span className="text-white font-medium">{sport}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Location</span>
                    <span className="text-white font-medium">{city}, {state.toUpperCase()}</span>
                  </div>
                </div>
                
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Signup Fee</span>
                    <span className="text-xl font-bold text-purple-400">{COMMISSIONER_SIGNUP_COST} Credits</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    This one-time fee covers program creation and commissioner privileges
                  </p>
                </div>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">
                    I agree to the Commissioner Terms & Responsibilities and understand that I am responsible for managing my program fairly and professionally.
                  </span>
                </label>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !agreedToTerms}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Complete Signup'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Credit Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Your current balance: <span className="text-purple-400 font-medium">{userData?.credits || 0} credits</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CommissionerSignup;
