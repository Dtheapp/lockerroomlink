import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, updateDoc, addDoc, serverTimestamp, writeBatch, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ChevronLeft, Search, Inbox, Check, X, Clock, Filter, AlertCircle, Loader2, Building2, Calendar, Shield, Send, Users, Plus, Minus, LogOut, Tag, CheckCircle, MapPin, Globe, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toastSuccess, toastError, toastInfo } from '../../services/toast';

interface TeamInfo {
  id: string;
  name: string;
  ageGroup?: string;
  sport?: string;
  inLeague: boolean;
  canJoinLeague: boolean; // True if team has matching age group in league
  noAgeGroup: boolean; // True if team has no age group set
}

interface LeagueInvitation {
  id: string;
  leagueId: string;
  leagueName: string;
  programId: string;
  programName: string;
  sportSpecificName?: string;
  status: 'pending' | 'approved' | 'rejected';
  type: string;
  createdBy: string;
  createdAt: any;
  message?: string;
  isSwitchLeague?: boolean;
  previousLeagueName?: string;
}

interface LeagueInfo {
  id: string;
  name: string;
  sport: string;
  logoUrl?: string;
  joinedAt?: any;
  ageGroups?: string[]; // Available age groups in the league
}

// Search result league interface
interface SearchableLeague {
  id: string;
  name: string;
  sport: string;
  city?: string;
  state?: string;
  region?: string;
  logoUrl?: string;
  ageGroups?: string[];
  teamCount?: number;
  programCount?: number;
  ownerId: string;
  ownerName?: string;
  description?: string;
  hasPendingRequest?: boolean; // If we already requested to join
}

