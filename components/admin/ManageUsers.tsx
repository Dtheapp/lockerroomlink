import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { UserProfile, Team } from '../../types';
import { Trash2, UserPlus, Link } from 'lucide-react'; // Added icons

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  
  // FILTER STATE
  const [filterRole, setFilterRole] = useState<'All' | 'Coach' | 'Parent'>('All');

  // MODAL STATES
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  useEffect(() => {
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile).filter(user => user.role !== 'SuperAdmin');
      setUsers(usersData);
      setLoading(false);
    });

    const fetchTeams = async () => {
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const teamsData = teamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team));
        setTeams(teamsData);
    }
    fetchTeams();

    return () => usersUnsub();
  }, []);

  // COMPUTED FILTER
  const filteredUsers = users.filter(user => {
      if (filterRole === 'All') return true;
      return user.role === filterRole;
  });

  const openAssignModal = (user: UserProfile) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };
  
  const handleAssignTeam = async () => {
    if (!selectedUser || !selectedTeamId) return;
    try {
      const userDocRef = doc(db, 'users', selectedUser.uid);
      const teamDocRef = doc(db, 'teams', selectedTeamId);
      
      await updateDoc(userDocRef, { teamId: selectedTeamId });
      if (selectedUser.role === 'Coach') {
          await updateDoc(teamDocRef, { coachId: selectedUser.uid });
      }

      setIsModalOpen(false);
      setSelectedUser(null);
      setSelectedTeamId('');
    } catch (error) {
      console.error("Error assigning team:", error);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm("Are you sure? This will permanently delete the user.")) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white">Manage Users</h1>
          
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
              {(['All', 'Coach', 'Parent'] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setFilterRole(role)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                        filterRole === role 
                        ? 'bg-sky-600 text-white shadow-lg' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                      {role === 'All' ? 'All Users' : role + 's'}
                      <span className="ml-2 text-xs opacity-60 bg-black/20 px-1.5 py-0.5 rounded-full">
                          {role === 'All' ? users.length : users.filter(u => u.role === role).length}
                      </span>
                  </button>
              ))}
          </div>
      </div>

      <div className="bg-slate-900 rounded-lg shadow overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800">
              <tr>
                <th scope="col" className="px-6 py-3">Name</th>
                <th scope="col" className="px-6 py-3 text-sky-400">Username (ID)</th>
                <th scope="col" className="px-6 py-3">Role</th>
                <th scope="col" className="px-6 py-3">Team ID</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center p-4">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="text-center p-8 text-slate-500">No {filterRole === 'All' ? 'users' : filterRole.toLowerCase() + 's'} found.</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.uid} className="bg-slate-900 border-b border-slate-800 hover:bg-slate-850">
                    <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                        {user.name}
                        {user.role === 'Parent' && <span className="block text-xs text-slate-500 font-normal">{user.email}</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-sky-400">{user.username || '---'}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'Coach' ? 'bg-purple-900/50 text-purple-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                            {user.role}
                        </span>
                    </td>
                    <td className="px-6 py-4 font-mono">{user.teamId || 'Unassigned'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                          {!user.teamId && (
                            <button 
                                onClick={() => openAssignModal(user)} 
                                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-sky-900/30 text-sky-400 hover:bg-sky-900/50 hover:text-white transition-colors text-xs font-medium border border-sky-800/50"
                            >
                              <Link className="w-3 h-3" /> Assign
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteUser(user.uid)} 
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-white transition-colors text-xs font-medium border border-red-800/50"
                          >
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

      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Assign Team to {selectedUser.name}</h2>
            <div className="space-y-4">
               <label htmlFor="team" className="block text-sm font-medium text-slate-300">Select a Team</label>
               <select id="team" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="w-full bg-slate-800 p-2 rounded border border-slate-700">
                  <option value="">-- Choose a team --</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name} ({team.id})</option>
                  ))}
               </select>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Cancel</button>
              <button onClick={handleAssignTeam} className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-700">Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;