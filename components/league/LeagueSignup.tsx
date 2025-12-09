/**
 * League Signup Component
 * Allows users to create and become owner of a new League
 * Costs 100 credits to create a league
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createLeague } from '../../services/leagueService';
import { deductCredits, getUserCreditBalance } from '../../services/creditService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
  Trophy, MapPin, Building2, Shield, ChevronRight, Loader2, 
  AlertCircle, CheckCircle2, DollarSign, Users, Globe, Lock
} from 'lucide-react';
import { SPORT_CONFIGS, getSportOptions } from '../../config/sportConfig';
import type { SportType, League } from '../../types';

const LEAGUE_CREATE_COST = 100; // Credits required to create a league

export const LeagueSignup: React.FC = () => {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  
  // Form data
  const [leagueName, setLeagueName] = useState('');
  const [sport, setSport] = useState<SportType>('football');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Load credit balance on mount
  React.useEffect(() => {
    const loadBalance = async () => {
      if (user?.uid) {
        const balance = await getUserCreditBalance(user.uid);
        setCreditBalance(balance);
      }
    };
    loadBalance();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;
    
    if (!agreedToTerms) {
      setError('Please agree to the League Owner Terms & Responsibilities');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Check credits
      const credits = await getUserCreditBalance(user.uid);
      if (credits < LEAGUE_CREATE_COST) {
        setError(`Not enough credits. You need ${LEAGUE_CREATE_COST} credits to create a league. You have ${credits}.`);
        setLoading(false);
        return;
      }
      
      // Deduct credits
      const deductResult = await deductCredits(user.uid, LEAGUE_CREATE_COST, 'league_create', `Created league: ${leagueName}`);
      if (!deductResult.success) {
        setError(deductResult.error || 'Failed to process creation fee. Please try again.');
        setLoading(false);
        return;
      }
      
      // Create the league
      const leagueData: Omit<League, 'id' | 'createdAt' | 'updatedAt'> = {
        name: leagueName.trim(),
        sport,
        city: city.trim(),
        state: state.trim(),
        ownerId: user.uid,
        ...(description && { description: description.trim() }),
      };
      
      // Add public profile setting
      (leagueData as any).publicProfile = isPublic;
      
      const leagueId = await createLeague(leagueData);
      
      // Update user role to LeagueOwner
      await updateDoc(doc(db, 'users', user.uid), {
        role: 'LeagueOwner',
        leagueId: leagueId,
        updatedAt: serverTimestamp(),
      });
      
      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        // Force page reload to update user context
        window.location.href = '/#/league';
      }, 2000);
      
    } catch (err: any) {
      console.error('League creation error:', err);
      setError(err.message || 'Failed to create league. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-2xl p-8 max-w-md w-full border border-green-500/30 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">League Created!</h2>
          <p className="text-gray-300">
            Your league "{leagueName}" has been created. Redirecting to your League Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/25">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create a League</h1>
          <p className="text-gray-400 mt-2">
            Become a League Owner and manage programs, schedules, and standings
          </p>
        </div>

        {/* Cost Banner */}
        <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-xl p-4 mb-6 border border-orange-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-orange-400" />
              <div>
                <p className="font-medium text-white">League Creation Fee</p>
                <p className="text-sm text-gray-400">One-time fee to create your league</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-orange-400">{LEAGUE_CREATE_COST} Credits</p>
              {creditBalance !== null && (
                <p className={`text-sm ${creditBalance >= LEAGUE_CREATE_COST ? 'text-green-400' : 'text-red-400'}`}>
                  You have {creditBalance} credits
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`w-12 h-1 rounded ${step > s ? 'bg-orange-500' : 'bg-gray-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">League Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">League Name *</label>
                <input
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none"
                  placeholder="e.g., Northern Youth Football League"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Sport *</label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value as SportType)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-orange-500 focus:outline-none"
                >
                  {getSportOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none"
                  placeholder="Describe your league..."
                  rows={3}
                />
              </div>
              
              <button
                onClick={() => setStep(2)}
                disabled={!leagueName.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-400" />
              League Location
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">City *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none"
                    placeholder="City"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">State *</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none"
                    placeholder="State"
                    required
                  />
                </div>
              </div>

              {/* Public Profile Toggle */}
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isPublic ? (
                      <Globe className="w-5 h-5 text-green-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium text-white">Public League Profile</p>
                      <p className="text-sm text-gray-400">
                        {isPublic 
                          ? "Anyone can view standings, schedules, and teams" 
                          : "Only league members can view details"
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPublic(!isPublic)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${isPublic ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isPublic ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!city.trim() || !state.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-400" />
              Review & Confirm
            </h2>

            {/* Summary */}
            <div className="bg-gray-700/50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">League Name</span>
                <span className="text-white font-medium">{leagueName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sport</span>
                <span className="text-white font-medium capitalize">{sport}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Location</span>
                <span className="text-white font-medium">{city}, {state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Visibility</span>
                <span className={`font-medium ${isPublic ? 'text-green-400' : 'text-gray-400'}`}>
                  {isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="border-t border-gray-600 my-2" />
              <div className="flex justify-between">
                <span className="text-gray-400">Creation Fee</span>
                <span className="text-orange-400 font-bold">{LEAGUE_CREATE_COST} Credits</span>
              </div>
            </div>

            {/* League Owner Responsibilities */}
            <div className="mb-6">
              <h3 className="font-medium text-white mb-3">League Owner Responsibilities</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>Manage programs and teams within your league</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>Create and publish game schedules for seasons</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>Maintain standings and playoff brackets</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>Handle grievances and disputes fairly</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>Start and end seasons (ending clears rosters)</span>
                </li>
              </ul>
            </div>

            {/* Terms Agreement */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-300">
                I understand and accept the League Owner responsibilities. I agree to maintain fair governance 
                and uphold the integrity of youth sports.
              </span>
            </label>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !agreedToTerms || (creditBalance !== null && creditBalance < LEAGUE_CREATE_COST)}
                className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Trophy className="w-5 h-5" />
                    Create League ({LEAGUE_CREATE_COST} Credits)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <Building2 className="w-8 h-8 text-blue-400 mb-2" />
            <h3 className="font-medium text-white">Manage Programs</h3>
            <p className="text-sm text-gray-400">Oversee multiple programs and commissioners</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <Trophy className="w-8 h-8 text-yellow-400 mb-2" />
            <h3 className="font-medium text-white">Seasons & Playoffs</h3>
            <p className="text-sm text-gray-400">Create schedules, brackets, and track standings</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <Users className="w-8 h-8 text-green-400 mb-2" />
            <h3 className="font-medium text-white">Public Profile</h3>
            <p className="text-sm text-gray-400">Showcase your league to the community</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeagueSignup;
