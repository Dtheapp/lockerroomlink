/**
 * League Signup Component
 * Allows users to create and become owner of a new League
 * FREE to create - leagues drive user growth!
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createLeague } from '../../services/leagueService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
  Trophy, MapPin, Building2, Shield, ChevronRight, Loader2, 
  AlertCircle, CheckCircle2, Users, Sparkles, Link2
} from 'lucide-react';
import { StateSelector } from '../StateSelector';
import type { SportType, League } from '../../types';

// Get sport emoji for display
const getSportEmoji = (sport: string): string => {
  const emojiMap: Record<string, string> = {
    'football': '🏈', 'basketball': '🏀', 'soccer': '⚽', 'baseball': '⚾',
    'softball': '🥎', 'volleyball': '🏐', 'cheer': '📣', 'track': '🏃',
    'wrestling': '🤼', 'hockey': '🏒', 'lacrosse': '🥍', 'tennis': '🎾',
    'golf': '⛳', 'swimming': '🏊',
  };
  return emojiMap[sport.toLowerCase()] || '🏆';
};

export const LeagueSignup: React.FC = () => {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // Get selected sport from sidebar (stored in localStorage) - reactive to changes
  const getStoredSport = (): SportType => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('commissioner_selected_sport');
      return (stored?.toLowerCase() || 'football') as SportType;
    }
    return 'football' as SportType;
  };
  
  const [selectedSport, setSelectedSport] = useState<SportType>(getStoredSport);
  
  // Listen for sport changes from sidebar
  useEffect(() => {
    const handleSportChange = (event: CustomEvent<string>) => {
      const newSport = (event.detail?.toLowerCase() || 'football') as SportType;
      setSelectedSport(newSport);
    };
    
    window.addEventListener('commissioner-sport-changed', handleSportChange as EventListener);
    return () => {
      window.removeEventListener('commissioner-sport-changed', handleSportChange as EventListener);
    };
  }, []);
  
  const displaySport = selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form data
  const [leagueName, setLeagueName] = useState('');
  const [website, setWebsite] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [description, setDescription] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Zipcode lookup state
  const [zipcodeLookupLoading, setZipcodeLookupLoading] = useState(false);
  const [zipcodeError, setZipcodeError] = useState('');
  
  // Zipcode lookup function
  const lookupZipcode = async (zip: string) => {
    if (zip.length !== 5 || !/^\d{5}$/.test(zip)) return;
    
    setZipcodeLookupLoading(true);
    setZipcodeError('');
    
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (response.ok) {
        const data = await response.json();
        if (data.places && data.places.length > 0) {
          const place = data.places[0];
          setCity(place['place name'] || '');
          setState(place['state abbreviation'] || '');
        }
      } else if (response.status === 404) {
        setZipcodeError('Invalid zipcode');
      }
    } catch (err) {
      console.error('Zipcode lookup failed:', err);
    } finally {
      setZipcodeLookupLoading(false);
    }
  };
  
  // Handle zipcode change
  const handleZipcodeChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 5);
    setZipcode(cleaned);
    setZipcodeError('');
    
    if (cleaned.length === 5) {
      lookupZipcode(cleaned);
    }
  };

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
      // Create the league (FREE!)
      const leagueData: Omit<League, 'id' | 'createdAt' | 'updatedAt'> = {
        name: leagueName.trim(),
        sport: selectedSport,
        city: city.trim(),
        state: state.trim(),
        ownerId: user.uid,
        ...(description && { description: description.trim() }),
        ...(website && { website: website.trim() }),
        ...(zipcode && { zipcode: zipcode.trim() }),
      };
      
      // Leagues are always public
      (leagueData as any).publicProfile = true;
      
      const leagueId = await createLeague(leagueData);
      
      // Update user role and link to league
      await updateDoc(doc(db, 'users', user.uid), {
        role: 'LeagueCommissioner',
        leagueId: leagueId,
        updatedAt: serverTimestamp(),
      });
      
      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        // Dispatch sport change event to trigger league reload in AuthContext
        window.dispatchEvent(new CustomEvent('commissioner-sport-changed', { detail: selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1) }));
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
      <div className={`min-h-screen flex items-center justify-center px-4 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950' 
          : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'
      }`}>
        <div className={`rounded-2xl p-8 max-w-md w-full text-center ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-emerald-900/30 to-green-900/20 border border-emerald-500/30'
            : 'bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200'
        }`}>
          <CheckCircle2 className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
          }`} />
          <h2 className={`text-2xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>League Created!</h2>
          <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>
            Your league "{leagueName}" has been created. Redirecting to your League Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen py-8 px-4 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950' 
        : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'
    }`}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-3xl ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-purple-600 to-purple-500 shadow-purple-500/25'
              : 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-500/25'
          }`}>
            {getSportEmoji(selectedSport)}
          </div>
          <h1 className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Create a {displaySport} League</h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Become a League Owner and manage programs, schedules, and standings
          </p>
        </div>

        {/* FREE Banner */}
        <div className={`rounded-2xl p-4 mb-6 flex items-center gap-4 ${
          theme === 'dark'
            ? 'bg-gradient-to-r from-emerald-900/30 to-green-900/20 border border-emerald-500/30'
            : 'bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
          }`}>
            <Sparkles className={`w-6 h-6 ${
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            }`} />
          </div>
          <div>
            <p className={`font-semibold ${
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
            }`}>🎉 FREE to Create!</p>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Start your league today at no cost</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${
                step >= s 
                  ? 'bg-purple-600 text-white' 
                  : theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`w-12 h-1 rounded transition-colors ${
                  step > s 
                    ? 'bg-purple-600' 
                    : theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
            theme === 'dark'
              ? 'bg-red-500/20 border border-red-500/50'
              : 'bg-red-50 border border-red-200'
          }`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
              theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`} />
            <p className={theme === 'dark' ? 'text-red-200' : 'text-red-700'}>{error}</p>
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className={`rounded-2xl p-6 ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <h2 className={`text-xl font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>League Information</h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>League Name *</label>
                <input
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  className={`w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                  placeholder={`e.g., Northern Youth ${displaySport} League`}
                  required
                />
              </div>

              {/* Sport Display (read-only, from sidebar selector) */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>Sport</label>
                <div className={`w-full rounded-xl px-4 py-3 flex items-center gap-2 ${
                  theme === 'dark'
                    ? 'bg-purple-500/10 border border-purple-500/30 text-purple-300'
                    : 'bg-purple-50 border border-purple-200 text-purple-700'
                }`}>
                  <span className="text-lg">{getSportEmoji(selectedSport)}</span>
                  <span className="font-medium">{displaySport}</span>
                  <span className={`text-xs ml-auto ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`}>Selected from sidebar</span>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <Link2 className="w-4 h-4" />
                    Website (optional)
                  </span>
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className={`w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                  placeholder="https://yourleague.com"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                    theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                  placeholder="Describe your league..."
                  rows={3}
                />
              </div>
              
              <button
                onClick={() => setStep(2)}
                disabled={!leagueName.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className={`rounded-2xl p-6 ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <h2 className={`text-xl font-semibold mb-4 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <MapPin className={`w-5 h-5 ${
                theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
              }`} />
              League Location
            </h2>
            <div className="space-y-4">
              {/* Zipcode - Auto-fills City/State */}
              <div className="max-w-[180px]">
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>Zipcode *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={zipcode}
                    onChange={(e) => handleZipcodeChange(e.target.value)}
                    placeholder="e.g., 75428"
                    maxLength={5}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                      zipcodeError
                        ? 'border-red-500'
                        : theme === 'dark'
                          ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                          : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  {zipcodeLookupLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    </div>
                  )}
                </div>
                {zipcodeError && (
                  <p className="text-red-500 text-sm mt-1">{zipcodeError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>City *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                      theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                    placeholder="Auto-filled from zipcode"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>State *</label>
                  <StateSelector
                    value={state}
                    onChange={setState}
                    placeholder="Select state"
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className={`flex-1 font-semibold py-3 rounded-xl transition-colors ${
                    theme === 'dark'
                      ? 'bg-white/5 hover:bg-white/10 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                  }`}
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!city.trim() || !state.trim()}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && (
          <div className={`rounded-2xl p-6 ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <h2 className={`text-xl font-semibold mb-4 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <Shield className={`w-5 h-5 ${
                theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
              }`} />
              Review & Confirm
            </h2>

            {/* Summary */}
            <div className={`rounded-xl p-4 mb-6 space-y-3 ${
              theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'
            }`}>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>League Name</span>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>{leagueName}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Sport</span>
                <span className={`font-medium flex items-center gap-1.5 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  <span>{getSportEmoji(selectedSport)}</span>
                  {displaySport}
                </span>
              </div>
              {website && (
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Website</span>
                  <span className={`font-medium ${
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  }`}>{website}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Location</span>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>{city}, {state} {zipcode}</span>
              </div>
              <div className={`border-t my-2 ${
                theme === 'dark' ? 'border-white/10' : 'border-slate-200'
              }`} />
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Price</span>
                <span className={`font-bold ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                }`}>FREE!</span>
              </div>
            </div>

            {/* League Owner Responsibilities */}
            <div className="mb-6">
              <h3 className={`font-medium mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>League Owner Responsibilities</h3>
              <ul className="space-y-2">
                {[
                  'Manage programs and teams within your league',
                  'Create and publish game schedules for seasons',
                  'Maintain standings and playoff brackets',
                  'Handle grievances and disputes fairly',
                  'Start and end seasons (ending clears rosters)',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    }`} />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                    }`}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Terms Agreement */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
              }`}>
                I understand and accept the League Owner responsibilities. I agree to maintain fair governance 
                and uphold the integrity of youth sports.
              </span>
            </label>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className={`flex-1 font-semibold py-3 rounded-xl transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/5 hover:bg-white/10 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                }`}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !agreedToTerms}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Trophy className="w-5 h-5" />
                    Create League
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className={`rounded-xl p-4 ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <Building2 className={`w-8 h-8 mb-2 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
            <h3 className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Manage Programs</h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Oversee multiple programs and commissioners</p>
          </div>
          <div className={`rounded-xl p-4 ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <Trophy className={`w-8 h-8 mb-2 ${
              theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
            }`} />
            <h3 className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Seasons & Playoffs</h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Create schedules, brackets, and track standings</p>
          </div>
          <div className={`rounded-xl p-4 ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-slate-200 shadow-sm'
          }`}>
            <Users className={`w-8 h-8 mb-2 ${
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            }`} />
            <h3 className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>Public Profile</h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>Showcase your league to the community</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeagueSignup;
