import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc, query, orderBy, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team, BulletinPost, Player, Message, UserProfile } from '../../types';
import { Plus, Trash2, Edit2, Users, FileText, MessageCircle, MoreVertical } from 'lucide-react';

type ModalContent = 'roster' | 'posts' | 'chat';

const ManageTeams: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [coachLookup, setCoachLookup] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  
  // MODAL STATES
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isViewModalOpen, setViewModalOpen] = useState(false);
  
  // FORM STATES
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [createError, setCreateError] = useState('');

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [modalContent, setModalContent] = useState<ModalContent>('roster');
  const [modalData, setModalData] = useState<any[]>([]);

  useEffect(() => {
    const teamsUnsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData);
    });

    const fetchCoaches = async () => {
        const q = query(collection(db, 'users'), where('role', '==', 'Coach'));
        const snapshot = await getDocs(q);
        const lookup: {[key: string]: string} = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data() as UserProfile;
            lookup[doc.id] = data.username || data.name;
        });
        setCoachLookup(lookup);
        setLoading(false);
    };
    
    fetchCoaches();

    return () => teamsUnsub();
  }, []);
  
  // Fetch details logic...
  useEffect(() => {
    if (!isViewModalOpen || !selectedTeam) return;
    
    let unsub: () => void;
    
    if (modalContent === 'roster') {
      // Fetch players from team's subcollection
      const q = query(collection(db, 'teams', selectedTeam.id, 'players'), orderBy('number'));
      unsub = onSnapshot(q, (snapshot) => {
        setModalData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
      });
    } else if (modalContent === 'posts') {
      // Fetch bulletin posts for this team
      const q = query(collection(db, 'teams', selectedTeam.id, 'bulletin'), orderBy('timestamp', 'desc'));
      unsub = onSnapshot(q, (snapshot) => {
        setModalData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
      });
    } else { 
      // Fetch chat messages for this team
      const q = query(collection(db, 'teams', selectedTeam.id, 'messages'), orderBy('timestamp', 'asc'));
      unsub = onSnapshot(q, (snapshot) => {
        setModalData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
      });
    }
    
    return () => unsub();
  }, [isViewModalOpen, selectedTeam, modalContent]);

  // Handlers...
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newTeamName.trim() || !newTeamId.trim()) { setCreateError("Name and Team ID are required."); return; }
    try {
      const docRef = doc(db, 'teams', newTeamId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) { setCreateError("Team ID already taken."); return; }
      await setDoc(docRef, { name: newTeamName, coachId: null });
      setNewTeamName(''); setNewTeamId(''); setCreateModalOpen(false);
    } catch (error) { console.error(error); setCreateError("Failed to create team."); }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTeam || !editTeamName.trim()) return;
      try {
          await updateDoc(doc(db, 'teams', selectedTeam.id), { name: editTeamName });
          setEditModalOpen(false); setSelectedTeam(null);
      } catch (error) { console.error(error); alert("Failed to update."); }
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm("Are you sure? This will delete the team and all its data.")) return;
    try { await deleteDoc(doc(db, 'teams', teamId)); } catch (error) { console.error(error); }
  };
  
  const openEditModal = (team: Team) => { setSelectedTeam(team); setEditTeamName(team.name); setEditModalOpen(true); }
  const openViewModal = (team: Team, contentType: ModalContent) => { setSelectedTeam(team); setModalContent(contentType); setViewModalOpen(true); }
  const handleDeleteItem = async (itemId: string) => {
      if (!selectedTeam || !window.confirm("Delete this item?")) return;
      try {
        const col = modalContent === 'roster' ? 'players' : modalContent === 'posts' ? 'bulletin' : 'messages';
        await deleteDoc(doc(db, 'teams', selectedTeam.id, col, itemId));
      } catch (error) {
        console.error("Error deleting item:", error);
        alert("Failed to delete item.");
      }
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
                className={`flex items-center justify-center gap-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 hover:text-orange-900 dark:hover:text-white transition-colors font-medium border border-orange-300 dark:border-orange-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'p-2 md:px-3 md:py-1.5 text-xs'}`}
           >
               <Users className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
               <span className={isMobile ? 'inline' : 'hidden xl:inline ml-1'}>Roster</span>
           </button>
           
           <button 
                onClick={() => openViewModal(team, 'posts')} 
                className={`flex items-center justify-center gap-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 hover:text-orange-900 dark:hover:text-white transition-colors font-medium border border-orange-300 dark:border-orange-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'p-2 md:px-3 md:py-1.5 text-xs'}`}
           >
               <FileText className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
               <span className={isMobile ? 'inline' : 'hidden xl:inline ml-1'}>Posts</span>
           </button>
           
           <button 
                onClick={() => openViewModal(team, 'chat')} 
                className={`flex items-center justify-center gap-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 hover:text-orange-900 dark:hover:text-white transition-colors font-medium border border-orange-300 dark:border-orange-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'p-2 md:px-3 md:py-1.5 text-xs'}`}
           >
               <MessageCircle className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
               <span className={isMobile ? 'inline' : 'hidden xl:inline ml-1'}>Chat</span>
           </button>

           <button 
                onClick={() => handleDeleteTeam(team.id)} 
                className={`flex items-center justify-center gap-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 hover:text-red-900 dark:hover:text-white transition-colors font-medium border border-red-300 dark:border-red-800/50 ${isMobile ? 'w-full py-2 text-sm mt-2' : 'p-2 md:px-3 md:py-1.5 text-xs ml-2'}`}
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
          <div key={item.id} className="flex justify-between items-center p-3 bg-slate-300 dark:bg-zinc-900 rounded mb-2 hover:bg-slate-400 dark:hover:bg-zinc-800 transition-colors">
              <div className="text-sm flex-1">
                  {/* Smartly figure out what text to show based on content type */}
                  {modalContent === 'roster' && (
                    <div>
                      <span className="text-slate-900 dark:text-white font-bold">#{item.number || '?'} {item.name}</span>
                      <span className="text-xs text-slate-600 dark:text-slate-400 block mt-1">Position: {item.position || 'N/A'}</span>
                    </div>
                  )}
                  {modalContent === 'posts' && (
                    <div>
                      <span className="text-slate-900 dark:text-white font-medium">{item.text}</span>
                      <span className="text-xs text-slate-500 block mt-1">By: {item.author || 'Unknown'}</span>
                    </div>
                  )}
                  {modalContent === 'chat' && (
                    <div>
                      <span className="text-slate-900 dark:text-white">{item.text}</span>
                      <span className="text-xs text-slate-500 block mt-1">From: {item.sender?.name || item.senderName || 'Unknown'}</span>
                    </div>
                  )}
              </div>
              <button 
                onClick={() => handleDeleteItem(item.id)}
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
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Manage Teams</h1>
            <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                <Plus className="w-5 h-5" />
                <span className="hidden md:inline">Create Team</span>
            </button>
        </div>

        {/* --- MOBILE VIEW: CARDS --- */}
        <div className="md:hidden space-y-4">
            {loading ? <p className="text-center text-slate-500 dark:text-slate-400">Loading...</p> : teams.map(team => (
                <div key={team.id} className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-5 shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{team.name}</h3>
                            <p className="text-xs text-slate-500 font-mono">ID: {team.id}</p>
                        </div>
                        <div className="bg-slate-300 dark:bg-zinc-900 px-2 py-1 rounded text-xs text-orange-700 dark:text-orange-400 border border-slate-400 dark:border-zinc-700">
                            {team.coachId ? (coachLookup[team.coachId] || 'Coach') : 'No Coach'}
                        </div>
                    </div>
                    
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
                        <th className="px-6 py-3 text-orange-600 dark:text-orange-400">Coach</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading ? (
                        <tr><td colSpan={4} className="text-center p-4">Loading teams...</td></tr>
                    ) : (
                        teams.map(team => (
                        <tr key={team.id} className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-black">
                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{team.name}</td>
                            <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">{team.id}</td>
                            <td className="px-6 py-4 font-mono text-orange-600 dark:text-orange-400">
                                {team.coachId ? (coachLookup[team.coachId] || team.coachId) : 'Unassigned'}
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

        {/* MODALS (Create, Edit, View) - Reused for both views */}
        {isCreateModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-lg w-full max-w-md border border-slate-200 dark:border-zinc-700">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Create New Team</h2>
                {createError && <p className="text-red-600 dark:text-red-400 text-sm mb-2">{createError}</p>}
                <form onSubmit={handleCreateTeam} className="space-y-4">
                    <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team Name" className="w-full bg-white dark:bg-zinc-900 p-2 rounded border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white" required />
                    <input value={newTeamId} onChange={(e) => setNewTeamId(e.target.value)} placeholder="Team ID (e.g. LIONS24)" className="w-full bg-white dark:bg-zinc-900 p-2 rounded border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white" required />
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 rounded bg-slate-400 dark:bg-zinc-700 hover:bg-slate-500 dark:hover:bg-zinc-600 text-white">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white">Create</button>
                    </div>
                </form>
            </div>
            </div>
        )}

        {isEditModalOpen && selectedTeam && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-lg w-full max-w-md border border-slate-200 dark:border-zinc-700">
                <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Edit Team Name</h2>
                <form onSubmit={handleUpdateTeam} className="space-y-4">
                    <input value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} className="w-full bg-white dark:bg-zinc-900 p-2 rounded border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white" required />
                    <p className="text-sm text-slate-600 dark:text-slate-400">Team ID ({selectedTeam.id}) will not change.</p>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 rounded bg-slate-400 dark:bg-zinc-700 hover:bg-slate-500 dark:hover:bg-zinc-600 text-white">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white">Save</button>
                    </div>
                </form>
            </div>
            </div>
        )}

        {isViewModalOpen && selectedTeam && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-200 dark:border-zinc-700">
                <h2 className="text-2xl font-bold mb-4 capitalize text-slate-900 dark:text-white">Viewing {modalContent}</h2>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {renderModalContent()}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button type="button" onClick={() => setViewModalOpen(false)} className="px-4 py-2 rounded bg-slate-400 dark:bg-zinc-700 hover:bg-slate-500 dark:hover:bg-zinc-600 text-white">Close</button>
                </div>
            </div>
            </div>
        )}
    </div>
  );
};

export default ManageTeams;