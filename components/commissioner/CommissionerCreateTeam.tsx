/**
 * Commissioner Create Team Component
 * Allows commissioners to create new teams under their program
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { assignTeamToProgram } from '../../services/leagueService';
import { deductCredits, getUserCreditBalance } from '../../services/creditService';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { SPORT_CONFIGS, getSportOptions } from '../../config/sportConfig';
import type { SportType } from '../../types';
import { AgeGroupSelector } from '../AgeGroupSelector';
import { 
  Shield, 
  ChevronRight, 
  Users, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Palette,
  Calendar
} from 'lucide-react';

const TEAM_CREATION_COST = 50; // Credits required to create a team

// Expanded color palette organized by color family - covers most common team colors
const TEAM_COLOR_PALETTE = {
  // Reds
  reds: ['#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5'],
  // Oranges
  oranges: ['#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74'],
  // Yellows/Golds
  yellows: ['#713f12', '#854d0e', '#a16207', '#ca8a04', '#eab308', '#facc15', '#fde047'],
  // Greens
  greens: ['#14532d', '#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac'],
  // Teals/Cyans
  teals: ['#134e4a', '#115e59', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4'],
  // Blues
  blues: ['#1e3a5f', '#1e40af', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
  // Purples
  purples: ['#4c1d95', '#5b21b6', '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'],
  // Pinks/Magentas
  pinks: ['#831843', '#9d174d', '#be185d', '#db2777', '#ec4899', '#f472b6', '#f9a8d4'],
  // Neutrals (Black, Gray, White spectrum)
  neutrals: ['#000000', '#171717', '#262626', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#ffffff'],
  // Metallic/Special (common for sports)
  metallics: ['#b8860b', '#c0c0c0', '#cd7f32', '#ffd700', '#8b4513', '#2f4f4f']
};

export const CommissionerCreateTeam: React.FC = () => {
  const { user, userData, programData, leagueData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form data
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [sport, setSport] = useState<SportType>((programData?.sport as SportType) || 'football');
  const [ageGroup, setAgeGroup] = useState<string | string[]>('');
  const [ageGroupType, setAgeGroupType] = useState<'single' | 'multi'>('single');
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [primaryColor, setPrimaryColor] = useState('#f97316');
  const [secondaryColor, setSecondaryColor] = useState('#1e293b');
  const [customPrimaryHex, setCustomPrimaryHex] = useState('');
  const [customSecondaryHex, setCustomSecondaryHex] = useState('');
  const [maxRosterSize, setMaxRosterSize] = useState(25);
  const [isCheerTeam, setIsCheerTeam] = useState(false);
  const [linkedCheerTeamId, setLinkedCheerTeamId] = useState('');
  const [availableCheerTeams, setAvailableCheerTeams] = useState<{id: string; name: string}[]>([]);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Validate hex color code
  const isValidHex = (hex: string): boolean => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  };

  // Handle custom hex input for primary color
  const handleCustomPrimaryHex = (value: string) => {
    // Auto-add # if not present
    let hex = value.startsWith('#') ? value : `#${value}`;
    setCustomPrimaryHex(hex);
    if (isValidHex(hex)) {
      setPrimaryColor(hex.toLowerCase());
    }
  };

  // Handle custom hex input for secondary color
  const handleCustomSecondaryHex = (value: string) => {
    let hex = value.startsWith('#') ? value : `#${value}`;
    setCustomSecondaryHex(hex);
    if (isValidHex(hex)) {
      setSecondaryColor(hex.toLowerCase());
    }
  };

  // Get all colors as flat array for checking selection
  const allPaletteColors = Object.values(TEAM_COLOR_PALETTE).flat();

  // Load available cheer teams for linking
  useEffect(() => {
    const loadCheerTeams = async () => {
      if (!user?.uid || isCheerTeam) return;
      
      try {
        const cheerQuery = query(
          collection(db, 'teams'),
          where('isCheerTeam', '==', true),
          where('ownerId', '==', user.uid)
        );
        const snap = await getDocs(cheerQuery);
        const teams = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || 'Unnamed Team' }));
        setAvailableCheerTeams(teams);
      } catch (err) {
        console.error('Error loading cheer teams:', err);
      }
    };
    
    loadCheerTeams();
  }, [user?.uid, isCheerTeam]);

  const handleAgeGroupChange = (value: string | string[], type: 'single' | 'multi') => {
    setAgeGroup(value);
    setAgeGroupType(type);
  };

  // Get display value for age group
  const ageGroupDisplay = Array.isArray(ageGroup) 
    ? (ageGroup.length === 0 ? '' : ageGroup.length <= 2 ? ageGroup.join('/') : `${ageGroup[0]}-${ageGroup[ageGroup.length - 1]}`)
    : ageGroup;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData || !userData.programId) return;
    
    // Validate age group selection
    const hasAgeGroup = Array.isArray(ageGroup) ? ageGroup.length > 0 : !!ageGroup;
    if (!hasAgeGroup) {
      setError('Please select an age group');
      return;
    }
    
    // Validate city and state
    if (!city.trim()) {
      setError('Please enter a city');
      return;
    }
    if (!state.trim()) {
      setError('Please enter a state');
      return;
    }
    
    // Validate team ID
    if (!teamId.trim()) {
      setError('Please enter a team ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Validate custom team ID format and availability
      const customTeamId = teamId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const existingTeam = await getDoc(doc(db, 'teams', customTeamId));
      if (existingTeam.exists()) {
        setError(`Team ID "${customTeamId}" is already taken. Please choose a different ID.`);
        setLoading(false);
        return;
      }
      
      // Check credits
      const credits = await getUserCreditBalance(user.uid);
      if (credits < TEAM_CREATION_COST) {
        setError(`Not enough credits. You need ${TEAM_CREATION_COST} credits to create a team. You have ${credits}.`);
        setLoading(false);
        return;
      }
      
      // Prepare age group data
      const primaryAgeGroup = Array.isArray(ageGroup) ? ageGroup[0] : ageGroup;
      const ageGroupsArray = Array.isArray(ageGroup) ? ageGroup : [ageGroup];
      
      // Create the team with the validated custom ID
      const teamData: Record<string, any> = {
        name: teamName,
        sport,
        ageGroup: primaryAgeGroup,
        ageGroups: ageGroupsArray,
        ageGroupType,
        seasonYear,
        color: primaryColor,
        primaryColor,
        secondaryColor,
        maxRosterSize,
        isCheerTeam,
        location: {
          city: city.trim(),
          state: state.trim().toUpperCase(),
        },
        ownerId: user.uid,
        ownerName: userData.name,
        programId: userData.programId,
        leagueId: leagueData?.id || null,
        leagueStatus: leagueData ? 'active' : null,
        leagueJoinedAt: leagueData ? serverTimestamp() : null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Add linked cheer team if selected (for non-cheer teams)
      if (!isCheerTeam && linkedCheerTeamId) {
        teamData.linkedCheerTeamId = linkedCheerTeamId;
      }
      
      await setDoc(doc(db, 'teams', customTeamId), teamData);
      
      // Deduct credits after successful team creation
      await deductCredits(user.uid, TEAM_CREATION_COST, 'team_create', `Created team: ${teamName}`);
      
      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate(`/commissioner/teams/${customTeamId}`);
      }, 2000);
      
    } catch (err: any) {
      console.error('Team creation error:', err);
      setError(err.message || 'Failed to create team. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`max-w-md w-full rounded-xl p-8 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-lg'}`}>
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Team Created!</h2>
          <p className={`mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            "{teamName}" has been added to your program.
          </p>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Redirecting to team details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/commissioner" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
              <Shield className="w-5 h-5" />
            </Link>
            <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <Link to="/commissioner/teams" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
              Teams
            </Link>
            <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Create Team</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className={`rounded-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {/* Cost Info */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Team Creation Cost</span>
              <span className="text-lg font-bold text-purple-500">{TEAM_CREATION_COST} Credits</span>
            </div>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Your balance: {userData?.credits || 0} credits
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Team Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Team Name *
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g., Northside Tigers"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                required
              />
            </div>

            {/* Team ID */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Team ID *
              </label>
              <input
                type="text"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                placeholder="e.g., northside-tigers-9u"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                required
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                URL-friendly ID for your team. Only lowercase letters, numbers, and dashes.
              </p>
            </div>

            {/* Sport & Season Year */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Sport *
                </label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value as SportType)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  {getSportOptions().map((sportOption) => (
                    <option key={sportOption.value} value={sportOption.value}>
                      {sportOption.emoji} {sportOption.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Season Year *
                  </div>
                </label>
                <select
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(parseInt(e.target.value))}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() + i;
                    return (
                      <option key={year} value={year}>{year}</option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Age Group Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Age Group *
              </label>
              <AgeGroupSelector
                value={ageGroup}
                onChange={handleAgeGroupChange}
                mode="auto"
                required
              />
            </div>

            {/* City & State */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  City *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Commerce"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  State *
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="e.g., TX"
                  maxLength={2}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  required
                />
              </div>
            </div>

            {/* Team Colors */}
            <div className="space-y-4">
              <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Team Colors *
                </div>
              </label>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Select your team's primary and secondary colors. These will be used throughout the app for your team's branding.
              </p>

              {/* Color Palette Grid */}
              <div className={`rounded-lg p-4 space-y-3 ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50 border border-gray-200'}`}>
                {/* Reds */}
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_COLOR_PALETTE.reds.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                  <span className={`w-px h-7 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} />
                  {/* Oranges */}
                  {TEAM_COLOR_PALETTE.oranges.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
                {/* Yellows & Greens */}
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_COLOR_PALETTE.yellows.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                  <span className={`w-px h-7 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} />
                  {TEAM_COLOR_PALETTE.greens.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
                {/* Teals & Blues */}
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_COLOR_PALETTE.teals.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                  <span className={`w-px h-7 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} />
                  {TEAM_COLOR_PALETTE.blues.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
                {/* Purples & Pinks */}
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_COLOR_PALETTE.purples.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                  <span className={`w-px h-7 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} />
                  {TEAM_COLOR_PALETTE.pinks.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
                {/* Neutrals & Metallics */}
                <div className="flex flex-wrap gap-1.5">
                  {TEAM_COLOR_PALETTE.neutrals.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all border ${c === '#ffffff' ? 'border-gray-300' : 'border-transparent'} ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                  <span className={`w-px h-7 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} />
                  {TEAM_COLOR_PALETTE.metallics.map((c) => (
                    <button key={c} type="button" onClick={() => { setPrimaryColor(c); setCustomPrimaryHex(''); }}
                      className={`w-7 h-7 rounded-md transition-all ${primaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-white ring-offset-gray-800' : 'ring-gray-900 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
              </div>

              {/* Primary & Secondary Color Selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* Primary Color */}
                <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                  <label className={`text-xs font-medium block mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-10 h-10 rounded-lg border-2 border-white shadow-md flex-shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <input
                      type="text"
                      value={customPrimaryHex || primaryColor}
                      onChange={(e) => handleCustomPrimaryHex(e.target.value)}
                      placeholder="#f97316"
                      maxLength={7}
                      className={`flex-1 px-2 py-1.5 text-sm font-mono rounded border focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                        theme === 'dark' 
                          ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      } ${customPrimaryHex && !isValidHex(customPrimaryHex) ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {customPrimaryHex && !isValidHex(customPrimaryHex) && (
                    <p className="text-xs text-red-500 mt-1">Invalid hex (use #RRGGBB)</p>
                  )}
                </div>

                {/* Secondary Color */}
                <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                  <label className={`text-xs font-medium block mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Swap to secondary color picker mode - clicking palette sets secondary
                      }}
                      className="w-10 h-10 rounded-lg border-2 border-white shadow-md flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
                      style={{ backgroundColor: secondaryColor }}
                      title="Click palette to change secondary color"
                    />
                    <input
                      type="text"
                      value={customSecondaryHex || secondaryColor}
                      onChange={(e) => handleCustomSecondaryHex(e.target.value)}
                      placeholder="#1e293b"
                      maxLength={7}
                      className={`flex-1 px-2 py-1.5 text-sm font-mono rounded border focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                        theme === 'dark' 
                          ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      } ${customSecondaryHex && !isValidHex(customSecondaryHex) ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {customSecondaryHex && !isValidHex(customSecondaryHex) && (
                    <p className="text-xs text-red-500 mt-1">Invalid hex (use #RRGGBB)</p>
                  )}
                </div>
              </div>

              {/* Quick Secondary Color Selector */}
              <div>
                <label className={`text-xs font-medium block mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Quick pick secondary color:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[...TEAM_COLOR_PALETTE.neutrals, '#b8860b', '#c0c0c0', '#ffd700'].map((c) => (
                    <button key={`sec-${c}`} type="button" onClick={() => { setSecondaryColor(c); setCustomSecondaryHex(''); }}
                      className={`w-6 h-6 rounded transition-all border ${c === '#ffffff' ? 'border-gray-300' : 'border-transparent'} ${secondaryColor === c ? `ring-2 ring-offset-1 scale-110 ${theme === 'dark' ? 'ring-purple-400 ring-offset-gray-800' : 'ring-purple-600 ring-offset-white'}` : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
              </div>
              
              {/* Dual Color Preview */}
              <div className={`mt-4 flex items-center gap-4 rounded-lg p-4 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                <div 
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl overflow-hidden relative shadow-lg"
                >
                  {/* Diagonal split background */}
                  <div 
                    className="absolute inset-0"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor} 50%, ${secondaryColor} 50%)`
                    }}
                  />
                  <span className="relative z-10 drop-shadow-lg">{teamName?.charAt(0) || 'T'}</span>
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{teamName || 'Team Name'}</p>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Team Color Preview</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded shadow-sm" style={{ backgroundColor: primaryColor }} />
                      <span className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{primaryColor}</span>
                    </div>
                    <span className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>/</span>
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded shadow-sm" style={{ backgroundColor: secondaryColor }} />
                      <span className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>{secondaryColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Max Roster Size */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Max Roster Size
              </label>
              <input
                type="number"
                value={maxRosterSize}
                onChange={(e) => setMaxRosterSize(parseInt(e.target.value) || 25)}
                min={1}
                max={100}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Maximum number of players allowed on the team
              </p>
            </div>

            {/* Cheer Team Toggle */}
            <div className={`flex items-center justify-between rounded-lg p-4 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
              <div>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Cheer Team</p>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>This team is a cheerleading squad</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCheerTeam}
                  onChange={(e) => setIsCheerTeam(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            
            {/* Link Cheer Team (only show for non-cheer teams with available cheer teams) */}
            {!isCheerTeam && availableCheerTeams.length > 0 && (
              <div>
                <label className={`block mb-2 text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                  🔗 Link to Cheer Team (Optional)
                </label>
                <select
                  value={linkedCheerTeamId}
                  onChange={(e) => setLinkedCheerTeamId(e.target.value)}
                  className={`w-full p-3 rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-purple-500`}
                >
                  <option value="">No linked cheer team</option>
                  {availableCheerTeams.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                  ))}
                </select>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  Link your sports team to a cheer team to display them together
                </p>
              </div>
            )}

            {/* Program Info */}
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-100'}`}>
              <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Creating under program</p>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{programData?.name || 'Your Program'}</p>
              {leagueData && (
                <p className="text-sm text-purple-500 mt-1">
                  League: {leagueData.name}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !teamName || !teamId.trim() || !ageGroup || !city.trim() || !state.trim()}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Team...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Create Team ({TEAM_CREATION_COST} Credits)
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CommissionerCreateTeam;
