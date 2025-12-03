import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { PlayerStats } from '../../types';
import { Edit2, Save, X, Plus, TrendingUp, AlertTriangle } from 'lucide-react';

// Define the interface for the new stat form (subset of PlayerStats)
interface NewStatForm extends Omit<PlayerStats, 'id' | 'teamId' | 'updatedAt' | 'updatedBy' | 'createdAt'> {}

const EditableStatsBoard: React.FC = () => {
  const { teamData, userData } = useAuth();
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<PlayerStats>>({});
  const [sortBy, setSortBy] = useState<keyof PlayerStats>('tds');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for tracking temporary field edits before blur/save
  const [tempEdit, setTempEdit] = useState<any>({});

  // Initial state for the Add Form
  const [newStat, setNewStat] = useState<NewStatForm>({ 
    playerId: '', playerName: '', playerNumber: 0, gp: 0, tds: 0, yards: 0, rec: 0, 
    tackles: 0, sacks: 0, int: 0, ff: 0, spts: 0,
  });

  // --- UTILITY: SANITIZE AND PARSE INPUT ---
  const sanitizeInput = (value: string): number => {
    const cleanValue = value.replace(/[^0-9-]/g, ''); 
    const parsed = parseInt(cleanValue, 10);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  // --- DATA FETCHING ---
  useEffect(() => {
    if (!teamData?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const q = query(
      collection(db, 'teams', teamData.id, 'playerStats'),
      orderBy('tds', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStats));
      setPlayerStats(stats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  // --- SORTING ---
  const getSortedStats = useMemo(() => {
    return [...playerStats].sort((a, b) => {
      const aVal = a[sortBy as keyof PlayerStats];
      const bVal = b[sortBy as keyof PlayerStats];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return bVal - aVal;
      }
      return 0;
    });
  }, [playerStats, sortBy]);

  // --- EDITING LOGIC ---

  const handleEdit = (stat: PlayerStats) => {
    setEditingId(stat.id);
    setEditData({...stat});
  };
  
  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  }

  const handleSave = async (id: string) => {
    if (!teamData?.id) return;
    setError(null);
    
    const dataToSave: any = {};
    Object.keys(editData).forEach((key) => {
        const value = editData[key as keyof PlayerStats];
        if (typeof value === 'number' || key === 'playerName') {
            dataToSave[key] = typeof value === 'number' ? sanitizeInput(String(value)) : value;
        }
    });

    try {
      const statRef = doc(db, 'teams', teamData.id, 'playerStats', id);
      await updateDoc(statRef, {
        ...dataToSave,
        updatedAt: serverTimestamp(),
        updatedBy: userData?.uid,
      });
      handleCancel();
    } catch (error) {
      console.error('Error updating stats:', error);
      setError('Failed to save changes. Check console for details.');
    }
  };

  const handleBlur = async (id: string, key: keyof PlayerStats, value: string) => {
    if (!teamData?.id) return;
    
    let sanitizedValue: number | string = value;
    
    if (key !== 'playerName') {
        sanitizedValue = sanitizeInput(value);
        if (sanitizedValue !== parseFloat(value) && value.trim() !== '') {
             console.warn(`Input stripped to ${sanitizedValue}`);
        }
    }
    
    const originalStat = playerStats.find(s => s.id === id);
    if (originalStat && originalStat[key as keyof PlayerStats] === sanitizedValue) {
        return;
    }

    try {
        const statRef = doc(db, 'teams', teamData.id, 'playerStats', id);
        await updateDoc(statRef, {
            [key]: sanitizedValue,
            updatedAt: serverTimestamp(),
            updatedBy: userData?.uid,
        });
        setTempEdit(prev => ({...prev, [key]: sanitizedValue}));
    } catch (error) {
        console.error(`Error updating field ${key}:`, error);
        setError(`Failed to auto-save ${key}.`);
    }
  };
  
  // --- ADD NEW STAT LOGIC ---
  const handleAddStat = async () => {
    if (!teamData?.id || !newStat.playerName) {
      setError('Player name is required');
      return;
    }
    
    const sanitizedNewStat = {
        ...newStat,
        playerNumber: sanitizeInput(String(newStat.playerNumber)),
        gp: sanitizeInput(String(newStat.gp)),
        tds: sanitizeInput(String(newStat.tds)),
        yards: sanitizeInput(String(newStat.yards)),
        rec: sanitizeInput(String(newStat.rec)),
        tackles: sanitizeInput(String(newStat.tackles)),
        sacks: sanitizeInput(String(newStat.sacks)),
        int: sanitizeInput(String(newStat.int)),
        ff: sanitizeInput(String(newStat.ff)),
        spts: sanitizeInput(String(newStat.spts)),
        playerId: newStat.playerId || 'N/A'
    };

    try {
      setError(null);
      await addDoc(collection(db, 'teams', teamData.id, 'playerStats'), {
        ...sanitizedNewStat,
        teamId: teamData.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: userData?.uid,
      });
      
      setNewStat({
        playerId: '', playerName: '', playerNumber: 0, gp: 0, tds: 0, yards: 0, rec: 0, 
        tackles: 0, sacks: 0, int: 0, ff: 0, spts: 0,
      });
      setShowAddForm(false);
    } catch (error: any) {
      console.error('Error adding stat:', error);
      setError(`Error adding stat: ${error.message}`);
    }
  };

  // Centralized change handler for the ADD FORM
  const handleNewStatChange = (key: keyof NewStatForm, value: string) => {
    // Determine the new value based on type (number or string)
    const newValue = (key !== 'playerName' && key !== 'playerId') 
        ? sanitizeInput(value) 
        : value;

    // FINAL FIX: Using structural type casting to safely handle dynamic key assignment
    setNewStat(prev => {
        // We temporarily treat the previous state as if it allows any string key (which it should, structurally)
        const updated = { ...prev as { [key: string]: any }, [key]: newValue };
        // We cast the resulting object back to the strict NewStatForm, satisfying the compiler
        return updated as NewStatForm;
    });
  };

  // Centralized change handler for the EDIT TABLE (for desktop inline editing)
  const handleEditChange = (key: keyof PlayerStats, value: string) => {
    if (key !== 'playerName') {
        const sanitizedValue = sanitizeInput(value);
        setTempEdit(prev => ({ ...prev, [key]: sanitizedValue }));
        setEditData(prev => ({ ...prev, [key]: sanitizedValue }));
    } else {
        setTempEdit(prev => ({ ...prev, [key]: value }));
        setEditData(prev => ({ ...prev, [key]: value }));
    }
  };

  const statFields: { key: keyof PlayerStats, title: string, color: string }[] = [
    { key: 'gp', title: 'GP', color: 'text-slate-600' },
    { key: 'tds', title: 'TDs', color: 'text-red-600' },
    { key: 'yards', title: 'Yards', color: 'text-sky-600' },
    { key: 'rec', title: 'Rec', color: 'text-slate-600' },
    { key: 'tackles', title: 'Tkls', color: 'text-emerald-600' },
    { key: 'sacks', title: 'Sacks', color: 'text-slate-600' },
    { key: 'int', title: 'INT', color: 'text-purple-600' },
    { key: 'ff', title: 'FF', color: 'text-orange-600' },
    { key: 'spts', title: 'SPTS', color: 'text-slate-600' },
  ];

  const StatInput = ({ stat, field }: { stat: PlayerStats, field: { key: keyof PlayerStats, color: string } }) => {
    const isNumber = field.key !== 'playerName';
    
    const currentValue = (editingId === stat.id && tempEdit[field.key] !== undefined ? tempEdit[field.key] : editData[field.key] !== undefined ? editData[field.key] : stat[field.key]);

    return (
        <input
            key={field.key}
            type={isNumber ? "number" : "text"}
            value={currentValue as string | number || (isNumber ? 0 : '')}
            onChange={(e) => handleEditChange(field.key, e.target.value)}
            onBlur={(e) => handleBlur(stat.id, field.key, e.target.value)}
            className={`w-full bg-slate-100 dark:bg-slate-700 p-1 rounded text-slate-900 dark:text-white text-center text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${field.color} font-medium`}
        />
    );
  };
  

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-sky-500" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Player Stats (Data Entry)</h2>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Player Stats
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add New Player Stats</h3>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 p-3 rounded mb-4 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4"/> {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Player Name *</label>
              <input type="text" placeholder="Name" value={newStat.playerName} onChange={(e) => handleNewStatChange('playerName', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Jersey #</label>
              <input type="number" placeholder="0" value={newStat.playerNumber as number} onChange={(e) => handleNewStatChange('playerNumber', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white text-sm" />
            </div>
            {statFields.map(field => (
                <div key={field.key}>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{field.title}</label>
                    <input 
                        type="number" 
                        placeholder="0" 
                        value={newStat[field.key] as number || 0} 
                        onChange={(e) => handleNewStatChange(field.key as keyof NewStatForm, e.target.value)} 
                        className={`w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white text-sm ${field.color}`}
                    />
                </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
            <button
              onClick={handleAddStat}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded transition-colors font-semibold"
            >
              Add Stats Entry
            </button>
            <button
              onClick={() => { setShowAddForm(false); setError(null); }}
              className="flex-1 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-4 py-2 rounded transition-colors font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sort Dropdown */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">{getSortedStats().length} players</p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as keyof PlayerStats)}
          className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-800"
        >
          <option value="tds">Sort by TDs</option>
          <option value="yards">Sort by Yards</option>
          <option value="tackles">Sort by Tackles</option>
          <option value="rec">Sort by Receptions</option>
          <option value="sacks">Sort by Sacks</option>
          <option value="spts">Sort by Sportsmanship</option>
        </select>
      </div>

      {/* Stats Table / Mobile Cards */}
      <div className="bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl overflow-hidden">
        
        {/* MOBILE EDITING CARDS */}
        <div className="md:hidden divide-y divide-slate-200 dark:divide-zinc-800">
            {getSortedStats().map((stat) => (
                <div key={stat.id} className="p-4 bg-white dark:bg-black space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{stat.playerName}</h3>
                        {editingId !== stat.id && (
                            <button onClick={() => handleEdit(stat)} className="text-sky-600 dark:text-sky-400">
                                <Edit2 className="w-5 h-5"/>
                            </button>
                        )}
                        {editingId === stat.id && (
                            <div className="flex gap-2">
                                <button onClick={() => handleSave(stat.id)} className="text-emerald-600 dark:text-emerald-400">
                                    <Save className="w-5 h-5"/>
                                </button>
                                <button onClick={handleCancel} className="text-red-600 dark:text-red-400">
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {statFields.map(field => (
                            <div key={field.key} className="flex flex-col">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{field.title}</label>
                                {editingId === stat.id ? (
                                    <input
                                        type="number"
                                        value={editData[field.key] as number || 0}
                                        onChange={(e) => handleEditChange(field.key, e.target.value)}
                                        onBlur={(e) => handleBlur(stat.id, field.key, e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-700 p-2 rounded text-slate-900 dark:text-white text-center text-sm"
                                    />
                                ) : (
                                    <span className={`text-lg font-bold ${field.color}`}>{stat[field.key]}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
        
        {/* DESKTOP EDITING TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">#</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">NAME</th>
                {statFields.map(field => (
                    <th key={field.key} className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">{field.title}</th>
                ))}
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {getSortedStats().length > 0 ? (
                getSortedStats().map((stat) => (
                  <tr key={stat.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-bold">{stat.playerNumber}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{stat.playerName}</td>
                    
                    {statFields.map((field) => (
                      <td key={field.key} className="px-4 py-1.5 text-center">
                        {/* Always render StatInput for in-table quick edit */}
                        <StatInput stat={stat} field={field} /> 
                      </td>
                    ))}
                    
                    <td className="px-4 py-3 text-center">
                      {/* Button logic to show save/cancel on mobile card, but just edit on desktop */}
                      <button
                        onClick={() => handleEdit(stat)}
                        className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 p-1"
                        title="Quick Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="px-4 py-4 text-center text-slate-600 dark:text-slate-400">
                    No stats recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EditableStatsBoard;