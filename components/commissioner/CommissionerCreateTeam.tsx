/**
 * Commissioner Create Team Component - Simplified
 * Only needs: Team Name, Team ID, Age Group (from program)
 * Sport comes from sidebar, City/State from program
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { serverTimestamp, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
  Shield, 
  ChevronRight, 
  Users, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Trophy,
  ArrowLeft
} from 'lucide-react';

export const CommissionerCreateTeam: React.FC = () => {
  const { user, userData, programData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form data - simplified
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [ageGroup, setAgeGroup] = useState('');

  // Get sport from sidebar selection
  const selectedSport = localStorage.getItem('commissioner_selected_sport') || 'Football';
  
  // Get age groups from program
  const programAgeGroups = (programData as any)?.ageGroups || [];
  
  // Get city/state from program
  const programCity = programData?.city || '';
  const programState = programData?.state || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !userData) {
      setError('You must be logged in to create a team.');
      return;
    }
    
    // Validate required fields
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }
    if (!teamId.trim()) {
      setError('Please enter a team ID');
      return;
    }
    // Age group is optional - team can be assigned later
    if (!programCity || !programState) {
      setError('Program city/state not set. Please update your program first.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const customTeamId = teamId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      
      // Check if team ID exists
      const existingTeam = await getDoc(doc(db, 'teams', customTeamId));
      if (existingTeam.exists()) {
        setError(`Team ID "${customTeamId}" is already taken.`);
        setLoading(false);
        return;
      }
      
      // Team data - simplified, uses program values
      const teamData = {
        name: teamName.trim(),
        sport: selectedSport,
        ageGroup: ageGroup || null,
        ageGroups: ageGroup ? [ageGroup] : [],
        ageGroupType: ageGroup ? 'single' : null,
        city: programCity,
        state: programState,
        location: {
          city: programCity,
          state: programState,
        },
        primaryColor: programData?.primaryColor || '#f97316',
        secondaryColor: programData?.secondaryColor || '#1e293b',
        color: programData?.primaryColor || '#f97316',
        ownerId: user.uid,
        ownerName: userData.name || 'Unknown',
        programId: programData?.id || null,
        programName: programData?.name || '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Create the team
      const batch = writeBatch(db);
      const teamRef = doc(db, 'teams', customTeamId);
      batch.set(teamRef, teamData);
      await batch.commit();
      
      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/commissioner/teams');
      }, 1500);
      
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
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/commissioner/teams')}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-500" />
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Create Team</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        <div className={`rounded-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
          
          {/* Sport Badge - Shows which sport */}
          <div className={`rounded-lg p-3 mb-6 flex items-center gap-3 ${theme === 'dark' ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-100'}`}>
            <span className="text-2xl">
              {selectedSport === 'Football' ? '🏈' : 
               selectedSport === 'Basketball' ? '🏀' : 
               selectedSport === 'Soccer' ? '⚽' : 
               selectedSport === 'Baseball' ? '⚾' :
               selectedSport === 'Cheer' ? '📣' : '🏆'}
            </span>
            <div>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedSport}</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {programData?.name || 'Your Program'} • {programCity}, {programState}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Team Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Team Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g., Tigers, Eagles, Panthers"
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
                Team ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                placeholder="e.g., tigers-6u"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                required
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                URL-friendly ID. Only lowercase letters, numbers, and dashes.
              </p>
            </div>

            {/* Age Group - Simple dropdown from program */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Age Group <span className="text-slate-400 text-xs">(optional)</span>
              </label>
              {programAgeGroups.length > 0 ? (
                <div>
                  <select
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      theme === 'dark' 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">No age group (assign later)</option>
                    {programAgeGroups.map((ag: string) => (
                      <option key={ag} value={ag}>{ag}</option>
                    ))}
                  </select>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    Teams without age groups won't appear in season setup until assigned.
                  </p>
                </div>
              ) : (
                <div className={`p-4 rounded-lg text-center ${theme === 'dark' ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                    No age groups created yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/commissioner/age-groups')}
                    className="text-purple-500 hover:text-purple-400 font-medium text-sm"
                  >
                    Create Age Groups →
                  </button>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !teamName.trim() || !teamId.trim()}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Create Team
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
