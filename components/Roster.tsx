import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, getDocs, where, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText, sanitizeNumber, sanitizeDate } from '../services/sanitize';
import { calculateAgeGroup } from '../services/ageValidator';
import type { Player, UserProfile, Team, SportType } from '../types';
import { getPositions } from '../config/sportConfig';
import { Plus, Trash2, Shield, Sword, AlertCircle, Phone, Link as LinkIcon, User, X, Edit2, ChevronLeft, ChevronRight, Search, Users, Crown, UserMinus, Star, Camera, UserPlus, ArrowRightLeft, BarChart3, Eye, AtSign, Copy, Check, ExternalLink, Zap } from 'lucide-react';
import PlayerStatsModal from './stats/PlayerStatsModal';
import EmptyState from './ui/EmptyState';
import { GlassCard, AnimatedBackground } from './ui/OSYSComponents';
import NoAthleteBlock from './NoAthleteBlock';

// Pagination settings
const PLAYERS_PER_PAGE = 12;

/**
 * Check if a player's age group fits within a team's age group range
 * e.g., "9U" fits in "9U-10U", "10U" fits in "9U-10U", "8U" does NOT fit in "9U-10U"
 */
const playerAgeGroupFitsTeam = (playerAgeGroup: string | null, teamAgeGroup: string | null | undefined): boolean => {
  // If either is not set, assume it's a match (no restriction)
  if (!playerAgeGroup || !teamAgeGroup) return true;
  
  // Extract numeric age from age group string (e.g., "9U" -> 9, "10U" -> 10)
  const extractAge = (ageGroup: string): number | null => {
    const match = ageGroup.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };
  
  const playerAge = extractAge(playerAgeGroup);
  if (playerAge === null) return true; // Can't determine, assume match
  
  // Check if team age group is a range (e.g., "9U-10U")
  if (teamAgeGroup.includes('-')) {
    const parts = teamAgeGroup.split('-');
    const minAge = extractAge(parts[0]);
    const maxAge = extractAge(parts[1]);
    
    if (minAge !== null && maxAge !== null) {
      return playerAge >= minAge && playerAge <= maxAge;
    }
  }
  
  // Single age group comparison (e.g., "9U" === "9U")
  const teamAge = extractAge(teamAgeGroup);
  if (teamAge === null) return true;
  
  return playerAge === teamAge;
};

