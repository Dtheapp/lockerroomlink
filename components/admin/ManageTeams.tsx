import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc, query, orderBy, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team, BulletinPost, Player, Message, UserProfile } from '../../types';
import { Plus, Trash2, Edit2, Users, FileText, MessageCircle } from 'lucide-react'; // <--- Added Icons

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
    // 1. Fetch Teams
    const teamsUnsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData);
    });

    // 2. Fetch Coaches for Lookup
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
  
  // Fetch details for View Modal
  useEffect(() => {
    if (!isViewModalOpen || !selectedTeam) return;

    let q;
    if (modalContent === 'roster') {
      q = query(collection(db, 'teams', selectedTeam.id, 'players'), orderBy('name'));
    } else if (modalContent === 'posts') {
      q = query(collection(db, 'teams', selectedTeam.id, 'bulletin'), orderBy('timestamp', 'desc'));
    } else { // chat
      q = query(collection(db, 'teams', selectedTeam.id, 'messages'), orderBy('timestamp', 'asc'));
    }
    
    const unsub = onSnapshot(q, (snapshot) => {
      setModalData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
    });

    return () => unsub();

  }, [isViewModalOpen, selectedTeam, modalContent]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    
    if (!newTeamName.trim() || !newTeamId.trim()) {
        setCreateError("Name and Team ID are required.");
        return;
    }

    try {
      const docRef = doc(db, 'teams', newTeamId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
          setCreateError("Team ID already taken. Choose another.");
          return;
      }

      await setDoc(docRef, { 
          name: newTeamName, 
          coachId: null 
      });

      setNewTeamName('');
      setNewTeamId('');
      setCreateModalOpen(false);
    } catch (error) {
      console.error("Error creating team:", error);
      setCreateError("Failed to create team.");
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTeam || !editTeamName.trim()) return;

      try {
          const teamRef = doc(db, 'teams', selectedTeam.id);
          await updateDoc(teamRef, { name: editTeamName });
          setEditModalOpen(false);
          setSelectedTeam(null);
      } catch (error) {
          console.error("Error updating team:", error);
          alert("Failed to update team name.");
      }
  }

  const openEditModal = (team: Team) => {
      setSelectedTeam(team);
      setEditTeamName(team.name);
      setEditModalOpen(true);
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm("Are you sure? This will delete the team and all its data.")) return;
    try {
      await deleteDoc(doc(db, 'teams', teamId));
    } catch (error) {
      console.error("Error deleting team:", error);
    }
  };
  
  const openViewModal = (team: Team, contentType: ModalContent) => {
    setSelectedTeam(team);
    setModalContent(contentType);
    setViewModalOpen(true);
  }

  const handleDeleteSubcollectionItem = async (itemId: string) => {
      if (!selectedTeam || !window.confirm("Delete this item permanently?")) return;
      const collectionName = modalContent === 'roster' ? 'players' : modalContent === 'posts' ? 'bulletin' : 'messages';
      try {
        await deleteDoc(doc(db, 'teams', selectedTeam.id, collectionName, itemId));
      } catch (error) {
          console.error("Error deleting item: ", error);
      }
  }

  const renderModalContent = () => {
      if(modalData.length === 0) return <p className="text-slate-400">No content found.</p>
      switch(modalContent) {
          case 'roster':
              return (modalData as Player[]).map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2 bg-slate-800 rounded">
                      <span>#{p.number} - {p.name} ({p.position})</span>
                      <button onClick={() => handleDeleteSubcollectionItem(p.id)}><Trash2 className="w-4 h-4 text-red-500"/></button>
                  </div>
              ));
          case 'posts':
              return (modalData as BulletinPost[]).map(p => (
                  <div key={p.id} className="p-2 bg-slate-800 rounded">
                      <p>{p.text} <span className="text-xs text-slate-400">- {p.author}</span></p>
                      <button onClick={() => handleDeleteSubcollectionItem(p.id)} className="float-right -mt-6"><Trash2 className="w-4 h-4 text-red-500"/></button>
                  </div>
              ));
          case 'chat':
              return (modalData as Message[]).map(m => (
                  <div key={m.id} className="p-2 bg-slate-800 rounded">
                      <p>{m.text} <span className="text-xs text-slate-400">- {m.sender.name}</span></p>
                      <button onClick={() => handleDeleteSubcollectionItem(m.id)} className="float-right -mt-6"><Trash2 className="w-4 h-4 text-red-500"/></button>
                  </div>
              ));
          default: return null;
      }
  }

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white">Manage Teams</h1>
            <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors">
                <Plus className="w-5 h-5" />
                Create Team
            </button>
        </div>
        <div className="bg-slate-900 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                    <tr>
                        <th scope="col" className="px-6 py-3">Team Name</th>
                        <th scope="col" className="px-6 py-3">Team ID</th>
                        <th scope="col" className="px-6 py-3 text-sky-400">Coach (Username)</th>
                        <th scope="col" className="px-6 py-3 text-right">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading ? (
                        <tr><td colSpan={4} className="text-center p-4">Loading teams...</td></tr>
                    ) : (
                        teams.map(team => (
                        <tr key={team.id} className="bg-slate-900 border-b border-slate-800 hover:bg-slate-850">
                            <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{team.name}</td>
                            <td className="px-6 py-4 font-mono">{team.id}</td>
                            <td className="px-6 py-4 font-mono text-sky-400">
                                {team.coachId ? (coachLookup[team.coachId] || team.coachId) : 'Unassigned'}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <div className="flex justify-end items-center gap-2">
                                   
                                   {/* EDIT BUTTON */}
                                   <button onClick={() => openEditModal(team)} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-xs font-medium border border-slate-700">
                                       <Edit2 className="w-3 h-3" /> Edit
                                   </button>

                                   {/* VIEW ACTIONS (ROSTER, POSTS, CHAT) */}
                                   <button onClick={() => openViewModal(team, 'roster')} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-sky-900/30 text-sky-400 hover:bg-sky-900/50 hover:text-white transition-colors text-xs font-medium border border-sky-800/50">
                                       <Users className="w-3 h-3" /> Roster
                                   </button>
                                   <button onClick={() => openViewModal(team, 'posts')} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-sky-900/30 text-sky-400 hover:bg-sky-900/50 hover:text-white transition-colors text-xs font-medium border border-sky-800/50">
                                       <FileText className="w-3 h-3" /> Posts
                                   </button>
                                   <button onClick={() => openViewModal(team, 'chat')} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-sky-900/30 text-sky-400 hover:bg-sky-900/50 hover:text-white transition-colors text-xs font-medium border border-sky-800/50">
                                       <MessageCircle className="w-3 h-3" /> Chat
                                   </button>

                                   {/* DELETE BUTTON */}
                                   <button onClick={() => handleDeleteTeam(team.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-white transition-colors text-xs font-medium border border-red-800/50 ml-2">
                                       <Trash2 className="w-3 h-3" /> Delete
                                   </button>
                               </div>
                            </td>
                        </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* CREATE MODAL */}
        {isCreateModalOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 p-6 rounded-lg w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Create New Team</h2>
                {createError && <p className="text-red-400 text-sm mb-2">{createError}</p>}
                
                <form onSubmit={handleCreateTeam} className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 uppercase">Team Name</label>
                        <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g. Westside Tigers" className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white" required />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 uppercase">Custom Team ID</label>
                        <input value={newTeamId} onChange={(e) => setNewTeamId(e.target.value)} placeholder="e.g. TIGERS24" className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white font-mono" required />
                        <p className="text-xs text-slate-500 mt-1">Parents will use this ID to join.</p>
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-700 text-white">Create</button>
                    </div>
                </form>
            </div>
            </div>
        )}

        {/* EDIT NAME MODAL */}
        {isEditModalOpen && selectedTeam && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 p-6 rounded-lg w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Edit Team Name</h2>
                <form onSubmit={handleUpdateTeam} className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 uppercase">Team Name</label>
                        <input value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white" required />
                    </div>
                    <div className="bg-slate-800 p-3 rounded text-sm text-slate-400">
                        <p className="mb-2"><span className="text-white font-bold">Effect:</span> This will instantly update the Team Name on all Coach and Parent dashboards.</p>
                        <p><span className="text-white font-bold">Safe:</span> The Team ID (Join Code: <span className="font-mono text-sky-400">{selectedTeam.id}</span>) will NOT change.</p>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-700 text-white">Save Changes</button>
                    </div>
                </form>
            </div>
            </div>
        )}

        {/* VIEW MODAL */}
        {isViewModalOpen && selectedTeam && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 p-6 rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
                <h2 className="text-2xl font-bold mb-4 capitalize">Viewing {modalContent} for {selectedTeam.name}</h2>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {renderModalContent()}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button type="button" onClick={() => setViewModalOpen(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Close</button>
                </div>
            </div>
            </div>
        )}
    </div>
  );
};

export default ManageTeams;