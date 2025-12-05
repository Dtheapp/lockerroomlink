import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadFile, deleteFile } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { Edit2, Save, X, HeartPulse, Plus, Shield, Activity, Droplet, CheckCircle, Pill, AlertCircle, BarChart3, Eye, Sword, User, Camera, Star, Crown, Ruler, Scale, Users, Trash2, AtSign, Link as LinkIcon, Copy, Check, ExternalLink } from 'lucide-react';
import type { Player, MedicalInfo, Team } from '../types';
import PlayerStatsModal from './stats/PlayerStatsModal';

const Profile: React.FC = () => {
  const { user, userData, players: contextPlayers, teamData } = useAuth();
  
  // PARENT PROFILE STATES
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');
  const [emergRelation, setEmergRelation] = useState('');

  // ATHLETE STATES
  const [myAthletes, setMyAthletes] = useState<Player[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<Player | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // All Teams for team selection
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  
  // Add Athlete Modal state
  const [isAddAthleteModalOpen, setIsAddAthleteModalOpen] = useState(false);
  const [addingAthlete, setAddingAthlete] = useState(false);
  const [newAthleteForm, setNewAthleteForm] = useState({
    name: '',
    username: '',
    dob: '',
    teamId: '',
    height: '',
    weight: '',
    shirtSize: '',
    pantSize: ''
  });
  
  // Username validation state
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  
  // Delete athlete confirmation
  const [deleteAthleteConfirm, setDeleteAthleteConfirm] = useState<Player | null>(null);
  const [deletingAthlete, setDeletingAthlete] = useState(false);
  
  // Player Stats Modal state
  const [viewStatsPlayer, setViewStatsPlayer] = useState<Player | null>(null);
  
  // Copy link feedback
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);

  // Full Edit Form State (including medical)
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    dob: '',
    height: '',
    weight: '',
    shirtSize: '',
    pantSize: '',
    teamId: '', // NEW: Team selection for changing teams
    // Medical
    allergies: '',
    conditions: '',
    medications: '',
    bloodType: ''
  });
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Profile photo upload for parent/coach
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [showProfilePhotoModal, setShowProfilePhotoModal] = useState(false);
  
  // Bio state for coaches
  const [bio, setBio] = useState('');
  
  // Head Coach status for coaches
  const [isHeadCoach, setIsHeadCoach] = useState(false);
  
  // Edit username validation state
  const [editUsernameError, setEditUsernameError] = useState<string | null>(null);
  const [checkingEditUsername, setCheckingEditUsername] = useState(false);

  // 1. Load Parent Data
  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setPhone(userData.phone || '');
      setSecondaryPhone(userData.secondaryPhone || '');
      setAddress(userData.address || '');
      setBio(userData.bio || '');
      if (userData.emergencyContact) {
          setEmergName(userData.emergencyContact.name || '');
          setEmergPhone(userData.emergencyContact.phone || '');
          setEmergRelation(userData.emergencyContact.relation || '');
      }
    }
  }, [userData]);

  // Check if coach is head coach of any of their teams
  useEffect(() => {
    const checkHeadCoachStatus = async () => {
      if (userData?.role !== 'Coach' || !userData?.uid) {
        setIsHeadCoach(false);
        return;
      }
      
      try {
        // Get all team IDs the coach belongs to
        const coachTeamIds = userData.teamIds || (userData.teamId ? [userData.teamId] : []);
        
        // Check each team to see if this coach is the head coach
        for (const teamId of coachTeamIds) {
          const teamDocRef = doc(db, 'teams', teamId);
          const teamDocSnap = await getDoc(teamDocRef);
          if (teamDocSnap.exists()) {
            const team = teamDocSnap.data() as Team;
            if (team.headCoachId === userData.uid || team.coachId === userData.uid) {
              setIsHeadCoach(true);
              return;
            }
          }
        }
        setIsHeadCoach(false);
      } catch (err) {
        console.error('Error checking head coach status:', err);
        setIsHeadCoach(false);
      }
    };
    
    checkHeadCoachStatus();
  }, [userData?.role, userData?.uid, userData?.teamIds, userData?.teamId]);

  // 2. Load My Athletes from Context (already loaded in AuthContext for parents)
  useEffect(() => {
      if (userData?.role === 'Parent') {
          setMyAthletes(contextPlayers);
      }
  }, [userData, contextPlayers]);

  // 3. Load all teams for team selection
  useEffect(() => {
    const fetchAllTeams = async () => {
      try {
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const teamsData = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        setAllTeams(teamsData);
      } catch (err) {
        console.error("Error fetching teams:", err);
      }
    };
    
    if (userData?.role === 'Parent') {
      fetchAllTeams();
    }
  }, [userData?.role]);

  // Username validation helper - checks if username is taken across ALL teams
  const checkUsernameAvailability = async (username: string, excludePlayerId?: string): Promise<boolean> => {
    if (!username || username.length < 3) return false;
    
    const normalizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    // Check all teams for this username
    for (const team of allTeams) {
      const playersSnapshot = await getDocs(collection(db, 'teams', team.id, 'players'));
      const playerWithUsername = playersSnapshot.docs.find(doc => {
        const playerData = doc.data();
        const playerUsername = (playerData.username || '').toLowerCase();
        return playerUsername === normalizedUsername && doc.id !== excludePlayerId;
      });
      
      if (playerWithUsername) {
        return false; // Username is taken
      }
    }
    return true; // Username is available
  };

  // Validate and format username input
  const formatUsername = (value: string): string => {
    // Remove @ if typed, lowercase, only alphanumeric and underscore
    return value.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '').substring(0, 20);
  };

  // --- HANDLERS ---

  // Copy public profile link
  const copyPublicLink = async (player: Player) => {
    if (!player.username) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const publicUrl = `${baseUrl}#/athlete/${player.username}`;
    
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedPlayerId(player.id);
      setTimeout(() => setCopiedPlayerId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name, phone, secondaryPhone, address, bio,
        emergencyContact: { name: emergName, phone: emergPhone, relation: emergRelation }
      });
      setIsEditing(false);
      setStatusMsg({ type: 'success', text: 'Profile updated successfully.' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (error) {
      console.error('Error:', error);
      setStatusMsg({ type: 'error', text: 'Failed to save changes.' });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle profile photo upload for parent/coach
  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB. Please choose a smaller image.');
      return;
    }
    
    setUploadingProfilePhoto(true);
    try {
      // Upload to Firebase Storage and store both URL and storage path in Firestore
      const path = `users/${user.uid}/profile-${Date.now()}-${file.name}`;
      const uploaded = await uploadFile(file, path);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { photoUrl: uploaded.url, photoPath: uploaded.path });
      setStatusMsg({ type: 'success', text: 'Profile photo updated!' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingProfilePhoto(false);
    }
  };
  
  // Remove profile photo
  const handleRemoveProfilePhoto = async () => {
    if (!user) return;
    
    if (!confirm('Remove your profile photo?')) return;
    
    setUploadingProfilePhoto(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      // If there's a storage path recorded, delete the underlying object
      try {
        const currentPath = (userData as any)?.photoPath;
        if (currentPath) {
          await deleteFile(currentPath);
        }
      } catch (err) {
        console.warn('Failed to delete profile photo from storage:', err);
      }

      await updateDoc(userRef, { photoUrl: null, photoPath: null });
      setStatusMsg({ type: 'success', text: 'Profile photo removed.' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (error) {
      console.error('Error removing photo:', error);
      alert('Failed to remove photo.');
    } finally {
      setUploadingProfilePhoto(false);
    }
  };



  const openEditModal = (player: Player) => {
      setSelectedAthlete(player);
      setEditForm({
        name: player.name || '',
        username: player.username || '',
        dob: player.dob || '',
        height: player.height || '',
        weight: player.weight || '',
        shirtSize: player.shirtSize || '',
        pantSize: player.pantSize || '',
        teamId: player.teamId || '',
        allergies: player.medical?.allergies || '',
        conditions: player.medical?.conditions || '',
        medications: player.medical?.medications || '',
        bloodType: player.medical?.bloodType || ''
      });
      setEditUsernameError(null);
      setIsEditModalOpen(true);
  }

  const handleSavePlayer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedAthlete || !selectedAthlete.teamId || savingPlayer) return;

      // Check if username is changing and validate
      const usernameChanged = editForm.username !== (selectedAthlete.username || '');
      if (usernameChanged && editForm.username) {
        if (editForm.username.length < 3) {
          setEditUsernameError('Username must be at least 3 characters');
          return;
        }
        
        setCheckingEditUsername(true);
        const isAvailable = await checkUsernameAvailability(editForm.username, selectedAthlete.id);
        setCheckingEditUsername(false);
        
        if (!isAvailable) {
          setEditUsernameError('This username is already taken');
          return;
        }
      }

      setSavingPlayer(true);
      try {
          const medicalData: MedicalInfo = {
              allergies: editForm.allergies,
              conditions: editForm.conditions,
              medications: editForm.medications,
              bloodType: editForm.bloodType
          };
          
          // Check if team is changing
          const isTeamChanging = editForm.teamId && editForm.teamId !== selectedAthlete.teamId;
          
          if (isTeamChanging) {
            // Move player to new team
            // 1. Create player in new team
            const newPlayerData = {
              name: editForm.name,
              username: formatUsername(editForm.username),
              dob: editForm.dob,
              height: editForm.height,
              weight: editForm.weight,
              shirtSize: editForm.shirtSize,
              pantSize: editForm.pantSize,
              medical: medicalData,
              parentId: user?.uid,
              teamId: editForm.teamId,
              number: 0, // Reset - coach will assign
              position: 'TBD',
              stats: selectedAthlete.stats || { td: 0, tkl: 0 },
              photoUrl: selectedAthlete.photoUrl || null
            };
            
            await addDoc(collection(db, 'teams', editForm.teamId, 'players'), newPlayerData);
            
            // 2. Delete player from old team
            await deleteDoc(doc(db, 'teams', selectedAthlete.teamId, 'players', selectedAthlete.id));
            
            // Reload page to refresh context
            window.location.reload();
          } else {
            // Same team - just update
            const playerRef = doc(db, 'teams', selectedAthlete.teamId, 'players', selectedAthlete.id);
            await updateDoc(playerRef, { 
              name: editForm.name,
              username: formatUsername(editForm.username),
              dob: editForm.dob,
              height: editForm.height,
              weight: editForm.weight,
              shirtSize: editForm.shirtSize,
              pantSize: editForm.pantSize,
              medical: medicalData 
            });
          }
          
          setIsEditModalOpen(false);
          setSelectedAthlete(null);
      } catch (error) {
          console.error("Error saving player:", error);
          alert('Failed to save player information.');
      } finally {
          setSavingPlayer(false);
      }
  }
  
  // Handle adding a new athlete
  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addingAthlete || !user) return;
    
    if (!newAthleteForm.teamId) {
      alert('Please select a team for your athlete');
      return;
    }
    
    if (!newAthleteForm.username || newAthleteForm.username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }
    
    // Check username availability
    setCheckingUsername(true);
    const isAvailable = await checkUsernameAvailability(newAthleteForm.username);
    setCheckingUsername(false);
    
    if (!isAvailable) {
      setUsernameError('This username is already taken');
      return;
    }
    
    setAddingAthlete(true);
    try {
      const playerData = {
        name: newAthleteForm.name,
        username: formatUsername(newAthleteForm.username),
        dob: newAthleteForm.dob,
        teamId: newAthleteForm.teamId,
        parentId: user.uid,
        height: newAthleteForm.height,
        weight: newAthleteForm.weight,
        shirtSize: newAthleteForm.shirtSize,
        pantSize: newAthleteForm.pantSize,
        number: 0, // Placeholder - coach will assign
        position: 'TBD', // To be determined by coach
        stats: { td: 0, tkl: 0 },
        medical: { allergies: 'None', conditions: 'None', medications: 'None', bloodType: '' }
      };
      
      await addDoc(collection(db, 'teams', newAthleteForm.teamId, 'players'), playerData);
      
      // Reset form and close modal
      setNewAthleteForm({ name: '', username: '', dob: '', teamId: '', height: '', weight: '', shirtSize: '', pantSize: '' });
      setUsernameError(null);
      setIsAddAthleteModalOpen(false);
      
      // Reload to refresh context with new player
      window.location.reload();
    } catch (error) {
      console.error('Error adding athlete:', error);
      alert('Failed to add athlete. Please try again.');
    } finally {
      setAddingAthlete(false);
    }
  };
  
  // Handle deleting an athlete
  const handleDeleteAthlete = async () => {
    if (!deleteAthleteConfirm || deletingAthlete) return;
    
    setDeletingAthlete(true);
    try {
      await deleteDoc(doc(db, 'teams', deleteAthleteConfirm.teamId, 'players', deleteAthleteConfirm.id));
      setDeleteAthleteConfirm(null);
      
      // Reload to refresh context
      window.location.reload();
    } catch (error) {
      console.error('Error deleting athlete:', error);
      alert('Failed to remove athlete. Please try again.');
    } finally {
      setDeletingAthlete(false);
    }
  };

  // Photo upload handlers
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAthlete || !selectedAthlete.teamId || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB. Please choose a smaller image.');
      return;
    }
    
    setUploadingPhoto(true);
    try {
      // Upload to Firebase Storage and save url + storage path on player document
      const path = `teams/${selectedAthlete.teamId}/players/${selectedAthlete.id}/photo-${Date.now()}-${file.name}`;
      const uploaded = await uploadFile(file, path);
      const playerRef = doc(db, 'teams', selectedAthlete.teamId, 'players', selectedAthlete.id);
      await updateDoc(playerRef, { photoUrl: uploaded.url, photoPath: uploaded.path });
      setSelectedAthlete({ ...selectedAthlete, photoUrl: uploaded.url, photoPath: uploaded.path });
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };
  
  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(base64);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const handleRemovePhoto = async () => {
    if (!selectedAthlete || !selectedAthlete.teamId) return;
    
    setUploadingPhoto(true);
    try {
      const playerRef = doc(db, 'teams', selectedAthlete.teamId, 'players', selectedAthlete.id);
      try {
        const currentPath = (selectedAthlete as any)?.photoPath;
        if (currentPath) {
          await deleteFile(currentPath);
        }
      } catch (err) {
        console.warn('Failed to delete player photo from storage:', err);
      }
      await updateDoc(playerRef, { photoUrl: null, photoPath: null });
      setSelectedAthlete({ ...selectedAthlete, photoUrl: undefined, photoPath: undefined });
    } catch (error) {
      console.error('Error removing photo:', error);
      alert('Failed to remove photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Helper to check if medical field has data (ignoring default 'None')
  const hasMedicalData = (val?: string) => val && val !== 'None' && val.trim() !== '';

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      
      {/* 1. PARENT PROFILE CARD */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Profile</h1>
        {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors">
                <Edit2 className="h-4 w-4" /> Edit
            </button>
        )}
      </div>

      {statusMsg && (
          <div className={`p-4 rounded-lg border ${statusMsg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-red-500/10 border-red-500/20 text-red-600'}`}>
              {statusMsg.text}
          </div>
      )}

      <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl shadow-lg dark:shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex flex-col md:flex-row items-center gap-6 border-b border-slate-200 dark:border-slate-800">
            {/* Profile Photo with Upload */}
            <div className="relative group">
              {userData?.photoUrl ? (
                <img 
                  src={userData.photoUrl} 
                  alt={name}
                  onClick={() => setShowProfilePhotoModal(true)}
                  className="h-20 w-20 rounded-full object-cover border-4 border-sky-500 cursor-pointer hover:opacity-80 transition-opacity"
                />
              ) : (
                <div className="h-20 w-20 bg-gradient-to-br from-sky-600 to-blue-700 rounded-full flex items-center justify-center text-3xl font-bold text-white">
                    {name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Photo upload overlay */}
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <input type="file" accept="image/*" onChange={handleProfilePhotoUpload} className="hidden" disabled={uploadingProfilePhoto} />
                <Camera className="w-6 h-6 text-white" />
              </label>
              {uploadingProfilePhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {userData?.photoUrl && !uploadingProfilePhoto && (
                <button 
                  onClick={handleRemoveProfilePhoto}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-lg"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="text-center md:text-left flex-1">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{name || 'User'}</h2>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
                    userData?.role === 'Coach' && isHeadCoach 
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                      : 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20'
                  }`}>
                    {userData?.role === 'Coach' && isHeadCoach && <Crown className="w-3 h-3" />}
                    {userData?.role === 'Coach' ? (isHeadCoach ? 'Head Coach' : 'Assistant Coach') : userData?.role}
                  </span>
                </div>
                {userData?.username && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <AtSign className="w-3.5 h-3.5" />
                    {userData.username}
                  </p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Hover over photo to change</p>
            </div>
        </div>

        <div className="p-6 md:p-8">
            <form onSubmit={handleSaveProfile}>
                <div className="grid gap-8 md:grid-cols-2">
                    {/* Personal Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 pb-2">Details</h3>
                        <div>
                            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                            {isEditing ? <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" /> : <p className="text-slate-900 dark:text-white font-medium">{name}</p>}
                        </div>
                        <div>
                            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Email</label>
                            <p className="text-slate-900 dark:text-white font-medium">{userData?.email}</p>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Address</label>
                            {isEditing ? <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" /> : <p className="text-slate-900 dark:text-white">{address || '--'}</p>}
                        </div>
                    </div>
                    {/* Contact Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 pb-2">Contact & Emergency</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Mobile</label>
                                {isEditing ? <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" /> : <p className="text-slate-900 dark:text-white">{phone || '--'}</p>}
                            </div>
                            <div>
                                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Secondary</label>
                                {isEditing ? <input value={secondaryPhone} onChange={e => setSecondaryPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" /> : <p className="text-slate-900 dark:text-white">{secondaryPhone || '--'}</p>}
                            </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded p-4">
                            <div className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2 mb-4"><HeartPulse className="w-5 h-5"/> Emergency Contact</div>
                            <div className="space-y-3">
                                {isEditing ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Name</label>
                                            <input value={emergName} onChange={e => setEmergName(e.target.value)} placeholder="Emergency contact name" className="w-full bg-slate-50 dark:bg-slate-950 border border-red-200 dark:border-red-900/30 rounded p-3 text-slate-900 dark:text-white" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Relationship</label>
                                                <input value={emergRelation} onChange={e => setEmergRelation(e.target.value)} placeholder="e.g., Spouse" className="w-full bg-slate-50 dark:bg-slate-950 border border-red-200 dark:border-red-900/30 rounded p-3 text-slate-900 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Phone</label>
                                                <input value={emergPhone} onChange={e => setEmergPhone(e.target.value)} placeholder="(555) 123-4567" className="w-full bg-slate-50 dark:bg-slate-950 border border-red-200 dark:border-red-900/30 rounded p-3 text-slate-900 dark:text-white" />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-2">
                                        {emergName ? (
                                            <>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-400">Name & Relationship</p>
                                                    <p className="text-slate-900 dark:text-white">{emergName} ({emergRelation})</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-400">Phone</p>
                                                    <p className="text-slate-900 dark:text-white">{emergPhone}</p>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-slate-500 italic">No contact set</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Bio Section - for Coaches */}
                {userData?.role === 'Coach' && (
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" /> About Me
                    </h3>
                    <p className="text-xs text-slate-500 mb-2">This will be displayed on your public coach profile for parents and visitors to see.</p>
                    {isEditing ? (
                      <textarea 
                        value={bio} 
                        onChange={e => setBio(e.target.value)} 
                        placeholder="Tell parents about yourself, your coaching experience, philosophy, etc..."
                        rows={4}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-3 text-slate-900 dark:text-white"
                      />
                    ) : (
                      <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{bio || <span className="text-slate-500 italic">No bio added yet. Click Edit to add one.</span>}</p>
                    )}
                  </div>
                )}
                
                {isEditing && (
                    <div className="flex justify-end gap-3 mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                        <button type="button" onClick={() => {setIsEditing(false); setName(userData?.name || ''); setBio(userData?.bio || '');}} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="h-4 w-4" /> Cancel</button>
                        <button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"><Save className="h-4 w-4" /> Save</button>
                    </div>
                )}
            </form>
        </div>
      </div>

      {/* 2. MY ATHLETES SECTION */}
      {userData?.role === 'Parent' && (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Shield className="text-sky-500"/> My Athletes</h2>
                  <button 
                    onClick={() => setIsAddAthleteModalOpen(true)}
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-orange-900/20"
                  >
                    <Plus className="w-5 h-5" /> Add Athlete
                  </button>
              </div>

              {myAthletes.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                      <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 dark:text-slate-400 mb-4">You haven't added any athletes yet.</p>
                      <p className="text-sm text-slate-500 mb-4">Add your athlete to join a team and access all features.</p>
                      <button 
                        onClick={() => setIsAddAthleteModalOpen(true)}
                        className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
                      >
                        <Plus className="h-5 w-5" /> Add Your First Athlete
                      </button>
                  </div>
              ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                      {myAthletes.map(player => {
                          const blood = player.medical?.bloodType;
                          const allergies = hasMedicalData(player.medical?.allergies);
                          const conditions = hasMedicalData(player.medical?.conditions);
                          const meds = hasMedicalData(player.medical?.medications);
                          const isHealthy = !allergies && !conditions && !meds;
                          const isStarter = player.isStarter;
                          const isCaptain = player.isCaptain;
                          const playerTeam = allTeams.find(t => t.id === player.teamId);

                          return (
                            <div 
                                key={player.id} 
                                className={`bg-slate-50 dark:bg-zinc-950 rounded-xl border p-5 relative overflow-hidden transition-all ${
                                  isStarter 
                                    ? 'border-yellow-400 dark:border-yellow-500 ring-2 ring-yellow-400/50 dark:ring-yellow-500/40 shadow-yellow-400/20 dark:shadow-yellow-500/20' 
                                    : 'border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500'
                                } shadow-lg hover:shadow-xl`}
                                style={isStarter ? { boxShadow: '0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.1)' } : {}}
                            >
                                {/* Starter Badge */}
                                {isStarter && (
                                  <div className="absolute top-2 left-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full px-2.5 py-1 shadow-lg flex items-center gap-1 z-10">
                                    <Star className="w-3 h-3 text-white fill-white" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wide">Starter</span>
                                  </div>
                                )}
                                
                                {/* Action Buttons - Top Right (stacked vertically) */}
                                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                                  <button 
                                    onClick={() => openEditModal(player)}
                                    className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-full transition-colors"
                                    title="Edit Player"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => setDeleteAthleteConfirm(player)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    title="Remove Athlete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Player Photo & Basic Info */}
                                <div className={`flex items-start gap-4 ${isStarter ? 'mt-6' : ''}`}>
                                    {/* Photo */}
                                    <div className="flex-shrink-0">
                                      {player.photoUrl ? (
                                        <div className={`w-20 h-20 rounded-full overflow-hidden border-4 ${
                                          isStarter 
                                            ? 'border-yellow-400 dark:border-yellow-500 shadow-lg shadow-yellow-400/30' 
                                            : 'border-slate-300 dark:border-slate-700'
                                        }`}>
                                          <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                                        </div>
                                      ) : (
                                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 font-mono ${
                                          isStarter 
                                            ? 'bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border-yellow-400 dark:border-yellow-500 text-yellow-700 dark:text-yellow-400 shadow-lg shadow-yellow-400/30' 
                                            : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                        }`}>
                                          {player.number || '?'}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                          {player.name}
                                          {isCaptain && <Crown className="w-5 h-5 text-amber-500 flex-shrink-0" />}
                                        </h3>
                                        {/* Username */}
                                        {player.username && (
                                          <div className="flex items-center gap-1 mt-0.5">
                                            <AtSign className="w-3 h-3 text-purple-500" />
                                            <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">{player.username}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs px-2 py-1 rounded font-bold">#{player.number || '?'}</span>
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{player.position || 'TBD'}</span>
                                        </div>
                                        {/* Team Badge */}
                                        <div className="flex items-center gap-1 mt-1.5">
                                          <Users className="w-3 h-3 text-sky-500" />
                                          <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">{playerTeam?.name || 'Unknown Team'}</span>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openEditModal(player); }}
                                            className="ml-1 text-[10px] text-sky-500 hover:text-sky-700 dark:hover:text-sky-300 underline"
                                          >
                                            (change)
                                          </button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">DOB: {player.dob || '--'}</p>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="mt-4 flex justify-center gap-4 bg-slate-100 dark:bg-black p-2 rounded-lg">
                                    <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                                        <Sword className="w-3 h-3 text-orange-500" /> <span className="font-bold">{player.stats?.td || 0}</span> TD
                                    </div>
                                    <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                                        <Shield className="w-3 h-3 text-cyan-500" /> <span className="font-bold">{player.stats?.tkl || 0}</span> TKL
                                    </div>
                                </div>

                                {/* Public Profile Link */}
                                {player.username && (
                                  <div className="mt-3 bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-200 dark:border-purple-900/30">
                                    <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                      <LinkIcon className="w-3 h-3" /> Public Profile
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-white dark:bg-zinc-800 rounded px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 truncate border border-purple-200 dark:border-purple-800">
                                        lockerroomlink.com/#/athlete/{player.username}
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); copyPublicLink(player); }}
                                        className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                                          copiedPlayerId === player.id
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-purple-500 hover:bg-purple-600 text-white'
                                        }`}
                                      >
                                        {copiedPlayerId === player.id ? (
                                          <>
                                            <Check className="w-3 h-3" />
                                            Copied!
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3" />
                                            Copy
                                          </>
                                        )}
                                      </button>
                                      <a
                                        href={`#/athlete/${player.username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 rounded transition-colors"
                                        title="View public profile"
                                      >
                                        <ExternalLink className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                                      </a>
                                    </div>
                                  </div>
                                )}

                                {/* Physical Info */}
                                {(player.height || player.weight) && (
                                  <div className="mt-3 bg-cyan-50 dark:bg-cyan-900/10 p-2 rounded border border-cyan-200 dark:border-cyan-900/30">
                                    <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                      <Ruler className="w-3 h-3" /> Physical
                                    </p>
                                    <div className="flex justify-around text-xs">
                                      {player.height && (
                                        <div>
                                          <span className="text-slate-500">Height:</span>
                                          <span className="ml-1 font-bold text-slate-900 dark:text-white">{player.height}</span>
                                        </div>
                                      )}
                                      {player.weight && (
                                        <div>
                                          <span className="text-slate-500">Weight:</span>
                                          <span className="ml-1 font-bold text-slate-900 dark:text-white">{player.weight}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Uniform Sizes */}
                                {(player.shirtSize || player.pantSize) && (
                                  <div className="mt-3 bg-orange-50 dark:bg-orange-900/10 p-2 rounded border border-orange-200 dark:border-orange-900/30">
                                    <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Uniform</p>
                                    <div className="flex justify-around text-xs">
                                      {player.shirtSize && (
                                        <div>
                                          <span className="text-slate-500">Shirt:</span>
                                          <span className="ml-1 font-bold text-slate-900 dark:text-white">{player.shirtSize}</span>
                                        </div>
                                      )}
                                      {player.pantSize && (
                                        <div>
                                          <span className="text-slate-500">Pants:</span>
                                          <span className="ml-1 font-bold text-slate-900 dark:text-white">{player.pantSize}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* MEDICAL BADGES ROW */}
                                <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
                                    {blood && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium">
                                            <Droplet className="w-3 h-3" /> {blood}
                                        </div>
                                    )}
                                    {allergies && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium">
                                            <AlertCircle className="w-3 h-3" /> Allergies
                                        </div>
                                    )}
                                    {conditions && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                            <Activity className="w-3 h-3" /> Medical
                                        </div>
                                    )}
                                    {meds && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                                            <Pill className="w-3 h-3" /> Meds
                                        </div>
                                    )}
                                    {isHealthy && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                                            <CheckCircle className="w-3 h-3" /> Medically Cleared
                                        </div>
                                    )}
                                </div>
                                
                                {/* VIEW STATS BUTTON */}
                                <button
                                  onClick={() => setViewStatsPlayer(player)}
                                  className="w-full mt-3 flex items-center justify-center gap-2 text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 py-2.5 rounded-lg border border-orange-200 dark:border-orange-900/30 transition-colors"
                                >
                                  <BarChart3 className="w-4 h-4" /> View Stats History
                                </button>
                            </div>
                          );
                      })}
                  </div>
              )}
          </div>
      )}

      {/* PLAYER STATS HISTORY MODAL */}
      {viewStatsPlayer && (
        <PlayerStatsModal
          player={viewStatsPlayer}
          teamName={teamData?.name}
          onClose={() => setViewStatsPlayer(null)}
        />
      )}

      {/* FULL EDIT PLAYER MODAL */}
      {isEditModalOpen && selectedAthlete && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-slate-50 dark:bg-zinc-950 w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="sticky top-0 bg-slate-50 dark:bg-zinc-950 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="bg-orange-100 dark:bg-orange-500/20 p-2 rounded-full">
                            <Edit2 className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                          </div>
                          <div>
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Player</h3>
                              <p className="text-slate-500 text-sm">#{selectedAthlete.number || '?'} • {selectedAthlete.position || 'TBD'}</p>
                          </div>
                      </div>
                      <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSavePlayer} className="p-6 space-y-6">
                      {/* Photo Upload */}
                      <div className="flex flex-col items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wider">Player Photo</p>
                        <div className="relative">
                          {selectedAthlete.photoUrl ? (
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-orange-500 shadow-lg">
                              <img src={selectedAthlete.photoUrl} alt={selectedAthlete.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-slate-300 dark:border-slate-700 flex items-center justify-center">
                              <User className="w-10 h-10 text-slate-400 dark:text-slate-600" />
                            </div>
                          )}
                          <label className="absolute bottom-0 right-0 bg-orange-600 hover:bg-orange-500 text-white rounded-full p-2 cursor-pointer shadow-lg transition-colors">
                            <Camera className="w-4 h-4" />
                            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                          </label>
                        </div>
                        {uploadingPhoto && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-orange-600">
                            <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                            Uploading...
                          </div>
                        )}
                        {selectedAthlete.photoUrl && !uploadingPhoto && (
                          <button type="button" onClick={handleRemovePhoto} className="mt-2 text-xs text-red-500 hover:text-red-700 underline">
                            Remove Photo
                          </button>
                        )}
                        <p className="text-[10px] text-slate-500 mt-2">Tap camera icon to upload (max 2MB)</p>
                      </div>

                      {/* Basic Info */}
                      <div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wider">Basic Information</p>
                        <div className="space-y-3">
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                              <input 
                                value={editForm.name} 
                                onChange={e => setEditForm({...editForm, name: e.target.value})} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                                required
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Date of Birth</label>
                              <input 
                                type="date"
                                value={editForm.dob} 
                                onChange={e => setEditForm({...editForm, dob: e.target.value})} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                        </div>
                      </div>

                      {/* Username */}
                      <div>
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                          <AtSign className="w-3 h-3" /> Athlete Username
                        </p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 font-medium">@</span>
                          <input 
                            value={editForm.username} 
                            onChange={e => {
                              const formatted = formatUsername(e.target.value);
                              setEditForm({...editForm, username: formatted});
                              setEditUsernameError(null);
                            }}
                            placeholder="johnny_smith"
                            className={`w-full bg-white dark:bg-black border rounded-lg p-3 pl-8 text-slate-900 dark:text-white ${
                              editUsernameError ? 'border-red-500' : 'border-purple-300 dark:border-purple-700'
                            }`}
                            minLength={3}
                            maxLength={20}
                          />
                          {checkingEditUsername && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        {editUsernameError && (
                          <p className="text-xs text-red-500 mt-1">{editUsernameError}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">Used for tracking stats history. 3-20 characters, lowercase letters, numbers, and underscores only.</p>
                      </div>

                      {/* Team Selection */}
                      <div>
                        <p className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                          <Users className="w-3 h-3" /> Team Assignment
                        </p>
                        <select 
                          value={editForm.teamId} 
                          onChange={e => setEditForm({...editForm, teamId: e.target.value})} 
                          className="w-full bg-white dark:bg-black border border-sky-300 dark:border-sky-700 rounded-lg p-3 text-slate-900 dark:text-white"
                        >
                          {allTeams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                        {editForm.teamId !== selectedAthlete?.teamId && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                            ⚠️ Changing teams will reset jersey number and position (coach will reassign)
                          </p>
                        )}
                      </div>

                      {/* Physical Info */}
                      <div>
                        <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                          <Ruler className="w-3 h-3" /> Physical Information
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Height</label>
                              <input 
                                value={editForm.height} 
                                onChange={e => setEditForm({...editForm, height: e.target.value})} 
                                placeholder="4 ft 6 in"
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Weight</label>
                              <input 
                                value={editForm.weight} 
                                onChange={e => setEditForm({...editForm, weight: e.target.value})} 
                                placeholder="85 lbs"
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                        </div>
                      </div>

                      {/* Uniform Sizes */}
                      <div>
                        <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-3 uppercase tracking-wider">Uniform Sizing</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Shirt Size</label>
                              <select 
                                value={editForm.shirtSize} 
                                onChange={e => setEditForm({...editForm, shirtSize: e.target.value})} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white"
                              >
                                <option value="">Select size...</option>
                                <option value="Youth S">Youth S</option>
                                <option value="Youth M">Youth M</option>
                                <option value="Youth L">Youth L</option>
                                <option value="Youth XL">Youth XL</option>
                                <option value="Adult S">Adult S</option>
                                <option value="Adult M">Adult M</option>
                                <option value="Adult L">Adult L</option>
                                <option value="Adult XL">Adult XL</option>
                                <option value="Adult 2XL">Adult 2XL</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Pants Size</label>
                              <select 
                                value={editForm.pantSize} 
                                onChange={e => setEditForm({...editForm, pantSize: e.target.value})} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white"
                              >
                                <option value="">Select size...</option>
                                <option value="Youth S">Youth S</option>
                                <option value="Youth M">Youth M</option>
                                <option value="Youth L">Youth L</option>
                                <option value="Youth XL">Youth XL</option>
                                <option value="Adult S">Adult S</option>
                                <option value="Adult M">Adult M</option>
                                <option value="Adult L">Adult L</option>
                                <option value="Adult XL">Adult XL</option>
                                <option value="Adult 2XL">Adult 2XL</option>
                              </select>
                          </div>
                        </div>
                      </div>

                      {/* Medical Information */}
                      <div className="bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/30 p-4">
                        <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                          <HeartPulse className="w-3 h-3" /> Medical Information
                        </p>
                        <div className="space-y-3">
                          <div>
                              <label className="block text-xs text-red-600 dark:text-red-400 mb-1 font-medium">Blood Type</label>
                              <input 
                                value={editForm.bloodType} 
                                onChange={e => setEditForm({...editForm, bloodType: e.target.value})} 
                                placeholder="e.g. O+"
                                className="w-full bg-white dark:bg-black border border-red-200 dark:border-red-900/30 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Allergies</label>
                              <textarea 
                                rows={2} 
                                value={editForm.allergies} 
                                onChange={e => setEditForm({...editForm, allergies: e.target.value})} 
                                placeholder="Peanuts, Penicillin..."
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Medical Conditions</label>
                              <textarea 
                                rows={2} 
                                value={editForm.conditions} 
                                onChange={e => setEditForm({...editForm, conditions: e.target.value})} 
                                placeholder="Asthma, Diabetes..."
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Current Medications</label>
                              <textarea 
                                rows={2} 
                                value={editForm.medications} 
                                onChange={e => setEditForm({...editForm, medications: e.target.value})} 
                                placeholder="Inhaler before games..."
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                          <button 
                            type="button" 
                            onClick={() => setIsEditModalOpen(false)} 
                            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            disabled={savingPlayer}
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            disabled={savingPlayer} 
                            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
                          >
                            {savingPlayer ? (
                              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                            ) : (
                              <><Save className="w-4 h-4" /> Save Changes</>
                            )}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* ADD ATHLETE MODAL */}
      {isAddAthleteModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-50 dark:bg-zinc-950 w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-slate-50 dark:bg-zinc-950 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 dark:bg-orange-500/20 p-2 rounded-full">
                  <Plus className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Athlete</h3>
                  <p className="text-slate-500 text-sm">Register your athlete to a team</p>
                </div>
              </div>
              <button onClick={() => setIsAddAthleteModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddAthlete} className="p-6 space-y-4">
              {/* Team Selection */}
              <div>
                <label className="block text-xs font-bold text-sky-600 dark:text-sky-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3" /> Select Team *
                </label>
                <select 
                  value={newAthleteForm.teamId} 
                  onChange={e => setNewAthleteForm({...newAthleteForm, teamId: e.target.value})} 
                  className="w-full bg-white dark:bg-black border border-sky-300 dark:border-sky-700 rounded-lg p-3 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Choose a team...</option>
                  {allTeams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Contact your coach if you don't see your team</p>
              </div>
              
              {/* Basic Info */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Athlete's Full Name *</label>
                <input 
                  value={newAthleteForm.name} 
                  onChange={e => setNewAthleteForm({...newAthleteForm, name: e.target.value})} 
                  placeholder="John Smith"
                  className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date of Birth *</label>
                <input 
                  type="date"
                  value={newAthleteForm.dob} 
                  onChange={e => setNewAthleteForm({...newAthleteForm, dob: e.target.value})} 
                  className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                  required
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-purple-600 dark:text-purple-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                  <AtSign className="w-3 h-3" /> Athlete Username *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 font-medium">@</span>
                  <input 
                    value={newAthleteForm.username} 
                    onChange={e => {
                      const formatted = formatUsername(e.target.value);
                      setNewAthleteForm({...newAthleteForm, username: formatted});
                      setUsernameError(null);
                    }}
                    placeholder="johnny_smith"
                    className={`w-full bg-white dark:bg-black border rounded-lg p-3 pl-8 text-slate-900 dark:text-white ${
                      usernameError ? 'border-red-500' : 'border-purple-300 dark:border-purple-700'
                    }`}
                    required
                    minLength={3}
                    maxLength={20}
                  />
                  {checkingUsername && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {usernameError && (
                  <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">3-20 characters, lowercase letters, numbers, and underscores only</p>
              </div>

              {/* Physical Info */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-3 uppercase tracking-wider">Physical Information (Optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Height</label>
                    <input 
                      value={newAthleteForm.height} 
                      onChange={e => setNewAthleteForm({...newAthleteForm, height: e.target.value})} 
                      placeholder="4 ft 6 in"
                      className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Weight</label>
                    <input 
                      value={newAthleteForm.weight} 
                      onChange={e => setNewAthleteForm({...newAthleteForm, weight: e.target.value})} 
                      placeholder="85 lbs"
                      className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                    />
                  </div>
                </div>
              </div>

              {/* Uniform Sizes */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-3 uppercase tracking-wider">Uniform Sizing (Optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Shirt Size</label>
                    <select 
                      value={newAthleteForm.shirtSize} 
                      onChange={e => setNewAthleteForm({...newAthleteForm, shirtSize: e.target.value})} 
                      className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white"
                    >
                      <option value="">Select size...</option>
                      <option value="Youth S">Youth S</option>
                      <option value="Youth M">Youth M</option>
                      <option value="Youth L">Youth L</option>
                      <option value="Youth XL">Youth XL</option>
                      <option value="Adult S">Adult S</option>
                      <option value="Adult M">Adult M</option>
                      <option value="Adult L">Adult L</option>
                      <option value="Adult XL">Adult XL</option>
                      <option value="Adult 2XL">Adult 2XL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Pants Size</label>
                    <select 
                      value={newAthleteForm.pantSize} 
                      onChange={e => setNewAthleteForm({...newAthleteForm, pantSize: e.target.value})} 
                      className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white"
                    >
                      <option value="">Select size...</option>
                      <option value="Youth S">Youth S</option>
                      <option value="Youth M">Youth M</option>
                      <option value="Youth L">Youth L</option>
                      <option value="Youth XL">Youth XL</option>
                      <option value="Adult S">Adult S</option>
                      <option value="Adult M">Adult M</option>
                      <option value="Adult L">Adult L</option>
                      <option value="Adult XL">Adult XL</option>
                      <option value="Adult 2XL">Adult 2XL</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="bg-sky-50 dark:bg-sky-900/20 p-3 rounded-lg border border-sky-200 dark:border-sky-900/30">
                <p className="text-xs text-sky-700 dark:text-sky-400">
                  💡 Your coach will assign a jersey number and position after reviewing your athlete.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setIsAddAthleteModalOpen(false)} 
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  disabled={addingAthlete}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={addingAthlete} 
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  {addingAthlete ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Add Athlete</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ATHLETE CONFIRMATION MODAL */}
      {deleteAthleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Remove Athlete</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <button 
                onClick={() => setDeleteAthleteConfirm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                {deleteAthleteConfirm.photoUrl ? (
                  <img src={deleteAthleteConfirm.photoUrl} alt={deleteAthleteConfirm.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                    #{deleteAthleteConfirm.number || '?'}
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{deleteAthleteConfirm.name}</p>
                  <p className="text-xs text-slate-500">{allTeams.find(t => t.id === deleteAthleteConfirm.teamId)?.name || 'Unknown Team'}</p>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              Are you sure you want to remove this athlete? All stats and team data associated with this player will be removed.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteAthleteConfirm(null)}
                disabled={deletingAthlete}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAthlete}
                disabled={deletingAthlete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deletingAthlete ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Photo Modal */}
      {showProfilePhotoModal && userData?.photoUrl && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowProfilePhotoModal(false)}
        >
          <div className="relative max-w-2xl max-h-[80vh]">
            <button
              onClick={() => setShowProfilePhotoModal(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-zinc-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={userData.photoUrl} 
              alt={name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <p className="text-center text-white font-bold mt-4">{name}</p>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;