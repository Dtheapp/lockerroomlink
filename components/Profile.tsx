import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
// ADDED: Droplet, CheckCircle
import { User, Phone, Mail, Edit2, Save, X, MapPin, HeartPulse, Plus, Shield, Activity, AlertCircle, Pill, Droplet, CheckCircle } from 'lucide-react';
import type { Player, MedicalInfo } from '../types';

const Profile: React.FC = () => {
  const { user, userData, teamData } = useAuth();
  
  // PARENT PROFILE STATES
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');
  const [emergRelation, setEmergRelation] = useState('');

  // ATHLETE STATES
  const [myAthletes, setMyAthletes] = useState<Player[]>([]);
  const [isAddAthleteOpen, setIsAddAthleteOpen] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<Player | null>(null);
  const [isMedicalOpen, setIsMedicalOpen] = useState(false);

  // New Athlete Form
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerPos, setNewPlayerPos] = useState('');
  const [newPlayerDob, setNewPlayerDob] = useState('');

  // Medical Form
  const [medAllergies, setMedAllergies] = useState('');
  const [medConditions, setMedConditions] = useState('');
  const [medMeds, setMedMeds] = useState('');
  const [medBlood, setMedBlood] = useState('');

  // 1. Load Parent Data
  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setPhone(userData.phone || '');
      setSecondaryPhone(userData.secondaryPhone || '');
      setAddress(userData.address || '');
      if (userData.emergencyContact) {
          setEmergName(userData.emergencyContact.name || '');
          setEmergPhone(userData.emergencyContact.phone || '');
          setEmergRelation(userData.emergencyContact.relation || '');
      }
    }
  }, [userData]);

  // 2. Load My Athletes (Real-time)
  useEffect(() => {
      if (!userData?.teamId || !user) return;

      const q = query(
          collection(db, 'teams', userData.teamId, 'players'), 
          where('parentId', '==', user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
          const players = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
          setMyAthletes(players);
      });

      return () => unsubscribe();
  }, [userData, user]);

  // --- HANDLERS ---

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name, phone, secondaryPhone, address,
        emergencyContact: { name: emergName, phone: emergPhone, relation: emergRelation }
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAthlete = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userData?.teamId || !user) return;
      
      try {
          await addDoc(collection(db, 'teams', userData.teamId, 'players'), {
              name: newPlayerName,
              number: parseInt(newPlayerNumber) || 0,
              position: newPlayerPos,
              dob: newPlayerDob,
              parentId: user.uid,
              stats: { td: 0, tkl: 0 },
              medical: {
                  allergies: 'None',
                  conditions: 'None',
                  medications: 'None',
                  bloodType: ''
              }
          });
          setIsAddAthleteOpen(false);
          setNewPlayerName(''); setNewPlayerNumber(''); setNewPlayerPos(''); setNewPlayerDob('');
      } catch (error) {
          console.error("Error adding athlete:", error);
      }
  };

  const openMedical = (player: Player) => {
      setSelectedAthlete(player);
      setMedAllergies(player.medical?.allergies || '');
      setMedConditions(player.medical?.conditions || '');
      setMedMeds(player.medical?.medications || '');
      setMedBlood(player.medical?.bloodType || '');
      setIsMedicalOpen(true);
  }

  const handleSaveMedical = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedAthlete || !userData?.teamId) return;

      try {
          const playerRef = doc(db, 'teams', userData.teamId, 'players', selectedAthlete.id);
          const medicalData: MedicalInfo = {
              allergies: medAllergies,
              conditions: medConditions,
              medications: medMeds,
              bloodType: medBlood
          };
          
          await updateDoc(playerRef, { medical: medicalData });
          setIsMedicalOpen(false);
          setSelectedAthlete(null);
      } catch (error) {
          console.error("Error saving medical:", error);
      }
  }

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

      <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl shadow-lg dark:shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex flex-col md:flex-row items-center gap-6 border-b border-slate-200 dark:border-slate-800">
            <div className="h-20 w-20 bg-gradient-to-br from-sky-600 to-blue-700 rounded-full flex items-center justify-center text-3xl font-bold text-white">
                {name.charAt(0).toUpperCase()}
            </div>
            <div className="text-center md:text-left">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{userData?.username || 'User'}</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 uppercase tracking-wider">{userData?.role}</span>
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
                {isEditing && (
                    <div className="flex justify-end gap-3 mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                        <button type="button" onClick={() => {setIsEditing(false); /*reset logic*/}} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="h-4 w-4" /> Cancel</button>
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
                  <button onClick={() => setIsAddAthleteOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                      <Plus className="h-4 w-4" /> Add Child
                  </button>
              </div>

              {myAthletes.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
                      <p>You haven't added any athletes yet.</p>
                      <p className="text-sm">Add your child to join the team roster.</p>
                  </div>
              ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                      {myAthletes.map(player => {
                          const blood = player.medical?.bloodType;
                          const allergies = player.medical?.allergies && player.medical.allergies !== 'None' && player.medical.allergies !== '' ? player.medical.allergies : null;
                          const conditions = player.medical?.conditions && player.medical.conditions !== 'None' && player.medical.conditions !== '' ? player.medical.conditions : null;
                          const meds = player.medical?.medications && player.medical.medications !== 'None' && player.medical.medications !== '' ? player.medical.medications : null;
                          
                          // Check if healthy (no issues)
                          const isHealthy = !allergies && !conditions && !meds;

                          return (
                            <div 
                                key={player.id} 
                                onClick={() => openMedical(player)} 
                                className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5 relative group cursor-pointer hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-lg dark:hover:shadow-xl hover:shadow-sky-100 dark:hover:shadow-sky-900/20 transition-all"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{player.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700">#{player.number}</span>
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{player.position}</span>
                                        </div>
                                    </div>
                                    <div className="text-slate-400 dark:text-slate-600 group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors">
                                        <Edit2 className="h-5 w-5" />
                                    </div>
                                </div>
                                
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    <p>DOB: {player.dob || '--'}</p>
                                </div>

                                {/* MEDICAL BADGES ROW */}
                                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                                    {/* 1. Blood Type */}
                                    {blood && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium">
                                            <Droplet className="w-3 h-3" /> {blood}
                                        </div>
                                    )}

                                    {/* 2. Allergies */}
                                    {allergies && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium">
                                            <Shield className="w-3 h-3" /> Allergies
                                        </div>
                                    )}

                                    {/* 3. Conditions */}
                                    {conditions && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                            <Activity className="w-3 h-3" /> Medical
                                        </div>
                                    )}

                                    {/* 4. Meds */}
                                    {meds && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                                            <Pill className="w-3 h-3" /> Meds
                                        </div>
                                    )}

                                    {/* 5. Healthy Fallback */}
                                    {isHealthy && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                                            <CheckCircle className="w-3 h-3" /> Medically Cleared
                                        </div>
                                    )}
                                </div>
                            </div>
                          );
                      })}
                  </div>
              )}
          </div>
      )}

      {/* MODAL: ADD ATHLETE */}
      {isAddAthleteOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-slate-50 dark:bg-zinc-950 w-full max-w-md rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-xl">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Add Athlete</h3>
                  <form onSubmit={handleAddAthlete} className="space-y-4">
                      <input value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} placeholder="Full Name" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" required />
                      <div className="grid grid-cols-2 gap-4">
                          <input type="number" value={newPlayerNumber} onChange={e => setNewPlayerNumber(e.target.value)} placeholder="Jersey #" className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" required />
                          <input value={newPlayerPos} onChange={e => setNewPlayerPos(e.target.value)} placeholder="Position (e.g. QB)" className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" required />
                      </div>
                      <div>
                          <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Date of Birth</label>
                          <input type="date" value={newPlayerDob} onChange={e => setNewPlayerDob(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" required />
                      </div>
                      <div className="flex justify-end gap-3 mt-6">
                          <button type="button" onClick={() => setIsAddAthleteOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">Cancel</button>
                          <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg">Add to Roster</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: MEDICAL INFO */}
      {isMedicalOpen && selectedAthlete && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-slate-50 dark:bg-zinc-950 w-full max-w-lg rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center gap-3 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
                      <div className="bg-red-100 dark:bg-red-500/20 p-3 rounded-full text-red-600 dark:text-red-500"><Activity className="h-6 w-6" /></div>
                      <div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Medical ID</h3>
                          <p className="text-slate-600 dark:text-slate-400 text-sm">{selectedAthlete.name}</p>
                      </div>
                  </div>
                  
                  <form onSubmit={handleSaveMedical} className="space-y-4">
                      {/* BLOOD TYPE ONLY */}
                      <div>
                          <label className="block text-xs text-red-600 dark:text-red-400 mb-1 font-bold">Blood Type</label>
                          <input value={medBlood} onChange={e => setMedBlood(e.target.value)} placeholder="e.g. O+" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" />
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Allergies</label>
                              <textarea rows={2} value={medAllergies} onChange={e => setMedAllergies(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" placeholder="Peanuts, Penicillin..." />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Medical Conditions</label>
                              <textarea rows={2} value={medConditions} onChange={e => setMedConditions(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" placeholder="Asthma, Diabetes..." />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Current Medications</label>
                              <textarea rows={2} value={medMeds} onChange={e => setMedMeds(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white" placeholder="Inhaler before games..." />
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-6">
                          <button type="button" onClick={() => setIsMedicalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">Close</button>
                          <button type="submit" className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white px-6 py-2 rounded-lg shadow-lg dark:shadow-lg shadow-red-200 dark:shadow-red-900/20">Update Medical ID</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
};

export default Profile;