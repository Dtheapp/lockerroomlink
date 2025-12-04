import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText, sanitizeNumber, sanitizeDate } from '../services/sanitize';
import type { Player, UserProfile, Team } from '../types';
import { Plus, Trash2, Shield, Sword, AlertCircle, Phone, Link, User, X, Edit2, ChevronLeft, ChevronRight, Search, Users, Crown, UserMinus, Star } from 'lucide-react';

// Pagination settings
const PLAYERS_PER_PAGE = 12;

const Roster: React.FC = () => {
  const { userData, teamData } = useAuth();
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

  // Filter, sort (starters first), and paginate roster
  const filteredRoster = useMemo(() => {
    let filtered = roster;
    
    // Apply search filter
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      filtered = filtered.filter(player => 
        player.name.toLowerCase().includes(term) ||
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
  
  // Delete confirmation state
  const [deletePlayerConfirm, setDeletePlayerConfirm] = useState<{ id: string; name: string; number: string } | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);
  
  const [newPlayer, setNewPlayer] = useState({ 
    name: '', 
    number: '', 
    position: '', 
    td: '0', 
    tkl: '0', 
    dob: '', 
    teamId: '', // NEW: Team selection for parents
    shirtSize: '', // For parents: uniform sizing
    pantSize: '' // For parents: uniform sizing
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
        const coachesQuery = query(
          collection(db, 'users'),
          where('role', '==', 'Coach'),
          where('teamId', '==', teamData?.id)
        );
        const snapshot = await getDocs(coachesQuery);
        const coachesData = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
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
      // SECURITY: Sanitize all input before storing
      const playerData: any = {
        name: sanitizeText(newPlayer.name, 100),
        dob: sanitizeDate(newPlayer.dob),
        teamId: targetTeamId,
        parentId: isParent ? userData?.uid : undefined,
        medical: { allergies: 'None', conditions: 'None', medications: 'None', bloodType: '' }
      };

      if (isParent) {
        // Parents only provide uniform sizes
        playerData.shirtSize = sanitizeText(newPlayer.shirtSize, 20);
        playerData.pantSize = sanitizeText(newPlayer.pantSize, 20);
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
      }

      await addDoc(collection(db, 'teams', targetTeamId, 'players'), playerData);
      setNewPlayer({ name: '', number: '', position: '', td: '0', tkl: '0', dob: '', teamId: '', shirtSize: '', pantSize: '' });
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

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !editingPlayer.teamId || savingPlayer) return;
    
    setSavingPlayer(true);
    try {
      const playerRef = doc(db, 'teams', editingPlayer.teamId, 'players', editingPlayer.id);
      const updateData: any = {
        name: editingPlayer.name,
        dob: editingPlayer.dob,
        shirtSize: editingPlayer.shirtSize || '',
        pantSize: editingPlayer.pantSize || ''
      };
      
      // Coaches can also edit jersey number, position, and designations
      if (isStaff) {
        updateData.number = editingPlayer.number || 0;
        updateData.position = editingPlayer.position || 'TBD';
        updateData.isStarter = editingPlayer.isStarter || false;
        updateData.isCaptain = editingPlayer.isCaptain || false;
      }
      
      await updateDoc(playerRef, updateData);
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
      // Remove coach from team by setting teamId to null
      await updateDoc(doc(db, 'users', removeCoachConfirm.id), { teamId: null });
      
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
      
      // Refresh coaches list
      const coachesQuery = query(
        collection(db, 'users'),
        where('role', '==', 'Coach'),
        where('teamId', '==', teamData.id)
      );
      const snapshot = await getDocs(coachesQuery);
      const coachesData = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setTeamCoaches(coachesData);
      
      setRemoveCoachConfirm(null);
    } catch (error) {
      console.error('Error removing coach:', error);
      alert('Failed to remove coach from team.');
    } finally {
      setRemovingCoach(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Team Roster</h1>
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
                className="w-full sm:w-48 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-10 pr-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
              />
            </div>
          )}
          {(isStaff || isParent) && (
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-500 transition-colors shadow-lg shadow-orange-900/20 whitespace-nowrap">
              <Plus className="w-5 h-5" /> {isParent ? 'Add My Player' : 'Add Player'}
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {roster.length > 0 && searchFilter && (
        <p className="text-sm text-zinc-500">
          Showing {filteredRoster.length} of {roster.length} players
        </p>
      )}

      {!teamData && isParent ? (
        <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Add your first player to view the team roster</p>
          <button onClick={() => setIsAddModalOpen(true)} className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-500 transition-colors shadow-lg">
            <Plus className="w-5 h-5" /> Add My Player
          </button>
        </div>
      ) : loading ? <p className="text-zinc-500">Loading roster...</p> : filteredRoster.length > 0 ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedRoster.map(player => {
            const hasMedicalAlert = player.medical && (player.medical.allergies !== 'None' || player.medical.conditions !== 'None');
            const parent = getParentInfo(player.parentId);
            const isStarter = player.isStarter;
            const isCaptain = player.isCaptain;

            return (
                <div 
                  key={player.id} 
                  className={`bg-slate-50 dark:bg-zinc-950 rounded-xl p-5 flex flex-col relative overflow-hidden border shadow-lg transition-all duration-300 ${
                    isStarter 
                      ? 'border-yellow-400 dark:border-yellow-500 ring-2 ring-yellow-400/50 dark:ring-yellow-500/40 shadow-yellow-400/20 dark:shadow-yellow-500/20' 
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-orange-500/30'
                  }`}
                  style={isStarter ? { boxShadow: '0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.1)' } : {}}
                >
                    {/* Starter Badge - Top Left Corner */}
                    {isStarter && (
                      <div className="absolute top-2 left-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full px-2 py-0.5 shadow-lg flex items-center gap-1">
                        <Star className="w-3 h-3 text-white fill-white" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wide">Starter</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-4 mt-2">
                        <div className={`rounded-full h-12 w-12 flex items-center justify-center text-xl font-bold border font-mono ${
                          isStarter 
                            ? 'bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400' 
                            : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white'
                        }`}>
                            {player.number}
                        </div>
                        <div className="flex gap-2">
                            {/* PRIVACY FIX: Only Coaches/Staff can see the Medical Alert Button */}
                            {hasMedicalAlert && isStaff && (
                                <button onClick={() => setViewMedical(player)} className="text-red-500 hover:text-red-400 bg-red-100 dark:bg-red-900/20 p-1.5 rounded-full animate-pulse">
                                    <AlertCircle className="w-5 h-5" />
                                </button>
                            )}
                            {parent && isStaff && (
                                <button onClick={() => openContact(player.parentId)} className="text-cyan-500 hover:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/20 p-1.5 rounded-full">
                                    <Phone className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="text-center mb-4">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white truncate flex items-center justify-center gap-1.5">
                          {player.name}
                          {isCaptain && <Crown className="w-5 h-5 text-amber-500 flex-shrink-0" />}
                        </h3>
                        <p className="text-orange-500 font-bold text-sm uppercase tracking-wide">{player.position}</p>
                        <p className="text-xs text-zinc-500 mt-1">DOB: {player.dob || '--'}</p>
                    </div>

                    <div className="flex justify-center gap-4 mt-auto mb-4 bg-zinc-50 dark:bg-black p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                            <Sword className="w-3 h-3 text-orange-500" /> <span className="font-bold">{player.stats.td}</span> TD
                        </div>
                        <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                            <Shield className="w-3 h-3 text-cyan-500" /> <span className="font-bold">{player.stats.tkl}</span> TKL
                        </div>
                    </div>

                    {/* Uniform Sizes - Visible to both Parents and Coaches */}
                    {(player.shirtSize || player.pantSize) && (
                      <div className="mb-3 bg-orange-50 dark:bg-orange-900/10 p-2 rounded border border-orange-200 dark:border-orange-900/30">
                        <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Uniform</p>
                        <div className="flex justify-around text-xs">
                          {player.shirtSize && (
                            <div>
                              <span className="text-zinc-500 dark:text-zinc-500">Shirt:</span>
                              <span className="ml-1 font-bold text-zinc-900 dark:text-white">{player.shirtSize}</span>
                            </div>
                          )}
                          {player.pantSize && (
                            <div>
                              <span className="text-zinc-500 dark:text-zinc-500">Pants:</span>
                              <span className="ml-1 font-bold text-zinc-900 dark:text-white">{player.pantSize}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Parent: Edit their own child */}
                    {isParent && player.parentId === userData?.uid && (
                      <div className="flex justify-center border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-2">
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
                        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-2 space-y-2">
                            <div className="flex justify-between items-center">
                                {!player.parentId ? (
                                    <button onClick={() => { setSelectedPlayerId(player.id); setIsLinkModalOpen(true); }} className="text-xs flex items-center gap-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><Link className="w-3 h-3" /> Link Parent</button>
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
                </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
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
                      ? 'bg-orange-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
        </>
      ) : searchFilter ? (
        <p className="text-zinc-500 text-center py-8">No players match your search.</p>
      ) : (
        <p className="text-zinc-500 text-center py-8">No players yet.</p>
      )}

      {/* COACHING STAFF SECTION - Only visible to coaches */}
      {isStaff && teamCoaches.length > 0 && (
        <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Coaching Staff ({teamCoaches.length})
            </h2>
            {isHeadCoach && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-full flex items-center gap-1">
                <Crown className="w-3 h-3" /> Head Coach
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamCoaches.map(coach => (
              <div 
                key={coach.uid} 
                className={`bg-slate-50 dark:bg-zinc-950 rounded-lg p-4 border ${
                  teamData?.headCoachId === coach.uid 
                    ? 'border-purple-500 dark:border-purple-500' 
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center text-white font-bold">
                      {coach.name?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        {coach.name}
                        {teamData?.headCoachId === coach.uid && (
                          <Crown className="w-4 h-4 text-purple-500" />
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">@{coach.username || coach.email}</p>
                    </div>
                  </div>
                  
                  {/* Only Head Coach can remove other coaches (not themselves) */}
                  {isHeadCoach && coach.uid !== userData?.uid && (
                    <button
                      onClick={() => setRemoveCoachConfirm({ id: coach.uid, name: coach.name })}
                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Remove from team"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {coach.phone && (
                  <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {coach.phone}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REMOVE COACH CONFIRMATION MODAL */}
      {removeCoachConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Remove Coach?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Are you sure you want to remove <strong className="text-zinc-900 dark:text-white">{removeCoachConfirm.name}</strong> from the team? 
              They will no longer have access to team content.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveCoachConfirm(null)}
                disabled={removingCoach}
                className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
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

      {/* MODALS (Styled) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">
              {isParent ? 'Add Your Player' : 'Add New Player'}
            </h2>
            <form onSubmit={handleAddPlayer} className="space-y-4">
              {isParent && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Select Team *</label>
                  <select 
                    name="teamId" 
                    value={newPlayer.teamId} 
                    onChange={handleInputChange} 
                    className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                    required
                  >
                    <option value="">Choose a team...</option>
                    {allTeams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500 mt-1">Ask your coach for the Team ID if needed</p>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Full Name *</label>
                <input name="name" value={newPlayer.name} onChange={handleInputChange} placeholder="John Smith" className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" required />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date of Birth *</label>
                <input name="dob" type="date" value={newPlayer.dob} onChange={handleInputChange} className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" required />
              </div>

              {/* PARENT FORM: Uniform Sizes */}
              {isParent && (
                <>
                  <div className="pt-2 border-t border-zinc-300 dark:border-zinc-800">
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-3 uppercase tracking-wider">Uniform Sizing</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Shirt Size</label>
                        <select name="shirtSize" value={newPlayer.shirtSize} onChange={handleInputChange} className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white">
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
                        <select name="pantSize" value={newPlayer.pantSize} onChange={handleInputChange} className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white">
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
                </>
              )}

              {/* COACH FORM: Jersey, Position, Stats */}
              {isStaff && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Jersey # *</label>
                      <input name="number" type="number" value={newPlayer.number} onChange={handleInputChange} placeholder="12" className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Position *</label>
                      <input name="position" value={newPlayer.position} onChange={handleInputChange} placeholder="QB" className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" required />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Shirt Size</label>
                      <select name="shirtSize" value={newPlayer.shirtSize} onChange={handleInputChange} className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white">
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
                      <select name="pantSize" value={newPlayer.pantSize} onChange={handleInputChange} className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white">
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
                </>
              )}
              {isStaff && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-3 uppercase tracking-wider">Season Stats (Optional)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Touchdowns</label>
                      <input name="td" type="number" value={newPlayer.td} onChange={handleInputChange} placeholder="0" className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Tackles</label>
                      <input name="tkl" type="number" value={newPlayer.tkl} onChange={handleInputChange} placeholder="0" className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 text-zinc-500 hover:text-zinc-900 dark:hover:text-white" disabled={addingPlayer}>Cancel</button>
                <button type="submit" disabled={addingPlayer} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2">
                  {addingPlayer ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>
                  ) : (
                    'Add Player'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LINK PARENT MODAL */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white">Link Parent</h2>
            <div className="space-y-4">
              <select value={selectedParentId} onChange={(e) => setSelectedParentId(e.target.value)} className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white">
                <option value="">Select a parent...</option>
                {parents.map(p => (
                  <option key={p.uid} value={p.uid}>{p.name} ({p.username})</option>
                ))}
              </select>
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" onClick={() => setIsLinkModalOpen(false)} className="px-4 text-zinc-500 hover:text-zinc-900 dark:hover:text-white" disabled={linkingParent}>Cancel</button>
                <button onClick={handleLinkParent} disabled={!selectedParentId || linkingParent} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2">
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-6 h-6" /> Medical Alert
            </h2>
            <div className="space-y-3">
              <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded border border-red-200 dark:border-red-900/30">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Player</h3>
                <p className="text-zinc-900 dark:text-white">#{viewMedical.number} {viewMedical.name}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Allergies</h3>
                <p className="text-zinc-900 dark:text-white">{viewMedical.medical?.allergies || 'None'}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Medical Conditions</h3>
                <p className="text-zinc-900 dark:text-white">{viewMedical.medical?.conditions || 'None'}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Medications</h3>
                <p className="text-zinc-900 dark:text-white">{viewMedical.medical?.medications || 'None'}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Blood Type</h3>
                <p className="text-zinc-900 dark:text-white">{viewMedical.medical?.bloodType || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setViewMedical(null)} className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT INFO MODAL */}
      {viewContact && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
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
                ) : (
                  <p className="text-zinc-900 dark:text-white">{viewContact.phone || 'Not provided'}</p>
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
                ) : (
                  <p className="text-zinc-900 dark:text-white">{viewContact.secondaryPhone || 'Not provided'}</p>
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
                      <p className="text-zinc-900 dark:text-white">{viewContact.emergencyContact.phone}</p>
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
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
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
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold"
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
          <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
              <Edit2 className="w-6 h-6 text-orange-500" /> Edit Player Info
            </h2>
            <form onSubmit={handleUpdatePlayer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Full Name</label>
                <input 
                  type="text"
                  value={editingPlayer.name}
                  onChange={(e) => setEditingPlayer({...editingPlayer, name: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  required
                />
              </div>

              {/* PARENT-ONLY FIELD: Date of Birth */}
              {isParent && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date of Birth</label>
                  <input 
                    type="date"
                    value={editingPlayer.dob}
                    onChange={(e) => setEditingPlayer({...editingPlayer, dob: e.target.value})}
                    className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
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
                      <input 
                        type="text"
                        value={editingPlayer.position || ''}
                        onChange={(e) => setEditingPlayer({...editingPlayer, position: e.target.value})}
                        placeholder="QB, RB, WR..."
                        className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white"
                      />
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
                    <label className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-black rounded-lg border border-zinc-300 dark:border-zinc-800 cursor-pointer hover:border-yellow-400 dark:hover:border-yellow-500 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
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

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-3 uppercase tracking-wider">Uniform Sizing</p>
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
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
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
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
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
            
            <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
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
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
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
    </div>
  );
};

export default Roster;