import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Edit2, Save, X, HeartPulse, Plus, Shield, Activity, Droplet, CheckCircle, Pill, AlertCircle, BarChart3, Eye, Sword, User, Camera, Star, Crown, Ruler, Scale } from 'lucide-react';
import type { Player, MedicalInfo } from '../types';
import PlayerStatsModal from './stats/PlayerStatsModal';

const Profile: React.FC = () => {
  const { user, userData, players: contextPlayers, teamData } = useAuth();
  
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
  
  // Player Stats Modal state
  const [viewStatsPlayer, setViewStatsPlayer] = useState<Player | null>(null);

  // Full Edit Form State (including medical)
  const [editForm, setEditForm] = useState({
    name: '',
    dob: '',
    height: '',
    weight: '',
    shirtSize: '',
    pantSize: '',
    // Medical
    allergies: '',
    conditions: '',
    medications: '',
    bloodType: ''
  });
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  // 2. Load My Athletes from Context (already loaded in AuthContext for parents)
  useEffect(() => {
      if (userData?.role === 'Parent') {
          setMyAthletes(contextPlayers);
      }
  }, [userData, contextPlayers]);

  // --- HANDLERS ---

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name, phone, secondaryPhone, address,
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



  const openEditModal = (player: Player) => {
      setSelectedAthlete(player);
      setEditForm({
        name: player.name || '',
        dob: player.dob || '',
        height: player.height || '',
        weight: player.weight || '',
        shirtSize: player.shirtSize || '',
        pantSize: player.pantSize || '',
        allergies: player.medical?.allergies || '',
        conditions: player.medical?.conditions || '',
        medications: player.medical?.medications || '',
        bloodType: player.medical?.bloodType || ''
      });
      setIsEditModalOpen(true);
  }

  const handleSavePlayer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedAthlete || !selectedAthlete.teamId || savingPlayer) return;

      setSavingPlayer(true);
      try {
          const playerRef = doc(db, 'teams', selectedAthlete.teamId, 'players', selectedAthlete.id);
          const medicalData: MedicalInfo = {
              allergies: editForm.allergies,
              conditions: editForm.conditions,
              medications: editForm.medications,
              bloodType: editForm.bloodType
          };
          
          await updateDoc(playerRef, { 
            name: editForm.name,
            dob: editForm.dob,
            height: editForm.height,
            weight: editForm.weight,
            shirtSize: editForm.shirtSize,
            pantSize: editForm.pantSize,
            medical: medicalData 
          });
          setIsEditModalOpen(false);
          setSelectedAthlete(null);
      } catch (error) {
          console.error("Error saving player:", error);
          alert('Failed to save player information.');
      } finally {
          setSavingPlayer(false);
      }
  }

  // Photo upload handlers
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAthlete || !selectedAthlete.teamId || !e.target.files || e.target.files.length === 0) return;
    
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
      const resizedBase64 = await resizeImage(file, 200, 200);
      const playerRef = doc(db, 'teams', selectedAthlete.teamId, 'players', selectedAthlete.id);
      await updateDoc(playerRef, { photoUrl: resizedBase64 });
      setSelectedAthlete({ ...selectedAthlete, photoUrl: resizedBase64 });
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
      await updateDoc(playerRef, { photoUrl: null });
      setSelectedAthlete({ ...selectedAthlete, photoUrl: undefined });
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
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors">
                <Edit2 className="h-4 w-4" /> Edit
            </button>
        )}
      </div>

      {statusMsg && (
          <div className={`p-4 rounded-lg border ${statusMsg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-red-500/10 border-red-500/20 text-red-600'}`}>
              {statusMsg.text}
          </div>
      )}

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
                        <button type="button" onClick={() => {setIsEditing(false); setName(userData?.name || '');}} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="h-4 w-4" /> Cancel</button>
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
              </div>

              {myAthletes.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-slate-600 dark:text-slate-400 mb-3">You haven't added any athletes yet.</p>
                      <a 
                        href="#/roster" 
                        className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        <Plus className="h-4 w-4" /> Add Your First Player
                      </a>
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

                          return (
                            <div 
                                key={player.id} 
                                className={`bg-slate-50 dark:bg-zinc-950 rounded-xl border p-5 relative overflow-hidden transition-all ${
                                  isStarter 
                                    ? 'border-yellow-400 dark:border-yellow-500 ring-2 ring-yellow-400/50 dark:ring-yellow-500/40 shadow-yellow-400/20 dark:shadow-yellow-500/20' 
                                    : 'border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500'
                                } shadow-lg hover:shadow-xl`}
                                style={isStarter ? { boxShadow: '0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.1)' } : {}}
                            >
                                {/* Starter Badge */}
                                {isStarter && (
                                  <div className="absolute top-2 left-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full px-2.5 py-1 shadow-lg flex items-center gap-1 z-10">
                                    <Star className="w-3 h-3 text-white fill-white" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wide">Starter</span>
                                  </div>
                                )}

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
                                          {player.name}
                                          {isCaptain && <Crown className="w-5 h-5 text-amber-500 flex-shrink-0" />}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs px-2 py-1 rounded font-bold">#{player.number || '?'}</span>
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{player.position || 'TBD'}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">DOB: {player.dob || '--'}</p>
                                    </div>
                                    
                                    {/* Edit Button */}
                                    <button 
                                      onClick={() => openEditModal(player)}
                                      className="flex-shrink-0 p-2 text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                                    >
                                        <Edit2 className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Quick Stats */}
                                <div className="mt-4 flex justify-center gap-4 bg-slate-100 dark:bg-black p-2 rounded-lg">
                                    <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                                        <Sword className="w-3 h-3 text-orange-500" /> <span className="font-bold">{player.stats?.td || 0}</span> TD
                                    </div>
                                    <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                                        <Shield className="w-3 h-3 text-cyan-500" /> <span className="font-bold">{player.stats?.tkl || 0}</span> TKL
                                    </div>
                                </div>

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
                                          <span className="ml-1 font-bold text-slate-900 dark:text-white">{player.weight}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Uniform Sizes */}
                                {(player.shirtSize || player.pantSize) && (
                                  <div className="mt-3 bg-orange-50 dark:bg-orange-900/10 p-2 rounded border border-orange-200 dark:border-orange-900/30">
                                    <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Uniform</p>
                                    <div className="flex justify-around text-xs">
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
                                  className="w-full mt-3 flex items-center justify-center gap-2 text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 py-2.5 rounded-lg border border-orange-200 dark:border-orange-900/30 transition-colors"
                                >
                                  <BarChart3 className="w-4 h-4" /> View Stats History
                                </button>
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
              <div className="bg-slate-50 dark:bg-zinc-950 w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="sticky top-0 bg-slate-50 dark:bg-zinc-950 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="bg-orange-100 dark:bg-orange-500/20 p-2 rounded-full">
                            <Edit2 className="h-5 w-5 text-orange-600 dark:text-orange-500" />
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
                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-orange-500 shadow-lg">
                              <img src={selectedAthlete.photoUrl} alt={selectedAthlete.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-slate-300 dark:border-slate-700 flex items-center justify-center">
                              <User className="w-10 h-10 text-slate-400 dark:text-slate-600" />
                            </div>
                          )}
                          <label className="absolute bottom-0 right-0 bg-orange-600 hover:bg-orange-500 text-white rounded-full p-2 cursor-pointer shadow-lg transition-colors">
                            <Camera className="w-4 h-4" />
                            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                          </label>
                        </div>
                        {uploadingPhoto && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-orange-600">
                            <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
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
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                              <input 
                                value={editForm.name} 
                                onChange={e => setEditForm({...editForm, name: e.target.value})} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                                required
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Date of Birth</label>
                              <input 
                                type="date"
                                value={editForm.dob} 
                                onChange={e => setEditForm({...editForm, dob: e.target.value})} 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                        </div>
                      </div>

                      {/* Physical Info */}
                      <div>
                        <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                          <Ruler className="w-3 h-3" /> Physical Information
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Height</label>
                              <input 
                                value={editForm.height} 
                                onChange={e => setEditForm({...editForm, height: e.target.value})} 
                                placeholder="4 ft 6 in"
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                          <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Weight</label>
                              <input 
                                value={editForm.weight} 
                                onChange={e => setEditForm({...editForm, weight: e.target.value})} 
                                placeholder="85 lbs"
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" 
                              />
                          </div>
                        </div>
                      </div>

                      {/* Uniform Sizes */}
                      <div>
                        <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-3 uppercase tracking-wider">Uniform Sizing</p>
                        <div className="grid grid-cols-2 gap-3">
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
                            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
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

    </div>
  );
};

export default Profile;