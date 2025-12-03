import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Player, UserProfile, Team } from '../types';
import { Plus, Trash2, Shield, Sword, AlertCircle, Phone, Link, User, X, Edit2 } from 'lucide-react';

const Roster: React.FC = () => {
  const { userData, teamData } = useAuth();
  const [roster, setRoster] = useState<Player[]>([]);
  const [parents, setParents] = useState<UserProfile[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isStaff = userData?.role === 'Coach' || userData?.role === 'SuperAdmin';
  const isParent = userData?.role === 'Parent';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [viewMedical, setViewMedical] = useState<Player | null>(null);
  const [viewContact, setViewContact] = useState<UserProfile | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);
  
  const [newPlayer, setNewPlayer] = useState({ 
    name: '', 
    number: '', 
    position: '', 
    td: '0', 
    tkl: '0', 
    dob: '', 
    teamId: '' // NEW: Team selection for parents
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

    const q = query(collection(db, 'teams', teamData.id, 'players'), orderBy('number'));
    const unsubRoster = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, teamId: teamData.id, ...doc.data() } as Player));
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

    return () => unsubRoster();
  }, [teamData?.id, isParent, isStaff]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    try {
      await addDoc(collection(db, 'teams', targetTeamId, 'players'), {
        name: newPlayer.name, 
        number: parseInt(newPlayer.number, 10), 
        position: newPlayer.position, 
        dob: newPlayer.dob,
        teamId: targetTeamId,
        parentId: isParent ? userData?.uid : undefined, // Auto-link to parent
        stats: { td: parseInt(newPlayer.td, 10), tkl: parseInt(newPlayer.tkl, 10) },
        medical: { allergies: 'None', conditions: 'None', medications: 'None', bloodType: '' } 
      });
      setNewPlayer({ name: '', number: '', position: '', td: '0', tkl: '0', dob: '', teamId: '' });
      setIsAddModalOpen(false);
      
      // For parents, reload the AuthContext to pick up the new player
      if (isParent) {
        window.location.reload(); // Simple approach - could be optimized
      }
    } catch (error) { 
      console.error(error);
      alert('Failed to add player. Please try again.');
    }
  };
  
  const handleLinkParent = async () => {
      if (!teamData?.id || !selectedPlayerId || !selectedParentId) return;
      try {
          const playerRef = doc(db, 'teams', teamData.id, 'players', selectedPlayerId);
          await updateDoc(playerRef, { parentId: selectedParentId });
          setIsLinkModalOpen(false);
          setSelectedPlayerId(''); setSelectedParentId('');
      } catch (error) { console.error(error); }
  }

  const handleDeletePlayer = async (playerId: string) => {
    if (!teamData?.id || !window.confirm("Delete player?")) return;
    try { await deleteDoc(doc(db, 'teams', teamData.id, 'players', playerId)); } catch (error) { console.error(error); }
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
    if (!viewContact) return;
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
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Team Roster</h1>
        {(isStaff || isParent) && (
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-500 transition-colors shadow-lg shadow-orange-900/20">
            <Plus className="w-5 h-5" /> {isParent ? 'Add My Player' : 'Add Player'}
          </button>
        )}
      </div>

      {!teamData && isParent ? (
        <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Add your first player to view the team roster</p>
          <button onClick={() => setIsAddModalOpen(true)} className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-500 transition-colors shadow-lg">
            <Plus className="w-5 h-5" /> Add My Player
          </button>
        </div>
      ) : loading ? <p className="text-zinc-500">Loading roster...</p> : roster.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {roster.map(player => {
            const hasMedicalAlert = player.medical && (player.medical.allergies !== 'None' || player.medical.conditions !== 'None');
            const parent = getParentInfo(player.parentId);

            return (
                <div key={player.id} className="bg-slate-50 dark:bg-zinc-950 rounded-xl p-5 flex flex-col relative overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg hover:border-orange-500/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-full h-12 w-12 flex items-center justify-center text-xl font-bold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 font-mono">
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
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white truncate">{player.name}</h3>
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

                    {isStaff && (
                        <div className="flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-2">
                            {!player.parentId ? (
                                <button onClick={() => { setSelectedPlayerId(player.id); setIsLinkModalOpen(true); }} className="text-xs flex items-center gap-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><Link className="w-3 h-3" /> Link Parent</button>
                            ) : (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><User className="w-3 h-3"/> {parent?.name || 'Linked'}</span>
                            )}
                            <button onClick={() => handleDeletePlayer(player.id)} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove</button>
                        </div>
                    )}
                </div>
            );
          })}
        </div>
      ) : <p className="text-zinc-500 text-center py-8">No players yet.</p>}

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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Jersey #</label>
                  <input name="number" type="number" value={newPlayer.number} onChange={handleInputChange} placeholder="12" className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Position</label>
                  <input name="position" value={newPlayer.position} onChange={handleInputChange} placeholder="QB" className="bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date of Birth</label>
                <input name="dob" type="date" value={newPlayer.dob} onChange={handleInputChange} className="w-full bg-zinc-50 dark:bg-black p-3 rounded border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
              </div>
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
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold">Add Player</button>
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
                <button type="button" onClick={() => setIsLinkModalOpen(false)} className="px-4 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">Cancel</button>
                <button onClick={handleLinkParent} disabled={!selectedParentId} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold disabled:opacity-50">Link</button>
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
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4 rotate-45" /> Save
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
    </div>
  );
};

export default Roster;