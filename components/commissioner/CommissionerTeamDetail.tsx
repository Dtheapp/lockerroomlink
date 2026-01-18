/**
 * Commissioner Team Detail Component
 * Detailed view and management of a single team
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
  deleteDoc,
  serverTimestamp,
  arrayRemove,
  setDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team, Player, UserProfile } from '../../types';
import TeamManagersPanel from './TeamManagersPanel';
import { 
  Shield, 
  ChevronRight, 
  Users, 
  Loader2, 
  User,
  UserPlus,
  Settings,
  Trash2,
  Edit2,
  Mail,
  Phone,
  Link2,
  AlertTriangle,
  CheckCircle2,
  X,
  UserMinus,
  Crown,
  Camera,
  ImagePlus,
  MapPin
} from 'lucide-react';
import { uploadFile } from '../../services/storage';

export const CommissionerTeamDetail: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { userData, user, programData: authProgramData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLinkCheerModal, setShowLinkCheerModal] = useState(false);
  const [linkedCheerTeam, setLinkedCheerTeam] = useState<Team | null>(null);
  const [availableCheerTeams, setAvailableCheerTeams] = useState<Team[]>([]);
  const [linkingCheerTeam, setLinkingCheerTeam] = useState(false);
  const [settingHeadCoach, setSettingHeadCoach] = useState<string | null>(null);
  const [confirmHeadCoach, setConfirmHeadCoach] = useState<{ id: string; name: string } | null>(null);
  const [removeCoachConfirm, setRemoveCoachConfirm] = useState<{ id: string; name: string; isHeadCoach: boolean } | null>(null);
  const [removingCoach, setRemovingCoach] = useState(false);
  const [newHeadCoachAfterRemove, setNewHeadCoachAfterRemove] = useState<string | null>(null);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [editAgeGroup, setEditAgeGroup] = useState('');
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState(false);
  const [programData, setProgramData] = useState<any>(null);
  
  // Logo upload state
  const [editLogo, setEditLogo] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  // Home field state
  const [editHomeFieldName, setEditHomeFieldName] = useState('');
  const [editHomeFieldAddress, setEditHomeFieldAddress] = useState('');
  const [editHomeFieldCity, setEditHomeFieldCity] = useState('');
  const [editHomeFieldState, setEditHomeFieldState] = useState('');
  const [editHomeFieldNotes, setEditHomeFieldNotes] = useState('');

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    const loadTeamData = async () => {
      try {
        // Load team
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (!teamDoc.exists()) {
          navigate('/commissioner/teams');
          return;
        }
        const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
        setTeam(teamData);
        
        // Check program ownership (skip if no programData yet - let AuthContext handle)
        if (authProgramData?.id && teamData.programId !== authProgramData.id) {
          navigate('/commissioner/teams');
          return;
        }
        
        // Load players
        const playersSnap = await getDocs(collection(db, 'teams', teamId, 'players'));
        setPlayers(playersSnap.docs.map(doc => ({ id: doc.id, teamId, ...doc.data() } as Player)));
        
        // Load coaches assigned to this team
        const coachesQuery = query(
          collection(db, 'users'),
          where('teamIds', 'array-contains', teamId)
        );
        const coachesSnap = await getDocs(coachesQuery);
        setCoaches(coachesSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
        
        // Load linked cheer team if exists
        if (teamData.linkedCheerTeamId) {
          const cheerDoc = await getDoc(doc(db, 'teams', teamData.linkedCheerTeamId));
          if (cheerDoc.exists()) {
            setLinkedCheerTeam({ id: cheerDoc.id, ...cheerDoc.data() } as Team);
          }
        }
        
        // Load available cheer teams for linking (only if this is NOT a cheer team)
        if (!teamData.isCheerTeam && user?.uid) {
          const cheerQuery = query(
            collection(db, 'teams'),
            where('ownerId', '==', user.uid),
            where('isCheerTeam', '==', true)
          );
          const cheerSnap = await getDocs(cheerQuery);
          const cheerTeams = cheerSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Team))
            .filter(t => !t.linkedToTeamId); // Only unlinked cheer teams
          setAvailableCheerTeams(cheerTeams);
        }
        
        // Load program data for edit modal age groups
        if (teamData.programId) {
          const programDoc = await getDoc(doc(db, 'programs', teamData.programId));
          if (programDoc.exists()) {
            setProgramData({ id: programDoc.id, ...programDoc.data() });
          }
        }
        
      } catch (error) {
        console.error('Error loading team data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeamData();
  }, [teamId, authProgramData?.id, user?.uid, navigate]);

  const handleDeleteTeam = async () => {
    if (!teamId) return;
    setDeleting(true);
    
    try {
      await deleteDoc(doc(db, 'teams', teamId));
      navigate('/commissioner/teams');
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Open edit modal
  const handleOpenEdit = () => {
    if (!team) return;
    setEditName(team.name || '');
    setEditTeamId(team.id || '');
    setEditAgeGroup(team.ageGroup || '');
    setEditLogo(team.logo || '');
    setLogoFile(null);
    // Initialize home field values
    setEditHomeFieldName(team.homeField?.name || '');
    setEditHomeFieldAddress(team.homeField?.address || '');
    setEditHomeFieldCity(team.homeField?.city || '');
    setEditHomeFieldState(team.homeField?.state || '');
    setEditHomeFieldNotes(team.homeField?.notes || '');
    setEditError('');
    setShowEditModal(true);
  };
  
  // Handle logo file selection
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setEditError('Please select an image file');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setEditError('Image must be under 2MB');
      return;
    }
    
    setLogoFile(file);
    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
    setEditError('');
  };

  // Save edited team
  const handleSaveEdit = async () => {
    if (!team || !teamId) return;
    
    if (!editName.trim()) {
      setEditError('Team name is required');
      return;
    }
    
    // Age group is now optional - team can have no age group
    
    setEditing(true);
    setEditError('');
    
    try {
      const newTeamId = editTeamId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const teamIdChanged = newTeamId && newTeamId !== team.id;
      
      if (teamIdChanged) {
        // Check if new team ID already exists
        const existingTeam = await getDoc(doc(db, 'teams', newTeamId));
        if (existingTeam.exists()) {
          setEditError(`Team ID "${newTeamId}" is already taken.`);
          setEditing(false);
          return;
        }
      }
      
      const updateData: Record<string, any> = {
        name: editName.trim(),
        ageGroup: editAgeGroup || null,
        ageGroups: editAgeGroup ? [editAgeGroup] : [],
        updatedAt: serverTimestamp(),
      };
      
      // Build home field object if any field is filled
      if (editHomeFieldName.trim()) {
        updateData.homeField = {
          name: editHomeFieldName.trim(),
          address: editHomeFieldAddress.trim() || null,
          city: editHomeFieldCity.trim() || null,
          state: editHomeFieldState.trim() || null,
          notes: editHomeFieldNotes.trim() || null,
        };
      } else {
        // Clear home field if name is empty
        updateData.homeField = null;
      }
      
      // Upload logo if a new file was selected
      if (logoFile) {
        setUploadingLogo(true);
        try {
          const path = `teams/${teamId}/logo_${Date.now()}`;
          const result = await uploadFile(logoFile, path);
          updateData.logo = result.url;
        } catch (uploadErr) {
          console.error('Error uploading logo:', uploadErr);
          setEditError('Failed to upload logo');
          setEditing(false);
          setUploadingLogo(false);
          return;
        }
        setUploadingLogo(false);
      } else if (editLogo && editLogo !== team.logo) {
        // Logo was cleared
        updateData.logo = editLogo || null;
      }
      
      if (teamIdChanged) {
        // Copy to new ID
        const oldTeamDoc = await getDoc(doc(db, 'teams', team.id!));
        const oldData = oldTeamDoc.data();
        await setDoc(doc(db, 'teams', newTeamId), { ...oldData, ...updateData });
        
        // Copy subcollections
        const subcollections = ['players', 'plays', 'events', 'assignedPlays'];
        for (const subcol of subcollections) {
          const subcolSnap = await getDocs(collection(db, 'teams', team.id!, subcol));
          for (const subDoc of subcolSnap.docs) {
            await setDoc(doc(db, 'teams', newTeamId, subcol, subDoc.id), subDoc.data());
          }
        }
        
        // Delete old
        for (const subcol of subcollections) {
          const subcolSnap = await getDocs(collection(db, 'teams', team.id!, subcol));
          for (const subDoc of subcolSnap.docs) {
            await deleteDoc(doc(db, 'teams', team.id!, subcol, subDoc.id));
          }
        }
        await deleteDoc(doc(db, 'teams', team.id!));
        
        // Navigate to new team detail
        navigate(`/commissioner/teams/${newTeamId}`);
      } else {
        await updateDoc(doc(db, 'teams', team.id!), updateData);
        setTeam(prev => prev ? { 
          ...prev, 
          name: editName.trim(), 
          ageGroup: editAgeGroup, 
          logo: updateData.logo !== undefined ? updateData.logo : prev.logo,
          homeField: updateData.homeField
        } : null);
      }
      
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update team');
    } finally {
      setEditing(false);
    }
  };

  const handleSetHeadCoach = async (coachId: string) => {
    if (!teamId || !team) return;
    setSettingHeadCoach(coachId);
    setConfirmHeadCoach(null);
    
    try {
      await updateDoc(doc(db, 'teams', teamId), {
        headCoachId: coachId,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setTeam(prev => prev ? { ...prev, headCoachId: coachId } : null);
    } catch (error) {
      console.error('Error setting head coach:', error);
      alert('Failed to set head coach. Please try again.');
    } finally {
      setSettingHeadCoach(null);
    }
  };

  const handleRemoveCoach = async () => {
    if (!teamId || !removeCoachConfirm) return;
    setRemovingCoach(true);
    
    try {
      const coachId = removeCoachConfirm.id;
      const isHeadCoach = removeCoachConfirm.isHeadCoach;
      
      // Remove team from coach's teamIds
      await updateDoc(doc(db, 'users', coachId), {
        teamIds: arrayRemove(teamId),
        updatedAt: serverTimestamp()
      });
      
      // If this was the head coach and we have a new head coach selected, update it
      if (isHeadCoach && newHeadCoachAfterRemove) {
        await updateDoc(doc(db, 'teams', teamId), {
          headCoachId: newHeadCoachAfterRemove,
          updatedAt: serverTimestamp()
        });
        setTeam(prev => prev ? { ...prev, headCoachId: newHeadCoachAfterRemove } : null);
      } else if (isHeadCoach) {
        // Clear head coach if no new one selected
        await updateDoc(doc(db, 'teams', teamId), {
          headCoachId: null,
          updatedAt: serverTimestamp()
        });
        setTeam(prev => prev ? { ...prev, headCoachId: undefined } : null);
      }
      
      // Update local state - remove coach from list
      setCoaches(prev => prev.filter(c => c.uid !== coachId));
      setRemoveCoachConfirm(null);
      setNewHeadCoachAfterRemove(null);
      
    } catch (error) {
      console.error('Error removing coach:', error);
      alert('Failed to remove coach. Please try again.');
    } finally {
      setRemovingCoach(false);
    }
  };

  const handleLinkCheerTeam = async (cheerTeamId: string) => {
    if (!teamId || !team) return;
    setLinkingCheerTeam(true);
    
    try {
      // Update this sport team to link to cheer team
      await updateDoc(doc(db, 'teams', teamId), {
        linkedCheerTeamId: cheerTeamId,
        updatedAt: serverTimestamp()
      });
      
      // Update the cheer team to link back to this sport team
      await updateDoc(doc(db, 'teams', cheerTeamId), {
        linkedToTeamId: teamId,
        linkedToTeamName: team.name,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      const linkedTeam = availableCheerTeams.find(t => t.id === cheerTeamId);
      if (linkedTeam) {
        setLinkedCheerTeam(linkedTeam);
        setAvailableCheerTeams(prev => prev.filter(t => t.id !== cheerTeamId));
      }
      
      setShowLinkCheerModal(false);
    } catch (error) {
      console.error('Error linking cheer team:', error);
      alert('Failed to link cheer team. Please try again.');
    } finally {
      setLinkingCheerTeam(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Team Not Found</h2>
          <Link to="/commissioner/teams" className="text-purple-500 hover:text-purple-400">
            Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/commissioner" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
                <Shield className="w-5 h-5" />
              </Link>
              <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <Link to="/commissioner/teams" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
                Teams
              </Link>
              <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{team.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenEdit}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <Edit2 className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-red-600/20' : 'bg-gray-100 hover:bg-red-50'}`}
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Team Header Card */}
        <div className={`rounded-xl p-4 sm:p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            {/* Team Logo/Avatar with click to edit */}
            <button
              onClick={handleOpenEdit}
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex-shrink-0 group overflow-hidden"
              title="Click to change logo"
            >
              {team.logo ? (
                <img 
                  src={team.logo} 
                  alt={team.name} 
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div 
                  className="w-full h-full rounded-xl flex items-center justify-center text-white text-2xl sm:text-3xl font-bold"
                  style={{ backgroundColor: team.color || '#6366f1' }}
                >
                  {team.name?.charAt(0) || 'T'}
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className={`text-xl sm:text-2xl font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{team.name}</h2>
              <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <span>{team.sport}</span>
                <span>•</span>
                <span>{team.ageGroup || 'No age group'}</span>
                {team.maxRosterSize && (
                  <>
                    <span>•</span>
                    <span>Max {team.maxRosterSize} players</span>
                  </>
                )}
                {team.homeField?.name && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {team.homeField.name}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{players.length}</p>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Players</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{coaches.length}</p>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Coaches</p>
              </div>
            </div>
          </div>
        </div>

        {/* Linked Cheer Team */}
        {linkedCheerTeam ? (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-purple-500">Linked Cheer Team</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{linkedCheerTeam.name}</p>
              </div>
            </div>
            <Link
              to={`/commissioner/teams/${linkedCheerTeam.id}`}
              className="text-sm text-purple-500 hover:text-purple-400 flex items-center gap-1"
            >
              View Team <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : !team.isCheerTeam && (
          <button
            onClick={() => setShowLinkCheerModal(true)}
            className={`w-full rounded-xl p-4 flex items-center justify-center gap-2 transition-all border border-dashed ${
              theme === 'dark' 
                ? 'bg-gray-800 hover:bg-gray-750 border-gray-600 hover:border-purple-500/50 text-gray-400 hover:text-purple-400' 
                : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-purple-400 text-gray-500 hover:text-purple-500'
            }`}
          >
            <Link2 className="w-5 h-5" />
            Link Cheer Team
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coaches Section */}
          <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <User className="w-5 h-5 text-green-400" />
                Coaches ({coaches.length})
              </h3>
              <Link
                to={`/commissioner/teams/${teamId}/assign-coach`}
                className="text-sm text-purple-500 hover:text-purple-400 flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                Assign
              </Link>
            </div>
            
            {coaches.length === 0 ? (
              <div className="p-8 text-center">
                <User className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={`mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>No coaches assigned yet</p>
                <Link
                  to={`/commissioner/teams/${teamId}/assign-coach`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Coach
                </Link>
              </div>
            ) : (
              <div className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {coaches.map((coach) => {
                  const isHeadCoach = team?.headCoachId === coach.uid;
                  return (
                    <div key={coach.uid} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${isHeadCoach ? 'bg-amber-500/20' : 'bg-green-500/20'} rounded-full flex items-center justify-center`}>
                          {isHeadCoach ? (
                            <Crown className="w-5 h-5 text-amber-400" />
                          ) : (
                            <User className="w-5 h-5 text-green-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{coach.name}</p>
                            {isHeadCoach && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                                👑 Head Coach
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{coach.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isHeadCoach && (
                          <button
                            onClick={() => setConfirmHeadCoach({ id: coach.uid, name: coach.name || 'Unknown' })}
                            disabled={settingHeadCoach === coach.uid}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              settingHeadCoach === coach.uid
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : theme === 'dark'
                                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                          >
                            {settingHeadCoach === coach.uid ? 'Setting...' : 'Set as Head Coach'}
                          </button>
                        )}
                        {coach.phone && (
                          <a href={`tel:${coach.phone}`} className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                            <Phone className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                          </a>
                        )}
                        <a href={`mailto:${coach.email}`} className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                          <Mail className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                        </a>
                        <button
                          onClick={() => setRemoveCoachConfirm({ id: coach.uid, name: coach.name || 'Unknown', isHeadCoach })}
                          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                          title="Remove coach from team"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Players Section */}
          <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Users className="w-5 h-5 text-blue-400" />
                Roster ({players.length}{team.maxRosterSize ? `/${team.maxRosterSize}` : ''})
              </h3>
              <Link
                to={`/commissioner/teams/${teamId}/roster`}
                className="text-sm text-purple-500 hover:text-purple-400 flex items-center gap-1"
              >
                Manage <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {players.length === 0 ? (
              <div className="p-8 text-center">
                <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>No players on roster yet</p>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Coaches can add players to the roster</p>
              </div>
            ) : (
              <div className={`divide-y max-h-96 overflow-y-auto ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {players.slice(0, 10).map((player) => (
                  <div key={player.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-sm font-medium text-blue-400">
                        {player.jerseyNumber || '-'}
                      </div>
                      <div>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{player.name}</p>
                        <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{player.position || 'No position'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {players.length > 10 && (
                  <div className="px-4 py-3 text-center">
                    <Link
                      to={`/commissioner/teams/${teamId}/roster`}
                      className="text-sm text-purple-500 hover:text-purple-400"
                    >
                      View all {players.length} players
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Team Managers Section */}
        {teamId && user?.uid && team && (
          <TeamManagersPanel teamId={teamId} teamName={team.name} />
        )}
      </div>

      {/* Edit Team Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b flex items-center justify-between flex-shrink-0 ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
              <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <Edit2 className="w-5 h-5 text-blue-400" />
                Edit Team
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
                  {editError}
                </div>
              )}
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Team Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter team name"
                  className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Team ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                  placeholder="unique-team-id"
                  className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
                <p className="text-xs text-yellow-500 mt-1">⚠️ Changing Team ID will migrate all data to new ID</p>
              </div>
              
              {/* Team Logo Upload */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Team Logo
                </label>
                <div className="flex items-center gap-4">
                  {/* Logo Preview */}
                  <div className="relative">
                    {editLogo ? (
                      <img 
                        src={editLogo} 
                        alt="Team logo preview" 
                        className="w-16 h-16 rounded-xl object-cover border-2 border-purple-500"
                      />
                    ) : (
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-bold border-2 border-dashed border-gray-400"
                        style={{ backgroundColor: team?.color || '#6366f1' }}
                      >
                        {editName?.charAt(0) || 'T'}
                      </div>
                    )}
                    {editLogo && (
                      <button
                        type="button"
                        onClick={() => { setEditLogo(''); setLogoFile(null); }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  {/* Upload Button */}
                  <label className={`flex-1 cursor-pointer`}>
                    <div className={`border-2 border-dashed rounded-lg py-3 px-4 text-center transition-colors ${
                      theme === 'dark' 
                        ? 'border-gray-600 hover:border-purple-500 hover:bg-purple-500/5' 
                        : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                    }`}>
                      <ImagePlus className={`w-5 h-5 mx-auto mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`} />
                      <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                        {uploadingLogo ? 'Uploading...' : 'Choose Image'}
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>
                        PNG, JPG up to 2MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                      disabled={uploadingLogo}
                    />
                  </label>
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  Age Group <span className="text-slate-400 text-xs">(optional)</span>
                </label>
                {(() => {
                  // Get sport-specific age groups from sportConfigs
                  const teamSport = team?.sport?.toLowerCase() || '';
                  const sportConfigs = programData?.sportConfigs || [];
                  const sportConfig = sportConfigs.find((c: any) => 
                    c.sport?.toLowerCase() === teamSport
                  );
                  
                  // Extract age group labels from sportConfig
                  let programAgeGroups: string[] = [];
                  if (sportConfig?.ageGroups) {
                    programAgeGroups = sportConfig.ageGroups.map((ag: any) => ag.label || ag.id || ag);
                  } else {
                    // Fallback to legacy ageGroups
                    programAgeGroups = programData?.ageGroups || [];
                  }
                  
                  return (
                    <div>
                      <div className={`w-full border rounded-lg py-2.5 px-3 mb-2 ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
                        Selected: {editAgeGroup || 'None'}
                      </div>
                      {programAgeGroups.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {programAgeGroups.map((ag: string) => (
                            <button
                              key={ag}
                              type="button"
                              onClick={() => setEditAgeGroup(editAgeGroup === ag ? '' : ag)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                editAgeGroup === ag
                                  ? 'bg-purple-600 text-white'
                                  : theme === 'dark'
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {ag}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                          No age groups configured for {team?.sport || 'this sport'}. Go to Age Groups to add some.
                        </p>
                      )}
                      <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>
                        Click again to deselect. Teams without age groups won't appear in season setup.
                      </p>
                    </div>
                  );
                })()}
              </div>
              
              {/* Home Field Section */}
              <div className={`pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                  🏟️ Home Field <span className="text-slate-400 text-xs">(optional - used for league scheduling)</span>
                </label>
                
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={editHomeFieldName}
                      onChange={(e) => setEditHomeFieldName(e.target.value)}
                      placeholder="Field/Stadium Name (e.g., Commerce ISD Stadium)"
                      className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                    />
                  </div>
                  
                  <div>
                    <input
                      type="text"
                      value={editHomeFieldAddress}
                      onChange={(e) => setEditHomeFieldAddress(e.target.value)}
                      placeholder="Street Address"
                      className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editHomeFieldCity}
                      onChange={(e) => setEditHomeFieldCity(e.target.value)}
                      placeholder="City"
                      className={`flex-1 border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                    />
                    <input
                      type="text"
                      value={editHomeFieldState}
                      onChange={(e) => setEditHomeFieldState(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="TX"
                      maxLength={2}
                      className={`w-16 border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center uppercase ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                    />
                  </div>
                  
                  <div>
                    <textarea
                      value={editHomeFieldNotes}
                      onChange={(e) => setEditHomeFieldNotes(e.target.value)}
                      placeholder="Notes (e.g., Enter through south gate, parking in lot B)"
                      rows={2}
                      className={`w-full border rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                    />
                  </div>
                </div>
                
                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>
                  When your team is "Home" in league games, this location will be used automatically.
                </p>
              </div>
            </div>
            
            <div className={`p-4 border-t flex gap-3 flex-shrink-0 ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
              <button
                onClick={() => setShowEditModal(false)}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editing || uploadingLogo || !editName.trim()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {editing || uploadingLogo ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 max-w-md w-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Delete Team?</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>This action cannot be undone</p>
              </div>
            </div>
            
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Are you sure you want to delete <strong>{team.name}</strong>? All players, stats, and team data will be permanently removed.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`flex-1 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeam}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Cheer Team Modal */}
      {showLinkCheerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-purple-500" />
                </div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Link Cheer Team</h3>
              </div>
              <button
                onClick={() => setShowLinkCheerModal(false)}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>
            
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Select a cheer team to link to "{team.name}". This creates a two-way connection.
            </p>
            
            {availableCheerTeams.length === 0 ? (
              <div className="text-center py-8">
                <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>No cheer teams available</p>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  Create a cheer team first, then you can link it here.
                </p>
                <Link
                  to="/commissioner/teams/create"
                  onClick={() => setShowLinkCheerModal(false)}
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                >
                  Create Cheer Team
                </Link>
              </div>
            ) : (
              <div className={`flex-1 overflow-y-auto space-y-2 ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {availableCheerTeams.map((cheerTeam) => (
                  <button
                    key={cheerTeam.id}
                    onClick={() => handleLinkCheerTeam(cheerTeam.id!)}
                    disabled={linkingCheerTeam}
                    className={`w-full p-4 rounded-lg text-left flex items-center gap-3 transition-all ${
                      theme === 'dark' 
                        ? 'bg-gray-700/50 hover:bg-purple-500/20 border border-gray-600 hover:border-purple-500/50' 
                        : 'bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-400'
                    } ${linkingCheerTeam ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ backgroundColor: cheerTeam.color || '#ec4899' }}
                    >
                      {cheerTeam.name?.charAt(0) || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{cheerTeam.name}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {cheerTeam.ageGroup || 'No age group'}
                      </p>
                    </div>
                    {linkingCheerTeam ? (
                      <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                    ) : (
                      <CheckCircle2 className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Set Head Coach Modal */}
      {confirmHeadCoach && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`max-w-md w-full rounded-2xl shadow-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Confirm Head Coach</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>This action will change team leadership</p>
              </div>
            </div>
            
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Are you sure you want to set <strong>{confirmHeadCoach.name}</strong> as the Head Coach for {team?.name}?
              {team?.headCoachId && (
                <span className="block mt-2 text-sm text-amber-500">
                  This will replace the current head coach.
                </span>
              )}
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmHeadCoach(null)}
                className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSetHeadCoach(confirmHeadCoach.id)}
                disabled={settingHeadCoach === confirmHeadCoach.id}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {settingHeadCoach === confirmHeadCoach.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Setting...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Coach Confirmation Modal */}
      {removeCoachConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`max-w-md w-full rounded-2xl shadow-xl p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <UserMinus className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Remove Coach</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {removeCoachConfirm.isHeadCoach ? 'This coach is the Head Coach' : 'Remove from team roster'}
                </p>
              </div>
            </div>
            
            <p className={`mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Are you sure you want to remove <strong>{removeCoachConfirm.name}</strong> from {team?.name}?
            </p>
            
            {removeCoachConfirm.isHeadCoach && coaches.length > 1 && (
              <div className={`mb-4 p-4 rounded-lg ${theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
                <p className={`text-sm mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>
                  <AlertTriangle className="w-4 h-4" />
                  Select a new Head Coach:
                </p>
                <div className="space-y-2">
                  {coaches.filter(c => c.uid !== removeCoachConfirm.id).map((coach) => (
                    <label
                      key={coach.uid}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        newHeadCoachAfterRemove === coach.uid
                          ? theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'
                          : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="newHeadCoach"
                        value={coach.uid}
                        checked={newHeadCoachAfterRemove === coach.uid}
                        onChange={() => setNewHeadCoachAfterRemove(coach.uid)}
                        className="text-amber-500 focus:ring-amber-500"
                      />
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{coach.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {removeCoachConfirm.isHeadCoach && coaches.length === 1 && (
              <div className={`mb-4 p-4 rounded-lg ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>
                  <AlertTriangle className="w-4 h-4" />
                  This is the only coach. The team will have no Head Coach after removal.
                </p>
              </div>
            )}
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setRemoveCoachConfirm(null);
                  setNewHeadCoachAfterRemove(null);
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveCoach}
                disabled={removingCoach || (removeCoachConfirm.isHeadCoach && coaches.length > 1 && !newHeadCoachAfterRemove)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {removingCoach ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    Remove Coach
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionerTeamDetail;
