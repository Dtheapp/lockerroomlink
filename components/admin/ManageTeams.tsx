import React, { useState, useEffect } from 'react';
import { 
    collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc, 
    query, orderBy, getDoc, getDocs, where, writeBatch, limit, addDoc, serverTimestamp,
    arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Team, UserProfile } from '../../types';
import { Plus, Trash2, Edit2, Users, FileText, MessageCircle, AlertTriangle, Search, X, Check, UserX, UserCheck, Shield, Crown } from 'lucide-react';

type ModalContent = 'roster' | 'posts' | 'chat';

interface CoachOption {
    id: string;
    name: string;
    currentTeamId?: string | null;
}

const ManageTeams: React.FC = () => {
    const { userData } = useAuth();
    const [teams, setTeams] = useState<Team[]>([]);
    const [coachLookup, setCoachLookup] = useState<{[key: string]: string}>({});
    const [availableCoaches, setAvailableCoaches] = useState<CoachOption[]>([]);
    const [teamMemberCounts, setTeamMemberCounts] = useState<{[key: string]: { users: number, players: number }}>({});
    const [teamCoachesMap, setTeamCoachesMap] = useState<{[teamId: string]: CoachOption[]}>({});
    const [loading, setLoading] = useState(true);
    
    // SEARCH STATE
    const [searchQuery, setSearchQuery] = useState('');
    
    // MODAL STATES
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isViewModalOpen, setViewModalOpen] = useState(false);
    const [isDeleteTeamModalOpen, setDeleteTeamModalOpen] = useState(false);
    const [isDeleteItemModalOpen, setDeleteItemModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // FORM STATES
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamId, setNewTeamId] = useState('');
    const [editTeamName, setEditTeamName] = useState('');
    const [editCoachId, setEditCoachId] = useState<string | null>(null);
    const [editHeadCoachId, setEditHeadCoachId] = useState<string | null>(null);
    const [teamCoaches, setTeamCoaches] = useState<CoachOption[]>([]); // Coaches currently on this team
    const [createError, setCreateError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [modalContent, setModalContent] = useState<ModalContent>('roster');
    const [modalData, setModalData] = useState<any[]>([]);
    
    // FILTERED TEAMS
    const filteredTeams = teams.filter(team => {
        const q = searchQuery.toLowerCase();
        const coachName = team.coachId ? (coachLookup[team.coachId] || '').toLowerCase() : '';
        return (
            team.name.toLowerCase().includes(q) ||
            team.id.toLowerCase().includes(q) ||
            coachName.includes(q)
        );
    });

    // ACTIVITY LOGGING FUNCTION
    const logActivity = async (action: string, targetType: string, targetId: string, details?: string) => {
        try {
            await addDoc(collection(db, 'adminActivityLog'), {
                action,
                targetType,
                targetId,
                details: details || '',
                performedBy: userData?.uid || 'unknown',
                performedByName: userData?.name || userData?.email || 'Unknown Admin',
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error('Failed to log activity:', error);
        }
    };

    useEffect(() => {
      // 1. Fetch Teams List
      const teamsUnsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
        const teamsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Team));
        setTeams(teamsData);
      });

      // 2. Fetch Coaches Lookup and Available Coaches
      const fetchCoaches = async () => {
          const coachesQuery = query(collection(db, 'users'), where('role', '==', 'Coach'));
          const snapshot = await getDocs(coachesQuery);
          const lookup: {[key: string]: string} = {};
          const coaches: CoachOption[] = [];
          const coachesByTeam: {[teamId: string]: CoachOption[]} = {};
          
          snapshot.docs.forEach(docSnap => {
              const data = docSnap.data() as UserProfile;
              lookup[docSnap.id] = data.username || data.name;
              const coachData = {
                  id: docSnap.id,
                  name: data.username || data.name,
                  currentTeamId: data.teamId || null
              };
              coaches.push(coachData);
              
              // Group coaches by team
              if (data.teamId) {
                  if (!coachesByTeam[data.teamId]) {
                      coachesByTeam[data.teamId] = [];
                  }
                  coachesByTeam[data.teamId].push(coachData);
              }
          });
          
          setCoachLookup(lookup);
          setAvailableCoaches(coaches);
          setTeamCoachesMap(coachesByTeam);
          setLoading(false);
      };
      
      fetchCoaches();
      
      // 3. Fetch team member counts (users + roster players)
      const fetchMemberCounts = async () => {
          // Get all users to count by teamId
          const usersSnapshot = await getDocs(collection(db, 'users'));
          const userCounts: {[key: string]: number} = {};
          usersSnapshot.docs.forEach(docSnap => {
              const data = docSnap.data() as UserProfile;
              if (data.teamId) {
                  userCounts[data.teamId] = (userCounts[data.teamId] || 0) + 1;
              }
          });
          
          // Get all teams to fetch roster counts
          const teamsSnapshot = await getDocs(collection(db, 'teams'));
          const counts: {[key: string]: { users: number, players: number }} = {};
          
          for (const teamDoc of teamsSnapshot.docs) {
              const teamId = teamDoc.id;
              const playersSnapshot = await getDocs(collection(db, 'teams', teamId, 'players'));
              counts[teamId] = {
                  users: userCounts[teamId] || 0,
                  players: playersSnapshot.size
              };
          }
          setTeamMemberCounts(counts);
      };
      
      fetchMemberCounts();

      return () => teamsUnsub(); // Only need to unsubscribe from teams list
    }, []);
    
    // Fetch details logic (Roster, Posts, Chat)
    useEffect(() => {
      if (!isViewModalOpen || !selectedTeam) return;
      
      let unsub: () => void;
      
      // Determine the subcollection path
      const subCol = modalContent === 'roster' ? 'players' : modalContent === 'posts' ? 'bulletin' : 'messages';
      
      // Build query based on content type
      let contentQuery;
      if (subCol === 'messages' || subCol === 'bulletin') {
        // Limit chat/posts data for viewing performance
        contentQuery = query(
          collection(db, 'teams', selectedTeam.id, subCol), 
          orderBy('timestamp', 'desc'), 
          limit(50)
        );
      } else {
        // Roster - order by number
        contentQuery = query(
          collection(db, 'teams', selectedTeam.id, subCol), 
          orderBy('number', 'asc')
        );
      }
      
      unsub = onSnapshot(contentQuery, (snapshot) => {
          setModalData(snapshot.docs.map(docSnap => ({id: docSnap.id, ...docSnap.data()})));
      }, (error) => {
          console.error(`Error fetching ${subCol} data:`, error);
          setModalData([]);
      });
      
      return () => unsub();
    }, [isViewModalOpen, selectedTeam, modalContent]);

    // Handlers...
    const handleCreateTeam = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreateError('');
      const cleanId = newTeamId.trim().toUpperCase();
      if (!newTeamName.trim() || !cleanId) { setCreateError("Name and Team ID are required."); return; }
      
      if (!/^[a-zA-Z0-9]+$/.test(cleanId)) {
        setCreateError("Team ID can only contain letters and numbers.");
        return;
      }

      try {
        const docRef = doc(db, 'teams', cleanId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) { setCreateError("Team ID already taken."); return; }
        
        await setDoc(docRef, { 
            name: newTeamName, 
            coachId: null,
            record: { wins: 0, losses: 0, ties: 0 } // Initialize record
        });
        
        // Log activity
        await logActivity('CREATE', 'team', cleanId, `Created team "${newTeamName}"`);
        
        setNewTeamName(''); setNewTeamId(''); setCreateModalOpen(false);
      } catch (error) { console.error(error); setCreateError("Failed to create team."); }
    };

    const handleUpdateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTeam || !editTeamName.trim()) return;
        setIsSaving(true);
        
        try {
            const oldCoachId = selectedTeam.coachId;
            const newCoachId = editCoachId;
            const oldHeadCoachId = selectedTeam.headCoachId;
            let newHeadCoachId = editHeadCoachId;
            
            // AUTO HEAD COACH: If assigning first coach and no head coach exists, make them head coach
            if (newCoachId && !oldCoachId && !oldHeadCoachId) {
                newHeadCoachId = newCoachId;
            }
            
            // Update team document
            await updateDoc(doc(db, 'teams', selectedTeam.id), { 
                name: editTeamName,
                coachId: newCoachId,
                headCoachId: newHeadCoachId
            });
            
            // If coach changed, update user documents
            if (oldCoachId !== newCoachId) {
                // Unlink old coach from this team (remove from teamIds array)
                if (oldCoachId) {
                    await updateDoc(doc(db, 'users', oldCoachId), { 
                        teamId: null,
                        teamIds: arrayRemove(selectedTeam.id)
                    });
                }
                
                // Link new coach to this team (if not unassigning)
                if (newCoachId) {
                    // First, unlink new coach from their old team if they had one
                    const newCoach = availableCoaches.find(c => c.id === newCoachId);
                    if (newCoach?.currentTeamId && newCoach.currentTeamId !== selectedTeam.id) {
                        // Update their old team to remove this coach
                        await updateDoc(doc(db, 'teams', newCoach.currentTeamId), { coachId: null });
                    }
                    // Assign new coach to this team - add to teamIds array for multi-team support
                    await updateDoc(doc(db, 'users', newCoachId), { 
                        teamId: selectedTeam.id,
                        teamIds: arrayUnion(selectedTeam.id)
                    });
                }
            }
            
            // Refresh coach list
            const coachesQuery = query(collection(db, 'users'), where('role', '==', 'Coach'));
            const snapshot = await getDocs(coachesQuery);
            const coaches: CoachOption[] = [];
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data() as UserProfile;
                coaches.push({
                    id: docSnap.id,
                    name: data.username || data.name,
                    currentTeamId: data.teamId || null
                });
            });
            setAvailableCoaches(coaches);
            
            // Log activity
            const changes: string[] = [];
            if (editTeamName !== selectedTeam.name) changes.push(`renamed to "${editTeamName}"`);
            if (oldCoachId !== newCoachId) {
                if (!newCoachId) changes.push('coach unassigned');
                else if (!oldCoachId) changes.push(`coach assigned: ${coachLookup[newCoachId] || newCoachId}`);
                else changes.push(`coach changed from ${coachLookup[oldCoachId] || oldCoachId} to ${coachLookup[newCoachId] || newCoachId}`);
            }
            if (oldHeadCoachId !== newHeadCoachId) {
                const oldHeadName = oldHeadCoachId ? (coachLookup[oldHeadCoachId] || oldHeadCoachId) : 'none';
                const newHeadName = newHeadCoachId ? (coachLookup[newHeadCoachId] || newHeadCoachId) : 'none';
                changes.push(`head coach changed from ${oldHeadName} to ${newHeadName}`);
            }
            if (changes.length > 0) {
                await logActivity('UPDATE', 'team', selectedTeam.id, `Updated team "${selectedTeam.name}": ${changes.join(', ')}`);
            }
            
            setEditModalOpen(false); 
            setSelectedTeam(null);
        } catch (error) { 
            console.error(error); 
        } finally {
            setIsSaving(false);
        }
    }
    
    // --- CRITICAL DATA INTEGRITY FIX: Cascading Delete ---
    const handleDeleteTeam = async () => {
        if (!selectedTeam) return;
        setIsDeleting(true);
        
        try {
            const teamId = selectedTeam.id;
            
            // 1. Find all related users and UNLINK them
            const usersQuery = query(collection(db, 'users'), where('teamId', '==', teamId));
            const usersSnapshot = await getDocs(usersQuery);
            
            const userBatch = writeBatch(db);
            usersSnapshot.docs.forEach(userDoc => {
                const userRef = doc(db, 'users', userDoc.id);
                userBatch.update(userRef, { teamId: null });
            });
            await userBatch.commit();
            console.log(`Unlinked ${usersSnapshot.size} users from team ${teamId}.`);

            // 2. Perform Cascading Delete on subcollections (Players, Posts, Messages, Stats)
            const subCollections = ['players', 'bulletin', 'messages', 'playerStats'];
            
            for (const subCol of subCollections) {
                const subColQuery = query(collection(db, 'teams', teamId, subCol));
                const subColSnapshot = await getDocs(subColQuery);
                
                if (subColSnapshot.empty) continue;
                
                const deleteBatch = writeBatch(db);
                subColSnapshot.docs.forEach(subDoc => {
                    deleteBatch.delete(doc(db, 'teams', teamId, subCol, subDoc.id));
                });
                await deleteBatch.commit();
                console.log(`Deleted ${subColSnapshot.size} documents from subcollection: ${subCol}.`);
            }

            // 3. Delete the main team document
            await deleteDoc(doc(db, 'teams', teamId));
            
            // Log activity
            await logActivity('DELETE', 'team', teamId, `Deleted team "${selectedTeam.name}" (unlinked ${usersSnapshot.size} users, deleted subcollections)`);
            
            setDeleteTeamModalOpen(false);
            setSelectedTeam(null);

        } catch (error) { 
            console.error("Error performing cascading delete:", error); 
        } finally {
            setIsDeleting(false);
        }
    };
    // --- END CRITICAL DATA INTEGRITY FIX ---

    const openEditModal = async (team: Team) => { 
        setSelectedTeam(team); 
        setEditTeamName(team.name); 
        setEditCoachId(team.coachId || null);
        setEditHeadCoachId(team.headCoachId || null);
        
        // Load all coaches currently on this team
        try {
            const coachesOnTeamQuery = query(
                collection(db, 'users'), 
                where('role', '==', 'Coach'),
                where('teamId', '==', team.id)
            );
            const snapshot = await getDocs(coachesOnTeamQuery);
            const coaches = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                name: (docSnap.data() as UserProfile).username || (docSnap.data() as UserProfile).name,
                currentTeamId: team.id
            }));
            setTeamCoaches(coaches);
        } catch (error) {
            console.error("Error loading team coaches:", error);
            setTeamCoaches([]);
        }
        
        setEditModalOpen(true); 
    }
    const openViewModal = (team: Team, contentType: ModalContent) => { setSelectedTeam(team); setModalContent(contentType); setViewModalOpen(true); }
    const openDeleteTeamModal = (team: Team) => { setSelectedTeam(team); setDeleteTeamModalOpen(true); }
    
    const handleDeleteItem = async () => {
        if (!selectedTeam || !itemToDelete) return;
        setIsDeleting(true);
        try {
            const col = modalContent === 'roster' ? 'players' : modalContent === 'posts' ? 'bulletin' : modalContent === 'chat' ? 'messages' : '';
            const itemType = modalContent === 'roster' ? 'player' : modalContent === 'posts' ? 'post' : 'message';
            if (col) {
                // Get item details before deleting for logging
                const itemData = modalData.find(item => item.id === itemToDelete);
                const itemName = itemData?.name || itemData?.text?.substring(0, 50) || itemToDelete;
                
                await deleteDoc(doc(db, 'teams', selectedTeam.id, col, itemToDelete));
                
                // Log activity
                await logActivity('DELETE', itemType, itemToDelete, `Deleted ${itemType} "${itemName}" from team "${selectedTeam.name}"`);
            }
            setDeleteItemModalOpen(false);
            setItemToDelete(null);
        } catch (error) {
            console.error("Error deleting item:", error);
        } finally {
            setIsDeleting(false);
        }
    }
    
    const openDeleteItemModal = (itemId: string) => {
        setItemToDelete(itemId);
        setDeleteItemModalOpen(true);
    }

    // --- HELPER: RENDER ACTION BUTTONS (Used for both Mobile & Desktop) ---
    const renderTeamActions = (team: Team, isMobile = false) => (
        <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap w-full mt-4 border-t border-slate-300 dark:border-zinc-800 pt-4' : 'justify-end'}`}>
             <button 
                onClick={() => openEditModal(team)} 
                className={`flex items-center justify-center gap-1 rounded-md bg-slate-300 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-400 dark:hover:bg-zinc-700 transition-colors font-medium border border-slate-400 dark:border-zinc-700 ${isMobile ? 'flex-1 py-2 text-sm' : 'p-2 md:px-3 md:py-1.5 text-xs'}`}
             >
                <Edit2 className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} /> 
                <span className={isMobile ? 'inline' : 'hidden xl:inline ml-1'}>Edit</span>
             </button>

             <button 
                onClick={() => openViewModal(team, 'roster')} 
                className={`flex items-center justify-center gap-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors font-medium border border-orange-300 dark:border-orange-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'p-2 md:px-3 md:py-1.5 text-xs'}`}
             >
                <Users className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
                <span className={isMobile ? 'inline' : 'hidden xl:inline ml-1'}>Roster</span>
             </button>
             
             <button 
                onClick={() => openViewModal(team, 'posts')} 
                className={`flex items-center justify-center gap-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors font-medium border border-orange-300 dark:border-orange-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'p-2 md:px-3 md:py-1.5 text-xs'}`}
             >
                <FileText className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
                <span className={isMobile ? 'inline' : 'hidden xl:inline ml-1'}>Bulletin</span>
             </button>
             
             <button 
                onClick={() => openViewModal(team, 'chat')} 
                className={`flex items-center justify-center gap-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors font-medium border border-orange-300 dark:border-orange-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'p-2 md:px-3 md:py-1.5 text-xs'}`}
             >
                <MessageCircle className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
                <span className={isMobile ? 'inline' : 'hidden xl:inline ml-1'}>Chat</span>
             </button>

             <button 
                onClick={() => openDeleteTeamModal(team)} 
                className={`flex items-center justify-center gap-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium border border-red-300 dark:border-red-800/50 ${isMobile ? 'w-full py-2 text-sm mt-2' : 'p-2 md:px-3 md:py-1.5 text-xs ml-2'}`}
             >
                <Trash2 className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
                <span className={isMobile ? 'inline' : 'hidden xl:inline ml-1'}>Delete</span>
             </button>
        </div>
    );

    const renderModalContent = () => {
        if(modalData.length === 0) return (
          <div className="text-center py-8">
            <p className="text-slate-600 dark:text-slate-400 text-lg">No {modalContent} found for this team.</p>
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">
                {modalContent === 'roster' && 'Players will appear here once they are added to this team.'}
                {modalContent === 'posts' && 'Bulletin posts and announcements will appear here.'}
                {modalContent === 'chat' && 'Team chat messages will appear here.'}
            </p>
          </div>
        );
        
        // Simple rendering for modal content lists
        return modalData.map((item: any) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-white dark:bg-zinc-900 rounded border border-slate-300 dark:border-zinc-800 mb-2 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                <div className="text-sm flex-1">
                    {modalContent === 'roster' && (
                        <div>
                            <span className="text-slate-900 dark:text-white font-bold">#{item.number || '?'} {item.name}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400 block mt-1">Position: {item.position || 'N/A'}</span>
                        </div>
                    )}
                    {modalContent === 'posts' && (
                        <div>
                            <span className="text-slate-900 dark:text-white font-medium line-clamp-2">{item.text}</span>
                            <span className="text-xs text-slate-500 block mt-1">By: {item.author || 'Unknown'}</span>
                        </div>
                    )}
                    {modalContent === 'chat' && (
                        <div>
                            <span className="text-slate-900 dark:text-white line-clamp-2">{item.text}</span>
                            <span className="text-xs text-slate-500 block mt-1">From: {item.sender?.name || item.senderName || 'Unknown'}</span>
                        </div>
                    )}
                </div>
                <button 
                    onClick={() => openDeleteItemModal(item.id)}
                    className="ml-3 p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    title="Delete"
                >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-500"/>
                </button>
            </div>
        ));
    };

    return (
      <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Manage Teams</h1>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  {/* Search Bar */}
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                          type="text"
                          placeholder="Search teams..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 w-full sm:w-64 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      {searchQuery && (
                          <button
                              onClick={() => setSearchQuery('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                              <X className="w-4 h-4" />
                          </button>
                      )}
                  </div>
                  <button onClick={() => setCreateModalOpen(true)} className="flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                      <Plus className="w-5 h-5" />
                      <span className="hidden md:inline">Create Team</span>
                  </button>
              </div>
          </div>

          {/* --- MOBILE VIEW: CARDS --- */}
          <div className="md:hidden space-y-4">
              {loading ? <p className="text-center text-slate-500 dark:text-slate-400">Loading...</p> : filteredTeams.length === 0 ? (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                      {searchQuery ? `No teams matching "${searchQuery}"` : 'No teams found.'}
                  </p>
              ) : filteredTeams.map(team => (
                  <div key={team.id} className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-5 shadow-lg">
                      <div className="flex justify-between items-start mb-2">
                          <div>
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{team.name}</h3>
                              <p className="text-xs text-slate-500 font-mono">ID: {team.id}</p>
                          </div>
                          <div className="bg-slate-300 dark:bg-zinc-900 px-2 py-1 rounded text-xs text-orange-700 dark:text-orange-400 border border-slate-400 dark:border-zinc-700">
                              {teamCoachesMap[team.id]?.length > 0 ? (
                                  <span>{teamCoachesMap[team.id].length} coach{teamCoachesMap[team.id].length > 1 ? 'es' : ''}</span>
                              ) : 'No Coach'}
                          </div>
                      </div>
                      
                      {/* Member counts */}
                      <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-400 mb-2">
                          <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> 
                              {teamMemberCounts[team.id]?.users || 0} users
                          </span>
                          <span className="flex items-center gap-1">
                              👤 {teamMemberCounts[team.id]?.players || 0} players
                          </span>
                      </div>
                      
                      {/* Coaches List */}
                      {teamCoachesMap[team.id]?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                              {teamCoachesMap[team.id].map(coach => (
                                  <span 
                                      key={coach.id} 
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                          team.headCoachId === coach.id 
                                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-700' 
                                              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800/50'
                                      }`}
                                  >
                                      {team.headCoachId === coach.id && <Crown className="w-3 h-3" />}
                                      {coach.name}
                                  </span>
                              ))}
                          </div>
                      )}
                      
                      {/* RENDER ACTIONS (Mobile Mode) */}
                      {renderTeamActions(team, true)}
                  </div>
              ))}
          </div>

          {/* --- DESKTOP VIEW: TABLE --- */}
          <div className="hidden md:block bg-slate-50 dark:bg-zinc-950 rounded-lg shadow overflow-hidden border border-slate-200 dark:border-zinc-800">
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
                      <thead className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-white dark:bg-black">
                      <tr>
                          <th className="px-6 py-3">Team Name</th>
                          <th className="px-6 py-3">Team ID</th>
                          <th className="px-6 py-3 text-orange-600 dark:text-orange-400">Coaches</th>
                          <th className="px-6 py-3 text-center">Members</th>
                          <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                      {loading ? (
                          <tr><td colSpan={5} className="text-center p-4">Loading teams...</td></tr>
                      ) : filteredTeams.length === 0 ? (
                          <tr><td colSpan={5} className="text-center p-4 text-slate-500 dark:text-slate-400">
                              {searchQuery ? `No teams matching "${searchQuery}"` : 'No teams found.'}
                          </td></tr>
                      ) : (
                          filteredTeams.map(team => (
                          <tr key={team.id} className="bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-black transition-colors">
                              <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{team.name}</td>
                              <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">{team.id}</td>
                              <td className="px-6 py-4">
                                  {teamCoachesMap[team.id]?.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                          {teamCoachesMap[team.id].map(coach => (
                                              <span 
                                                  key={coach.id} 
                                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                                      team.headCoachId === coach.id 
                                                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-700' 
                                                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800/50'
                                                  }`}
                                              >
                                                  {team.headCoachId === coach.id && <Crown className="w-3 h-3" />}
                                                  {coach.name}
                                              </span>
                                          ))}
                                      </div>
                                  ) : (
                                      <span className="text-slate-400 dark:text-slate-500 text-sm">Unassigned</span>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-3 text-xs">
                                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400" title="Linked Users">
                                          <Users className="w-3 h-3" /> {teamMemberCounts[team.id]?.users || 0}
                                      </span>
                                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400" title="Roster Players">
                                          👤 {teamMemberCounts[team.id]?.players || 0}
                                      </span>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                 {/* RENDER ACTIONS (Desktop Mode) */}
                                 {renderTeamActions(team, false)}
                              </td>
                          </tr>
                          ))
                      )}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* MODAL: Create Team */}
          {isCreateModalOpen && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg w-full max-w-md border border-slate-200 dark:border-zinc-700 shadow-2xl">
                  <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Create New Team</h2>
                  {createError && <p className="text-red-600 dark:text-red-400 text-sm mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {createError}</p>}
                  <form onSubmit={handleCreateTeam} className="space-y-4">
                      <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team Name (e.g., The Mighty Ducks)" className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500" required />
                      <input value={newTeamId} onChange={(e) => setNewTeamId(e.target.value)} placeholder="Team ID (e.g. LIONS24)" className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500" required />
                      <p className="text-xs text-slate-500">The ID must be unique and is used for parent registration.</p>
                      <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
                          <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                          <button type="submit" className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-lg shadow-orange-900/20">Create</button>
                      </div>
                  </form>
              </div>
              </div>
          )}

          {/* MODAL: Edit Team */}
          {isEditModalOpen && selectedTeam && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg w-full max-w-md border border-slate-200 dark:border-zinc-700 shadow-2xl">
                  <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Edit Team</h2>
                  <form onSubmit={handleUpdateTeam} className="space-y-4">
                      {/* Team Name */}
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Team Name</label>
                          <input 
                              value={editTeamName} 
                              onChange={(e) => setEditTeamName(e.target.value)} 
                              className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500" 
                              required 
                          />
                      </div>
                      
                      {/* Team ID (Read-only) */}
                      <p className="text-sm text-slate-500 dark:text-slate-500">Team ID: <span className="font-mono">{selectedTeam.id}</span> (cannot be changed)</p>
                      
                      {/* Coach Assignment */}
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned Coach</label>
                          <select
                              value={editCoachId || ''}
                              onChange={(e) => setEditCoachId(e.target.value || null)}
                              className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                          >
                              <option value="">— No Coach (Unassigned) —</option>
                              {availableCoaches.map(coach => (
                                  <option key={coach.id} value={coach.id}>
                                      {coach.name}
                                      {coach.currentTeamId && coach.currentTeamId !== selectedTeam.id 
                                          ? ` (currently on ${teams.find(t => t.id === coach.currentTeamId)?.name || coach.currentTeamId})` 
                                          : coach.currentTeamId === selectedTeam.id 
                                              ? ' (current)' 
                                              : ''}
                                  </option>
                              ))}
                          </select>
                          {editCoachId !== selectedTeam.coachId && (
                              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded text-sm">
                                  {!editCoachId ? (
                                      <p className="text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                          <UserX className="w-4 h-4" /> Coach will be unassigned from this team
                                      </p>
                                  ) : (
                                      <p className="text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                          <UserCheck className="w-4 h-4" /> 
                                          {availableCoaches.find(c => c.id === editCoachId)?.currentTeamId 
                                              ? `Coach will be reassigned from ${teams.find(t => t.id === availableCoaches.find(c => c.id === editCoachId)?.currentTeamId)?.name || 'another team'}` 
                                              : 'Coach will be assigned to this team'}
                                      </p>
                                  )}
                              </div>
                          )}
                      </div>
                      
                      {/* Head Coach Designation */}
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Head Coach
                            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">(can manage other coaches)</span>
                          </label>
                          <select
                              value={editHeadCoachId || ''}
                              onChange={(e) => setEditHeadCoachId(e.target.value || null)}
                              className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                          >
                              <option value="">— No Head Coach Designated —</option>
                              {teamCoaches.map(coach => (
                                  <option key={coach.id} value={coach.id}>
                                      {coach.name}
                                      {selectedTeam.headCoachId === coach.id ? ' (current head coach)' : ''}
                                  </option>
                              ))}
                          </select>
                          {teamCoaches.length === 0 && (
                              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                  No coaches currently assigned to this team. Assign coaches first to designate a head coach.
                              </p>
                          )}
                          {editHeadCoachId !== (selectedTeam.headCoachId || null) && editHeadCoachId && (
                              <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded text-sm">
                                  <p className="text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                      <Shield className="w-4 h-4" /> 
                                      {teamCoaches.find(c => c.id === editHeadCoachId)?.name} will be designated as Head Coach and can remove other coaches from the team.
                                  </p>
                              </div>
                          )}
                      </div>
                      
                      <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
                          <button 
                              type="button" 
                              onClick={() => setEditModalOpen(false)} 
                              disabled={isSaving}
                              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                              Cancel
                          </button>
                          <button 
                              type="submit" 
                              disabled={isSaving}
                              className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-lg shadow-orange-900/20 disabled:opacity-50 flex items-center gap-2"
                          >
                              {isSaving ? 'Saving...' : <><Check className="w-4 h-4" /> Save Changes</>}
                          </button>
                      </div>
                  </form>
              </div>
              </div>
          )}

          {/* MODAL: View Details */}
          {isViewModalOpen && selectedTeam && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-200 dark:border-zinc-700 shadow-2xl">
                  <h2 className="text-2xl font-bold mb-4 capitalize text-slate-900 dark:text-white">Viewing {modalContent} for {selectedTeam.name}</h2>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                      {renderModalContent()}
                  </div>
                  <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
                      <button type="button" onClick={() => setViewModalOpen(false)} className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold">Close</button>
                  </div>
              </div>
              </div>
          )}

          {/* MODAL: Delete Team Confirmation */}
          {isDeleteTeamModalOpen && selectedTeam && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                  <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg w-full max-w-md border border-red-300 dark:border-red-800 shadow-2xl">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                          </div>
                          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Delete Team</h2>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mb-2">
                          Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{selectedTeam.name}</span>?
                      </p>
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-3 mb-4">
                          <p className="text-sm text-red-700 dark:text-red-400 font-medium">⚠️ This action will permanently:</p>
                          <ul className="text-sm text-red-600 dark:text-red-300 mt-2 space-y-1 ml-4 list-disc">
                              <li>Delete all players in the roster</li>
                              <li>Delete all bulletin posts</li>
                              <li>Delete all chat messages</li>
                              <li>Unlink all associated users</li>
                          </ul>
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                          <button
                              type="button"
                              onClick={() => { setDeleteTeamModalOpen(false); setSelectedTeam(null); }}
                              disabled={isDeleting}
                              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                              Cancel
                          </button>
                          <button
                              type="button"
                              onClick={handleDeleteTeam}
                              disabled={isDeleting}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-50"
                          >
                              {isDeleting ? (
                                  <>Deleting...</>
                              ) : (
                                  <><Trash2 className="w-4 h-4" /> Delete Team</>
                              )}
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* MODAL: Delete Item Confirmation */}
          {isDeleteItemModalOpen && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                  <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg w-full max-w-sm border border-red-300 dark:border-red-800 shadow-2xl">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                          </div>
                          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Delete {modalContent === 'roster' ? 'Player' : modalContent === 'posts' ? 'Post' : 'Message'}?</h2>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                          This action cannot be undone.
                      </p>
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                          <button
                              type="button"
                              onClick={() => { setDeleteItemModalOpen(false); setItemToDelete(null); }}
                              disabled={isDeleting}
                              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                              Cancel
                          </button>
                          <button
                              type="button"
                              onClick={handleDeleteItem}
                              disabled={isDeleting}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-50"
                          >
                              {isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </div>
    );
};

export default ManageTeams;