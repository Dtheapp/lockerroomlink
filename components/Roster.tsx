import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Player, UserProfile } from '../types';
import { Plus, Trash2, Shield, Sword, AlertCircle, Phone, Link, User } from 'lucide-react';

const Roster: React.FC = () => {
  const { userData, teamData } = useAuth();
  const [roster, setRoster] = useState<Player[]>([]);
  const [parents, setParents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // PERMISSION CHECK: Are you Staff? (Coach or Admin)
  const isStaff = userData?.role === 'Coach' || userData?.role === 'SuperAdmin' || userData?.role === 'Admin';

  // MODALS
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [viewMedical, setViewMedical] = useState<Player | null>(null);
  const [viewContact, setViewContact] = useState<UserProfile | null>(null);
  
  // FORMS
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: '', td: '0', tkl: '0', dob: '' });
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');

  useEffect(() => {
    if (!teamData?.id) return;
    setLoading(true);

    const q = query(collection(db, 'teams', teamData.id, 'players'), orderBy('number'));
    const unsubRoster = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setRoster(playersData);
      setLoading(false);
    });

    const fetchParents = async () => {
        const pSnapshot = await getDocs(collection(db, 'users'));
        const pData = pSnapshot.docs
            .map(d => ({uid: d.id, ...d.data()} as UserProfile))
            .filter(u => u.role === 'Parent' && u.teamId === teamData.id);
        setParents(pData);
    }
    fetchParents();

    return () => unsubRoster();
  }, [teamData?.id]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamData?.id) return;

    try {
      await addDoc(collection(db, 'teams', teamData.id, 'players'), {
        name: newPlayer.name,
        number: parseInt(newPlayer.number, 10),
        position: newPlayer.position,
        dob: newPlayer.dob,
        stats: {
          td: parseInt(newPlayer.td, 10),
          tkl: parseInt(newPlayer.tkl, 10),
        },
        medical: { allergies: 'None', conditions: 'None', medications: 'None', bloodType: '' } 
      });
      setNewPlayer({ name: '', number: '', position: '', td: '0', tkl: '0', dob: '' });
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error adding player:", error);
    }
  };
  
  const handleLinkParent = async () => {
      if (!teamData?.id || !selectedPlayerId || !selectedParentId) return;
      try {
          const playerRef = doc(db, 'teams', teamData.id, 'players', selectedPlayerId);
          await updateDoc(playerRef, { parentId: selectedParentId });
          setIsLinkModalOpen(false);
          setSelectedPlayerId(''); setSelectedParentId('');
      } catch (error) {
          console.error("Link failed:", error);
      }
  }

  const handleDeletePlayer = async (playerId: string) => {
    if (!teamData?.id || !window.confirm("Are you sure you want to delete this player?")) return;
    try {
      await deleteDoc(doc(db, 'teams', teamData.id, 'players', playerId));
    } catch (error) {
      console.error("Error deleting player:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewPlayer(prev => ({ ...prev, [name]: value }));
  };

  const getParentInfo = (parentId?: string) => {
      return parents.find(p => p.uid === parentId);
  }

  const openContact = (parentId?: string) => {
      const parent = getParentInfo(parentId);
      if (parent) setViewContact(parent);
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Team Roster</h1>
        {isStaff && (
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors">
            <Plus className="w-5 h-5" />
            Add Player
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400">Loading roster...</p>
      ) : roster.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {roster.map(player => {
            const hasMedicalAlert = player.medical && (player.medical.allergies !== 'None' || player.medical.conditions !== 'None');
            const parent = getParentInfo(player.parentId);

            return (
                <div key={player.id} className="bg-slate-900 rounded-lg p-4 flex flex-col relative overflow-hidden border border-slate-700 shadow-lg">
                
                {/* HEADER */}
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-800 rounded-full h-12 w-12 flex items-center justify-center text-xl font-bold text-white border border-slate-600">
                        {player.number}
                    </div>
                    <div className="flex gap-2">
                        {/* MEDICAL ALERT BUTTON - Visible to ALL (Safety) */}
                        {hasMedicalAlert && (
                            <button onClick={() => setViewMedical(player)} className="text-red-500 hover:text-red-400 bg-red-900/20 p-1.5 rounded-full animate-pulse">
                                <AlertCircle className="w-5 h-5" />
                            </button>
                        )}
                        
                        {/* CONTACT BUTTON - RESTRICTED TO STAFF */}
                        {parent && isStaff && (
                            <button onClick={() => openContact(player.parentId)} className="text-sky-500 hover:text-sky-400 bg-sky-900/20 p-1.5 rounded-full">
                                <Phone className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-white truncate">{player.name}</h3>
                    <p className="text-sky-400 font-medium">{player.position}</p>
                    <p className="text-xs text-slate-500 mt-1">DOB: {player.dob || '--'}</p>
                </div>

                {/* STATS */}
                <div className="flex justify-center gap-4 mt-auto mb-4 bg-slate-950/50 p-2 rounded-lg">
                    <div className="flex items-center gap-1 text-sm text-slate-300">
                        <Sword className="w-4 h-4 text-red-500" /> 
                        <span className="font-bold">{player.stats.td}</span> TD
                    </div>
                    <div className="flex items-center gap-1 text-sm text-slate-300">
                        <Shield className="w-4 h-4 text-blue-500" /> 
                        <span className="font-bold">{player.stats.tkl}</span> TKL
                    </div>
                </div>

                {/* COACH ACTIONS */}
                {isStaff && (
                    <div className="flex justify-between items-center border-t border-slate-800 pt-3 mt-2">
                        {!player.parentId ? (
                            <button 
                                onClick={() => { setSelectedPlayerId(player.id); setIsLinkModalOpen(true); }}
                                className="text-xs flex items-center gap-1 text-slate-400 hover:text-white"
                            >
                                <Link className="w-3 h-3" /> Link Parent
                            </button>
                        ) : (
                            <span className="text-xs text-emerald-500 flex items-center gap-1">
                                <User className="w-3 h-3"/> {parent?.name || 'Linked'}
                            </span>
                        )}
                        
                        <button onClick={() => handleDeletePlayer(player.id)} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> Remove
                        </button>
                    </div>
                )}
                </div>
            );
          })}
        </div>
      ) : (
        <p className="text-slate-400 text-center py-8">No players on the roster yet.</p>
      )}

      {/* --- MODALS --- */}

      {/* ADD PLAYER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 p-6 rounded-lg w-full max-w-md border border-slate-700">
            <h2 className="text-2xl font-bold mb-4 text-white">Add New Player</h2>
            <form onSubmit={handleAddPlayer} className="space-y-4">
              <input name="name" value={newPlayer.name} onChange={handleInputChange} placeholder="Name" className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white" required />
              <div className="grid grid-cols-2 gap-4">
                <input name="number" type="number" value={newPlayer.number} onChange={handleInputChange} placeholder="Number" className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white" required />
                <input name="position" value={newPlayer.position} onChange={handleInputChange} placeholder="Position" className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white" required />
              </div>
              <div>
                  <label className="block text-xs text-slate-400 mb-1">Date of Birth</label>
                  <input name="dob" type="date" value={newPlayer.dob} onChange={handleInputChange} className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input name="td" type="number" value={newPlayer.td} onChange={handleInputChange} placeholder="Touchdowns" className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white" />
                <input name="tkl" type="number" value={newPlayer.tkl} onChange={handleInputChange} placeholder="Tackles" className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white" />
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-700 text-white">Add Player</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LINK PARENT MODAL */}
      {isLinkModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 p-6 rounded-lg w-full max-w-sm border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">Link Parent</h3>
                <select 
                    className="w-full bg-slate-800 p-2 rounded border border-slate-700 text-white mb-4"
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    value={selectedParentId}
                >
                    <option value="">-- Select Parent --</option>
                    {parents.map(p => (
                        <option key={p.uid} value={p.uid}>{p.name} ({p.username})</option>
                    ))}
                </select>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={handleLinkParent} className="bg-sky-600 text-white px-4 py-2 rounded">Link</button>
                </div>
            </div>
          </div>
      )}

      {/* MEDICAL VIEW MODAL */}
      {viewMedical && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-slate-900 p-6 rounded-xl w-full max-w-md border border-red-900/50 relative">
                  <button onClick={() => setViewMedical(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><Plus className="rotate-45 w-6 h-6"/></button>
                  <div className="flex items-center gap-3 mb-6 text-red-500">
                      <AlertCircle className="w-8 h-8" />
                      <h2 className="text-2xl font-bold">Medical Alert</h2>
                  </div>
                  
                  <div className="space-y-4 text-white">
                      <div>
                          <label className="text-xs text-red-400 uppercase font-bold">Allergies</label>
                          <p className="bg-red-900/20 p-2 rounded border border-red-900/30">{viewMedical.medical?.allergies}</p>
                      </div>
                      <div>
                          <label className="text-xs text-red-400 uppercase font-bold">Conditions</label>
                          <p className="bg-red-900/20 p-2 rounded border border-red-900/30">{viewMedical.medical?.conditions}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs text-slate-500 uppercase font-bold">Medications</label>
                              <p className="text-sm">{viewMedical.medical?.medications}</p>
                          </div>
                          <div>
                              <label className="text-xs text-slate-500 uppercase font-bold">Blood Type</label>
                              <p className="text-sm">{viewMedical.medical?.bloodType || '--'}</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* CONTACT VIEW MODAL */}
      {viewContact && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-slate-900 p-6 rounded-xl w-full max-w-md border border-sky-900/50 relative">
                  <button onClick={() => setViewContact(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><Plus className="rotate-45 w-6 h-6"/></button>
                  <div className="flex items-center gap-3 mb-6 text-sky-500">
                      <Phone className="w-8 h-8" />
                      <h2 className="text-2xl font-bold">Parent Contact</h2>
                  </div>
                  
                  <div className="space-y-4 text-white">
                      <div className="text-center mb-6">
                          <h3 className="text-xl font-bold">{viewContact.name}</h3>
                          <p className="text-slate-400">{viewContact.email}</p>
                      </div>
                      
                      <div className="bg-slate-800 p-4 rounded-lg flex items-center gap-4">
                          <Phone className="text-sky-400"/>
                          <div>
                              <label className="text-xs text-slate-500 uppercase">Mobile</label>
                              <p className="text-lg font-mono">{viewContact.phone || 'No number'}</p>
                          </div>
                      </div>

                      {viewContact.secondaryPhone && (
                          <div className="bg-slate-800 p-4 rounded-lg flex items-center gap-4">
                              <Phone className="text-slate-400"/>
                              <div>
                                  <label className="text-xs text-slate-500 uppercase">Secondary</label>
                                  <p className="text-lg font-mono">{viewContact.secondaryPhone}</p>
                              </div>
                          </div>
                      )}

                      {viewContact.emergencyContact?.name && (
                          <div className="mt-4 border-t border-slate-700 pt-4">
                              <label className="text-xs text-red-400 uppercase font-bold mb-2 block">Emergency Contact</label>
                              <div className="bg-red-900/10 p-3 rounded border border-red-900/30">
                                  <p className="font-bold text-red-200">{viewContact.emergencyContact.name} ({viewContact.emergencyContact.relation})</p>
                                  <p className="font-mono text-red-300">{viewContact.emergencyContact.phone}</p>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Roster;