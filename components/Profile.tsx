import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot, getDocs, deleteDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { uploadFile, deleteFile } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { calculateAgeGroup } from '../services/ageValidator';
import { getPlayerRegistrationStatus, removeFromDraftPool, removeFromTeamRoster, type PlayerRegistrationStatus } from '../services/eventService';
import { Edit2, Save, X, HeartPulse, Plus, Shield, Activity, Droplet, CheckCircle, Pill, AlertCircle, BarChart3, Eye, Sword, User, Camera, Star, Crown, Ruler, Scale, Users, Trash2, AtSign, Link as LinkIcon, Copy, Check, ExternalLink, Film, Play, UserCheck, Key, Clock, XCircle, MinusCircle } from 'lucide-react';
import type { Player, MedicalInfo, Team, PlayerFilmEntry } from '../types';
import PlayerStatsModal from './stats/PlayerStatsModal';
import PlayerStatsDisplay from './stats/PlayerStatsDisplay';

const Profile: React.FC = () => {
  const { user, userData, players: contextPlayers, teamData, selectedSportContext } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  
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
    firstName: '',
    lastName: '',
    nickname: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    username: '',
    dob: '',
    heightFt: '',
    heightIn: '',
    weight: '',
    helmetSize: '',
    shirtSize: '',
    pantSize: ''
  });
  
  // Username validation state
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  
  // Delete athlete confirmation
  const [deleteAthleteConfirm, setDeleteAthleteConfirm] = useState<Player | null>(null);
  const [deletingAthlete, setDeletingAthlete] = useState(false);
  
  // Release athlete (make independent account)
  const [releaseAthleteConfirm, setReleaseAthleteConfirm] = useState<Player | null>(null);
  const [releasingAthlete, setReleasingAthlete] = useState(false);
  const [releasePassword, setReleasePassword] = useState('');
  const [releaseError, setReleaseError] = useState('');
  
  // Player Stats Modal state
  const [viewStatsPlayer, setViewStatsPlayer] = useState<Player | null>(null);
  
  // Copy link feedback
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);
  const [copiedCoachLink, setCopiedCoachLink] = useState(false);

  // Film Room state for parents
  const [athleteFilmRooms, setAthleteFilmRooms] = useState<Record<string, PlayerFilmEntry[]>>({});
  const [showFilmRoomForPlayer, setShowFilmRoomForPlayer] = useState<Player | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [deleteFilmConfirm, setDeleteFilmConfirm] = useState<{ playerId: string; film: PlayerFilmEntry } | null>(null);
  const [deletingFilm, setDeletingFilm] = useState(false);
  const [filmSportFilter, setFilmSportFilter] = useState<string | null>(null); // Filter films by sport
  
  // Add film state for parents
  const [showAddFilmForPlayer, setShowAddFilmForPlayer] = useState<Player | null>(null);
  const [newFilmForm, setNewFilmForm] = useState({ 
    title: '', 
    url: '', 
    category: 'Game Film' as 'Game Film' | 'Highlights', 
    description: '',
    sport: 'football' as 'football' | 'basketball' | 'cheer' | 'soccer' | 'baseball' | 'volleyball' | 'other'
  });
  const [addingFilm, setAddingFilm] = useState(false);
  const [addFilmError, setAddFilmError] = useState('');

  // Full Edit Form State (including medical)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    name: '',
    username: '',
    dob: '',
    heightFt: '',
    heightIn: '',
    weight: '',
    helmetSize: '',
    shirtSize: '',
    pantSize: '',
    teamId: '', // NEW: Team selection for changing teams
    bio: '', // Bio about the athlete
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
  
  // Coach teams with positions
  const [coachTeamPositions, setCoachTeamPositions] = useState<{ teamId: string; teamName: string; isHeadCoach: boolean }[]>([]);
  
  // Edit username validation state
  const [editUsernameError, setEditUsernameError] = useState<string | null>(null);
  const [checkingEditUsername, setCheckingEditUsername] = useState(false);

  // Player registration/draft status (for each athlete)
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, PlayerRegistrationStatus>>({});
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [removingFromPool, setRemovingFromPool] = useState<string | null>(null);
  const [removingFromTeam, setRemovingFromTeam] = useState<string | null>(null);

  // Helper: Check if player is 18+ years old
  const isPlayerAdult = (dob: string | undefined): boolean => {
    if (!dob) return false;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

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

  // Check if navigated with state to open Add Athlete modal
  useEffect(() => {
    const state = location.state as { openAddAthlete?: boolean } | null;
    if (state?.openAddAthlete && userData?.role === 'Parent') {
      setIsAddAthleteModalOpen(true);
      // Clear the state so refreshing doesn't reopen
      window.history.replaceState({}, document.title);
    }
  }, [location.state, userData?.role]);

  // Fetch all teams the coach belongs to and their positions
  useEffect(() => {
    const fetchCoachTeamPositions = async () => {
      if (userData?.role !== 'Coach' || !userData?.uid) {
        setCoachTeamPositions([]);
        return;
      }
      
      try {
        const positions: { teamId: string; teamName: string; isHeadCoach: boolean }[] = [];
        const processedTeamIds = new Set<string>();
        
        // Fetch the coach's latest data directly from Firestore to ensure we have current teamIds
        const coachDocSnap = await getDoc(doc(db, 'users', userData.uid));
        const coachData = coachDocSnap.exists() ? coachDocSnap.data() : null;
        
        // Method 1: Get teams from the coach's teamIds array (from fresh Firestore data)
        const coachTeamIds: string[] = [];
        if (coachData?.teamIds && Array.isArray(coachData.teamIds)) {
          coachTeamIds.push(...coachData.teamIds);
        }
        if (coachData?.teamId && !coachTeamIds.includes(coachData.teamId)) {
          coachTeamIds.push(coachData.teamId);
        }
        // Also include from userData in case it has more recent local state
        if (userData.teamIds) {
          userData.teamIds.forEach((tid: string) => {
            if (!coachTeamIds.includes(tid)) coachTeamIds.push(tid);
          });
        }
        if (userData.teamId && !coachTeamIds.includes(userData.teamId)) {
          coachTeamIds.push(userData.teamId);
        }
        
        // Fetch ALL teams at once (more efficient than individual fetches)
        const allTeamsSnapshot = await getDocs(collection(db, 'teams'));
        const allTeamsMap = new Map<string, Team>();
        allTeamsSnapshot.docs.forEach(teamDoc => {
          allTeamsMap.set(teamDoc.id, { id: teamDoc.id, ...teamDoc.data() } as Team);
        });
        
        // Process teams from coach's teamIds
        for (const teamId of coachTeamIds) {
          if (processedTeamIds.has(teamId)) continue;
          
          const team = allTeamsMap.get(teamId);
          if (team) {
            processedTeamIds.add(teamId);
            const isHeadCoach = team.headCoachId === userData.uid || team.coachId === userData.uid;
            positions.push({
              teamId,
              teamName: team.name || teamId,
              isHeadCoach
            });
          }
        }
        
        // Method 2: Also find any teams where this coach is in coachIds array, headCoachId, or coachId
        // This is the most reliable method - checks the team's own list of coaches
        allTeamsMap.forEach((team, teamId) => {
          if (processedTeamIds.has(teamId)) return;
          
          const isInCoachIds = team.coachIds && team.coachIds.includes(userData.uid);
          const isHeadOrMain = team.headCoachId === userData.uid || team.coachId === userData.uid;
          
          if (isInCoachIds || isHeadOrMain) {
            processedTeamIds.add(teamId);
            positions.push({
              teamId,
              teamName: team.name || teamId,
              isHeadCoach: isHeadOrMain
            });
          }
        });
        
        // Sort: head coach positions first, then alphabetically by team name
        positions.sort((a, b) => {
          if (a.isHeadCoach !== b.isHeadCoach) {
            return b.isHeadCoach ? 1 : -1;
          }
          return a.teamName.localeCompare(b.teamName);
        });
        
        setCoachTeamPositions(positions);
      } catch (err) {
        console.error('Error fetching coach team positions:', err);
        setCoachTeamPositions([]);
      }
    };
    
    fetchCoachTeamPositions();
  }, [userData?.role, userData?.uid, userData?.teamIds, userData?.teamId, teamData]);

  // 2. Load My Athletes from Context (already loaded in AuthContext for parents)
  // ENRICH with roster data (number, position) if they're on a team
  useEffect(() => {
      if (userData?.role === 'Parent' && contextPlayers.length > 0) {
          const enrichWithRosterData = async () => {
              const enriched = await Promise.all(contextPlayers.map(async (player) => {
                  // If player is on a team, look up roster for coach-assigned fields
                  if (player.teamId) {
                      try {
                          let rosterData: any = null;
                          
                          // Method 1: Direct lookup by rosterPlayerId
                          if (player.rosterPlayerId) {
                              const rosterDoc = await getDoc(doc(db, 'teams', player.teamId, 'players', player.rosterPlayerId));
                              if (rosterDoc.exists()) {
                                  rosterData = rosterDoc.data();
                              }
                          }
                          
                          // Method 2: Fallback - search roster by athleteId
                          if (!rosterData) {
                              const rosterQuery = query(
                                  collection(db, 'teams', player.teamId, 'players'),
                                  where('athleteId', '==', player.id)
                              );
                              const rosterSnap = await getDocs(rosterQuery);
                              if (!rosterSnap.empty) {
                                  rosterData = rosterSnap.docs[0].data();
                              }
                          }
                          
                          if (rosterData) {
                              console.log('[Profile] Enriching player from roster:', {
                                  playerId: player.id,
                                  rosterNumber: rosterData.number,
                                  rosterPosition: rosterData.position
                              });
                              return {
                                  ...player,
                                  // Coach-assigned fields from roster (if not already on athlete profile)
                                  number: player.number || rosterData.number || 0,
                                  position: player.position || rosterData.position || 'TBD',
                                  isStarter: player.isStarter ?? rosterData.isStarter ?? false,
                                  isCaptain: player.isCaptain ?? rosterData.isCaptain ?? false,
                              };
                          }
                      } catch (err) {
                          console.log('[Profile] Could not enrich from roster:', err);
                      }
                  }
                  return player;
              }));
              setMyAthletes(enriched);
          };
          enrichWithRosterData();
      } else {
          setMyAthletes(contextPlayers);
      }
  }, [userData?.role, contextPlayers]);

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

  // 4. Load registration/draft status for each athlete
  useEffect(() => {
    if (userData?.role !== 'Parent' || myAthletes.length === 0) return;
    
    const fetchPlayerStatuses = async () => {
      setLoadingStatuses(true);
      const statuses: Record<string, PlayerRegistrationStatus> = {};
      
      for (const athlete of myAthletes) {
        if (!athlete.id) continue;
        
        try {
          // Pass player name as fallback for draft pool search
          const status = await getPlayerRegistrationStatus(athlete.id, athlete.teamId, athlete.name);
          statuses[athlete.id] = status;
        } catch (err) {
          console.error(`Error fetching status for athlete ${athlete.id}:`, err);
          statuses[athlete.id] = { status: 'not-registered' };
        }
      }
      
      setPlayerStatuses(statuses);
      setLoadingStatuses(false);
    };
    
    fetchPlayerStatuses();
  }, [userData?.role, myAthletes]);

  // 5. Load film room entries for parent's athletes
  useEffect(() => {
    if (userData?.role !== 'Parent' || myAthletes.length === 0) return;
    
    const fetchFilmRooms = async () => {
      const filmRooms: Record<string, PlayerFilmEntry[]> = {};
      
      for (const athlete of myAthletes) {
        if (!athlete.teamId || !athlete.id) continue;
        
        try {
          const filmSnapshot = await getDocs(collection(db, 'teams', athlete.teamId, 'players', athlete.id, 'filmRoom'));
          const films = filmSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlayerFilmEntry));
          // Sort by taggedAt descending
          films.sort((a, b) => {
            const aTime = a.taggedAt?.toMillis?.() || 0;
            const bTime = b.taggedAt?.toMillis?.() || 0;
            return bTime - aTime;
          });
          filmRooms[athlete.id] = films;
        } catch (err) {
          console.error(`Error fetching film room for athlete ${athlete.id}:`, err);
          filmRooms[athlete.id] = [];
        }
      }
      
      setAthleteFilmRooms(filmRooms);
    };
    
    fetchFilmRooms();
  }, [userData?.role, myAthletes]);

  // Delete film room entry handler
  const handleDeleteFilmEntry = async () => {
    if (!deleteFilmConfirm) return;
    
    const { playerId, film } = deleteFilmConfirm;
    const athlete = myAthletes.find(a => a.id === playerId);
    if (!athlete?.teamId) return;
    
    setDeletingFilm(true);
    try {
      await deleteDoc(doc(db, 'teams', athlete.teamId, 'players', playerId, 'filmRoom', film.id));
      
      // Update local state
      setAthleteFilmRooms(prev => ({
        ...prev,
        [playerId]: prev[playerId].filter(f => f.id !== film.id)
      }));
      
      setDeleteFilmConfirm(null);
    } catch (err) {
      console.error('Error deleting film entry:', err);
    } finally {
      setDeletingFilm(false);
    }
  };

  // Extract YouTube ID from URL
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Add film to athlete's film room handler
  const handleAddFilmEntry = async () => {
    if (!showAddFilmForPlayer || !user) return;
    
    const athlete = myAthletes.find(a => a.id === showAddFilmForPlayer.id);
    if (!athlete?.teamId) return;
    
    // Validate URL
    const youtubeId = extractYouTubeId(newFilmForm.url);
    if (!youtubeId) {
      setAddFilmError('Please enter a valid YouTube URL');
      return;
    }
    
    if (!newFilmForm.title.trim()) {
      setAddFilmError('Please enter a title for the video');
      return;
    }
    
    setAddingFilm(true);
    setAddFilmError('');
    
    try {
      // Get team name for the film entry
      const teamDoc = await getDoc(doc(db, 'teams', athlete.teamId));
      const teamName = teamDoc.exists() ? (teamDoc.data() as Team).name : 'Unknown Team';
      
      const filmEntry: Omit<PlayerFilmEntry, 'id'> = {
        videoId: `parent-upload-${Date.now()}`, // Parent-uploaded film, no video document reference
        youtubeId,
        title: newFilmForm.title.trim(),
        description: newFilmForm.description.trim() || undefined,
        category: newFilmForm.category,
        teamId: athlete.teamId,
        teamName,
        sport: newFilmForm.sport, // Sport tag for multi-sport support
        taggedAt: new Date() as any, // Will be converted to Timestamp by Firestore
        taggedBy: user.uid
      };
      
      // Add to player's film room
      const filmRef = await addDoc(
        collection(db, 'teams', athlete.teamId, 'players', athlete.id, 'filmRoom'),
        filmEntry
      );
      
      // Update local state
      setAthleteFilmRooms(prev => ({
        ...prev,
        [athlete.id]: [{ id: filmRef.id, ...filmEntry }, ...(prev[athlete.id] || [])]
      }));
      
      // Reset form and close modal
      setNewFilmForm({ title: '', url: '', category: 'Game Film', description: '', sport: 'football' });
      setShowAddFilmForPlayer(null);
    } catch (err) {
      console.error('Error adding film entry:', err);
      setAddFilmError('Failed to add video. Please try again.');
    } finally {
      setAddingFilm(false);
    }
  };

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

  const copyCoachPublicLink = async () => {
    if (!userData?.username) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const publicUrl = `${baseUrl}#/coach/${userData.username}`;
    
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedCoachLink(true);
      setTimeout(() => setCopiedCoachLink(false), 2000);
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
      
      // Parse existing height string like "4 ft 6 in" into separate ft/in values
      let heightFt = '';
      let heightIn = '';
      if (player.height) {
        const heightMatch = player.height.match(/(\d+)\s*ft\s*(\d+)\s*in/i);
        if (heightMatch) {
          heightFt = heightMatch[1];
          heightIn = heightMatch[2];
        } else {
          // Try simple number parsing if format is different
          const parts = player.height.replace(/[^\d\s]/g, '').trim().split(/\s+/);
          if (parts.length >= 1) heightFt = parts[0];
          if (parts.length >= 2) heightIn = parts[1];
        }
      }
      
      setEditForm({
        firstName: player.firstName || player.name?.split(' ')[0] || '',
        lastName: player.lastName || player.name?.split(' ').slice(1).join(' ') || '',
        nickname: player.nickname || '',
        gender: player.gender || '',
        name: player.name || '',
        username: player.username || '',
        dob: player.dob || '',
        heightFt,
        heightIn,
        weight: player.weight || '',
        helmetSize: player.helmetSize || '',
        shirtSize: player.shirtSize || '',
        pantSize: player.pantSize || '',
        teamId: player.teamId || '',
        bio: player.bio || '',
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
      if (!selectedAthlete || savingPlayer) return;

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
          
          // NEW ARCHITECTURE: Parent ALWAYS writes to athlete profile (players/{id})
          // Roster doc is read-only for parents - only coaches write to it
          // The athlete profile is the SOURCE OF TRUTH for parent-editable fields
          
          // Combine height ft/in into formatted string
          const heightStr = editForm.heightFt || editForm.heightIn 
            ? `${editForm.heightFt || 0} ft ${editForm.heightIn || 0} in`
            : '';
          
          const updateData = {
            firstName: editForm.firstName,
            lastName: editForm.lastName,
            nickname: editForm.nickname || '',
            gender: editForm.gender || '',
            name: `${editForm.firstName} ${editForm.lastName}`.trim() || editForm.name,
            username: formatUsername(editForm.username),
            dob: editForm.dob,
            height: heightStr,
            weight: editForm.weight,
            helmetSize: editForm.helmetSize,
            shirtSize: editForm.shirtSize,
            pantSize: editForm.pantSize,
            bio: editForm.bio || '',
            medical: medicalData,
            updatedAt: serverTimestamp()
          };
          
          // Always update the athlete profile (top-level players collection)
          const playerRef = doc(db, 'players', selectedAthlete.id);
          await updateDoc(playerRef, updateData);
          console.log('[Profile] ✅ Saved athlete profile:', selectedAthlete.id);
          
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
    
    // Validate required fields
    if (!newAthleteForm.firstName?.trim() || !newAthleteForm.lastName?.trim()) {
      alert('Please enter the athlete\'s first and last name');
      return;
    }
    
    if (!newAthleteForm.dob) {
      alert('Please enter the athlete\'s date of birth');
      return;
    }
    
    if (!newAthleteForm.gender) {
      alert('Please select the athlete\'s gender');
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
      // Combine height from ft/in inputs
      const heightStr = newAthleteForm.heightFt || newAthleteForm.heightIn 
        ? `${newAthleteForm.heightFt || 0} ft ${newAthleteForm.heightIn || 0} in`
        : '';
      
      // Calculate age group from DOB using Sept 10 cutoff
      const calculatedAgeGroup = calculateAgeGroup(newAthleteForm.dob);
      
      const playerData = {
        firstName: newAthleteForm.firstName.trim(),
        lastName: newAthleteForm.lastName.trim(),
        nickname: newAthleteForm.nickname?.trim() || undefined,
        name: `${newAthleteForm.firstName.trim()} ${newAthleteForm.lastName.trim()}`,
        gender: newAthleteForm.gender,
        ageGroup: calculatedAgeGroup || undefined, // e.g., "9U", "10U"
        username: formatUsername(newAthleteForm.username),
        dob: newAthleteForm.dob,
        teamId: null, // Players start unassigned - they register to teams separately
        parentId: user.uid,
        height: heightStr,
        weight: newAthleteForm.weight,
        helmetSize: newAthleteForm.helmetSize,
        shirtSize: newAthleteForm.shirtSize,
        pantSize: newAthleteForm.pantSize,
        number: 0, // Placeholder - coach will assign
        position: 'TBD', // To be determined by coach
        stats: { td: 0, tkl: 0 },
        medical: { allergies: 'None', conditions: 'None', medications: 'None', bloodType: '' },
        status: 'unassigned', // Mark as unassigned - ready to register to a team
        createdAt: new Date().toISOString()
      };
      
      // Save to top-level players collection (not under a team)
      await addDoc(collection(db, 'players'), playerData);
      
      // Reset form and close modal
      setNewAthleteForm({ firstName: '', lastName: '', nickname: '', gender: '', username: '', dob: '', heightFt: '', heightIn: '', weight: '', helmetSize: '', shirtSize: '', pantSize: '' });
      setUsernameError(null);
      setIsAddAthleteModalOpen(false);
      
      // Reload to refresh context with new player
      window.location.reload();
    } catch (error: any) {
      console.error('Error adding athlete:', error);
      const errorMessage = error?.code === 'permission-denied' 
        ? 'Permission denied. Please try logging out and back in.'
        : error?.message || 'Failed to add athlete. Please try again.';
      alert(errorMessage);
    } finally {
      setAddingAthlete(false);
    }
  };
  
  // Handle deleting an athlete
  const handleDeleteAthlete = async () => {
    if (!deleteAthleteConfirm || deletingAthlete) return;
    
    setDeletingAthlete(true);
    try {
      // Delete from appropriate collection based on whether player has a team
      if (deleteAthleteConfirm.teamId) {
        await deleteDoc(doc(db, 'teams', deleteAthleteConfirm.teamId, 'players', deleteAthleteConfirm.id));
      } else {
        await deleteDoc(doc(db, 'players', deleteAthleteConfirm.id));
      }
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

  // Handle releasing an athlete to their own independent account
  const handleReleaseAthlete = async () => {
    if (!releaseAthleteConfirm || !releasePassword || releasingAthlete || !user) return;
    
    // Athlete must have a username to be released
    if (!releaseAthleteConfirm.username) {
      setReleaseError('This athlete needs a username before they can be released. Edit their profile to add one.');
      return;
    }
    
    setReleasingAthlete(true);
    setReleaseError('');
    
    try {
      // 1. Re-authenticate parent to verify password
      const credential = EmailAuthProvider.credential(user.email!, releasePassword);
      await reauthenticateWithCredential(user, credential);
      
      // 2. Create a new Firebase Auth account for the released player
      // Use a generated email pattern: username@player.osys.team
      const playerEmail = `${releaseAthleteConfirm.username.toLowerCase()}@player.osys.team`;
      
      // Create the auth account with parent's password (they'll change it on first login)
      const playerCredential = await createUserWithEmailAndPassword(auth, playerEmail, releasePassword);
      const playerUid = playerCredential.user.uid;
      
      // 3. Create user profile for the player
      await setDoc(doc(db, 'users', playerUid), {
        uid: playerUid,
        name: releaseAthleteConfirm.name,
        email: playerEmail,
        username: releaseAthleteConfirm.username.toLowerCase(),
        role: 'Athlete',
        teamId: releaseAthleteConfirm.teamId || null,
        playerId: releaseAthleteConfirm.id,
        forceAccountSetup: true, // Forces email + password change on first login
        releasedFromParent: user.uid,
        releasedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        credits: 0
      });
      
      // 4. Update the player document to mark as released
      const playerDocRef = releaseAthleteConfirm.teamId 
        ? doc(db, 'teams', releaseAthleteConfirm.teamId, 'players', releaseAthleteConfirm.id)
        : doc(db, 'players', releaseAthleteConfirm.id);
      
      await updateDoc(playerDocRef, {
        released: true,
        releasedAt: serverTimestamp(),
        releasedUid: playerUid,
        parentId: null // Remove parent link
      });
      
      // 5. Sign back in as parent (creating new user signs out current user)
      // We need to sign the parent back in
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, user.email!, releasePassword);
      
      // Success!
      setReleaseAthleteConfirm(null);
      setReleasePassword('');
      alert(`${releaseAthleteConfirm.name} has been released! They can now log in with their username "${releaseAthleteConfirm.username}" and your password. They will be prompted to set their own email and password on first login.`);
      
      // Reload to refresh
      window.location.reload();
    } catch (error: any) {
      console.error('Error releasing athlete:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setReleaseError('Incorrect password. Please enter your current password.');
      } else if (error.code === 'auth/email-already-in-use') {
        setReleaseError('This athlete already has an account. They may already be released.');
      } else {
        setReleaseError(error.message || 'Failed to release athlete. Please try again.');
      }
    } finally {
      setReleasingAthlete(false);
    }
  };

  // Photo upload handlers
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAthlete || !e.target.files || e.target.files.length === 0) return;
    
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
      // ALWAYS upload to top-level players collection (athlete profile)
      // The roster just displays this photo - we don't store it on the team player doc
      const storagePath = `players/${selectedAthlete.id}/photo-${Date.now()}-${file.name}`;
      const uploaded = await uploadFile(file, storagePath);
      
      // ALWAYS update the top-level player document (athlete profile)
      // Parent owns this document - permissions are already set correctly
      const playerRef = doc(db, 'players', selectedAthlete.id);
      await updateDoc(playerRef, { photoUrl: uploaded.url, photoPath: uploaded.path });
      setSelectedAthlete({ ...selectedAthlete, photoUrl: uploaded.url, photoPath: uploaded.path });
      
      console.log('✅ Photo uploaded to athlete profile:', selectedAthlete.id);
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
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                <Edit2 className="h-4 w-4" /> Edit
            </button>
        )}
      </div>

      {statusMsg && (
          <div className={`p-4 rounded-lg border ${statusMsg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-red-500/10 border-red-500/20 text-red-600'}`}>
              {statusMsg.text}
          </div>
      )}

      <div className={`rounded-xl shadow-lg border overflow-hidden ${theme === 'dark' ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-white/10' : 'bg-white border-zinc-200'}`}>
        <div className={`p-6 flex flex-col md:flex-row items-center gap-6 border-b ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
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
                  {/* Show role badge - for coaches show team positions */}
                  {userData?.role === 'Coach' && coachTeamPositions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {coachTeamPositions.map((pos, idx) => (
                        <span 
                          key={idx}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
                            pos.isHeadCoach 
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                              : 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20'
                          }`}
                        >
                          {pos.isHeadCoach && <Crown className="w-3 h-3" />}
                          {pos.isHeadCoach ? 'Head Coach' : 'Coach'} | {pos.teamName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
                      {userData?.role}
                    </span>
                  )}
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
                                {isEditing ? <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" /> : (
                                  phone ? (
                                    <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`} className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1">
                                      {phone}
                                    </a>
                                  ) : <p className="text-slate-900 dark:text-white">--</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Secondary</label>
                                {isEditing ? <input value={secondaryPhone} onChange={e => setSecondaryPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" /> : (
                                  secondaryPhone ? (
                                    <a href={`tel:${secondaryPhone.replace(/[^0-9+]/g, '')}`} className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1">
                                      {secondaryPhone}
                                    </a>
                                  ) : <p className="text-slate-900 dark:text-white">--</p>
                                )}
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
                                                    {emergPhone ? (
                                                      <a href={`tel:${emergPhone.replace(/[^0-9+]/g, '')}`} className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1">
                                                        {emergPhone}
                                                      </a>
                                                    ) : <p className="text-slate-900 dark:text-white">--</p>}
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

                {/* Public Page Link - for Coaches */}
                {userData?.role === 'Coach' && userData?.username && (
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-200 dark:border-purple-900/30">
                      <h3 className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" /> Public Page
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Share this link with parents and loved ones so they can view your public coach profile.</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white dark:bg-zinc-800 rounded px-3 py-2 text-sm text-slate-600 dark:text-slate-300 truncate border border-purple-200 dark:border-purple-800">
                          osys.team/#/coach/{userData.username}
                        </div>
                        <button
                          onClick={copyCoachPublicLink}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-all ${
                            copiedCoachLink
                              ? 'bg-emerald-500 text-white'
                              : 'bg-purple-500 hover:bg-purple-600 text-white'
                          }`}
                        >
                          {copiedCoachLink ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy
                            </>
                          )}
                        </button>
                        <a
                          href={`#/coach/${userData.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 rounded transition-colors"
                          title="View public profile"
                        >
                          <ExternalLink className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                
                {isEditing && (
                    <div className="flex justify-end gap-3 mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                        <button type="button" onClick={() => {setIsEditing(false); setName(userData?.name || ''); setBio(userData?.bio || '');}} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="h-4 w-4" /> Cancel</button>
                        <button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"><Save className="h-4 w-4" /> Save</button>
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
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-purple-900/20"
                  >
                    <Plus className="w-5 h-5" /> Add Athlete
                  </button>
              </div>

              {myAthletes.length === 0 ? (
                  <div className={`p-8 rounded-xl border text-center ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 dark:text-slate-400 mb-4">You haven't added any athletes yet.</p>
                      <p className="text-sm text-slate-500 mb-4">Add your athlete to join a team and access all features.</p>
                      <button 
                        onClick={() => setIsAddAthleteModalOpen(true)}
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
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
                                className={`rounded-xl border p-5 relative overflow-hidden transition-all ${theme === 'dark' ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950' : 'bg-white'} ${
                                  isStarter 
                                    ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/50 dark:ring-amber-500/40 shadow-amber-400/20 dark:shadow-amber-500/20' 
                                    : `${theme === 'dark' ? 'border-white/10 hover:border-purple-500/50' : 'border-slate-200 hover:border-purple-400'}`
                                } shadow-lg hover:shadow-xl`}
                                style={isStarter ? { boxShadow: '0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.1)' } : {}}
                            >
                                {/* Starter Badge */}
                                {isStarter && (
                                  <div className="absolute top-2 left-2 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full px-2.5 py-1 shadow-lg flex items-center gap-1 z-10">
                                    <Star className="w-3 h-3 text-white fill-white" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wide">Starter</span>
                                  </div>
                                )}
                                
                                {/* Action Buttons - Top Right (stacked vertically) */}
                                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                                  <button 
                                    onClick={() => openEditModal(player)}
                                    className="p-1.5 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-full transition-colors"
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
                                  {/* Release Button - only show if player has username and isn't already released */}
                                  {player.username && !player.released && (
                                    <button 
                                      onClick={() => { setReleaseAthleteConfirm(player); setReleasePassword(''); setReleaseError(''); }}
                                      className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors"
                                      title="Release to Independent Account"
                                    >
                                      <UserCheck className="w-4 h-4" />
                                    </button>
                                  )}
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
                                          {player.nickname 
                                            ? `${player.firstName || player.name?.split(' ')[0]} "${player.nickname}" ${player.lastName || player.name?.split(' ').slice(1).join(' ')}`
                                            : player.name
                                          }
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
                                            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs px-2 py-1 rounded font-bold">#{player.number || '?'}</span>
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{player.position || 'TBD'}</span>
                                        </div>
                                        {/* Team/Status Badge - Smart display based on registration status AND selected sport */}
                                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                          {(() => {
                                            const playerStatus = playerStatuses[player.id];
                                            const statusLoading = loadingStatuses;
                                            
                                            // Get the selected sport for filtering
                                            const selectedSport = selectedSportContext?.sport;
                                            
                                            // Check if the player's status matches the selected sport
                                            // If a sport is selected and the player's status is for a different sport, show "Not Registered"
                                            const statusMatchesSport = !selectedSport || 
                                              (playerStatus?.sport === selectedSport) ||
                                              (playerStatus?.status === 'on-team' && !selectedSport) ||
                                              (playerStatus?.status === 'not-registered');
                                            
                                            if (statusLoading) {
                                              return (
                                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                  <Clock className="w-3 h-3 animate-spin" /> Loading...
                                                </span>
                                              );
                                            }
                                            
                                            // If sport context is selected and status doesn't match, show not registered for that sport
                                            // Use lowercase comparison to handle case differences
                                            const playerSportLower = (playerStatus?.sport || '').toLowerCase();
                                            const selectedSportLower = (selectedSport || '').toLowerCase();
                                            const sportMatches = playerSportLower === selectedSportLower || 
                                              (playerSportLower === 'other' && selectedSportLower === 'football');
                                            
                                            if (selectedSport && playerStatus?.status === 'in-draft-pool' && !sportMatches) {
                                              const sportEmoji = {
                                                football: '🏈',
                                                basketball: '🏀',
                                                cheer: '📣',
                                                soccer: '⚽',
                                                baseball: '⚾',
                                                volleyball: '🏐',
                                                other: '🎯',
                                              }[selectedSport] || '🎯';
                                              
                                              return (
                                                <>
                                                  <Users className="w-3 h-3 text-orange-500" />
                                                  <span className="text-xs text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                                                    ⚠️ No {selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1)} Team - 
                                                    <a href="#/events" className="underline hover:text-orange-700">Register!</a>
                                                  </span>
                                                </>
                                              );
                                            }
                                            
                                            // On Team - Show team name
                                            if (playerTeam || playerStatus?.status === 'on-team') {
                                              return (
                                                <>
                                                  <Users className="w-3 h-3 text-sky-500" />
                                                  <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                                                    {playerTeam?.name || playerStatus?.teamName || 'Unknown Team'}
                                                  </span>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(player); }}
                                                    className="ml-1 text-[10px] text-sky-500 hover:text-sky-700 dark:hover:text-sky-300 underline"
                                                  >
                                                    (manage)
                                                  </button>
                                                </>
                                              );
                                            }
                                            
                                            // In Draft Pool - Show waiting status with sport and team
                                            if (playerStatus?.status === 'in-draft-pool') {
                                              const sportEmoji = {
                                                football: '🏈',
                                                basketball: '🏀',
                                                cheer: '📣',
                                                soccer: '⚽',
                                                baseball: '⚾',
                                                volleyball: '🏐',
                                                other: '🎯',
                                              }[playerStatus.sport || 'other'] || '🎯';
                                              
                                              return (
                                                <>
                                                  <Clock className="w-3 h-3 text-amber-500" />
                                                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded font-bold">
                                                    {sportEmoji} In Draft Pool
                                                    {playerStatus.draftPoolTeamName && (
                                                      <span className="font-normal"> - {playerStatus.draftPoolTeamName}</span>
                                                    )}
                                                  </span>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(player); }}
                                                    className="ml-1 text-[10px] text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 underline"
                                                  >
                                                    /manage
                                                  </button>
                                                </>
                                              );
                                            }
                                            
                                            // Registration Denied
                                            if (playerStatus?.status === 'registration-denied') {
                                              return (
                                                <>
                                                  <XCircle className="w-3 h-3 text-red-500" />
                                                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded font-bold">
                                                    ❌ Registration Denied
                                                  </span>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(player); }}
                                                    className="ml-1 text-[10px] text-red-500 hover:text-red-700 dark:hover:text-red-300 underline"
                                                  >
                                                    (details)
                                                  </button>
                                                </>
                                              );
                                            }
                                            
                                            // Not Registered - Show join button with sport context
                                            const noTeamSportName = selectedSport 
                                              ? selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1) + ' '
                                              : '';
                                            
                                            return (
                                              <>
                                                <Users className="w-3 h-3 text-orange-500" />
                                                <a
                                                  href="#/events"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded font-bold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                                                >
                                                  ⚠️ No {noTeamSportName}Team - Join Now!
                                                </a>
                                              </>
                                            );
                                          })()}
                                        </div>
                                        {/* DOB and Age Group */}
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                          <span className="text-xs text-slate-500">DOB: {player.dob || '--'}</span>
                                          {player.dob && calculateAgeGroup(player.dob) && (
                                            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs px-2 py-0.5 rounded font-bold">
                                              {calculateAgeGroup(player.dob)}
                                            </span>
                                          )}
                                          {player.dob && !calculateAgeGroup(player.dob) && (
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded">
                                              18+
                                            </span>
                                          )}
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Stats - v2.0 Stats (fetches real data) */}
                                <div className={`mt-4 p-2 rounded-lg ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-100'}`}>
                                    <PlayerStatsDisplay 
                                      playerId={player.id}
                                      athleteId={player.athleteId}
                                      sport={selectedSportContext?.sport || 'football'}
                                      size="sm"
                                    />
                                </div>

                                {/* Public Profile Link */}
                                {player.username && (
                                  <div className="mt-3 bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-200 dark:border-purple-900/30">
                                    <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                      <LinkIcon className="w-3 h-3" /> Public Profile
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-white dark:bg-zinc-800 rounded px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 truncate border border-purple-200 dark:border-purple-800">
                                        osys.team/#/athlete/{player.username}
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

                                {/* Bio Preview */}
                                {player.bio ? (
                                  <div className="mt-3 bg-purple-50 dark:bg-purple-900/10 p-2 rounded border border-purple-200 dark:border-purple-900/30">
                                    <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                      <User className="w-3 h-3" /> Bio
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{player.bio}</p>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEditModal(player); }}
                                    className="mt-3 w-full bg-purple-50 dark:bg-purple-900/10 p-2 rounded border border-dashed border-purple-300 dark:border-purple-800 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" /> Add bio for public profile
                                  </button>
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
                                          <span className="ml-1 font-bold text-slate-900 dark:text-white">{player.weight} lbs</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Uniform Sizes */}
                                {(player.helmetSize || player.shirtSize || player.pantSize) && (
                                  <div className="mt-3 bg-purple-50 dark:bg-purple-900/10 p-2 rounded border border-purple-200 dark:border-purple-900/30">
                                    <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Uniform</p>
                                    <div className="flex justify-around text-xs">
                                      {player.helmetSize && (
                                        <div>
                                          <span className="text-slate-500">Helmet:</span>
                                          <span className="ml-1 font-bold text-slate-900 dark:text-white">{player.helmetSize}</span>
                                        </div>
                                      )}
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
                                  className="w-full mt-3 flex items-center justify-center gap-2 text-sm font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 py-2.5 rounded-lg border border-purple-200 dark:border-purple-900/30 transition-colors"
                                >
                                  <BarChart3 className="w-4 h-4" /> View Stats History
                                </button>
                                
                                {/* FILM ROOM BUTTON */}
                                <div className="flex gap-2 mt-2">
                                  {athleteFilmRooms[player.id]?.length > 0 && (
                                    <button
                                      onClick={() => setShowFilmRoomForPlayer(player)}
                                      className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 py-2.5 rounded-lg border border-red-200 dark:border-red-900/30 transition-colors"
                                    >
                                      <Film className="w-4 h-4" /> Film ({athleteFilmRooms[player.id].length})
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setShowAddFilmForPlayer(player)}
                                    className={`${athleteFilmRooms[player.id]?.length > 0 ? '' : 'flex-1'} flex items-center justify-center gap-2 text-sm font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 py-2.5 px-4 rounded-lg border border-purple-200 dark:border-purple-900/30 transition-colors`}
                                  >
                                    <Plus className="w-4 h-4" /> {athleteFilmRooms[player.id]?.length > 0 ? 'Add' : 'Add Film'}
                                  </button>
                                </div>
                                
                                {/* RELEASE TO INDEPENDENT ACCOUNT - Only for 18+ */}
                                {!player.released && isPlayerAdult(player.dob) && player.username && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setReleaseAthleteConfirm(player); setReleaseError(''); setReleasePassword(''); }}
                                    className="w-full mt-3 flex items-center justify-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/30 transition-colors"
                                  >
                                    <Key className="w-4 h-4" /> Release to Own Account
                                  </button>
                                )}
                                {player.released && (
                                  <div className="mt-3 bg-emerald-50 dark:bg-emerald-900/10 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/30 text-center">
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                      ✓ Released - Has independent account
                                    </p>
                                  </div>
                                )}
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
              <div className={`w-full max-w-lg rounded-xl border shadow-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-white/10' : 'bg-white border-zinc-200'}`}>
                  {/* Header */}
                  <div className={`sticky top-0 p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-center gap-3">
                          <div className="bg-purple-100 dark:bg-purple-500/20 p-2 rounded-full">
                            <Edit2 className="h-5 w-5 text-purple-600 dark:text-purple-500" />
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
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-500 shadow-lg">
                              <img src={selectedAthlete.photoUrl} alt={selectedAthlete.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-slate-300 dark:border-slate-700 flex items-center justify-center">
                              <User className="w-10 h-10 text-slate-400 dark:text-slate-600" />
                            </div>
                          )}
                          <label className="absolute bottom-0 right-0 bg-purple-600 hover:bg-purple-500 text-white rounded-full p-2 cursor-pointer shadow-lg transition-colors">
                            <Camera className="w-4 h-4" />
                            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                          </label>
                        </div>
                        {uploadingPhoto && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-purple-600">
                            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
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
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">First Name *</label>
                              <input 
                                value={editForm.firstName} 
                                onChange={e => {
                                  const firstName = e.target.value;
                                  setEditForm({...editForm, firstName, name: `${firstName} ${editForm.lastName}`.trim()});
                                }} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Last Name *</label>
                              <input 
                                value={editForm.lastName} 
                                onChange={e => {
                                  const lastName = e.target.value;
                                  setEditForm({...editForm, lastName, name: `${editForm.firstName} ${lastName}`.trim()});
                                }} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                                required
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Nickname (optional)</label>
                            <input 
                              value={editForm.nickname} 
                              onChange={e => setEditForm({...editForm, nickname: e.target.value})} 
                              placeholder='e.g., "Flash", "Tank"'
                              className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white placeholder-slate-400" 
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Shows on player card if set</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Date of Birth</label>
                              <input 
                                type="date"
                                value={editForm.dob} 
                                onChange={e => setEditForm({...editForm, dob: e.target.value})} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Gender</label>
                              <select 
                                value={editForm.gender} 
                                onChange={e => setEditForm({...editForm, gender: e.target.value as 'male' | 'female' | 'other' | ''})} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white"
                              >
                                <option value="">Select...</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
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
                          <p className="text-xs text-red-500 mt-1 break-words overflow-hidden">{editUsernameError}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">Used for tracking stats history. 3-20 characters, lowercase letters, numbers, and underscores only.</p>
                      </div>

                      {/* Team/Registration Status & Actions */}
                      <div>
                        <p className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                          <Users className="w-3 h-3" /> Team Status
                        </p>
                        
                        {(() => {
                          const playerStatus = selectedAthlete ? playerStatuses[selectedAthlete.id] : undefined;
                          const playerTeam = selectedAthlete?.teamId ? allTeams.find(t => t.id === selectedAthlete.teamId) : undefined;
                          const selectedSport = selectedSportContext?.sport;
                          
                          // Check if player's status matches selected sport (case-insensitive)
                          const playerSportLower = (playerStatus?.sport || '').toLowerCase();
                          const selectedSportLower = (selectedSport || '').toLowerCase();
                          const sportMatches = !selectedSport || playerSportLower === selectedSportLower || 
                            (playerSportLower === 'other' && selectedSportLower === 'football');
                          
                          // On Team
                          if (playerTeam || playerStatus?.status === 'on-team') {
                            return (
                              <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <CheckCircle className="w-5 h-5 text-sky-500" />
                                  <span className="font-bold text-sky-700 dark:text-sky-400">
                                    {playerTeam?.name || playerStatus?.teamName || 'On Team'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                                  This athlete is on the team roster.
                                </p>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!selectedAthlete?.teamId || !selectedAthlete?.id) return;
                                    if (!confirm('Are you sure you want to remove this athlete from the team? They will need to re-register.')) return;
                                    
                                    setRemovingFromTeam(selectedAthlete.id);
                                    const result = await removeFromTeamRoster(selectedAthlete.teamId, selectedAthlete.id);
                                    setRemovingFromTeam(null);
                                    
                                    if (result.success) {
                                      setStatusMsg({ type: 'success', text: 'Athlete removed from team' });
                                      // Refresh statuses
                                      const newStatus = await getPlayerRegistrationStatus(selectedAthlete.id, undefined, selectedAthlete.name);
                                      setPlayerStatuses(prev => ({ ...prev, [selectedAthlete.id]: newStatus }));
                                      setIsEditModalOpen(false);
                                    } else {
                                      setStatusMsg({ type: 'error', text: result.error || 'Failed to remove from team' });
                                    }
                                  }}
                                  disabled={removingFromTeam === selectedAthlete?.id}
                                  className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                  {removingFromTeam === selectedAthlete?.id ? (
                                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <MinusCircle className="w-4 h-4" />
                                  )}
                                  Remove from Team
                                </button>
                              </div>
                            );
                          }
                          
                          // In Draft Pool - only show if sport matches selected sport
                          if (playerStatus?.status === 'in-draft-pool' && sportMatches) {
                            const sportEmoji = {
                              football: '🏈',
                              basketball: '🏀',
                              cheer: '📣',
                              soccer: '⚽',
                              baseball: '⚾',
                              volleyball: '🏐',
                              other: '🎯',
                            }[playerStatus.sport || 'other'] || '🎯';
                            
                            return (
                              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Clock className="w-5 h-5 text-amber-500" />
                                  <span className="font-bold text-amber-700 dark:text-amber-400">
                                    {sportEmoji} In Draft Pool - {playerStatus.draftPoolTeamName || 'Unknown Team'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                                  {playerStatus.sport && (
                                    <span className="capitalize">{playerStatus.sport} • </span>
                                  )}
                                  {playerStatus.eventName 
                                    ? `Registered for "${playerStatus.eventName}" and waiting to be drafted.`
                                    : 'Waiting to be drafted by the coach.'
                                  }
                                </p>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!playerStatus.draftPoolTeamId || !playerStatus.draftPoolEntryId) return;
                                    if (!confirm('Are you sure you want to withdraw from the draft pool? You may need to re-register.')) return;
                                    
                                    setRemovingFromPool(selectedAthlete?.id || null);
                                    const result = await removeFromDraftPool(playerStatus.draftPoolTeamId, playerStatus.draftPoolEntryId);
                                    setRemovingFromPool(null);
                                    
                                    if (result.success) {
                                      setStatusMsg({ type: 'success', text: 'Withdrawn from draft pool' });
                                      // Refresh statuses
                                      if (selectedAthlete) {
                                        const newStatus = await getPlayerRegistrationStatus(selectedAthlete.id, undefined, selectedAthlete.name);
                                        setPlayerStatuses(prev => ({ ...prev, [selectedAthlete.id]: newStatus }));
                                      }
                                      setIsEditModalOpen(false);
                                    } else {
                                      setStatusMsg({ type: 'error', text: result.error || 'Failed to withdraw from draft pool' });
                                    }
                                  }}
                                  disabled={removingFromPool === selectedAthlete?.id}
                                  className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                  {removingFromPool === selectedAthlete?.id ? (
                                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <MinusCircle className="w-4 h-4" />
                                  )}
                                  Withdraw from Draft Pool
                                </button>
                              </div>
                            );
                          }
                          
                          // Registration Denied
                          if (playerStatus?.status === 'registration-denied') {
                            return (
                              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <XCircle className="w-5 h-5 text-red-500" />
                                  <span className="font-bold text-red-700 dark:text-red-400">
                                    ❌ Registration Denied
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                  {playerStatus.deniedReason || 'The registration for this athlete was not approved.'}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">
                                  Contact the league commissioner for more information or to re-apply.
                                </p>
                                <a
                                  href="/#/events"
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                                >
                                  <Plus className="w-4 h-4" />
                                  Register for Another Team
                                </a>
                              </div>
                            );
                          }
                          
                          // Not Registered (or in draft pool for different sport)
                          const sportLabel = selectedSport ? selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1) : '';
                          const notRegisteredMessage = selectedSport && playerStatus?.status === 'in-draft-pool' && !sportMatches
                            ? `This athlete is not registered for ${sportLabel}. They are in the ${playerStatus.sport || 'another'} draft pool.`
                            : selectedSport 
                              ? `This athlete is not registered for ${sportLabel}. Register for a ${sportLabel} event to join a team.`
                              : 'This athlete is not registered for any team or event. Register for a team event to join a team.';
                          
                          return (
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <AlertCircle className="w-5 h-5 text-orange-500" />
                                <span className="font-bold text-orange-700 dark:text-orange-400">
                                  ⚠️ Not Registered{selectedSport ? ` for ${sportLabel}` : ''}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                                {notRegisteredMessage}
                              </p>
                              <a
                                href="/#/events"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                              >
                                <Plus className="w-4 h-4" />
                                Find Events & Register
                              </a>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Physical Info */}
                      <div>
                        <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                          <Ruler className="w-3 h-3" /> Physical Information
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Height</label>
                              <div className="flex gap-2">
                                <div className="flex-1 relative">
                                  <input 
                                    type="number"
                                    min="0"
                                    max="8"
                                    value={editForm.heightFt} 
                                    onChange={e => setEditForm({...editForm, heightFt: e.target.value})} 
                                    placeholder="4"
                                    className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 pr-8 text-slate-900 dark:text-white" 
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">ft</span>
                                </div>
                                <div className="flex-1 relative">
                                  <input 
                                    type="number"
                                    min="0"
                                    max="11"
                                    value={editForm.heightIn} 
                                    onChange={e => setEditForm({...editForm, heightIn: e.target.value})} 
                                    placeholder="6"
                                    className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 pr-8 text-slate-900 dark:text-white" 
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">in</span>
                                </div>
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Weight</label>
                              <div className="relative">
                                <input 
                                  type="number"
                                  min="0"
                                  max="400"
                                  value={editForm.weight} 
                                  onChange={e => setEditForm({...editForm, weight: e.target.value})} 
                                  placeholder="85"
                                  className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 pr-10 text-slate-900 dark:text-white" 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">lbs</span>
                              </div>
                          </div>
                        </div>
                      </div>

                      {/* Uniform Sizes */}
                      <div>
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-3 uppercase tracking-wider">Uniform Sizing</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Helmet Size</label>
                              <select 
                                value={editForm.helmetSize} 
                                onChange={e => setEditForm({...editForm, helmetSize: e.target.value})} 
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

                      {/* Bio Section */}
                      <div>
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3 h-3" /> About (Public Bio)
                        </p>
                        <textarea
                          rows={4}
                          value={editForm.bio}
                          onChange={e => setEditForm({...editForm, bio: e.target.value})}
                          placeholder="Tell scouts and recruiters about your athlete... Achievements, personality, goals, etc."
                          className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white placeholder-slate-400"
                          maxLength={500}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">{editForm.bio.length}/500 characters • Shown on public profile</p>
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
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
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
          <div className={`w-full max-w-lg rounded-xl border shadow-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-white/10' : 'bg-white border-zinc-200'}`}>
            {/* Header */}
            <div className={`sticky top-0 p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-500/20 p-2 rounded-full">
                  <Plus className="h-5 w-5 text-purple-600 dark:text-purple-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Athlete</h3>
                  <p className="text-slate-500 text-sm">Create your athlete's profile</p>
                </div>
              </div>
              <button onClick={() => setIsAddAthleteModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddAthlete} className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">First Name *</label>
                  <input 
                    value={newAthleteForm.firstName} 
                    onChange={e => setNewAthleteForm({...newAthleteForm, firstName: e.target.value})} 
                    placeholder="John"
                    className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Last Name *</label>
                  <input 
                    value={newAthleteForm.lastName} 
                    onChange={e => setNewAthleteForm({...newAthleteForm, lastName: e.target.value})} 
                    placeholder="Smith"
                    className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                    required
                  />
                </div>
              </div>
              
              {/* Nickname */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nickname (optional)</label>
                <input 
                  value={newAthleteForm.nickname} 
                  onChange={e => setNewAthleteForm({...newAthleteForm, nickname: e.target.value})} 
                  placeholder='e.g., "Flash", "Tank"'
                  className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                />
                <p className="text-[10px] text-slate-500 mt-1">Shows on player card if set</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date of Birth *</label>
                  <input 
                    type="date"
                    value={newAthleteForm.dob} 
                    onChange={e => setNewAthleteForm({...newAthleteForm, dob: e.target.value})} 
                    className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                    required
                  />
                  {/* Show calculated age group */}
                  {newAthleteForm.dob && calculateAgeGroup(newAthleteForm.dob) && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs px-2 py-0.5 rounded font-bold">
                        {calculateAgeGroup(newAthleteForm.dob)}
                      </span>
                      <span className="text-[10px] text-slate-500">Age Group</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Gender *</label>
                  <select 
                    value={newAthleteForm.gender} 
                    onChange={e => setNewAthleteForm({...newAthleteForm, gender: e.target.value as 'male' | 'female' | 'other'})} 
                    className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white"
                    required
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
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
                  <p className="text-xs text-red-500 mt-1 break-words overflow-hidden">{usernameError}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">3-20 characters, lowercase letters, numbers, and underscores only</p>
              </div>

              {/* Physical Info */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-3 uppercase tracking-wider">Physical Information (Optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Height</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input 
                          type="number"
                          min="0"
                          max="8"
                          value={newAthleteForm.heightFt} 
                          onChange={e => setNewAthleteForm({...newAthleteForm, heightFt: e.target.value})} 
                          placeholder="4"
                          className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 pr-8 text-slate-900 dark:text-white" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">ft</span>
                      </div>
                      <div className="flex-1 relative">
                        <input 
                          type="number"
                          min="0"
                          max="11"
                          value={newAthleteForm.heightIn} 
                          onChange={e => setNewAthleteForm({...newAthleteForm, heightIn: e.target.value})} 
                          placeholder="6"
                          className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 pr-8 text-slate-900 dark:text-white" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">in</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Weight</label>
                    <div className="relative">
                      <input 
                        type="number"
                        min="0"
                        max="400"
                        value={newAthleteForm.weight} 
                        onChange={e => setNewAthleteForm({...newAthleteForm, weight: e.target.value})} 
                        placeholder="85"
                        className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 pr-10 text-slate-900 dark:text-white" 
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">lbs</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uniform Sizes */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-3 uppercase tracking-wider">Uniform Sizing (Optional)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Helmet Size</label>
                    <select 
                      value={newAthleteForm.helmetSize} 
                      onChange={e => setNewAthleteForm({...newAthleteForm, helmetSize: e.target.value})} 
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
                  💡 After creating your athlete, you can register them to a team using the team's registration link.
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
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
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
            
            <div className={`rounded-lg p-4 mb-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
              <div className="flex items-center gap-3">
                {deleteAthleteConfirm.photoUrl ? (
                  <img src={deleteAthleteConfirm.photoUrl} alt={deleteAthleteConfirm.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
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
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
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

      {/* RELEASE ATHLETE MODAL */}
      {releaseAthleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Release Athlete</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">Create independent account</p>
                </div>
              </div>
              <button 
                onClick={() => { setReleaseAthleteConfirm(null); setReleasePassword(''); setReleaseError(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`rounded-lg p-4 mb-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
              <div className="flex items-center gap-3">
                {releaseAthleteConfirm.photoUrl ? (
                  <img src={releaseAthleteConfirm.photoUrl} alt={releaseAthleteConfirm.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    #{releaseAthleteConfirm.number || '?'}
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{releaseAthleteConfirm.name}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <AtSign className="w-3 h-3" />{releaseAthleteConfirm.username}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium mb-2">What happens when you release:</p>
              <ul className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
                <li>• {releaseAthleteConfirm.name} gets their own account</li>
                <li>• They log in with username "<strong>{releaseAthleteConfirm.username}</strong>"</li>
                <li>• They use YOUR current password for first login</li>
                <li>• They'll be asked to set their own email & password</li>
                <li>• They will no longer appear in your account</li>
              </ul>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                <Key className="w-4 h-4 inline mr-1" />
                Confirm with your password
              </label>
              <input
                type="password"
                value={releasePassword}
                onChange={(e) => setReleasePassword(e.target.value)}
                placeholder="Enter your password"
                className={`w-full py-2.5 px-4 rounded-lg border ${theme === 'dark' ? 'bg-black border-zinc-700 text-white' : 'bg-white border-slate-300 text-slate-900'} focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500`}
              />
            </div>
            
            {releaseError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-600 dark:text-red-400">{releaseError}</p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => { setReleaseAthleteConfirm(null); setReleasePassword(''); setReleaseError(''); }}
                disabled={releasingAthlete}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleReleaseAthlete}
                disabled={releasingAthlete || !releasePassword}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {releasingAthlete ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Release
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

      {/* Film Room Modal for Parent */}
      {showFilmRoomForPlayer && (() => {
        const allVideos = athleteFilmRooms[showFilmRoomForPlayer.id] || [];
        const filteredVideos = filmSportFilter 
          ? allVideos.filter(v => v.sport === filmSportFilter)
          : allVideos;
        
        // Get unique sports from videos for filter buttons
        const sportsInFilm = [...new Set(allVideos.map(v => v.sport).filter(Boolean))];
        
        const sportEmojis: Record<string, string> = {
          football: '🏈',
          basketball: '🏀',
          cheer: '📣',
          soccer: '⚽',
          baseball: '⚾',
          volleyball: '🏐',
          other: '🎯',
        };
        
        return (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
          <div className="min-h-full p-4 md:p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
                    <Film className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{showFilmRoomForPlayer.name}'s Film Room</h2>
                    <p className="text-zinc-400">
                      {filteredVideos.length} of {allVideos.length} {allVideos.length === 1 ? 'video' : 'videos'}
                      {filmSportFilter && <span className="ml-1">({filmSportFilter})</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowFilmRoomForPlayer(null); setFilmSportFilter(null); }}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Sport Filter Tabs */}
              {sportsInFilm.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilmSportFilter(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      !filmSportFilter 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    All Sports
                  </button>
                  {sportsInFilm.map(sport => (
                    <button
                      key={sport}
                      onClick={() => setFilmSportFilter(sport || null)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        filmSportFilter === sport 
                          ? 'bg-purple-500 text-white' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      <span>{sportEmojis[sport || 'other'] || '🎯'}</span>
                      <span className="capitalize">{sport}</span>
                      <span className="text-xs opacity-70">({allVideos.filter(v => v.sport === sport).length})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Video Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((video) => (
                <div 
                  key={video.id}
                  className="group bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all"
                >
                  {/* Thumbnail */}
                  <div 
                    className="relative aspect-video bg-black cursor-pointer"
                    onClick={() => setPlayingVideoId(video.youtubeId)}
                  >
                    <img 
                      src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                      <div className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <Play className="w-7 h-7 text-white ml-1" />
                      </div>
                    </div>
                    {/* Category Badge */}
                    <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold ${
                      video.category === 'Game Film' ? 'bg-red-500/90' : 'bg-yellow-500/90'
                    } text-white`}>
                      {video.category}
                    </div>
                    {/* Sport Badge */}
                    {video.sport && (
                      <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold bg-black/70 text-white backdrop-blur-sm">
                        {sportEmojis[video.sport] || '🎯'} {video.sport.charAt(0).toUpperCase() + video.sport.slice(1)}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-white line-clamp-1">{video.title}</h3>
                    {video.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{video.description}</p>
                    )}
                    {video.teamName && (
                      <p className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {video.teamName}
                      </p>
                    )}
                    {/* Delete Button */}
                    <button
                      onClick={() => setDeleteFilmConfirm({ playerId: showFilmRoomForPlayer.id, film: video })}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-600/30"
                    >
                      <Trash2 className="w-4 h-4" /> Remove from Film Room
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Video Player Modal */}
      {playingVideoId && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-0 md:p-10 animate-in fade-in duration-300">
          <div className="w-full max-w-6xl relative aspect-video bg-black shadow-2xl rounded-lg overflow-hidden">
            {/* Close Button */}
            <button 
              onClick={() => setPlayingVideoId(null)} 
              className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-purple-600 p-2 rounded-full transition-colors backdrop-blur-sm"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* YouTube Embed */}
            <iframe 
              src={`https://www.youtube.com/embed/${playingVideoId}?autoplay=1&rel=0&modestbranding=1`} 
              title="YouTube video player" 
              className="w-full h-full"
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      {/* Delete Film Entry Confirmation Modal */}
      {deleteFilmConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70]">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/20 p-2 rounded-full">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Remove Video</h3>
            </div>
            <p className="text-zinc-400 mb-2">
              Are you sure you want to remove "<span className="text-white font-medium">{deleteFilmConfirm.film.title}</span>" from your athlete's Film Room?
            </p>
            <p className="text-zinc-500 text-sm mb-6">
              This will remove the video from their public profile. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteFilmConfirm(null)}
                disabled={deletingFilm}
                className="flex-1 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFilmEntry}
                disabled={deletingFilm}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deletingFilm ? (
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

      {/* Add Film Modal for Parent */}
      {showAddFilmForPlayer && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-purple-500/20 p-2 rounded-full">
                  <Film className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Add Film</h3>
                  <p className="text-zinc-500 text-sm">Add video to {showAddFilmForPlayer.name}'s Film Room</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowAddFilmForPlayer(null); setAddFilmError(''); setNewFilmForm({ title: '', url: '', category: 'Game Film', description: '', sport: 'football' }); }}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Form */}
            <div className="p-4 space-y-4">
              {addFilmError && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg overflow-hidden">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="break-words overflow-hidden">{addFilmError}</span>
                </div>
              )}
              
              {/* YouTube URL */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">YouTube URL *</label>
                <input
                  type="text"
                  value={newFilmForm.url}
                  onChange={(e) => setNewFilmForm(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Video Title *</label>
                <input
                  type="text"
                  value={newFilmForm.title}
                  onChange={(e) => setNewFilmForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Week 5 Highlights vs Eagles"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Category</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewFilmForm(prev => ({ ...prev, category: 'Game Film' }))}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      newFilmForm.category === 'Game Film' 
                        ? 'bg-red-500 text-white' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    🎬 Game Film
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewFilmForm(prev => ({ ...prev, category: 'Highlights' }))}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      newFilmForm.category === 'Highlights' 
                        ? 'bg-yellow-500 text-white' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    ⭐ Highlights
                  </button>
                </div>
              </div>
              
              {/* Sport Tag */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Sport</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { sport: 'football', emoji: '🏈', label: 'Football' },
                    { sport: 'basketball', emoji: '🏀', label: 'Basketball' },
                    { sport: 'cheer', emoji: '📣', label: 'Cheer' },
                    { sport: 'soccer', emoji: '⚽', label: 'Soccer' },
                    { sport: 'baseball', emoji: '⚾', label: 'Baseball' },
                    { sport: 'volleyball', emoji: '🏐', label: 'Volleyball' },
                  ].map(({ sport, emoji, label }) => (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => setNewFilmForm(prev => ({ ...prev, sport: sport as any }))}
                      className={`py-2 px-2 rounded-lg font-medium text-xs transition-colors ${
                        newFilmForm.sport === sport 
                          ? 'bg-purple-500 text-white ring-2 ring-purple-400' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Description (optional)</label>
                <textarea
                  value={newFilmForm.description}
                  onChange={(e) => setNewFilmForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the video content..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              
              {/* Info text */}
              <div className="bg-zinc-800/50 rounded-lg p-3 text-sm text-zinc-500">
                <p>Videos will appear on your athlete's public profile in their Film Room section.</p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-zinc-700 flex gap-3">
              <button
                onClick={() => { setShowAddFilmForPlayer(null); setAddFilmError(''); setNewFilmForm({ title: '', url: '', category: 'Game Film', description: '' }); }}
                disabled={addingFilm}
                className="flex-1 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFilmEntry}
                disabled={addingFilm || !newFilmForm.url || !newFilmForm.title}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {addingFilm ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add to Film Room
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

export default Profile;