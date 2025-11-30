import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { PlayerStats } from '../../types';
import { Edit2, Save, X, Plus, TrendingUp } from 'lucide-react';

const EditableStatsBoard: React.FC = () => {
  const { teamData, userData } = useAuth();
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<PlayerStats>>({});
  const [sortBy, setSortBy] = useState<keyof PlayerStats>('tds');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newStat, setNewStat] = useState({
    playerId: '',
    playerName: '',
    playerNumber: 0,
    gp: 0,
    tds: 0,
    yards: 0,
    rec: 0,
    tackles: 0,
    sacks: 0,
    int: 0,
    ff: 0,
    spts: 0,
  });

  useEffect(() => {
    if (!teamData?.id) return;
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

  const getSortedStats = () => {
    return [...playerStats].sort((a, b) => {
      const aVal = a[sortBy as keyof PlayerStats];
      const bVal = b[sortBy as keyof PlayerStats];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return bVal - aVal;
      }
      return 0;
    });
  };

  const handleEdit = (stat: PlayerStats) => {
    setEditingId(stat.id);
    setEditData(stat);
  };

  const handleSave = async (id: string) => {
    if (!teamData?.id) return;
    try {
      const statRef = doc(db, 'teams', teamData.id, 'playerStats', id);
      await updateDoc(statRef, {
        ...editData,
        updatedAt: serverTimestamp(),
        updatedBy: userData?.uid,
      });
      setEditingId(null);
      setEditData({});
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  };

  const handleAddStat = async () => {
    if (!teamData?.id || !newStat.playerName) {
      setError('Player name is required');
      return;
    }
    try {
      setError(null);
      const docRef = await addDoc(collection(db, 'teams', teamData.id, 'playerStats'), {
        ...newStat,
        teamId: teamData.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: userData?.uid,
      });
      console.log('Stat added successfully:', docRef.id);
      
      // Reset form
      setNewStat({
        playerId: '',
        playerName: '',
        playerNumber: 0,
        gp: 0,
        tds: 0,
        yards: 0,
        rec: 0,
        tackles: 0,
        sacks: 0,
        int: 0,
        ff: 0,
        spts: 0,
      });
      setShowAddForm(false);
    } catch (error: any) {
      console.error('Error adding stat:', error);
      setError(`Error adding stat: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-sky-500" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Player Stats (Editable)</h2>
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
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Player Name *</label>
              <input
                type="text"
                placeholder="Name"
                value={newStat.playerName}
                onChange={(e) => setNewStat({ ...newStat, playerName: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Jersey #</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.playerNumber}
                onChange={(e) => setNewStat({ ...newStat, playerNumber: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">GP</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.gp}
                onChange={(e) => setNewStat({ ...newStat, gp: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">TDS</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.tds}
                onChange={(e) => setNewStat({ ...newStat, tds: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">YARDS</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.yards}
                onChange={(e) => setNewStat({ ...newStat, yards: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">REC</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.rec}
                onChange={(e) => setNewStat({ ...newStat, rec: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">TACKLES</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.tackles}
                onChange={(e) => setNewStat({ ...newStat, tackles: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">SACKS</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.sacks}
                onChange={(e) => setNewStat({ ...newStat, sacks: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">INT</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.int}
                onChange={(e) => setNewStat({ ...newStat, int: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">FF</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.ff}
                onChange={(e) => setNewStat({ ...newStat, ff: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">SPTS</label>
              <input
                type="number"
                placeholder="0"
                value={newStat.spts}
                onChange={(e) => setNewStat({ ...newStat, spts: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleAddStat}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded transition-colors font-semibold"
            >
              Add Stats
            </button>
            <button
              onClick={() => setShowAddForm(false)}
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

      {/* Stats Table */}
      <div className="bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">#</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">NAME</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">GP</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">TDS</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">YARDS</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">REC</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">TACKLES</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">SACKS</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">INT</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">FF</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">SPTS</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-4 text-center text-slate-600 dark:text-slate-400">
                    Loading stats...
                  </td>
                </tr>
              ) : getSortedStats().length > 0 ? (
                getSortedStats().map((stat) => (
                  <tr key={stat.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-bold">
                      {editingId === stat.id ? (
                        <input
                          type="number"
                          value={editData.playerNumber || 0}
                          onChange={(e) => setEditData({ ...editData, playerNumber: parseInt(e.target.value, 10) || 0 })}
                          className="w-12 bg-slate-100 dark:bg-slate-700 p-1 rounded text-slate-900 dark:text-white"
                        />
                      ) : (
                        stat.playerNumber
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                      {editingId === stat.id ? (
                        <input
                          type="text"
                          value={editData.playerName || ''}
                          onChange={(e) => setEditData({ ...editData, playerName: e.target.value })}
                          className="w-full bg-slate-100 dark:bg-slate-700 p-1 rounded text-slate-900 dark:text-white"
                        />
                      ) : (
                        stat.playerName
                      )}
                    </td>
                    {['gp', 'tds', 'yards', 'rec', 'tackles', 'sacks', 'int', 'ff', 'spts'].map((key) => (
                      <td key={key} className="px-4 py-3 text-center">
                        {editingId === stat.id ? (
                          <input
                            type="number"
                            value={editData[key as keyof PlayerStats] || 0}
                            onChange={(e) => setEditData({ ...editData, [key]: parseInt(e.target.value, 10) || 0 })}
                            className="w-16 bg-slate-100 dark:bg-slate-700 p-1 rounded text-slate-900 dark:text-white text-center"
                          />
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300">{stat[key as keyof PlayerStats]}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      {editingId === stat.id ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleSave(stat.id)}
                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 p-1"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(stat)}
                          className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 p-1"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="px-4 py-4 text-center text-slate-600 dark:text-slate-400">
                    No stats recorded yet. Add one to get started.
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