export default function CommissionerLeagues() {
  const { userData, programData } = useAuth();
  const { theme } = useTheme();
  const [invitations, setInvitations] = useState<LeagueInvitation[]>([]);
  const [currentLeague, setCurrentLeague] = useState<LeagueInfo | null>(null);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [togglingTeam, setTogglingTeam] = useState<string | null>(null);
  const [leavingLeague, setLeavingLeague] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  
  // League Search states
  const [leagueSearchQuery, setLeagueSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchableLeague[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [requestingLeagueId, setRequestingLeagueId] = useState<string | null>(null);
  const [pendingRequestLeagueIds, setPendingRequestLeagueIds] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  
  // Multi-sport: Get selected sport from localStorage with listener
  const [selectedSport, setSelectedSport] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('commissioner_selected_sport')?.toLowerCase() || 'football';
    }
    return 'football';
  });

  // Listen for sport changes from sidebar selector
  useEffect(() => {
    const handleSportChange = (e: CustomEvent) => {
      setSelectedSport(e.detail?.toLowerCase() || 'football');
    };
    window.addEventListener('commissioner-sport-changed', handleSportChange as EventListener);
    return () => {
      window.removeEventListener('commissioner-sport-changed', handleSportChange as EventListener);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [programData, selectedSport]);


  const loadData = async () => {
    // Get programId from either programData or userData
    const programId = programData?.id || (userData as any)?.programId;
    
    if (!programId) {
      setLoading(false);
      return;
    }

    try {
      // Multi-sport: Get league ID for selected sport
      // Check leagueIds[sport] first, then fall back to leagueId if sport matches
      let leagueId: string | null = null;
      const sportLeagueId = (programData as any)?.leagueIds?.[selectedSport];
      
      if (sportLeagueId) {
        leagueId = sportLeagueId;
      } else if (programData?.leagueId) {
        // Check if the legacy leagueId matches the selected sport
        const legacyLeagueDoc = await getDocs(query(
          collection(db, 'leagues'),
          where('__name__', '==', programData.leagueId)
        ));
        if (!legacyLeagueDoc.empty) {
          const legacySport = legacyLeagueDoc.docs[0].data().sport?.toLowerCase() || 'football';
          if (legacySport === selectedSport) {
            leagueId = programData.leagueId;
          }
        }
      }
      
      // Reset league if no match for selected sport
      if (!leagueId) {
        setCurrentLeague(null);
        setTeams([]);
      }
      
      if (leagueId) {
        const leagueDoc = await getDocs(query(
          collection(db, 'leagues'),
          where('__name__', '==', leagueId)
        ));
        if (!leagueDoc.empty) {
          const data = leagueDoc.docs[0].data();
          setCurrentLeague({
            id: leagueDoc.docs[0].id,
            name: data.name,
            sport: data.sport,
            logoUrl: data.logoUrl,
            joinedAt: (programData as any).leagueJoinedAt,
            ageGroups: data.ageGroups || []
          });
        }
      }

      // Load league invitations for this program
      const q = query(
        collection(db, 'leagueRequests'),
        where('programId', '==', programId),
        where('type', '==', 'league_invitation'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      const invitationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeagueInvitation[];
      
      // Sort by createdAt descending (client-side)
      invitationsList.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      
      setInvitations(invitationsList);
      
      // Load teams from the program (for adding to league) - filter by selected sport
      // Note: leagueId already declared above
      if (leagueId) {
        // First get league age groups for validation
        const leagueDocRef = await getDocs(query(
          collection(db, 'leagues'),
          where('__name__', '==', leagueId)
        ));
        const leagueAgeGroups: string[] = leagueDocRef.empty ? [] : (leagueDocRef.docs[0].data().ageGroups || []);
        
        const teamsQuery = query(
          collection(db, 'teams'),
          where('programId', '==', programId)
        );
        const teamsSnap = await getDocs(teamsQuery);
        const teamsList = teamsSnap.docs
          .filter(d => d.data().sport?.toLowerCase() === selectedSport) // Filter by selected sport
          .map(d => {
          const data = d.data();
          const teamAgeGroup = data.ageGroup || '';
          const noAgeGroup = !teamAgeGroup;
          // Exact match required - "8U" must match "8U", not "7U/8U"
          const canJoinLeague = !noAgeGroup && leagueAgeGroups.includes(teamAgeGroup);
          
          return {
            id: d.id,
            name: data.name || 'Unnamed Team',
            ageGroup: data.ageGroup,
            sport: data.sport,
            inLeague: data.leagueId === leagueId,
            canJoinLeague,
            noAgeGroup
          } as TeamInfo;
        });
        setTeams(teamsList);
      }
      
      // Load pending join requests we've sent (to show status in search results)
      const pendingRequestsQuery = query(
        collection(db, 'leagueRequests'),
        where('programId', '==', programId),
        where('type', '==', 'join_request'),
        where('status', '==', 'pending')
      );
      const pendingSnap = await getDocs(pendingRequestsQuery);
      const pendingIds = pendingSnap.docs.map(d => d.data().leagueId);
      setPendingRequestLeagueIds(pendingIds);
      
    } catch (error) {
      console.error('Error loading league data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Search for leagues
  const searchLeagues = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    setSearchLoading(true);
    setShowSearchResults(true);
    
    try {
      // Get all leagues (Firestore doesn't support text search or case-insensitive queries)
      // We'll filter client-side for sport and search term
      // Note: Sports may be stored as 'basketball' or 'Basketball' depending on when created
      const leaguesQuery = query(
        collection(db, 'leagues'),
        limit(100)
      );
      
      const snapshot = await getDocs(leaguesQuery);
      const searchLower = searchQuery.toLowerCase();
      const sportLower = selectedSport.toLowerCase();
      
      const results: SearchableLeague[] = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            sport: data.sport || '',
            city: data.city,
            state: data.state,
            region: data.region,
            logoUrl: data.logoUrl,
            ageGroups: data.ageGroups || [],
            teamCount: data.teamIds?.length || 0,
            programCount: data.programIds?.length || 0,
            ownerId: data.ownerId,
            ownerName: data.ownerName,
            description: data.description,
            hasPendingRequest: pendingRequestLeagueIds.includes(doc.id)
          };
        })
        .filter(league => {
          // Don't show current league
          if (currentLeague && league.id === currentLeague.id) return false;
          
          // Filter by sport (case-insensitive)
          if (league.sport.toLowerCase() !== sportLower) return false;
          
          // Search in name, city, state, region, or league code (id)
          return (
            league.name.toLowerCase().includes(searchLower) ||
            league.id.toLowerCase().includes(searchLower) ||
            league.city?.toLowerCase().includes(searchLower) ||
            league.state?.toLowerCase().includes(searchLower) ||
            league.region?.toLowerCase().includes(searchLower)
          );
        })
        .slice(0, 10); // Limit to 10 results
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching leagues:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (leagueSearchQuery.trim()) {
        searchLeagues(leagueSearchQuery);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [leagueSearchQuery, selectedSport, pendingRequestLeagueIds]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Request to join a league
  const requestToJoinLeague = async (league: SearchableLeague) => {
    if (!programData?.id) {
      toastError('No program found');
      return;
    }
    
    // Check if already in a league for this sport
    if (currentLeague) {
      toastError(`Already in ${currentLeague.name}. Leave current league first.`);
      return;
    }
    
    setRequestingLeagueId(league.id);
    
    try {
      // Create join request
      await addDoc(collection(db, 'leagueRequests'), {
        type: 'join_request',
        leagueId: league.id,
        leagueName: league.name,
        programId: programData.id,
        programName: programData.name,
        sport: selectedSport,
        status: 'pending',
        createdBy: userData?.uid,
        createdByName: userData?.displayName || userData?.firstName || 'Unknown',
        createdAt: serverTimestamp(),
        message: `${programData.name} would like to join ${league.name}`
      });
      
      // Notify league owner
      await addDoc(collection(db, 'notifications'), {
        userId: league.ownerId,
        type: 'join_request',
        title: 'League Join Request',
        message: `${programData.name} has requested to join ${league.name}`,
        read: false,
        createdAt: serverTimestamp(),
        data: {
          programId: programData.id,
          programName: programData.name,
          leagueId: league.id,
          leagueName: league.name
        }
      });
      
      toastSuccess(`Request sent to ${league.name}!`);
      
      // Update local state
      setPendingRequestLeagueIds(prev => [...prev, league.id]);
      setSearchResults(prev => prev.map(l => 
        l.id === league.id ? { ...l, hasPendingRequest: true } : l
      ));
      
      // Clear search
      setLeagueSearchQuery('');
      setShowSearchResults(false);
      
    } catch (error) {
      console.error('Error requesting to join league:', error);
      toastError('Failed to send request');
    } finally {
      setRequestingLeagueId(null);
    }
  };
  
  // Toggle team in/out of league
  const handleToggleTeamLeague = async (team: TeamInfo) => {
    if (!currentLeague) return;
    
    // Safety check: Don't allow adding if no matching age group
    if (!team.inLeague && !team.canJoinLeague) {
      if (team.noAgeGroup) {
        toastError('Team must have an age group set before joining a league');
      } else {
        toastError(`Team age group "${team.ageGroup}" does not match any league age groups`);
      }
      return;
    }
    
    setTogglingTeam(team.id);
    try {
      if (team.inLeague) {
        // Remove from league
        await updateDoc(doc(db, 'teams', team.id), {
          leagueId: null,
          leagueName: null
        });
        
        // Notify relevant parties about team leaving
        await notifyTeamLeagueChange(team, 'removed');
        
        toastSuccess(`${team.name} removed from ${currentLeague.name}`);
      } else {
        // Add to league
        await updateDoc(doc(db, 'teams', team.id), {
          leagueId: currentLeague.id,
          leagueName: currentLeague.name
        });
        
        // Notify relevant parties about team joining
        await notifyTeamLeagueChange(team, 'added');
        
        toastSuccess(`${team.name} added to ${currentLeague.name}`);
      }
      
      // Update local state
      setTeams(teams.map(t => 
        t.id === team.id ? { ...t, inLeague: !t.inLeague } : t
      ));
    } catch (error) {
      console.error('Error toggling team league:', error);
      toastError('Failed to update team');
    } finally {
      setTogglingTeam(null);
    }
  };

  // Send notifications when a team is added/removed from league
  const notifyTeamLeagueChange = async (team: TeamInfo, action: 'added' | 'removed') => {
    if (!currentLeague || !programData) return;
    
    try {
      const batch = writeBatch(db);
      const notificationBase = {
        type: action === 'added' ? 'team_joined_league' : 'team_left_league',
        teamId: team.id,
        teamName: team.name,
        leagueId: currentLeague.id,
        leagueName: currentLeague.name,
        programId: programData.id,
        programName: programData.name,
        createdAt: serverTimestamp(),
        read: false
      };

      // Get team data for coaches
      const teamDoc = await getDocs(query(collection(db, 'teams'), where('__name__', '==', team.id)));
      if (!teamDoc.empty) {
        const teamData = teamDoc.docs[0].data();
        const coachIds = teamData.coachIds || (teamData.coachId ? [teamData.coachId] : []);
        
        // Notify coaches
        for (const coachId of coachIds) {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            ...notificationBase,
            userId: coachId,
            title: action === 'added' 
              ? `Team Added to League`
              : `Team Removed from League`,
            message: action === 'added'
              ? `${team.name} has been added to ${currentLeague.name}`
              : `${team.name} has been removed from ${currentLeague.name}`
          });
        }

        // Get players to notify parents
        const playersSnap = await getDocs(query(
          collection(db, 'teams', team.id, 'players')
        ));
        
        const parentIds = new Set<string>();
        playersSnap.docs.forEach(playerDoc => {
          const playerData = playerDoc.data();
          if (playerData.parentId) parentIds.add(playerData.parentId);
          if (playerData.guardianIds) {
            playerData.guardianIds.forEach((id: string) => parentIds.add(id));
          }
        });

        // Notify parents
        for (const parentId of parentIds) {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            ...notificationBase,
            userId: parentId,
            title: action === 'added' 
              ? `Team Joined League`
              : `Team Left League`,
            message: action === 'added'
              ? `${team.name} is now participating in ${currentLeague.name}`
              : `${team.name} is no longer in ${currentLeague.name}`
          });
        }
      }

      // Notify program commissioner
      if (programData.commissionerId && programData.commissionerId !== userData?.uid) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          ...notificationBase,
          userId: programData.commissionerId,
          title: action === 'added' 
            ? `Team Added to League`
            : `Team Removed from League`,
          message: action === 'added'
            ? `${team.name} has been added to ${currentLeague.name}`
            : `${team.name} has been removed from ${currentLeague.name}`
        });
      }

      // Notify league owner
      const leagueDoc = await getDocs(query(collection(db, 'leagues'), where('__name__', '==', currentLeague.id)));
      if (!leagueDoc.empty) {
        const leagueData = leagueDoc.docs[0].data();
        if (leagueData.ownerId) {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            ...notificationBase,
            userId: leagueData.ownerId,
            title: action === 'added' 
              ? `Team Joined Your League`
              : `Team Left Your League`,
            message: action === 'added'
              ? `${team.name} from ${programData.name} has joined ${currentLeague.name}`
              : `${team.name} from ${programData.name} has left ${currentLeague.name}`
          });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Error sending notifications:', error);
      // Don't fail the main operation if notifications fail
    }
  };

  // Leave the league entirely (remove all teams and program membership)
  const handleLeaveLeague = async () => {
    if (!currentLeague || !programData) return;
    
    setLeavingLeague(true);
    try {
      const batch = writeBatch(db);
      
      // Remove all teams from the league
      const teamsInLeague = teams.filter(t => t.inLeague);
      for (const team of teamsInLeague) {
        batch.update(doc(db, 'teams', team.id), {
          leagueId: null,
          leagueName: null
        });
      }
      
      // Update program to leave league
      batch.update(doc(db, 'programs', programData.id!), {
        leagueId: null,
        leagueName: null,
        leagueJoinedAt: null
      });
      
      await batch.commit();
      
      // Send notifications about leaving
      await notifyProgramLeaveLeague(teamsInLeague);
      
      toastSuccess(`${programData.name} has left ${currentLeague.name}`);
      setCurrentLeague(null);
      setTeams(teams.map(t => ({ ...t, inLeague: false })));
      setShowLeaveConfirm(false);
    } catch (error) {
      console.error('Error leaving league:', error);
      toastError('Failed to leave league');
    } finally {
      setLeavingLeague(false);
    }
  };

  // Notify all relevant parties when program leaves league
  const notifyProgramLeaveLeague = async (teamsInLeague: TeamInfo[]) => {
    if (!currentLeague || !programData) return;
    
    try {
      const batch = writeBatch(db);
      const notificationBase = {
        type: 'program_left_league',
        leagueId: currentLeague.id,
        leagueName: currentLeague.name,
        programId: programData.id,
        programName: programData.name,
        createdAt: serverTimestamp(),
        read: false
      };

      // Collect all coach IDs and parent IDs from all teams
      const coachIds = new Set<string>();
      const parentIds = new Set<string>();
      
      for (const team of teamsInLeague) {
        const teamDoc = await getDocs(query(collection(db, 'teams'), where('__name__', '==', team.id)));
        if (!teamDoc.empty) {
          const teamData = teamDoc.docs[0].data();
          if (teamData.coachIds) teamData.coachIds.forEach((id: string) => coachIds.add(id));
          if (teamData.coachId) coachIds.add(teamData.coachId);
          
          // Get players for parents
          const playersSnap = await getDocs(collection(db, 'teams', team.id, 'players'));
          playersSnap.docs.forEach(playerDoc => {
            const playerData = playerDoc.data();
            if (playerData.parentId) parentIds.add(playerData.parentId);
            if (playerData.guardianIds) {
              playerData.guardianIds.forEach((id: string) => parentIds.add(id));
            }
          });
        }
      }

      // Notify coaches
      for (const coachId of coachIds) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          ...notificationBase,
          userId: coachId,
          title: 'Program Left League',
          message: `${programData.name} has left ${currentLeague.name}. Your team is no longer in this league.`
        });
      }

      // Notify parents
      for (const parentId of parentIds) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          ...notificationBase,
          userId: parentId,
          title: 'Team League Update',
          message: `${programData.name} has left ${currentLeague.name}. Your child's team is no longer participating in this league.`
        });
      }

      // Notify league owner
      const leagueDoc = await getDocs(query(collection(db, 'leagues'), where('__name__', '==', currentLeague.id)));
      if (!leagueDoc.empty) {
        const leagueData = leagueDoc.docs[0].data();
        if (leagueData.ownerId) {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            ...notificationBase,
            userId: leagueData.ownerId,
            title: 'Program Left Your League',
            message: `${programData.name} has left ${currentLeague.name} with ${teamsInLeague.length} team(s).`
          });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Error sending leave notifications:', error);
    }
  };

  const handleAccept = async (invitation: LeagueInvitation) => {
    setProcessingId(invitation.id);
    try {
      // Update the invitation status
      await updateDoc(doc(db, 'leagueRequests', invitation.id), {
        status: 'approved',
        respondedAt: serverTimestamp(),
        respondedBy: userData?.uid
      });

      // Update program to be part of the league
      if (programData?.id) {
        await updateDoc(doc(db, 'programs', programData.id), {
          leagueId: invitation.leagueId,
          leagueName: invitation.leagueName,
          leagueJoinedAt: serverTimestamp()
        });
      }

      // Notify the league owner
      await addDoc(collection(db, 'notifications'), {
        userId: invitation.leagueId, // This should be the league owner's userId
        type: 'invitation_accepted',
        title: 'Invitation Accepted',
        message: `${invitation.sportSpecificName || invitation.programName} has accepted your league invitation.`,
        read: false,
        createdAt: serverTimestamp(),
        data: {
          leagueId: invitation.leagueId,
          programId: invitation.programId
        }
      });

      setInvitations(invitations.map(inv => 
        inv.id === invitation.id ? { ...inv, status: 'approved' } : inv
      ));
      
      toastSuccess('Successfully joined the league!');
      
      // Reload to update current league
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toastError('Failed to accept invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitation: LeagueInvitation) => {
    setProcessingId(invitation.id);
    try {
      await updateDoc(doc(db, 'leagueRequests', invitation.id), {
        status: 'rejected',
        respondedAt: serverTimestamp(),
        respondedBy: userData?.uid
      });

      setInvitations(invitations.map(inv => 
        inv.id === invitation.id ? { ...inv, status: 'rejected' } : inv
      ));
      
      toastSuccess('Invitation declined');
    } catch (error) {
      console.error('Error declining invitation:', error);
      toastError('Failed to decline invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredInvitations = invitations.filter(inv => {
    const matchesSearch = 
      inv.leagueName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.sportSpecificName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            theme === 'dark' 
              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' 
              : 'bg-yellow-100 text-yellow-700 border-yellow-300'
          }`}>
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            theme === 'dark'
              ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : 'bg-green-100 text-green-700 border-green-300'
          }`}>
            <Check className="w-3 h-3" />
            Accepted
          </span>
        );
      case 'rejected':
        return (
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            theme === 'dark'
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-red-100 text-red-700 border-red-300'
          }`}>
            <X className="w-3 h-3" />
            Declined
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const pendingCount = invitations.filter(inv => inv.status === 'pending').length;

  if (!programData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No Program Found</h2>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>You are not associated with any program.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-zinc-900 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Header */}
      <div className={`border-b ${
        theme === 'dark' 
          ? 'bg-black/40 border-white/10' 
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/commissioner" className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}>
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className={`text-xl font-bold flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Shield className={theme === 'dark' ? 'w-5 h-5 text-purple-400' : 'w-5 h-5 text-purple-600'} />
                Manage Leagues
                {pendingCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">
                    {pendingCount}
                  </span>
                )}
              </h1>
              <p className={theme === 'dark' ? 'text-sm text-slate-400' : 'text-sm text-slate-600'}>
                League invitations and memberships for {programData.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current League */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className={`rounded-2xl border mb-6 overflow-hidden ${
          theme === 'dark'
            ? 'bg-white/5 border-white/10'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          {/* Header Bar with Leave Button */}
          <div className={`px-5 py-3 flex items-center justify-between border-b ${
            theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'
          }`}>
            <h3 className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Current League
            </h3>
            {currentLeague && (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  theme === 'dark'
                    ? 'text-red-400 hover:bg-red-500/20'
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                Leave League
              </button>
            )}
          </div>
          
          <div className="p-5">
          {currentLeague ? (
            <>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  {currentLeague.logoUrl ? (
                    <img src={currentLeague.logoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <Building2 className="w-7 h-7 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {currentLeague.name}
                    </h3>
                    {/* Status Dot */}
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                  </div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {currentLeague.sport} • Joined {currentLeague.joinedAt ? formatDate(currentLeague.joinedAt) : 'Recently'}
                  </p>
                </div>
              </div>
              
              {/* Age Group Matching Summary */}
              {currentLeague.ageGroups && currentLeague.ageGroups.length > 0 && (
                <div className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Age Group Coverage
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentLeague.ageGroups.map(ag => {
                      // Count how many teams match this age group
                      const matchingTeams = teams.filter(t => t.ageGroup === ag);
                      const hasMatch = matchingTeams.length > 0;
                      const teamsInLeague = matchingTeams.filter(t => t.inLeague).length;
                      
                      return (
                        <div
                          key={ag}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            hasMatch
                              ? theme === 'dark'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-green-100 text-green-700 border border-green-200'
                              : theme === 'dark'
                                ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          <span>{ag}</span>
                          {hasMatch ? (
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
                              theme === 'dark' ? 'bg-green-500/30' : 'bg-green-200'
                            }`}>
                              <CheckCircle className="w-3 h-3" />
                              {teamsInLeague}/{matchingTeams.length}
                            </span>
                          ) : (
                            <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                              No teams
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Summary line */}
                  {(() => {
                    const coveredGroups = currentLeague.ageGroups.filter(ag => teams.some(t => t.ageGroup === ag)).length;
                    const totalGroups = currentLeague.ageGroups.length;
                    const teamsInLeagueCount = teams.filter(t => t.inLeague).length;
                    return (
                      <p className={`mt-3 text-xs ${
                        coveredGroups === totalGroups 
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                          : theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                      }`}>
                        {coveredGroups === totalGroups 
                          ? `✓ You have teams covering all ${totalGroups} age groups (${teamsInLeagueCount} active in league)`
                          : `⚠ Covering ${coveredGroups}/${totalGroups} age groups • Consider adding teams for missing groups`
                        }
                      </p>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-4 py-2">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'
              }`}>
                <Building2 className={theme === 'dark' ? 'w-7 h-7 text-slate-600' : 'w-7 h-7 text-slate-400'} />
              </div>
              <div>
                <h3 className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Not in a League
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  Accept an invitation below to join a league
                </p>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Leave League Confirmation Modal */}
        {showLeaveConfirm && currentLeague && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-md rounded-2xl p-6 ${
              theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white shadow-xl'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <LogOut className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Leave League?
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    This action cannot be undone
                  </p>
                </div>
              </div>
              
              <div className={`p-4 rounded-xl mb-4 ${
                theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
              }`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>
                  Leaving <strong>{currentLeague.name}</strong> will:
                </p>
                <ul className={`mt-2 text-sm space-y-1 ${theme === 'dark' ? 'text-red-400/80' : 'text-red-600'}`}>
                  <li>• Remove all {teams.filter(t => t.inLeague).length} team(s) from the league</li>
                  <li>• Notify all coaches and parents</li>
                  <li>• Remove scheduled games from league schedule</li>
                  <li>• Require re-invitation to rejoin</li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  disabled={leavingLeague}
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-white/10 hover:bg-white/15 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveLeague}
                  disabled={leavingLeague}
                  className="flex-1 py-2.5 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-2"
                >
                  {leavingLeague ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Leaving...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Leave League
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teams in League Section - only show if in a league */}
        {currentLeague && teams.length > 0 && (
          <div className={`rounded-2xl p-5 border mb-6 ${
            theme === 'dark'
              ? 'bg-white/5 border-white/10'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className={theme === 'dark' ? 'w-5 h-5 text-purple-400' : 'w-5 h-5 text-purple-600'} />
                <h3 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Teams in League
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                }`}>
                  {teams.filter(t => t.inLeague).length} / {teams.length}
                </span>
              </div>
            </div>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Toggle which of your teams participate in {currentLeague.name}
            </p>
            <div className="space-y-2">
              {teams.map(team => (
                <div 
                  key={team.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    team.inLeague
                      ? theme === 'dark'
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-green-50 border-green-200'
                      : theme === 'dark'
                        ? 'bg-white/5 border-white/10'
                        : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      team.inLeague
                        ? 'bg-green-500/20'
                        : team.noAgeGroup || !team.canJoinLeague
                          ? theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
                          : theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'
                    }`}>
                      <Users className={`w-5 h-5 ${
                        team.inLeague
                          ? 'text-green-500'
                          : team.noAgeGroup || !team.canJoinLeague
                            ? 'text-red-400'
                            : theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`} />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {team.name}
                      </p>
                      {team.ageGroup ? (
                        <p className={`text-xs ${
                          team.canJoinLeague || team.inLeague
                            ? theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                            : theme === 'dark' ? 'text-red-400' : 'text-red-500'
                        }`}>
                          {team.ageGroup}
                          {!team.canJoinLeague && !team.inLeague && ' (not in league age groups)'}
                        </p>
                      ) : (
                        <p className={`text-xs ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`}>
                          No age group set
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Only show Add button if team can join (has matching age group) */}
                  {team.inLeague ? (
                    <button
                      onClick={() => handleToggleTeamLeague(team)}
                      disabled={togglingTeam === team.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        theme === 'dark'
                          ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                          : 'bg-red-100 hover:bg-red-200 text-red-600'
                      } disabled:opacity-50`}
                    >
                      {togglingTeam === team.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Minus className="w-4 h-4" />
                          Remove
                        </>
                      )}
                    </button>
                  ) : team.canJoinLeague ? (
                    <button
                      onClick={() => handleToggleTeamLeague(team)}
                      disabled={togglingTeam === team.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        theme === 'dark'
                          ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                          : 'bg-green-100 hover:bg-green-200 text-green-600'
                      } disabled:opacity-50`}
                    >
                      {togglingTeam === team.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add
                        </>
                      )}
                    </button>
                  ) : (
                    <span className={`text-xs px-3 py-1.5 rounded-lg ${
                      theme === 'dark'
                        ? 'bg-slate-500/20 text-slate-500'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {team.noAgeGroup ? 'Set age group' : 'No match'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Find & Join a League Section */}
        {!currentLeague && (
          <div className={`rounded-2xl border mb-6 ${
            theme === 'dark'
              ? 'bg-white/5 border-white/10'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className={`px-5 py-3 border-b rounded-t-2xl ${
              theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'
            }`}>
              <h3 className={`text-sm font-medium flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Globe className="w-4 h-4 text-purple-500" />
                Find & Join a League
              </h3>
            </div>
            
            <div className="p-5">
              <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Search for {selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1)} leagues in your area to request membership
              </p>
              
              {/* Search Input */}
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={leagueSearchQuery}
                  onChange={(e) => setLeagueSearchQuery(e.target.value)}
                  onFocus={() => leagueSearchQuery.trim() && setShowSearchResults(true)}
                  placeholder="Search by league name, city, or state..."
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all ${
                    theme === 'dark'
                      ? 'bg-white/5 border-white/10 text-white placeholder-slate-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-500 animate-spin" />
                )}
                
                {/* Search Results Dropdown */}
                {showSearchResults && (
                  <div 
                    ref={searchDropdownRef}
                    className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl z-50 max-h-80 overflow-y-auto ${
                      theme === 'dark'
                        ? 'bg-zinc-800 border-white/10'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {searchLoading ? (
                      <div className="p-4 text-center">
                        <Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto" />
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="divide-y divide-white/10">
                        {searchResults.map(league => (
                          <div 
                            key={league.id}
                            className={`p-4 transition-colors ${
                              theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* League Logo */}
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
                              }`}>
                                {league.logoUrl ? (
                                  <img 
                                    src={league.logoUrl} 
                                    alt={league.name}
                                    className="w-10 h-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <Shield className="w-6 h-6 text-purple-500" />
                                )}
                              </div>
                              
                              {/* League Info */}
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-semibold truncate ${
                                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                                }`}>
                                  {league.name}
                                </h4>
                                
                                {(league.city || league.state) && (
                                  <p className={`text-sm flex items-center gap-1 ${
                                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                  }`}>
                                    <MapPin className="w-3 h-3" />
                                    {[league.city, league.state].filter(Boolean).join(', ')}
                                  </p>
                                )}
                                
                                <div className={`flex items-center gap-3 mt-1 text-xs ${
                                  theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                                }`}>
                                  <span>{league.teamCount} teams</span>
                                  <span>•</span>
                                  <span>{league.ageGroups?.length || 0} age groups</span>
                                </div>
                              </div>
                              
                              {/* Action Button */}
                              <div className="flex-shrink-0">
                                {league.hasPendingRequest ? (
                                  <span className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
                                    theme === 'dark'
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    <Clock className="w-3 h-3" />
                                    Pending
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => requestToJoinLeague(league)}
                                    disabled={requestingLeagueId === league.id}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                      theme === 'dark'
                                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                                    } disabled:opacity-50`}
                                  >
                                    {requestingLeagueId === league.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Send className="w-3 h-3" />
                                        Request
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : leagueSearchQuery.length >= 2 ? (
                      <div className="p-6 text-center">
                        <Globe className={`w-10 h-10 mx-auto mb-2 ${
                          theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
                        }`} />
                        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                          No {selectedSport} leagues found
                        </p>
                        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                          Try a different search term
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">
                        Type at least 2 characters to search
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Pending Requests Info */}
              {pendingRequestLeagueIds.length > 0 && (
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                  theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'
                }`}>
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className={`text-sm ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                    You have {pendingRequestLeagueIds.length} pending join request{pendingRequestLeagueIds.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            League Invitations
          </h2>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`} />
            <input
              type="text"
              placeholder="Search invitations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                  : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className={theme === 'dark' ? 'w-5 h-5 text-slate-400' : 'w-5 h-5 text-slate-500'} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-white border border-slate-200 text-slate-900'
              }`}
            >
              <option value="all">All Invitations</option>
              <option value="pending">Pending</option>
              <option value="approved">Accepted</option>
              <option value="rejected">Declined</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : filteredInvitations.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Inbox className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Invitations Found</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'No league invitations have been received yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInvitations.map(invitation => (
              <div key={invitation.id} className={`rounded-2xl p-5 border ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500/20">
                      <Send className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {invitation.leagueName}
                        </h3>
                        {getStatusBadge(invitation.status)}
                        {invitation.isSwitchLeague && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                            Switch Request
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {invitation.isSwitchLeague 
                          ? `Wants you to switch from ${invitation.previousLeagueName}`
                          : 'Has invited your program to join their league'}
                      </p>
                      <div className={`flex items-center gap-4 mt-2 text-sm ${
                        theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                      }`}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(invitation.createdAt)}
                        </span>
                      </div>
                      {invitation.message && (
                        <p className={`mt-3 text-sm rounded-xl p-3 ${
                          theme === 'dark' 
                            ? 'text-slate-300 bg-white/5' 
                            : 'text-slate-600 bg-slate-50'
                        }`}>
                          "{invitation.message}"
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {invitation.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => handleAccept(invitation)}
                        disabled={processingId === invitation.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium transition-colors bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
                      >
                        {processingId === invitation.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Accept
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDecline(invitation)}
                        disabled={processingId === invitation.id}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium transition-colors ${
                          theme === 'dark'
                            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                            : 'bg-red-100 hover:bg-red-200 text-red-600'
                        } disabled:opacity-50`}
                      >
                        <X className="w-4 h-4" />
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