const Roster: React.FC = () => {
  const { userData, teamData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [roster, setRoster] = useState<Player[]>([]);
  const [parents, setParents] = useState<UserProfile[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState('');
  
  const isStaff = userData?.role === 'Coach' || userData?.role === 'SuperAdmin';
  const isParent = userData?.role === 'Parent';
  
  // Head Coach check - can manage other coaches
  const isHeadCoach = userData?.role === 'Coach' && teamData?.headCoachId === userData?.uid;
  
  // Coaching staff state
  const [teamCoaches, setTeamCoaches] = useState<UserProfile[]>([]);
  const [removeCoachConfirm, setRemoveCoachConfirm] = useState<{ id: string; name: string } | null>(null);
  const [removingCoach, setRemovingCoach] = useState(false);
  
  // Add Coach modal state (Head Coach only)
  const [isAddCoachModalOpen, setIsAddCoachModalOpen] = useState(false);
  const [coachSearchQuery, setCoachSearchQuery] = useState('');
  const [availableCoaches, setAvailableCoaches] = useState<UserProfile[]>([]);
  const [searchingCoaches, setSearchingCoaches] = useState(false);
  const [addingCoach, setAddingCoach] = useState(false);
  const [allCoachesCache, setAllCoachesCache] = useState<UserProfile[]>([]);
  const [coachesCacheLoaded, setCoachesCacheLoaded] = useState(false);
  
  // Add Player by search (Coach only) - search all players in system by username
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState<(Player & { 
    teamName?: string;
    calculatedAgeGroup?: string | null;
    isInDraftPool?: boolean;
    draftPoolTeamName?: string;
    conflictWarning?: string;
  })[]>([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);
  const [selectedPlayerToAdd, setSelectedPlayerToAdd] = useState<(Player & { teamName?: string }) | null>(null);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Transfer Head Coach state
  const [transferHeadCoachTo, setTransferHeadCoachTo] = useState<{ id: string; name: string } | null>(null);
  const [transferringHeadCoach, setTransferringHeadCoach] = useState(false);
  
  // Coordinator assignment state (Head Coach only)
  const [assignCoordinatorModal, setAssignCoordinatorModal] = useState<{ type: 'OC' | 'DC' | 'STC'; currentId?: string | null } | null>(null);
  const [assigningCoordinator, setAssigningCoordinator] = useState(false);

  // Filter, sort (starters first), and paginate roster
  const filteredRoster = useMemo(() => {
    let filtered = roster;
    
    // Apply search filter
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      filtered = filtered.filter(player => 
        player.name.toLowerCase().includes(term) ||
        (player.username || '').toLowerCase().includes(term) ||
        player.position.toLowerCase().includes(term) ||
        player.number.toString().includes(term)
      );
    }
    
    // Sort: Starters first, then captains, then by jersey number
    return [...filtered].sort((a, b) => {
      // Starters always come first
      if (a.isStarter && !b.isStarter) return -1;
      if (!a.isStarter && b.isStarter) return 1;
      // Among same starter status, captains come first
      if (a.isCaptain && !b.isCaptain) return -1;
      if (!a.isCaptain && b.isCaptain) return 1;
      // Finally sort by jersey number
      return (a.number || 0) - (b.number || 0);
    });
  }, [roster, searchFilter]);

  const totalPages = Math.ceil(filteredRoster.length / PLAYERS_PER_PAGE);
  const paginatedRoster = useMemo(() => {
    const start = (currentPage - 1) * PLAYERS_PER_PAGE;
    return filteredRoster.slice(start, start + PLAYERS_PER_PAGE);
  }, [filteredRoster, currentPage]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter]);

  // Get sport-specific positions for team
  const sportPositions = useMemo(() => {
    const sport = teamData?.sport as SportType | undefined;
    return getPositions(sport);
  }, [teamData?.sport]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [viewMedical, setViewMedical] = useState<Player | null>(null);
  const [viewContact, setViewContact] = useState<UserProfile | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  
  // Loading states for async operations
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [linkingParent, setLinkingParent] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Delete confirmation state
  const [deletePlayerConfirm, setDeletePlayerConfirm] = useState<{ id: string; name: string; number: string } | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);
  
  // Photo popup state
  const [viewPhotoPlayer, setViewPhotoPlayer] = useState<Player | null>(null);
  
  // Player Stats Modal state
  const [viewStatsPlayer, setViewStatsPlayer] = useState<Player | null>(null);
  
  // Team public link copy state
  const [copiedTeamLink, setCopiedTeamLink] = useState(false);
  
  const [newPlayer, setNewPlayer] = useState({ 
    firstName: '',
    lastName: '',
    nickname: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    name: '', 
    number: '', 
    position: '', 
    td: '0', 
    tkl: '0', 
    dob: '', 
    teamId: '', // NEW: Team selection for parents
    shirtSize: '', // For parents: uniform sizing
    pantSize: '', // For parents: uniform sizing
    height: '', // Player height
    weight: '' // Player weight
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  
  // Contact edit form state
  const [editContactForm, setEditContactForm] = useState({
    phone: '',
    secondaryPhone: '',
    address: '',
    emergName: '',
    emergPhone: '',
    emergRelation: ''
  });

  useEffect(() => {
    // Load all teams for parent to select from when adding players
    const fetchAllTeams = async () => {
      try {
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const teamsData = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        setAllTeams(teamsData);
      } catch (err) {
        console.error("Error fetching teams:", err);
      }
    };
    
    if (isParent) {
      fetchAllTeams();
    }
    
    if (!teamData?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);

    const rosterQuery = query(collection(db, 'teams', teamData.id, 'players'), orderBy('number'));
    const unsubRoster = onSnapshot(rosterQuery, (snapshot) => {
      const playersData = snapshot.docs.map(docSnap => ({ id: docSnap.id, teamId: teamData.id, ...docSnap.data() } as Player));
      setRoster(playersData);
      setLoading(false);
    });

    // PERFORMANCE & SECURITY FIX: Only fetch parents from THIS team
    const fetchParents = async () => {
        try {
            const qParents = query(
                collection(db, 'users'), 
                where('role', '==', 'Parent')
            );
            const pSnapshot = await getDocs(qParents);
            const pData = pSnapshot.docs.map(d => ({uid: d.id, ...d.data()} as UserProfile));
            setParents(pData);
        } catch (err) {
            console.error("Error fetching parents:", err);
        }
    }
    if (isStaff) {
      fetchParents();
    }
    
    // Load coaches on this team (for Head Coach management)
    const fetchTeamCoaches = async () => {
      try {
        // Query coaches who have this team in their teamIds array
        const coachesQuery = query(
          collection(db, 'users'),
          where('role', '==', 'Coach'),
          where('teamIds', 'array-contains', teamData?.id)
        );
        const snapshot = await getDocs(coachesQuery);
        let coachesData = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        
        // Also check for coaches with legacy teamId field (who might not have teamIds yet)
        const legacyQuery = query(
          collection(db, 'users'),
          where('role', '==', 'Coach'),
          where('teamId', '==', teamData?.id)
        );
        const legacySnapshot = await getDocs(legacyQuery);
        legacySnapshot.docs.forEach(d => {
          // Only add if not already in the list
          if (!coachesData.some(c => c.uid === d.id)) {
            coachesData.push({ uid: d.id, ...d.data() } as UserProfile);
          }
        });
        
        setTeamCoaches(coachesData);
      } catch (err) {
        console.error("Error fetching team coaches:", err);
      }
    };
    if (teamData?.id && isStaff) {
      fetchTeamCoaches();
    }

    return () => unsubRoster();
  }, [teamData?.id, isParent, isStaff]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addingPlayer) return;
    
    // Determine which team to add the player to
    let targetTeamId: string;
    if (isParent) {
      // Parents must select a team
      if (!newPlayer.teamId) {
        alert('Please select a team for your player');
        return;
      }
      targetTeamId = newPlayer.teamId;
    } else {
      // Staff uses current teamData
      if (!teamData?.id) return;
      targetTeamId = teamData.id;
    }
    
    setAddingPlayer(true);
    try {
      // Calculate age group from DOB using Sept 10 cutoff
      const calculatedAgeGroup = calculateAgeGroup(sanitizeDate(newPlayer.dob));
      
      // SECURITY: Sanitize all input before storing
      const playerData: any = {
        firstName: sanitizeText(newPlayer.firstName, 50),
        lastName: sanitizeText(newPlayer.lastName, 50),
        nickname: sanitizeText(newPlayer.nickname, 30) || undefined,
        gender: newPlayer.gender || undefined,
        ageGroup: calculatedAgeGroup || undefined, // e.g., "9U", "10U"
        name: sanitizeText(`${newPlayer.firstName} ${newPlayer.lastName}`.trim(), 100),
        dob: sanitizeDate(newPlayer.dob),
        teamId: targetTeamId,
        parentId: isParent ? userData?.uid : undefined,
        medical: { allergies: 'None', conditions: 'None', medications: 'None', bloodType: '' }
      };

      if (isParent) {
        // Parents only provide uniform sizes
        playerData.shirtSize = sanitizeText(newPlayer.shirtSize, 20);
        playerData.pantSize = sanitizeText(newPlayer.pantSize, 20);
        playerData.height = sanitizeText(newPlayer.height, 10);
        playerData.weight = sanitizeText(newPlayer.weight, 10);
        // Initialize stats and position as empty - coach will fill
        playerData.stats = { td: 0, tkl: 0 };
        playerData.number = 0; // Placeholder
        playerData.position = 'TBD'; // To be determined by coach
      } else {
        // Coaches provide full details
        playerData.number = sanitizeNumber(newPlayer.number, 0, 99);
        playerData.position = sanitizeText(newPlayer.position, 20);
        playerData.stats = { td: sanitizeNumber(newPlayer.td, 0, 999), tkl: sanitizeNumber(newPlayer.tkl, 0, 999) };
        playerData.shirtSize = sanitizeText(newPlayer.shirtSize, 20);
        playerData.pantSize = sanitizeText(newPlayer.pantSize, 20);
        playerData.height = sanitizeText(newPlayer.height, 10);
        playerData.weight = sanitizeText(newPlayer.weight, 10);
      }

      await addDoc(collection(db, 'teams', targetTeamId, 'players'), playerData);
      setNewPlayer({ firstName: '', lastName: '', nickname: '', gender: '', name: '', number: '', position: '', td: '0', tkl: '0', dob: '', teamId: '', shirtSize: '', pantSize: '', height: '', weight: '' });
      setIsAddModalOpen(false);
      
      // For parents, reload the AuthContext to pick up the new player
      if (isParent) {
        window.location.reload(); // Simple approach - could be optimized
      }
    } catch (error) { 
      console.error(error);
      alert('Failed to add player. Please try again.');
    } finally {
      setAddingPlayer(false);
    }
  };

  // Search for players by username across all teams (Coach only)
  // Now includes: age group filtering, debounce, draft pool/team conflict warnings
  const handleSearchPlayers = async (searchTerm: string) => {
    setPlayerSearchQuery(searchTerm);
    
    // Clear previous debounce timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    if (searchTerm.length < 2) {
      setPlayerSearchResults([]);
      return;
    }
    
    // Debounce: wait 300ms before searching
    const timer = setTimeout(async () => {
      setSearchingPlayers(true);
      try {
        const normalizedSearch = searchTerm.toLowerCase().replace(/^@/, '');
        const foundPlayers: (Player & { 
          teamName?: string;
          calculatedAgeGroup?: string | null;
          isInDraftPool?: boolean;
          draftPoolTeamName?: string;
          conflictWarning?: string;
        })[] = [];
        
        // Get team's age group for filtering
        const teamAgeGroup = teamData?.ageGroup;
        
        // Search all teams for players with matching username
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        
        // Build a map of team info for quick lookups
        const teamInfoMap = new Map<string, { name: string; ageGroup?: string }>();
        teamsSnapshot.docs.forEach(teamDoc => {
          const data = teamDoc.data();
          teamInfoMap.set(teamDoc.id, { name: data.name || 'Unknown Team', ageGroup: data.ageGroup });
        });
        
        // Collect all draft pool entries for conflict checking
        // Check BOTH team draft pools AND season draft pools
        const draftPoolPlayers = new Map<string, { teamId: string; teamName: string; source: string }>();
        
        // 1. Check team draft pools
        for (const teamDoc of teamsSnapshot.docs) {
          try {
            const draftPoolQuery = query(
              collection(db, 'teams', teamDoc.id, 'draftPool'),
              where('status', '==', 'waiting')
            );
            const draftPoolSnap = await getDocs(draftPoolQuery);
            draftPoolSnap.docs.forEach(dpDoc => {
              const dpData = dpDoc.data();
              // Key by playerId or playerName
              if (dpData.playerId) {
                draftPoolPlayers.set(dpData.playerId, {
                  teamId: teamDoc.id,
                  teamName: teamInfoMap.get(teamDoc.id)?.name || 'Unknown Team',
                  source: 'team'
                });
              }
              if (dpData.playerName) {
                draftPoolPlayers.set(dpData.playerName.toLowerCase(), {
                  teamId: teamDoc.id,
                  teamName: teamInfoMap.get(teamDoc.id)?.name || 'Unknown Team',
                  source: 'team'
                });
              }
            });
          } catch (e) {
            // Skip teams with no draft pool
          }
        }
        
        // 2. Check season draft pools (where season registrations go)
        try {
          const seasonsSnap = await getDocs(collection(db, 'seasons'));
          for (const seasonDoc of seasonsSnap.docs) {
            try {
              const seasonData = seasonDoc.data();
              const seasonDraftPoolQuery = query(
                collection(db, 'seasons', seasonDoc.id, 'draftPool'),
                where('status', '==', 'available')
              );
              const seasonDraftPoolSnap = await getDocs(seasonDraftPoolQuery);
              seasonDraftPoolSnap.docs.forEach(dpDoc => {
                const dpData = dpDoc.data();
                const seasonName = seasonData.name || 'Draft Pool';
                if (dpData.athleteId) {
                  draftPoolPlayers.set(dpData.athleteId, {
                    teamId: seasonDoc.id,
                    teamName: seasonName,
                    source: 'season'
                  });
                }
                // Also key by name for matching
                const playerNameKey = `${dpData.athleteFirstName} ${dpData.athleteLastName}`.toLowerCase().trim();
                if (playerNameKey) {
                  draftPoolPlayers.set(playerNameKey, {
                    teamId: seasonDoc.id,
                    teamName: seasonName,
                    source: 'season'
                  });
                }
              });
            } catch (e) {
              // Skip seasons with no draft pool
            }
          }
        } catch (e) {
          console.error('Error checking season draft pools:', e);
        }
        
        for (const teamDoc of teamsSnapshot.docs) {
          const teamInfo = teamInfoMap.get(teamDoc.id);
          const playersSnapshot = await getDocs(collection(db, 'teams', teamDoc.id, 'players'));
          
          playersSnapshot.docs.forEach(playerDoc => {
            const playerData = playerDoc.data();
            const playerUsername = (playerData.username || '').toLowerCase();
            const playerName = (playerData.name || '').toLowerCase();
            
            // Match username or name
            if (playerUsername.includes(normalizedSearch) || playerName.includes(normalizedSearch)) {
              // Don't show players already on this team
              if (teamDoc.id !== teamData?.id) {
                // Calculate player's age group
                const playerAgeGroup = playerData.dob ? calculateAgeGroup(playerData.dob) : null;
                
                // Check for age group mismatch (handles ranges like "9U-10U")
                const ageGroupMatches = playerAgeGroupFitsTeam(playerAgeGroup, teamAgeGroup);
                
                // Check if player is in draft pool (from map OR from player document field)
                const draftPoolEntry = draftPoolPlayers.get(playerDoc.id) || 
                                       draftPoolPlayers.get(playerData.name?.toLowerCase() || '');
                
                // Also check player document's draftPoolStatus field
                const hasPlayerDraftStatus = playerData.draftPoolStatus === 'waiting' || 
                                             playerData.draftPoolStatus === 'available' ||
                                             playerData.draftPoolStatus === 'pending';
                
                const isPlayerInDraftPool = !!draftPoolEntry || hasPlayerDraftStatus;
                
                // Determine conflict warning
                let conflictWarning: string | undefined;
                if (isPlayerInDraftPool) {
                  conflictWarning = draftPoolEntry 
                    ? `In draft pool for ${draftPoolEntry.teamName}`
                    : 'Already in draft pool';
                } else if (!ageGroupMatches) {
                  conflictWarning = `Age group mismatch: ${playerAgeGroup || 'Unknown'} vs team's ${teamAgeGroup}`;
                }
                
                // Only include players that match age group (unless no team age group set)
                // But still show mismatches with warnings if they search directly
                foundPlayers.push({
                  id: playerDoc.id,
                  teamId: teamDoc.id,
                  teamName: teamInfo?.name,
                  calculatedAgeGroup: playerAgeGroup,
                  isInDraftPool: isPlayerInDraftPool,
                  draftPoolTeamName: draftPoolEntry?.teamName,
                  conflictWarning,
                  ...playerData
                } as Player & { 
                  teamName?: string;
                  calculatedAgeGroup?: string | null;
                  isInDraftPool?: boolean;
                  draftPoolTeamName?: string;
                  conflictWarning?: string;
                });
              }
            }
          });
        }
        
        // Also search unassigned players (top-level players collection)
        try {
          const unassignedPlayersSnap = await getDocs(collection(db, 'players'));
          unassignedPlayersSnap.docs.forEach(playerDoc => {
            const playerData = playerDoc.data();
            const playerUsername = (playerData.username || '').toLowerCase();
            const playerName = (playerData.name || '').toLowerCase();
            
            if (playerUsername.includes(normalizedSearch) || playerName.includes(normalizedSearch)) {
              // Calculate player's age group
              const playerAgeGroup = playerData.dob ? calculateAgeGroup(playerData.dob) : null;
              
              // Check for age group mismatch (handles ranges like "9U-10U")
              const ageGroupMatches = playerAgeGroupFitsTeam(playerAgeGroup, teamAgeGroup);
              
              // Check if player is in draft pool (from map OR from player document field)
              const draftPoolEntry = draftPoolPlayers.get(playerDoc.id) || 
                                     draftPoolPlayers.get(playerData.name?.toLowerCase() || '');
              
              // Also check player document's draftPoolStatus field
              const hasPlayerDraftStatus = playerData.draftPoolStatus === 'waiting' || 
                                           playerData.draftPoolStatus === 'available' ||
                                           playerData.draftPoolStatus === 'pending';
              
              const isPlayerInDraftPool = !!draftPoolEntry || hasPlayerDraftStatus;
              
              let conflictWarning: string | undefined;
              if (isPlayerInDraftPool) {
                conflictWarning = draftPoolEntry 
                  ? `In draft pool for ${draftPoolEntry.teamName}`
                  : 'Already in draft pool';
              } else if (!ageGroupMatches) {
                conflictWarning = `Age group mismatch: ${playerAgeGroup || 'Unknown'} vs team's ${teamAgeGroup}`;
              }
              
              // Avoid duplicates (player might exist in both places)
              if (!foundPlayers.find(p => p.id === playerDoc.id)) {
                foundPlayers.push({
                  id: playerDoc.id,
                  teamId: undefined,
                  teamName: undefined,
                  calculatedAgeGroup: playerAgeGroup,
                  isInDraftPool: isPlayerInDraftPool,
                  draftPoolTeamName: draftPoolEntry?.teamName,
                  conflictWarning,
                  ...playerData
                } as Player & { 
                  teamName?: string;
                  calculatedAgeGroup?: string | null;
                  isInDraftPool?: boolean;
                  draftPoolTeamName?: string;
                  conflictWarning?: string;
                });
              }
            }
          });
        } catch (e) {
          // Skip if players collection doesn't exist
        }
        
        // Sort results: matching age group first, then by conflicts, then alphabetically
        foundPlayers.sort((a, b) => {
          // Players matching team age group come first
          const aMatches = a.calculatedAgeGroup === teamAgeGroup;
          const bMatches = b.calculatedAgeGroup === teamAgeGroup;
          if (aMatches && !bMatches) return -1;
          if (!aMatches && bMatches) return 1;
          
          // Then sort by conflict (no conflicts first)
          if (!a.conflictWarning && b.conflictWarning) return -1;
          if (a.conflictWarning && !b.conflictWarning) return 1;
          
          // Finally alphabetically
          return (a.name || '').localeCompare(b.name || '');
        });
        
        setPlayerSearchResults(foundPlayers);
      } catch (error) {
        console.error('Error searching players:', error);
      } finally {
        setSearchingPlayers(false);
      }
    }, 300); // 300ms debounce
    
    setSearchDebounceTimer(timer);
  };

  // Add selected player to coach's team
  const handleAddPlayerToTeam = async () => {
    if (!selectedPlayerToAdd || !teamData?.id || addingPlayer) return;
    
    // DEBUG: Log what we're working with
    console.log('DEBUG Add Player:', {
      teamId: teamData.id,
      userRole: userData?.role,
      userTeamId: userData?.teamId,
      userTeamIds: userData?.teamIds,
      userId: userData?.uid
    });
    
    // Check if player is already on another team
    if (selectedPlayerToAdd.teamId && selectedPlayerToAdd.teamId !== teamData.id) {
      alert(`This player is already on another team${selectedPlayerToAdd.teamName ? ` (${selectedPlayerToAdd.teamName})` : ''}. Players can only be on one team at a time.`);
      return;
    }
    
    // Check if player is already on this team
    const alreadyOnTeam = roster.some(p => p.username === selectedPlayerToAdd.username);
    if (alreadyOnTeam) {
      alert('This player is already on your team.');
      return;
    }
    
    setAddingPlayer(true);
    try {
      // Copy player data to new team - include ageGroup or calculate it
      const ageGroup = selectedPlayerToAdd.ageGroup || calculateAgeGroup(selectedPlayerToAdd.dob);
      
      const playerData: any = {
        name: selectedPlayerToAdd.name,
        username: selectedPlayerToAdd.username,
        dob: selectedPlayerToAdd.dob,
        ageGroup: ageGroup || undefined, // e.g., "9U", "10U"
        teamId: teamData.id,
        parentId: selectedPlayerToAdd.parentId,
        photoUrl: selectedPlayerToAdd.photoUrl,
        height: selectedPlayerToAdd.height,
        weight: selectedPlayerToAdd.weight,
        shirtSize: selectedPlayerToAdd.shirtSize,
        pantSize: selectedPlayerToAdd.pantSize,
        bio: selectedPlayerToAdd.bio,
        medical: selectedPlayerToAdd.medical || { allergies: 'None', conditions: 'None', medications: 'None', bloodType: '' },
        // Coach will assign these
        number: 0,
        position: 'TBD',
        stats: { td: 0, tkl: 0 }
      };
      
      await addDoc(collection(db, 'teams', teamData.id, 'players'), playerData);
      
      // Reset and close
      setSelectedPlayerToAdd(null);
      setPlayerSearchQuery('');
      setPlayerSearchResults([]);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding player to team:', error);
      alert('Failed to add player. Please try again.');
    } finally {
      setAddingPlayer(false);
    }
  };
  
  const handleLinkParent = async () => {
      if (!teamData?.id || !selectedPlayerId || !selectedParentId || linkingParent) return;
      setLinkingParent(true);
      try {
          const playerRef = doc(db, 'teams', teamData.id, 'players', selectedPlayerId);
          await updateDoc(playerRef, { parentId: selectedParentId });
          setIsLinkModalOpen(false);
          setSelectedPlayerId(''); setSelectedParentId('');
      } catch (error) { 
          console.error(error); 
          alert('Failed to link parent. Please try again.');
      } finally {
          setLinkingParent(false);
      }
  }

  const handleDeletePlayer = async () => {
    if (!teamData?.id || !deletePlayerConfirm) return;
    setDeletingPlayer(true);
    try { 
      await deleteDoc(doc(db, 'teams', teamData.id, 'players', deletePlayerConfirm.id)); 
      setDeletePlayerConfirm(null);
    } catch (error) { console.error(error); }
    finally { setDeletingPlayer(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewPlayer(prev => ({ ...prev, [name]: value }));
  };

  const getParentInfo = (parentId?: string) => parents.find(p => p.uid === parentId);
  const openContact = (parentId?: string) => { 
    const parent = getParentInfo(parentId); 
    if (parent) {
      setViewContact(parent);
      setIsEditingContact(false);
      // Initialize edit form with current values
      setEditContactForm({
        phone: parent.phone || '',
        secondaryPhone: parent.secondaryPhone || '',
        address: parent.address || '',
        emergName: parent.emergencyContact?.name || '',
        emergPhone: parent.emergencyContact?.phone || '',
        emergRelation: parent.emergencyContact?.relation || ''
      });
    }
  };

  const handleSaveContact = async () => {
    if (!viewContact || savingContact) return;
    setSavingContact(true);
    try {
      await updateDoc(doc(db, 'users', viewContact.uid), {
        phone: editContactForm.phone,
        secondaryPhone: editContactForm.secondaryPhone,
        address: editContactForm.address,
        emergencyContact: {
          name: editContactForm.emergName,
          phone: editContactForm.emergPhone,
          relation: editContactForm.emergRelation
        }
      });
      setIsEditingContact(false);
      setViewContact(null);
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Failed to update contact information.');
    } finally {
      setSavingContact(false);
    }
  };

  // Handle player photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingPlayer || !editingPlayer.teamId || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB. Please choose a smaller image.');
      return;
    }
    
    setUploadingPhoto(true);
    try {
      // Resize and compress the image
      const resizedBase64 = await resizeImage(file, 200, 200); // 200x200 for headshot
      
      // Update player with photo
      const playerRef = doc(db, 'teams', editingPlayer.teamId, 'players', editingPlayer.id);
      await updateDoc(playerRef, { photoUrl: resizedBase64 });
      
      // Update local state
      setEditingPlayer({ ...editingPlayer, photoUrl: resizedBase64 });
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };
  
  // Helper function to resize image
  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions maintaining aspect ratio
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
          
          // Convert to base64 with compression
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
  
  // Remove player photo
  const handleRemovePhoto = async () => {
    if (!editingPlayer || !editingPlayer.teamId) return;
    
    setUploadingPhoto(true);
    try {
      const playerRef = doc(db, 'teams', editingPlayer.teamId, 'players', editingPlayer.id);
      await updateDoc(playerRef, { photoUrl: null });
      setEditingPlayer({ ...editingPlayer, photoUrl: undefined });
    } catch (error) {
      console.error('Error removing photo:', error);
      alert('Failed to remove photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !editingPlayer.teamId || savingPlayer) {
      console.error('[Roster] Cannot save - missing data:', { editingPlayer: !!editingPlayer, teamId: editingPlayer?.teamId, savingPlayer });
      return;
    }
    
    console.log('[Roster] Saving player update:', { 
      playerId: editingPlayer.id, 
      teamId: editingPlayer.teamId,
      nickname: editingPlayer.nickname 
    });
    
    setSavingPlayer(true);
    try {
      const playerRef = doc(db, 'teams', editingPlayer.teamId, 'players', editingPlayer.id);
      const updateData: any = {
        firstName: editingPlayer.firstName || editingPlayer.name?.split(' ')[0] || '',
        lastName: editingPlayer.lastName || editingPlayer.name?.split(' ').slice(1).join(' ') || '',
        nickname: editingPlayer.nickname || '',
        name: editingPlayer.name,
        dob: editingPlayer.dob,
        gender: editingPlayer.gender || '',
        shirtSize: editingPlayer.shirtSize || '',
        pantSize: editingPlayer.pantSize || '',
        height: editingPlayer.height || '',
        weight: editingPlayer.weight || ''
      };
      
      // Coaches can also edit jersey number, position, and designations
      if (isStaff) {
        updateData.number = editingPlayer.number || 0;
        updateData.position = editingPlayer.position || 'TBD';
        updateData.isStarter = editingPlayer.isStarter || false;
        updateData.isCaptain = editingPlayer.isCaptain || false;
      }
      
      console.log('[Roster] Update data:', updateData);
      await updateDoc(playerRef, updateData);
      console.log('[Roster] Player saved successfully!');
      setEditingPlayer(null);
    } catch (error) {
      console.error('Error updating player:', error);
      alert('Failed to update player information.');
    } finally {
      setSavingPlayer(false);
    }
  };

  // Head Coach: Remove another coach from the team
  const handleRemoveCoach = async () => {
    if (!removeCoachConfirm || !teamData?.id || !isHeadCoach || removingCoach) return;
    
    // Cannot remove yourself
    if (removeCoachConfirm.id === userData?.uid) {
      alert("You cannot remove yourself from the team.");
      setRemoveCoachConfirm(null);
      return;
    }
    
    setRemovingCoach(true);
    try {
      // Remove team from coach's teamIds array and clear teamId if it matches
      const coachRef = doc(db, 'users', removeCoachConfirm.id);
      await updateDoc(coachRef, { 
        teamId: null,
        teamIds: arrayRemove(teamData.id)
      });
      
      // Also remove coach from team's coachIds array
      await updateDoc(doc(db, 'teams', teamData.id), {
        coachIds: arrayRemove(removeCoachConfirm.id)
      });
      
      // Log the action to Activity Log
      await addDoc(collection(db, 'adminActivityLog'), {
        action: 'REMOVE_COACH',
        targetType: 'coach',
        targetId: removeCoachConfirm.id,
        details: `Head Coach "${userData?.name}" removed coach "${removeCoachConfirm.name}" from team "${teamData?.name || teamData?.id}"`,
        performedBy: userData?.uid || 'unknown',
        performedByName: userData?.name || 'Unknown',
        timestamp: serverTimestamp()
      });
      
      // Update local state
      setTeamCoaches(prev => prev.filter(c => c.uid !== removeCoachConfirm.id));
      
      setRemoveCoachConfirm(null);
    } catch (error) {
      console.error('Error removing coach:', error);
      alert('Failed to remove coach from team.');
    } finally {
      setRemovingCoach(false);
    }
  };

  // Load all coaches when modal opens (for instant search)
  useEffect(() => {
    if (isAddCoachModalOpen && !coachesCacheLoaded) {
      const loadAllCoaches = async () => {
        setSearchingCoaches(true);
        try {
          const coachesQuery = query(
            collection(db, 'users'),
            where('role', '==', 'Coach')
          );
          const snapshot = await getDocs(coachesQuery);
          const allCoaches = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
          setAllCoachesCache(allCoaches);
          setCoachesCacheLoaded(true);
        } catch (error) {
          console.error('Error loading coaches:', error);
        } finally {
          setSearchingCoaches(false);
        }
      };
      loadAllCoaches();
    }
  }, [isAddCoachModalOpen, coachesCacheLoaded]);
  
  // Live filter coaches as user types
  useEffect(() => {
    if (!coachesCacheLoaded || !isAddCoachModalOpen) return;
    
    const searchTerm = coachSearchQuery.toLowerCase().trim();
    
    if (!searchTerm) {
      setAvailableCoaches([]);
      return;
    }
    
    // Filter from cache (instant)
    const filtered = allCoachesCache.filter(coach => 
      (coach.name?.toLowerCase().includes(searchTerm) ||
      coach.username?.toLowerCase().includes(searchTerm) ||
      coach.email?.toLowerCase().includes(searchTerm)) &&
      // Exclude coaches already on this team
      !teamCoaches.some(tc => tc.uid === coach.uid)
    );
    
    setAvailableCoaches(filtered);
  }, [coachSearchQuery, allCoachesCache, coachesCacheLoaded, teamCoaches, isAddCoachModalOpen]);
  
  // Search for coaches to add (Head Coach only) - kept for Enter key support
  const handleSearchCoaches = async () => {
    // This function is now optional - search happens live as you type
    // But we keep it for manual trigger if needed
    if (!coachSearchQuery.trim()) return;
    
    if (!coachesCacheLoaded) {
      setSearchingCoaches(true);
      try {
        const coachesQuery = query(
          collection(db, 'users'),
          where('role', '==', 'Coach')
        );
        const snapshot = await getDocs(coachesQuery);
        const allCoaches = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        setAllCoachesCache(allCoaches);
        setCoachesCacheLoaded(true);
        
        // Filter immediately
        const searchTerm = coachSearchQuery.toLowerCase();
        const filtered = allCoaches.filter(coach => 
          (coach.name?.toLowerCase().includes(searchTerm) ||
          coach.username?.toLowerCase().includes(searchTerm) ||
          coach.email?.toLowerCase().includes(searchTerm)) &&
          !teamCoaches.some(tc => tc.uid === coach.uid)
        );
        setAvailableCoaches(filtered);
      } catch (error) {
        console.error('Error searching coaches:', error);
        alert('Failed to search for coaches.');
      } finally {
        setSearchingCoaches(false);
      }
    }
  };

  // Invite coach to team (Head Coach only) - Creates invitation that coach must accept
  const handleAddCoachToTeam = async (coach: UserProfile) => {
    if (!teamData?.id || !isHeadCoach || addingCoach) return;
    
    setAddingCoach(true);
    try {
      // Check if there's already a pending invitation for this coach to this team
      const existingInviteQuery = query(
        collection(db, 'teamInvitations'),
        where('teamId', '==', teamData.id),
        where('invitedCoachId', '==', coach.uid),
        where('status', '==', 'pending')
      );
      const existingSnap = await getDocs(existingInviteQuery);
      
      if (!existingSnap.empty) {
        alert(`${coach.name} already has a pending invitation to this team.`);
        setAddingCoach(false);
        return;
      }
      
      // Create team invitation record
      const invitationRef = await addDoc(collection(db, 'teamInvitations'), {
        teamId: teamData.id,
        teamName: teamData.name || teamData.id,
        invitedCoachId: coach.uid,
        invitedCoachName: coach.name,
        invitedCoachEmail: coach.email,
        invitedByUserId: userData?.uid,
        invitedByName: userData?.name,
        status: 'pending',
        createdAt: serverTimestamp(),
        respondedAt: null
      });
      
      // Create notification for the invited coach
      await addDoc(collection(db, 'notifications'), {
        userId: coach.uid,
        type: 'team_invite',
        category: 'team',
        priority: 'high',
        title: 'Team Invitation',
        message: `${userData?.name} has invited you to join "${teamData.name}" as a coach.`,
        read: false,
        actionRequired: true,
        actionType: 'accept_decline',
        link: '/notifications',
        metadata: {
          invitationId: invitationRef.id,
          teamId: teamData.id,
          teamName: teamData.name,
          invitedByUserId: userData?.uid,
          invitedByName: userData?.name
        },
        createdAt: serverTimestamp()
      });
      
      // Log the action (non-blocking)
      addDoc(collection(db, 'adminActivityLog'), {
        action: 'INVITE_COACH',
        targetType: 'coach',
        targetId: coach.uid,
        details: `Head Coach "${userData?.name}" invited coach "${coach.name}" to team "${teamData?.name || teamData?.id}"`,
        performedBy: userData?.uid || 'unknown',
        performedByName: userData?.name || 'Unknown',
        timestamp: serverTimestamp()
      }).catch(err => console.warn('Failed to log invite coach action:', err));
      
      // Show success message
      alert(`Invitation sent to ${coach.name}! They will need to accept it to join the team.`);
      
      // Remove from available coaches (they have a pending invite)
      setAvailableCoaches(prev => prev.filter(c => c.uid !== coach.uid));
      
      // Close modal if no more results
      if (availableCoaches.length <= 1) {
        setIsAddCoachModalOpen(false);
        setCoachSearchQuery('');
        setAvailableCoaches([]);
      }
    } catch (error) {
      console.error('Error inviting coach:', error);
      alert('Failed to send invitation.');
    } finally {
      setAddingCoach(false);
    }
  };

  // Transfer Head Coach title (current Head Coach only)
  const handleTransferHeadCoach = async () => {
    if (!transferHeadCoachTo || !teamData?.id || !isHeadCoach || transferringHeadCoach) return;
    
    setTransferringHeadCoach(true);
    try {
      // Update team's headCoachId
      await updateDoc(doc(db, 'teams', teamData.id), {
        headCoachId: transferHeadCoachTo.id
      });
      
      // Log the action
      await addDoc(collection(db, 'adminActivityLog'), {
        action: 'TRANSFER_HEAD_COACH',
        targetType: 'team',
        targetId: teamData.id,
        details: `"${userData?.name}" transferred Head Coach title to "${transferHeadCoachTo.name}" for team "${teamData?.name || teamData?.id}"`,
        performedBy: userData?.uid || 'unknown',
        performedByName: userData?.name || 'Unknown',
        timestamp: serverTimestamp()
      });
      
      setTransferHeadCoachTo(null);
      // Page will refresh with new head coach through onSnapshot
      window.location.reload();
    } catch (error) {
      console.error('Error transferring head coach:', error);
      alert('Failed to transfer Head Coach title.');
    } finally {
      setTransferringHeadCoach(false);
    }
  };

  // Assign/Remove Coordinator (Head Coach only)
  const handleAssignCoordinator = async (coachId: string | null) => {
    if (!teamData?.id || !isHeadCoach || !assignCoordinatorModal) return;
    
    setAssigningCoordinator(true);
    try {
      const updateData: any = {
        updatedAt: serverTimestamp()
      };
      const fieldName = assignCoordinatorModal.type === 'OC' 
        ? 'offensiveCoordinatorId' 
        : assignCoordinatorModal.type === 'DC' 
          ? 'defensiveCoordinatorId' 
          : 'specialTeamsCoordinatorId';
      updateData[fieldName] = coachId;
      
      await updateDoc(doc(db, 'teams', teamData.id), updateData);
      
      // Log the action (non-blocking - don't fail if logging fails)
      const coachName = coachId ? teamCoaches.find(c => c.uid === coachId)?.name || 'Unknown' : 'None';
      const positionName = assignCoordinatorModal.type === 'OC' 
        ? 'Offensive Coordinator' 
        : assignCoordinatorModal.type === 'DC' 
          ? 'Defensive Coordinator' 
          : 'Special Teams Coordinator';
      
      addDoc(collection(db, 'adminActivityLog'), {
        action: coachId ? 'ASSIGN_COORDINATOR' : 'REMOVE_COORDINATOR',
        targetType: 'team',
        targetId: teamData.id,
        details: coachId 
          ? `"${userData?.name}" assigned "${coachName}" as ${positionName} for team "${teamData?.name || teamData?.id}"`
          : `"${userData?.name}" removed ${positionName} from team "${teamData?.name || teamData?.id}"`,
        performedBy: userData?.uid || 'unknown',
        performedByName: userData?.name || 'Unknown',
        timestamp: serverTimestamp()
      }).catch(err => console.warn('Failed to log coordinator action:', err));
      
      setAssignCoordinatorModal(null);
    } catch (error) {
      console.error('Error assigning coordinator:', error);
      alert('Failed to assign coordinator.');
    } finally {
      setAssigningCoordinator(false);
    }
  };

  // Copy team public link
  const copyTeamLink = async () => {
    if (!teamData?.id) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const publicUrl = `${baseUrl}#/team/${teamData.id}`;
    
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedTeamLink(true);
      setTimeout(() => setCopiedTeamLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <NoAthleteBlock featureName="Roster">
    <div className="relative min-h-screen">
      {/* Animated Background */}
      <AnimatedBackground />
      
      <div className="relative z-10 space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Team Roster</h1>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {roster.length} player{roster.length !== 1 ? 's' : ''} on the roster
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Filter */}
          {roster.length > 0 && (
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search players..."
                className={`w-full sm:w-48 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                  theme === 'dark' 
                    ? 'bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50' 
                    : 'bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500'
                }`}
              />
            </div>
          )}
          {isStaff && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
            >
              <Plus className="w-4 h-4" /> Add Player
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {roster.length > 0 && searchFilter && (
        <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Showing {filteredRoster.length} of {roster.length} players
        </p>
      )}

      {/* Team Public Page Link - Coaches only */}
      {isStaff && teamData?.id && (
        <GlassCard className={`p-4 ${theme === 'light' ? 'bg-white/80 border-orange-200' : 'border-orange-500/20'}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <ExternalLink className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Public Team Page</p>
                <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Share your team's stats, roster, and schedule</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className={`flex-1 sm:flex-none rounded px-3 py-2 text-xs truncate max-w-[220px] ${
                theme === 'dark' ? 'bg-black/30 text-zinc-300 border border-white/10' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
              }`}>
                osys.team/#/team/{teamData.id}
              </div>
              <button
                onClick={copyTeamLink}
                className={`flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-all ${
                  copiedTeamLink
                    ? 'bg-emerald-500 text-white'
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25'
                }`}
              >
                {copiedTeamLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </button>
              <a
                href={`#/team/${teamData.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 rounded transition-colors ${
                  theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                }`}
                title="View public team page"
              >
                <Eye className="w-4 h-4" />
              </a>
            </div>
          </div>
        </GlassCard>
      )}

      {!teamData && isParent ? (
        <GlassCard className={`p-8 text-center ${theme === 'light' ? 'bg-white/80 border-zinc-200' : ''}`}>
          <Users className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
          <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>No Team Yet</h3>
          <p className={`mb-4 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Add your athlete in your profile to join a team and view the roster.</p>
          <a 
            href="#/profile" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-lg transition-all shadow-lg shadow-orange-500/25"
          >
            <Plus className="w-5 h-5" /> Go to My Profile
          </a>
        </GlassCard>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredRoster.length > 0 ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedRoster.map(player => {
            const hasMedicalAlert = player.medical && (player.medical.allergies !== 'None' || player.medical.conditions !== 'None');
            const parent = getParentInfo(player.parentId);
            const isStarter = player.isStarter;
            const isCaptain = player.isCaptain;

            return (
                <GlassCard 
                  key={player.id} 
                  glow={isStarter}
                  className={`p-5 flex flex-col relative overflow-hidden transition-all duration-300 ${
                    isStarter 
                      ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/50 dark:ring-amber-500/40' 
                      : theme === 'dark' 
                        ? 'hover:border-orange-500/30' 
                        : 'bg-white/80 hover:border-orange-500/30'
                  }`}
                  style={isStarter ? { boxShadow: '0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.1)' } : {}}
                >
                    {/* Starter Badge - Top Left Corner */}
                    {isStarter && (
                      <div className="absolute top-2 left-2 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full px-2.5 py-1 shadow-lg flex items-center gap-1 z-10">
                        <Star className="w-3 h-3 text-white fill-white" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wide">Starter</span>
                      </div>
                    )}
                    
                    {/* Player Photo */}
                    <div className={`flex justify-center ${isStarter ? 'mt-6' : 'mt-2'} mb-3`}>
                      {player.photoUrl ? (
                        <button 
                          onClick={() => setViewPhotoPlayer(player)}
                          className={`w-20 h-20 rounded-full overflow-hidden border-4 cursor-pointer hover:scale-105 transition-transform ${
                          isStarter 
                            ? 'border-amber-400 dark:border-amber-500 shadow-lg shadow-amber-400/30' 
                            : theme === 'dark' ? 'border-zinc-700 hover:border-orange-500' : 'border-zinc-300 hover:border-orange-500'
                        }`}>
                          <img 
                            src={player.photoUrl} 
                            alt={player.name} 
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 font-mono ${
                          isStarter 
                            ? 'bg-gradient-to-br from-amber-100 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/30 border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-400 shadow-lg shadow-amber-400/30' 
                            : theme === 'dark' ? 'bg-white/5 border-white/20 text-white' : 'bg-zinc-100 border-zinc-300 text-zinc-900'
                        }`}>
                          {player.number}
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons - top right */}
                    <div className="absolute top-2 right-2 flex gap-1">
                        {/* PRIVACY FIX: Only Coaches/Staff can see the Medical Alert Button */}
                        {hasMedicalAlert && isStaff && (
                            <button onClick={() => setViewMedical(player)} className="text-red-500 hover:text-red-400 bg-red-500/10 p-1.5 rounded-full animate-pulse">
                                <AlertCircle className="w-4 h-4" />
                            </button>
                        )}
                        {parent && isStaff && (
                            <button onClick={() => openContact(player.parentId)} className="text-cyan-500 hover:text-cyan-400 bg-cyan-500/10 p-1.5 rounded-full">
                                <Phone className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="text-center mb-4">
                        <h3 className={`text-xl font-bold truncate flex items-center justify-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                          {player.nickname ? (
                            <span>{player.firstName || player.name?.split(' ')[0]} <span className="text-orange-500">"{player.nickname}"</span> {player.lastName || player.name?.split(' ').slice(1).join(' ')}</span>
                          ) : player.name}
                          {isCaptain && <Crown className="w-5 h-5 text-amber-500 flex-shrink-0" />}
                        </h3>
                        {/* Username */}
                        {player.username && (
                          <a 
                            href={`#/athlete/${player.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1 mt-0.5 hover:opacity-80 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <AtSign className="w-3 h-3 text-orange-500" />
                            <span className="text-sm text-orange-600 dark:text-orange-400 font-medium hover:underline">{player.username}</span>
                          </a>
                        )}
                        <p className="text-orange-500 font-bold text-sm uppercase tracking-wide">
                          {player.photoUrl && <span>#{player.number} <span className={theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}>|</span> </span>}{player.position}
                        </p>
                        <div className={`flex items-center justify-center gap-2 mt-1 flex-wrap`}>
                          <span className={`text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>DOB: {player.dob || '--'}</span>
                          {player.dob && calculateAgeGroup(player.dob) && (
                            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs px-2 py-0.5 rounded font-bold">
                              {calculateAgeGroup(player.dob)}
                            </span>
                          )}
                          {player.dob && !calculateAgeGroup(player.dob) && (
                            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs px-2 py-0.5 rounded">
                              18+
                            </span>
                          )}
                        </div>
                    </div>

                    {/* Quick Stats with View Stats Button */}
                    <div className="mt-auto mb-4">
                      <div className={`flex justify-center gap-4 p-2 rounded-t-lg border border-b-0 ${
                        theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-zinc-50 border-zinc-200'
                      }`}>
                        <div className={`flex items-center gap-1 text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            <Sword className="w-3 h-3 text-orange-500" /> <span className="font-bold">{player.stats?.td || 0}</span> TD
                        </div>
                        <div className={`flex items-center gap-1 text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            <Shield className="w-3 h-3 text-cyan-500" /> <span className="font-bold">{player.stats?.tkl || 0}</span> TKL
                        </div>
                      </div>
                      <button
                        onClick={() => setViewStatsPlayer(player)}
                        className={`w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-b-lg border border-t-0 transition-colors ${
                          theme === 'dark' 
                            ? 'text-orange-400 bg-orange-900/20 hover:bg-orange-900/30 border-orange-900/30' 
                            : 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200'
                        }`}
                      >
                        <Eye className="w-3 h-3" /> View Stats History
                      </button>
                    </div>

                    {/* Height & Weight - Visible to everyone */}
                    {(player.height || player.weight) && (
                      <div className={`mb-3 p-2 rounded border ${
                        theme === 'dark' ? 'bg-cyan-900/10 border-cyan-900/30' : 'bg-cyan-50 border-cyan-200'
                      }`}>
                        <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1">Physical</p>
                        <div className="flex justify-around text-xs">
                          {player.height && (
                            <div>
                              <span className={theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}>Height:</span>
                              <span className={`ml-1 font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{player.height}</span>
                            </div>
                          )}
                          {player.weight && (
                            <div>
                              <span className={theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}>Weight:</span>
                              <span className={`ml-1 font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{player.weight}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Uniform Sizes - Visible to both Parents and Coaches */}
                    {(player.shirtSize || player.pantSize) && (
                      <div className={`mb-3 p-2 rounded border ${
                        theme === 'dark' ? 'bg-orange-900/10 border-orange-900/30' : 'bg-orange-50 border-orange-200'
                      }`}>
                        <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Uniform</p>
                        <div className="flex justify-around text-xs">
                          {player.shirtSize && (
                            <div>
                              <span className={theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}>Shirt:</span>
                              <span className={`ml-1 font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{player.shirtSize}</span>
                            </div>
                          )}
                          {player.pantSize && (
                            <div>
                              <span className={theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}>Pants:</span>
                              <span className={`ml-1 font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{player.pantSize}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Parent: Edit their own child */}
                    {isParent && player.parentId === userData?.uid && (
                      <div className={`flex justify-center pt-3 mt-2 ${theme === 'dark' ? 'border-t border-white/10' : 'border-t border-zinc-200'}`}>
                        <button 
                          onClick={() => setEditingPlayer(player)} 
                          className="text-xs flex items-center gap-1 text-orange-600 hover:text-orange-500 dark:text-orange-400 dark:hover:text-orange-300 font-bold"
                        >
                          <Edit2 className="w-3 h-3" /> Edit Player Info
                        </button>
                      </div>
                    )}

                    {/* Coach/Admin controls */}
                    {isStaff && (
                        <div className={`border-t pt-3 mt-2 space-y-2 ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
                            <div className="flex justify-between items-center">
                                {!player.parentId ? (
                                    <button onClick={() => { setSelectedPlayerId(player.id); setIsLinkModalOpen(true); }} className={`text-xs flex items-center gap-1 ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'}`}><LinkIcon className="w-3 h-3" /> Link Parent</button>
                                ) : (
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><User className="w-3 h-3"/> {parent?.name || 'Linked'}</span>
                                )}
                                <button onClick={() => setDeletePlayerConfirm({ id: player.id, name: player.name, number: String(player.number) })} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove</button>
                            </div>
                            <button 
                              onClick={() => setEditingPlayer(player)} 
                              className="w-full text-xs flex items-center justify-center gap-1 text-orange-600 hover:text-orange-500 dark:text-orange-400 dark:hover:text-orange-300 font-bold"
                            >
                              <Edit2 className="w-3 h-3" /> Edit Player
                            </button>
                        </div>
                    )}
                </GlassCard>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10' 
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25'
                      : theme === 'dark' ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10' 
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
        </>
      ) : searchFilter ? (
        <EmptyState
          type="search"
          title="No Players Found"
          description={`No players match "${searchFilter}". Try adjusting your search term.`}
          actionLabel="Clear Search"
          onAction={() => setSearchFilter('')}
          compact
        />
      ) : (
        <EmptyState
          type="roster"
          title="Build Your Roster"
          description="Add your first player to get started. You can add their photo, jersey number, position, and more."
          actionLabel="Add First Player"
          onAction={() => setIsAddModalOpen(true)}
        />
      )}

      {/* COACHING STAFF SECTION - Only visible to coaches */}
      {isStaff && (
        <GlassCard className={`mt-8 p-6 ${theme === 'light' ? 'bg-white/80 border-zinc-200' : ''}`}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              <Users className="w-5 h-5 text-orange-500" />
              Coaching Staff ({teamCoaches.length})
            </h2>
            <div className="flex items-center gap-2">
              {isHeadCoach && (
                <>
                  <button
                    onClick={() => setIsAddCoachModalOpen(true)}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-orange-500/25"
                  >
                    <UserPlus className="w-4 h-4" /> Add Coach
                  </button>
                  <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                    theme === 'dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                  }`}>
                    <Crown className="w-3 h-3" /> Head Coach
                  </span>
                </>
              )}
            </div>
          </div>
          
          {teamCoaches.length === 0 ? (
            <div className={`text-center py-8 rounded-lg border border-dashed ${
              theme === 'dark' ? 'bg-white/5 border-white/20' : 'bg-zinc-50 border-zinc-300'
            }`}>
              <Users className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
              <p className="text-zinc-500">No coaches on this team yet.</p>
              {isHeadCoach && (
                <button
                  onClick={() => setIsAddCoachModalOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-orange-500/25"
                >
                  <UserPlus className="w-4 h-4" /> Add Your First Coach
                </button>
              )}
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamCoaches.map(coach => {
              const isOC = teamData?.offensiveCoordinatorId === coach.uid;
              const isDC = teamData?.defensiveCoordinatorId === coach.uid;
              const isSTC = teamData?.specialTeamsCoordinatorId === coach.uid;
              const isHC = teamData?.headCoachId === coach.uid;
              
              return (
              <div 
                key={coach.uid} 
                className={`rounded-lg p-4 border transition-all ${
                  isHC 
                    ? theme === 'dark' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'
                    : (isOC || isDC || isSTC)
                      ? theme === 'dark' ? 'bg-white/5 border-orange-500/20' : 'bg-white border-orange-200'
                      : theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-zinc-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-orange-500/25">
                      {coach.name?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <div>
                      <p className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                        {coach.name}
                        {isHC && (
                          <span title="Head Coach"><Crown className="w-4 h-4 text-orange-500" /></span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">@{coach.username || coach.email}</p>
                      {/* Coordinator badges */}
                      <div className="flex gap-1 mt-1">
                        {isOC && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                            theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                          }`}>
                            <Sword className="w-2.5 h-2.5" /> OC
                          </span>
                        )}
                        {isDC && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                            theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                          }`}>
                            <Shield className="w-2.5 h-2.5" /> DC
                          </span>
                        )}
                        {isSTC && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                            theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            <Zap className="w-2.5 h-2.5" /> STC
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Head Coach actions for coaches */}
                  {isHeadCoach && (
                    <div className="flex flex-col items-end gap-1">
                      {/* Coordinator quick-assign buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setAssignCoordinatorModal({ type: 'OC', currentId: isOC ? null : coach.uid });
                          }}
                          className={`p-1 rounded transition-colors ${
                            isOC 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                              : 'text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                          }`}
                          title={isOC ? 'Remove Offensive Coordinator' : 'Set as Offensive Coordinator'}
                        >
                          <Sword className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setAssignCoordinatorModal({ type: 'DC', currentId: isDC ? null : coach.uid });
                          }}
                          className={`p-1 rounded transition-colors ${
                            isDC 
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                              : 'text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                          }`}
                          title={isDC ? 'Remove Defensive Coordinator' : 'Set as Defensive Coordinator'}
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setAssignCoordinatorModal({ type: 'STC', currentId: isSTC ? null : coach.uid });
                          }}
                          className={`p-1 rounded transition-colors ${
                            isSTC 
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' 
                              : 'text-zinc-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                          }`}
                          title={isSTC ? 'Remove Special Teams Coordinator' : 'Set as Special Teams Coordinator'}
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      </div>
                      {coach.uid !== userData?.uid && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setTransferHeadCoachTo({ id: coach.uid, name: coach.name })}
                            className="text-purple-500 hover:text-purple-700 p-1 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            title="Transfer Head Coach title"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRemoveCoachConfirm({ id: coach.uid, name: coach.name })}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Remove from team"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {coach.phone && (
                  <a 
                    href={`tel:${coach.phone.replace(/[^0-9+]/g, '')}`}
                    className="text-xs text-cyan-500 hover:text-cyan-400 hover:underline mt-2 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="w-3 h-3" /> {coach.phone}
                  </a>
                )}
              </div>
              );
            })}
          </div>
          )}
        </GlassCard>
      )}

      {/* ADD COACH MODAL (Head Coach only) */}
      {isAddCoachModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl w-full max-w-md border shadow-2xl max-h-[90vh] overflow-y-auto ${
            theme === 'dark' 
              ? 'bg-zinc-900/95 border-white/10' 
              : 'bg-white border-zinc-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                <UserPlus className="w-5 h-5 text-orange-500" />
                Add Coach to Team
              </h2>
              <button
                onClick={() => {
                  setIsAddCoachModalOpen(false);
                  setCoachSearchQuery('');
                  setAvailableCoaches([]);
                  setCoachesCacheLoaded(false);
                  setAllCoachesCache([]);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Search for coaches who have already signed up. Enter their name, username, or email.
            </p>
            
            {/* Search Input - Live search as you type */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={coachSearchQuery}
                onChange={(e) => setCoachSearchQuery(e.target.value)}
                placeholder="Start typing to search coaches..."
                className={`w-full rounded-lg pl-10 pr-10 py-2.5 focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                  theme === 'dark' 
                    ? 'bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50' 
                    : 'bg-zinc-50 border border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500'
                }`}
                autoFocus
              />
              {searchingCoaches && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            {/* Search Results */}
            {availableCoaches.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableCoaches.map(coach => (
                  <div
                    key={coach.uid}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                        {coach.name?.charAt(0).toUpperCase() || 'C'}
                      </div>
                      <div>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{coach.name}</p>
                        <p className="text-xs text-zinc-500">@{coach.username || coach.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddCoachToTeam(coach)}
                      disabled={addingCoach}
                      className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all flex items-center gap-1 shadow-lg shadow-orange-500/25"
                    >
                      {addingCoach ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" /> Invite
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : coachSearchQuery.trim() && coachesCacheLoaded && !searchingCoaches ? (
              <div className="text-center py-8 text-zinc-500">
                <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No coaches found matching "{coachSearchQuery}"</p>
                <p className="text-xs mt-1">Make sure the coach has signed up first</p>
              </div>
            ) : !coachSearchQuery.trim() && coachesCacheLoaded ? (
              <div className="text-center py-6 text-zinc-400">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Start typing to search for coaches</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* TRANSFER HEAD COACH CONFIRMATION MODAL */}
      {transferHeadCoachTo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl w-full max-w-sm border shadow-2xl ${
            theme === 'dark' 
              ? 'bg-zinc-900/95 border-white/10' 
              : 'bg-white border-zinc-200'
          }`}>
            <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              <ArrowRightLeft className="w-5 h-5 text-orange-500" />
              Transfer Head Coach?
            </h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Are you sure you want to transfer the <strong className="text-orange-600 dark:text-orange-400">Head Coach</strong> title to <strong className={theme === 'dark' ? 'text-white' : 'text-zinc-900'}>{transferHeadCoachTo.name}</strong>?
            </p>
            <p className={`text-sm p-3 rounded-lg mb-6 ${
              theme === 'dark' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              ⚠️ You will lose your Head Coach privileges and only they can transfer it back.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setTransferHeadCoachTo(null)}
                disabled={transferringHeadCoach}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleTransferHeadCoach}
                disabled={transferringHeadCoach}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25"
              >
                {transferringHeadCoach ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE COACH CONFIRMATION MODAL */}
      {removeCoachConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl w-full max-w-sm border shadow-2xl ${
            theme === 'dark' 
              ? 'bg-zinc-900/95 border-white/10' 
              : 'bg-white border-zinc-200'
          }`}>
            <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              <AlertCircle className="w-5 h-5 text-red-500" />
              Remove Coach?
            </h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Are you sure you want to remove <strong className={theme === 'dark' ? 'text-white' : 'text-zinc-900'}>{removeCoachConfirm.name}</strong> from the team? 
              They will no longer have access to team content.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveCoachConfirm(null)}
                disabled={removingCoach}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveCoach}
                disabled={removingCoach}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {removingCoach ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN COORDINATOR CONFIRMATION MODAL */}
      {assignCoordinatorModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl w-full max-w-sm border shadow-2xl ${
            theme === 'dark' 
              ? 'bg-zinc-900/95 border-white/10' 
              : 'bg-white border-zinc-200'
          }`}>
            {(() => {
              const coordType = assignCoordinatorModal.type;
              const currentCoordId = coordType === 'OC' 
                ? teamData?.offensiveCoordinatorId 
                : coordType === 'DC' 
                  ? teamData?.defensiveCoordinatorId 
                  : teamData?.specialTeamsCoordinatorId;
              const selectedCoach = teamCoaches.find(c => c.uid === assignCoordinatorModal.currentId);
              const currentCoach = teamCoaches.find(c => c.uid === currentCoordId);
              const isRemoving = !assignCoordinatorModal.currentId || (currentCoordId === assignCoordinatorModal.currentId);
              
              const coordLabel = coordType === 'OC' ? 'Offensive' : coordType === 'DC' ? 'Defensive' : 'Special Teams';
              const coordShort = coordType === 'OC' ? 'OC' : coordType === 'DC' ? 'DC' : 'STC';
              const CoordIcon = coordType === 'OC' ? Sword : coordType === 'DC' ? Shield : Zap;
              const colorClass = coordType === 'OC' ? 'text-red-500' : coordType === 'DC' ? 'text-blue-500' : 'text-yellow-500';
              const bgColorClass = coordType === 'OC' ? 'bg-red-600 hover:bg-red-700' : coordType === 'DC' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-yellow-600 hover:bg-yellow-700';
              const textColorClass = coordType === 'OC' ? 'text-red-600 dark:text-red-400' : coordType === 'DC' ? 'text-blue-600 dark:text-blue-400' : 'text-yellow-600 dark:text-yellow-400';
              
              return (
                <>
                  <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                    <CoordIcon className={`w-5 h-5 ${colorClass}`} />
                    {isRemoving ? 'Remove' : 'Assign'} {coordLabel} Coordinator
                  </h2>
                  
                  {isRemoving && currentCoach ? (
                    <p className={`mb-6 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Remove <strong className={theme === 'dark' ? 'text-white' : 'text-zinc-900'}>{currentCoach.name}</strong> as {coordLabel} Coordinator?
                    </p>
                  ) : selectedCoach ? (
                    <p className={`mb-6 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {currentCoach && (
                        <span className="block mb-2 text-sm">
                          Current {coordShort}: <span className="text-zinc-500">{currentCoach.name}</span>
                        </span>
                      )}
                      Assign <strong className={textColorClass}>{selectedCoach.name}</strong> as {coordLabel} Coordinator?
                    </p>
                  ) : null}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setAssignCoordinatorModal(null)}
                      disabled={assigningCoordinator}
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                        theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAssignCoordinator(isRemoving ? null : assignCoordinatorModal.currentId!)}
                      disabled={assigningCoordinator}
                      className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                        isRemoving ? 'bg-zinc-600 hover:bg-zinc-700' : bgColorClass
                      }`}
                    >
                      {assigningCoordinator ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {isRemoving ? 'Removing...' : 'Assigning...'}
                        </>
                      ) : (
                        <>
                          <CoordIcon className="w-4 h-4" />
                          {isRemoving ? 'Remove' : 'Assign'}
                        </>
                      )}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODALS (Styled) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl w-full max-w-md border shadow-2xl max-h-[90vh] overflow-y-auto ${
            theme === 'dark' 
              ? 'bg-zinc-900/95 border-white/10' 
              : 'bg-white border-zinc-200'
          }`}>
            <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              {isParent ? 'Add Your Player' : 'Add Player to Team'}
            </h2>
            
            {/* COACH VIEW: Search for existing players */}
            {isStaff && (
              <div className="space-y-4">
                <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Search for players by username or name. Players are created by their parents.
                </p>
                
                {/* Team Age Group Info */}
                {teamData?.ageGroup && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <Users className="w-4 h-4" />
                    <span>Team Age Group: <strong>{teamData.ageGroup}</strong> - Only matching players shown first</span>
                  </div>
                )}
                
                {/* Search Input */}
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`} />
                  <input
                    type="text"
                    value={playerSearchQuery}
                    onChange={(e) => handleSearchPlayers(e.target.value)}
                    placeholder="Search by @username or name..."
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50' 
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500'
                    }`}
                  />
                </div>
                
                {/* Search Results */}
                {searchingPlayers && (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                
                {!searchingPlayers && playerSearchQuery.length >= 2 && playerSearchResults.length === 0 && (
                  <div className={`text-center py-8 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No players found</p>
                    <p className="text-xs mt-1">Players must be created by their parents first</p>
                  </div>
                )}
                
                {!searchingPlayers && playerSearchResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {playerSearchResults.map(player => {
                      const isOnAnotherTeam = player.teamId && player.teamId !== teamData?.id;
                      const isAlreadyOnThisTeam = roster.some(p => p.username === player.username);
                      const hasConflict = !!player.conflictWarning || !!player.isInDraftPool;
                      const isDisabled = !!(isOnAnotherTeam || isAlreadyOnThisTeam || player.isInDraftPool);
                      
                      return (
                        <button
                          type="button"
                          key={`${player.teamId || 'unassigned'}-${player.id}`}
                          onClick={() => !isDisabled && setSelectedPlayerToAdd(player)}
                          disabled={isDisabled}
                          className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                            isDisabled
                              ? theme === 'dark'
                                ? 'bg-black/20 border-white/5 opacity-60 cursor-not-allowed'
                                : 'bg-zinc-100 border-zinc-200 opacity-60 cursor-not-allowed'
                              : hasConflict && !isDisabled
                                ? theme === 'dark'
                                  ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
                                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                                : selectedPlayerToAdd?.id === player.id && selectedPlayerToAdd?.teamId === player.teamId
                                  ? theme === 'dark'
                                    ? 'bg-orange-500/20 border-orange-500/50'
                                    : 'bg-orange-50 border-orange-300'
                                  : theme === 'dark'
                                    ? 'bg-black/30 border-white/10 hover:bg-white/5'
                                    : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          {player.photoUrl ? (
                            <img src={player.photoUrl} alt={player.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/10' : 'bg-zinc-200'}`}>
                              <User className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                                {player.name}
                              </span>
                              {player.calculatedAgeGroup && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  player.calculatedAgeGroup === teamData?.ageGroup
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {player.calculatedAgeGroup}
                                </span>
                              )}
                            </div>
                            <div className={`text-xs truncate ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                              {player.username && <span className="text-orange-500">@{player.username}</span>}
                              {player.username && (player.teamName || player.conflictWarning) && ' • '}
                              {player.isInDraftPool ? (
                                <span className={theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}>⏳ In draft pool {player.draftPoolTeamName ? `(${player.draftPoolTeamName})` : ''}</span>
                              ) : isAlreadyOnThisTeam ? (
                                <span className={theme === 'dark' ? 'text-green-400' : 'text-green-600'}>Already on your team</span>
                              ) : isOnAnotherTeam ? (
                                <span className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>On another team ({player.teamName})</span>
                              ) : player.conflictWarning ? (
                                <span className={theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}>⚠️ {player.conflictWarning}</span>
                              ) : player.teamName ? (
                                <span>Currently on {player.teamName}</span>
                              ) : (
                                <span className={theme === 'dark' ? 'text-green-400' : 'text-green-600'}>Available</span>
                              )}
                            </div>
                          </div>
                          {!isDisabled && selectedPlayerToAdd?.id === player.id && selectedPlayerToAdd?.teamId === player.teamId && (
                            <Check className="w-5 h-5 text-orange-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* Selected Player Preview */}
                {selectedPlayerToAdd && (
                  <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'}`}>
                    <p className={`text-xs font-medium mb-2 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}>Selected Player</p>
                    <div className="flex items-center gap-3">
                      {selectedPlayerToAdd.photoUrl ? (
                        <img src={selectedPlayerToAdd.photoUrl} alt={selectedPlayerToAdd.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/10' : 'bg-zinc-200'}`}>
                          <User className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <div className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{selectedPlayerToAdd.name}</div>
                        {selectedPlayerToAdd.username && (
                          <div className="text-sm text-orange-500">@{selectedPlayerToAdd.username}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex justify-end gap-4 mt-6">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setPlayerSearchQuery('');
                      setPlayerSearchResults([]);
                      setSelectedPlayerToAdd(null);
                    }} 
                    className={`px-4 ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddPlayerToTeam}
                    disabled={!selectedPlayerToAdd || addingPlayer}
                    className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-orange-500/25"
                  >
                    {addingPlayer ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>
                    ) : (
                      <><UserPlus className="w-4 h-4" /> Add to Team</>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {/* PARENT VIEW: Create new player form */}
            {isParent && (
              <form onSubmit={handleAddPlayer} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Select Team *</label>
                  <select 
                    name="teamId" 
                    value={newPlayer.teamId} 
                    onChange={handleInputChange} 
                    className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-black/30 border-white/10 text-white focus:border-orange-500/50' 
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-orange-500'
                    }`}
                    required
                  >
                    <option value="">Choose a team...</option>
                    {allTeams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500 mt-1">Ask your coach for the Team ID if needed</p>
                </div>
              
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>First Name *</label>
                    <input name="firstName" value={newPlayer.firstName} onChange={handleInputChange} placeholder="John" className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50' 
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500'
                    }`} required />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Last Name *</label>
                    <input name="lastName" value={newPlayer.lastName} onChange={handleInputChange} placeholder="Smith" className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50' 
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500'
                    }`} required />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Nickname (optional)</label>
                  <input name="nickname" value={newPlayer.nickname} onChange={handleInputChange} placeholder='e.g., "Flash", "Tank"' className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                    theme === 'dark' 
                      ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50' 
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500'
                  }`} />
                  <p className="text-xs text-zinc-500 mt-1">Shows on player card if set</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Date of Birth *</label>
                    <input name="dob" type="date" value={newPlayer.dob} onChange={handleInputChange} className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-black/30 border-white/10 text-white focus:border-orange-500/50' 
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-orange-500'
                    }`} required />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Gender *</label>
                    <select name="gender" value={newPlayer.gender} onChange={handleInputChange} className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-black/30 border-white/10 text-white focus:border-orange-500/50' 
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-orange-500'
                    }`} required>
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className={`pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
                  <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-3 uppercase tracking-wider">Physical Info</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Height</label>
                      <input name="height" value={newPlayer.height} onChange={handleInputChange} placeholder="4 ft 6 in" className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                        theme === 'dark' 
                          ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50' 
                          : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500'
                      }`} />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Weight</label>
                      <input name="weight" value={newPlayer.weight} onChange={handleInputChange} placeholder="85 lbs" className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                        theme === 'dark' 
                          ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-orange-500/50' 
                          : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500'
                      }`} />
                    </div>
                  </div>
                </div>
                <div className={`pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-3 uppercase tracking-wider">Uniform Sizing</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Shirt Size</label>
                      <select name="shirtSize" value={newPlayer.shirtSize} onChange={handleInputChange} className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                        theme === 'dark' 
                          ? 'bg-black/30 border-white/10 text-white focus:border-orange-500/50' 
                          : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-orange-500'
                      }`}>
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
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Pants Size</label>
                      <select name="pantSize" value={newPlayer.pantSize} onChange={handleInputChange} className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                        theme === 'dark' 
                          ? 'bg-black/30 border-white/10 text-white focus:border-orange-500/50' 
                          : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-orange-500'
                      }`}>
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
                
                <div className="flex justify-end gap-4 mt-6">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className={`px-4 ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`} disabled={addingPlayer}>Cancel</button>
                  <button type="submit" disabled={addingPlayer} className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-orange-500/25">
                    {addingPlayer ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>
                    ) : (
                      'Add Player'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LINK PARENT MODAL */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl w-full max-w-md border shadow-2xl ${
            theme === 'dark' 
              ? 'bg-zinc-900/95 border-white/10' 
              : 'bg-white border-zinc-200'
          }`}>
            <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Link Parent</h2>
            <div className="space-y-4">
              <select value={selectedParentId} onChange={(e) => setSelectedParentId(e.target.value)} className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-orange-500/50 outline-none transition-all ${
                theme === 'dark' 
                  ? 'bg-black/30 border-white/10 text-white focus:border-orange-500/50' 
                  : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-orange-500'
              }`}>
                <option value="">Select a parent...</option>
                {parents.map(p => (
                  <option key={p.uid} value={p.uid}>{p.name} ({p.username})</option>
                ))}
              </select>
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" onClick={() => setIsLinkModalOpen(false)} className={`px-4 ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`} disabled={linkingParent}>Cancel</button>
                <button onClick={handleLinkParent} disabled={!selectedParentId || linkingParent} className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-orange-500/25">
                  {linkingParent ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Linking...</>
                  ) : (
                    'Link'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEDICAL INFO MODAL */}
      {viewMedical && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl w-full max-w-md border shadow-2xl ${
            theme === 'dark' 
              ? 'bg-zinc-900/95 border-white/10' 
              : 'bg-white border-zinc-200'
          }`}>
            <h2 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-6 h-6" /> Medical Alert
            </h2>
            <div className="space-y-3">
              <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                <h3 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>Player</h3>
                <p className={theme === 'dark' ? 'text-white' : 'text-zinc-900'}>#{viewMedical.number} {viewMedical.name}</p>
              </div>
              <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-zinc-50 border-zinc-200'}`}>
                <h3 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>Allergies</h3>
                <p className={theme === 'dark' ? 'text-white' : 'text-zinc-900'}>{viewMedical.medical?.allergies || 'None'}</p>
              </div>
              <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-zinc-50 border-zinc-200'}`}>
                <h3 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>Medical Conditions</h3>
                <p className={theme === 'dark' ? 'text-white' : 'text-zinc-900'}>{viewMedical.medical?.conditions || 'None'}</p>
              </div>
              <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-zinc-50 border-zinc-200'}`}>
                <h3 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>Medications</h3>
                <p className={theme === 'dark' ? 'text-white' : 'text-zinc-900'}>{viewMedical.medical?.medications || 'None'}</p>
              </div>
              <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-zinc-50 border-zinc-200'}`}>
                <h3 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>Blood Type</h3>
                <p className={theme === 'dark' ? 'text-white' : 'text-zinc-900'}>{viewMedical.medical?.bloodType || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setViewMedical(null)} className={`px-6 py-2 rounded-lg font-bold transition-colors ${
                theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
              }`}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT INFO MODAL */}
      {viewContact && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-xl w-full max-w-md border shadow-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-white/10' : 'bg-white border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
                <Phone className="w-6 h-6" /> Parent Contact
              </h2>
              {!isEditingContact && isStaff && (
                <button 
                  onClick={() => setIsEditingContact(true)} 
                  className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              {/* Name & Email - Always Read-only */}
              <div className="bg-cyan-50 dark:bg-cyan-900/10 p-3 rounded border border-cyan-200 dark:border-cyan-900/30">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Name</h3>
                <p className="text-zinc-900 dark:text-white">{viewContact.name}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Email</h3>
                <p className="text-zinc-900 dark:text-white">{viewContact.email}</p>
              </div>

              {/* Phone - Editable */}
              <div className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Phone</h3>
                {isEditingContact ? (
                  <input 
                    type="tel" 
                    value={editContactForm.phone} 
                    onChange={(e) => setEditContactForm({...editContactForm, phone: e.target.value})}
                    placeholder="(555) 123-4567"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white text-sm"
                  />
                ) : viewContact.phone ? (
                  <a href={`tel:${viewContact.phone.replace(/[^0-9+]/g, '')}`} className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1">
                    {viewContact.phone}
                  </a>
                ) : (
                  <p className="text-zinc-500">Not provided</p>
                )}
              </div>

              {/* Secondary Phone - Editable */}
              <div className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Secondary Phone</h3>
                {isEditingContact ? (
                  <input 
                    type="tel" 
                    value={editContactForm.secondaryPhone} 
                    onChange={(e) => setEditContactForm({...editContactForm, secondaryPhone: e.target.value})}
                    placeholder="(555) 987-6543"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white text-sm"
                  />
                ) : viewContact.secondaryPhone ? (
                  <a href={`tel:${viewContact.secondaryPhone.replace(/[^0-9+]/g, '')}`} className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1">
                    {viewContact.secondaryPhone}
                  </a>
                ) : (
                  <p className="text-zinc-500">Not provided</p>
                )}
              </div>

              {/* Address - Editable */}
              <div className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Address</h3>
                {isEditingContact ? (
                  <textarea 
                    value={editContactForm.address} 
                    onChange={(e) => setEditContactForm({...editContactForm, address: e.target.value})}
                    placeholder="123 Main St, City, State 12345"
                    rows={2}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white text-sm"
                  />
                ) : (
                  <p className="text-zinc-900 dark:text-white">{viewContact.address || 'Not provided'}</p>
                )}
              </div>

              {/* Emergency Contact - Editable */}
              <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded border border-red-200 dark:border-red-900/30">
                <h3 className="text-base font-bold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
                  <Phone className="w-5 h-5" /> Emergency Contact
                </h3>
                {isEditingContact ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Name</label>
                      <input 
                        type="text" 
                        value={editContactForm.emergName} 
                        onChange={(e) => setEditContactForm({...editContactForm, emergName: e.target.value})}
                        placeholder="Emergency contact name"
                        className="w-full bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 rounded p-3 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Relationship</label>
                      <input 
                        type="text" 
                        value={editContactForm.emergRelation} 
                        onChange={(e) => setEditContactForm({...editContactForm, emergRelation: e.target.value})}
                        placeholder="e.g., Spouse, Sibling, Parent"
                        className="w-full bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 rounded p-3 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Phone</label>
                      <input 
                        type="tel" 
                        value={editContactForm.emergPhone} 
                        onChange={(e) => setEditContactForm({...editContactForm, emergPhone: e.target.value})}
                        placeholder="(555) 123-4567"
                        className="w-full bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 rounded p-3 text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>
                ) : viewContact.emergencyContact ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-400">Name & Relationship</p>
                      <p className="text-zinc-900 dark:text-white">
                        {viewContact.emergencyContact.name} ({viewContact.emergencyContact.relation})
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-400">Phone</p>
                      {viewContact.emergencyContact.phone ? (
                        <a href={`tel:${viewContact.emergencyContact.phone.replace(/[^0-9+]/g, '')}`} className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1">
                          {viewContact.emergencyContact.phone}
                        </a>
                      ) : (
                        <p className="text-zinc-500">Not provided</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-zinc-500 italic">No emergency contact set</p>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              {isEditingContact ? (
                <>
                  <button 
                    onClick={() => {
                      setIsEditingContact(false);
                      // Reset form to original values
                      setEditContactForm({
                        phone: viewContact.phone || '',
                        secondaryPhone: viewContact.secondaryPhone || '',
                        address: viewContact.address || '',
                        emergName: viewContact.emergencyContact?.name || '',
                        emergPhone: viewContact.emergencyContact?.phone || '',
                        emergRelation: viewContact.emergencyContact?.relation || ''
                      });
                    }}
                    className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveContact}
                    disabled={savingContact}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingContact ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                    ) : (
                      <><Plus className="w-4 h-4 rotate-45" /> Save</>
                    )}
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setViewContact(null)} 
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT PLAYER MODAL (For Parents and Coaches) */}
      {editingPlayer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-xl w-full max-w-md border shadow-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-white/10' : 'bg-white border-zinc-200'}`}>
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
              <Edit2 className="w-6 h-6 text-purple-500" /> Edit Player Info
            </h2>
            <form onSubmit={handleUpdatePlayer} className="space-y-4">
              
              {/* Player Photo Upload */}
              <div className="flex flex-col items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-3 uppercase tracking-wider">Player Photo</p>
                <div className="relative">
                  {editingPlayer.photoUrl ? (
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-500 shadow-lg">
                      <img src={editingPlayer.photoUrl} alt={editingPlayer.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 border-4 border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                      <User className="w-10 h-10 text-zinc-400 dark:text-zinc-600" />
                    </div>
                  )}
                  
                  {/* Upload Button Overlay */}
                  <label className="absolute bottom-0 right-0 bg-purple-600 hover:bg-purple-500 text-white rounded-full p-2 cursor-pointer shadow-lg transition-colors">
                    <Camera className="w-4 h-4" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload} 
                      className="hidden" 
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>
                
                {uploadingPhoto && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-purple-600">
                    <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </div>
                )}
                
                {editingPlayer.photoUrl && !uploadingPhoto && (
                  <button 
                    type="button"
                    onClick={handleRemovePhoto}
                    className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Remove Photo
                  </button>
                )}
                
                <p className="text-[10px] text-zinc-500 mt-2">Tap camera icon to upload (max 2MB)</p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">Basic Information</label>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">First Name *</label>
                  <input 
                    type="text"
                    value={editingPlayer.firstName || editingPlayer.name?.split(' ')[0] || ''}
                    onChange={(e) => setEditingPlayer({
                      ...editingPlayer, 
                      firstName: e.target.value,
                      name: `${e.target.value} ${editingPlayer.lastName || editingPlayer.name?.split(' ').slice(1).join(' ') || ''}`.trim()
                    })}
                    className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Last Name *</label>
                  <input 
                    type="text"
                    value={editingPlayer.lastName || editingPlayer.name?.split(' ').slice(1).join(' ') || ''}
                    onChange={(e) => setEditingPlayer({
                      ...editingPlayer, 
                      lastName: e.target.value,
                      name: `${editingPlayer.firstName || editingPlayer.name?.split(' ')[0] || ''} ${e.target.value}`.trim()
                    })}
                    className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Nickname (optional)</label>
                <input 
                  type="text"
                  value={editingPlayer.nickname || ''}
                  onChange={(e) => setEditingPlayer({...editingPlayer, nickname: e.target.value})}
                  placeholder="e.g., &quot;Flash&quot;, &quot;Tank&quot;"
                  className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Shows on player card if set</p>
              </div>

              {/* PARENT-ONLY FIELD: Date of Birth */}
              {isParent && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date of Birth</label>
                    <input 
                      type="date"
                      value={editingPlayer.dob}
                      onChange={(e) => setEditingPlayer({...editingPlayer, dob: e.target.value})}
                      className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Gender</label>
                    <select 
                      value={editingPlayer.gender || ''}
                      onChange={(e) => setEditingPlayer({...editingPlayer, gender: e.target.value as 'male' | 'female' | 'other'})}
                      className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                    >
                      <option value="">Select gender...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </>
              )}

              {/* COACH-ONLY FIELDS: Jersey Number and Position */}
              {isStaff && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-3 uppercase tracking-wider">Team Assignment</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Jersey #</label>
                      <input 
                        type="number"
                        value={editingPlayer.number || ''}
                        onChange={(e) => setEditingPlayer({...editingPlayer, number: parseInt(e.target.value) || 0})}
                        placeholder="00"
                        className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Position</label>
                      <select 
                        value={editingPlayer.position || ''}
                        onChange={(e) => setEditingPlayer({...editingPlayer, position: e.target.value})}
                        className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                      >
                        <option value="">Select position...</option>
                        {sportPositions.map(pos => (
                          <option key={pos.value} value={pos.value}>
                            {pos.label} {pos.category ? `(${pos.category})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* COACH-ONLY: Starter and Captain Designations */}
              {isStaff && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Crown className="w-3 h-3" /> Player Designations
                  </p>
                  <div className="space-y-3">
                    {/* Starter Toggle */}
                    <label className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-black rounded-lg border border-zinc-300 dark:border-zinc-800 cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center">
                          <Star className="w-4 h-4 text-white fill-white" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white text-sm">Starter</p>
                          <p className="text-xs text-zinc-500">Shows golden glow on roster card</p>
                        </div>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox"
                          checked={editingPlayer.isStarter || false}
                          onChange={(e) => setEditingPlayer({...editingPlayer, isStarter: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:bg-yellow-500 peer-checked:dark:bg-yellow-500 transition-colors"></div>
                        <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                      </div>
                    </label>
                    
                    {/* Captain Toggle */}
                    <label className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-black rounded-lg border border-zinc-300 dark:border-zinc-800 cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center">
                          <Crown className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white text-sm">Captain</p>
                          <p className="text-xs text-zinc-500">Shows crown badge on roster card</p>
                        </div>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox"
                          checked={editingPlayer.isCaptain || false}
                          onChange={(e) => setEditingPlayer({...editingPlayer, isCaptain: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:bg-amber-500 peer-checked:dark:bg-amber-500 transition-colors"></div>
                        <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Height & Weight - Editable by both Parents and Coaches */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-3 uppercase tracking-wider">Physical Info</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Height</label>
                    <input 
                      type="text"
                      value={editingPlayer.height || ''}
                      onChange={(e) => setEditingPlayer({...editingPlayer, height: e.target.value})}
                      placeholder="4 ft 6 in"
                      className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Weight</label>
                    <input 
                      type="text"
                      value={editingPlayer.weight || ''}
                      onChange={(e) => setEditingPlayer({...editingPlayer, weight: e.target.value})}
                      placeholder="85 lbs"
                      className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-3 uppercase tracking-wider">Uniform Sizing</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Shirt Size</label>
                    <select 
                      value={editingPlayer.shirtSize || ''}
                      onChange={(e) => setEditingPlayer({...editingPlayer, shirtSize: e.target.value})}
                      className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
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
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Pants Size</label>
                    <select 
                      value={editingPlayer.pantSize || ''}
                      onChange={(e) => setEditingPlayer({...editingPlayer, pantSize: e.target.value})}
                      className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
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

              <div className="flex justify-end gap-4 mt-6">
                <button 
                  type="button" 
                  onClick={() => setEditingPlayer(null)}
                  className="px-4 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  disabled={savingPlayer}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={savingPlayer}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  {savingPlayer ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PLAYER CONFIRMATION MODAL */}
      {deletePlayerConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`rounded-xl border shadow-2xl w-full max-w-md p-6 ${theme === 'dark' ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-white/10' : 'bg-white border-zinc-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Remove Player</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <button 
                onClick={() => setDeletePlayerConfirm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`rounded-lg p-4 mb-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  #{deletePlayerConfirm.number}
                </div>
                <p className="font-bold text-slate-900 dark:text-white">{deletePlayerConfirm.name}</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              Are you sure you want to remove this player from the roster? Their stats and linked parent connection will also be removed.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeletePlayerConfirm(null)}
                disabled={deletingPlayer}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlayer}
                disabled={deletingPlayer}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deletingPlayer ? (
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

      {/* PLAYER STATS HISTORY MODAL */}
      {viewStatsPlayer && (
        <PlayerStatsModal
          player={viewStatsPlayer}
          teamName={teamData?.name}
          onClose={() => setViewStatsPlayer(null)}
        />
      )}

      {/* PLAYER PHOTO POPUP MODAL */}
      {viewPhotoPlayer && viewPhotoPlayer.photoUrl && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setViewPhotoPlayer(null)}
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewPhotoPlayer(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            
            <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="aspect-square">
                <img 
                  src={viewPhotoPlayer.photoUrl} 
                  alt={viewPhotoPlayer.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 text-center">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center justify-center gap-2">
                  {viewPhotoPlayer.name}
                  {viewPhotoPlayer.isCaptain && <Crown className="w-5 h-5 text-amber-500" />}
                </h3>
                <p className="text-orange-500 font-bold text-sm uppercase tracking-wide mt-1">
                  #{viewPhotoPlayer.number} | {viewPhotoPlayer.position}
                </p>
                {viewPhotoPlayer.isStarter && (
                  <div className="mt-2 inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-white" /> Starter
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </NoAthleteBlock>
  );
};

export default Roster;