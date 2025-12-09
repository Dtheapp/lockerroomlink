/**
 * Commissioner Create Team Component
 * Allows commissioners to create new teams under their program
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { assignTeamToProgram } from '../../services/leagueService';
import { deductCredits, getUserCreditBalance } from '../../services/creditService';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { SPORT_CONFIGS, getSportOptions } from '../../config/sportConfig';
import type { SportType } from '../../types';
import { 
  Shield, 
  ChevronRight, 
  Users, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Palette
} from 'lucide-react';

const TEAM_CREATION_COST = 50; // Credits required to create a team

const AGE_GROUPS = [
  '6U', '7U', '8U', '9U', '10U', '11U', '12U', '13U', '14U', '15U', '16U', '17U', '18U',
  'High School', 'College', 'Adult', 'Senior'
];

const TEAM_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#1e293b'
];

export const CommissionerCreateTeam: React.FC = () => {
  const { user, userData, programData, leagueData } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form data
  const [teamName, setTeamName] = useState('');
  const [sport, setSport] = useState<SportType>((programData?.sport as SportType) || 'football');
  const [ageGroup, setAgeGroup] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [maxRosterSize, setMaxRosterSize] = useState(25);
  const [isCheerTeam, setIsCheerTeam] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData || !userData.programId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Check credits
      const credits = await getUserCreditBalance(user.uid);
      if (credits < TEAM_CREATION_COST) {
        setError(`Not enough credits. You need ${TEAM_CREATION_COST} credits to create a team. You have ${credits}.`);
        setLoading(false);
        return;
      }
      
      // Create the team
      const teamRef = await addDoc(collection(db, 'teams'), {
        name: teamName,
        sport,
        ageGroup,
        color,
        maxRosterSize,
        isCheerTeam,
        programId: userData.programId,
        leagueId: leagueData?.id || null,
        leagueStatus: leagueData ? 'active' : null,
        leagueJoinedAt: leagueData ? serverTimestamp() : null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Deduct credits after successful team creation
      await deductCredits(user.uid, TEAM_CREATION_COST, 'team_create', `Created team: ${teamName}`);
      
      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate(`/commissioner/teams/${teamRef.id}`);
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Team Created!</h2>
          <p className="text-gray-400 mb-4">
            "{teamName}" has been added to your program.
          </p>
          <p className="text-sm text-gray-500">Redirecting to team details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/commissioner" className="text-gray-400 hover:text-white">
              <Shield className="w-5 h-5" />
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-600" />
            <Link to="/commissioner/teams" className="text-gray-400 hover:text-white">
              Teams
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-600" />
            <h1 className="text-xl font-bold text-white">Create Team</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-gray-800 rounded-xl p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Cost Info */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Team Creation Cost</span>
              <span className="text-lg font-bold text-purple-400">{TEAM_CREATION_COST} Credits</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Your balance: {userData?.credits || 0} credits
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Team Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Team Name *
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g., Northside Tigers"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>

            {/* Sport & Age Group */}
            <div className="grid grid-cols-2 gap-4">
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
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Age Group *
                </label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">Select age group</option>
                  {AGE_GROUPS.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Team Color */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Team Color
                </div>
              </label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg transition-transform ${
                      color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              
              {/* Preview */}
              <div className="mt-4 flex items-center gap-3 bg-gray-700/50 rounded-lg p-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: color }}
                >
                  {teamName?.charAt(0) || 'T'}
                </div>
                <div>
                  <p className="text-white font-medium">{teamName || 'Team Name'}</p>
                  <p className="text-sm text-gray-400">Preview</p>
                </div>
              </div>
            </div>

            {/* Max Roster Size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Roster Size
              </label>
              <input
                type="number"
                value={maxRosterSize}
                onChange={(e) => setMaxRosterSize(parseInt(e.target.value) || 25)}
                min={1}
                max={100}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Maximum number of players allowed on the team
              </p>
            </div>

            {/* Cheer Team Toggle */}
            <div className="flex items-center justify-between bg-gray-700/50 rounded-lg p-4">
              <div>
                <p className="text-white font-medium">Cheer Team</p>
                <p className="text-sm text-gray-400">This team is a cheerleading squad</p>
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

            {/* Program Info */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Creating under program</p>
              <p className="text-white font-medium">{programData?.name || 'Your Program'}</p>
              {leagueData && (
                <p className="text-sm text-purple-400 mt-1">
                  League: {leagueData.name}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !teamName || !ageGroup}
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
