/**
 * Commissioner Assign Coach Component
 * Allows commissioners to assign/remove coaches from teams
 */

import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team, UserProfile } from '../../types';
import { 
  Shield, 
  ChevronRight, 
  User, 
  UserPlus,
  UserMinus,
  Loader2, 
  Search,
  AlertCircle,
  CheckCircle2,
  Mail
} from 'lucide-react';

export const CommissionerAssignCoach: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [assignedCoaches, setAssignedCoaches] = useState<UserProfile[]>([]);
  const [availableCoaches, setAvailableCoaches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        // Load team
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (!teamDoc.exists()) {
          navigate('/commissioner/teams');
          return;
        }
        const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
        setTeam(teamData);
        
        // Check program ownership
        if (teamData.programId !== userData?.programId) {
          navigate('/commissioner/teams');
          return;
        }
        
        // Load all coaches in the system
        const coachesQuery = query(
          collection(db, 'users'),
          where('role', '==', 'Coach')
        );
        const coachesSnap = await getDocs(coachesQuery);
        const allCoaches = coachesSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        
        // Split into assigned and available
        const assigned: UserProfile[] = [];
        const available: UserProfile[] = [];
        
        allCoaches.forEach(coach => {
          if (coach.teamIds?.includes(teamId)) {
            assigned.push(coach);
          } else {
            available.push(coach);
          }
        });
        
        setAssignedCoaches(assigned);
        setAvailableCoaches(available);
        
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [teamId, userData?.programId, navigate]);

  const handleAssignCoach = async (coach: UserProfile) => {
    if (!teamId || assigning) return;
    setAssigning(coach.uid);
    setError(null);
    setSuccess(null);
    
    try {
      // Update user's teamIds array
      await updateDoc(doc(db, 'users', coach.uid), {
        teamIds: arrayUnion(teamId),
        updatedAt: serverTimestamp(),
      });
      
      // Move from available to assigned
      setAvailableCoaches(prev => prev.filter(c => c.uid !== coach.uid));
      setAssignedCoaches(prev => [...prev, coach]);
      
      setSuccess(`${coach.name} has been assigned to ${team?.name}`);
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('Error assigning coach:', err);
      setError(err.message || 'Failed to assign coach');
    } finally {
      setAssigning(null);
    }
  };

  const handleRemoveCoach = async (coach: UserProfile) => {
    if (!teamId || removing) return;
    setRemoving(coach.uid);
    setError(null);
    setSuccess(null);
    
    try {
      // Update user's teamIds array
      await updateDoc(doc(db, 'users', coach.uid), {
        teamIds: arrayRemove(teamId),
        updatedAt: serverTimestamp(),
      });
      
      // Move from assigned to available
      setAssignedCoaches(prev => prev.filter(c => c.uid !== coach.uid));
      setAvailableCoaches(prev => [...prev, coach]);
      
      setSuccess(`${coach.name} has been removed from ${team?.name}`);
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('Error removing coach:', err);
      setError(err.message || 'Failed to remove coach');
    } finally {
      setRemoving(null);
    }
  };

  // Filter available coaches by search
  const filteredAvailable = availableCoaches.filter(coach =>
    coach.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coach.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!team) {
    return null;
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
            <Link to={`/commissioner/teams/${teamId}`} className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
              {team.name}
            </Link>
            <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Assign Coaches</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-500">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Currently Assigned Coaches */}
        <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              <User className="w-5 h-5 text-green-500" />
              Assigned Coaches ({assignedCoaches.length})
            </h2>
          </div>
          
          {assignedCoaches.length === 0 ? (
            <div className="p-6 text-center">
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>No coaches assigned to this team yet</p>
            </div>
          ) : (
            <div className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {assignedCoaches.map((coach) => (
                <div key={coach.uid} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{coach.name}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{coach.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveCoach(coach)}
                    disabled={removing === coach.uid}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors text-sm"
                  >
                    {removing === coach.uid ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserMinus className="w-4 h-4" />
                    )}
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available Coaches */}
        <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              <UserPlus className="w-5 h-5 text-purple-500" />
              Available Coaches
            </h2>
          </div>
          
          {/* Search */}
          <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search coaches by name or email..."
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
          </div>
          
          {filteredAvailable.length === 0 ? (
            <div className="p-6 text-center">
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                {searchQuery ? 'No coaches found matching your search' : 'No available coaches to assign'}
              </p>
            </div>
          ) : (
            <div className={`divide-y max-h-96 overflow-y-auto ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {filteredAvailable.map((coach) => (
                <div key={coach.uid} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <User className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{coach.name}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{coach.email}</p>
                      {coach.teamIds && coach.teamIds.length > 0 && (
                        <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Assigned to {coach.teamIds.length} team(s)</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssignCoach(coach)}
                    disabled={assigning === coach.uid}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                  >
                    {assigning === coach.uid ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Assign
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back Button */}
        <Link
          to={`/commissioner/teams/${teamId}`}
          className={`inline-flex items-center gap-2 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Team
        </Link>
      </div>
    </div>
  );
};

export default CommissionerAssignCoach;
