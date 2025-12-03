import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile, Team } from '../../types';
import { Trash2, Link, User, Shield, AtSign, Key, AlertTriangle } from 'lucide-react';

const ManageUsers: React.FC = () => {
  const { user } = useAuth(); // Needed to prevent self-deletion
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
    // SECURITY: Filter out SuperAdmins on the client side (Snapshot)
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile).filter(u => u.role !== 'SuperAdmin');
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
  const filteredUsers = users.filter(u => {
      if (filterRole === 'All') return true;
      return u.role === filterRole;
  });

  const openAssignModal = (targetUser: UserProfile) => {
    setSelectedUser(targetUser);
    setIsModalOpen(true);
  };
  
  const handleAssignTeam = async () => {
    if (!selectedUser || !selectedTeamId) return;
    try {
      const userDocRef = doc(db, 'users', selectedUser.uid);
      const newTeamDocRef = doc(db, 'teams', selectedTeamId);
      
      // 1. If Coach, handle "Ghost Coach" cleanup
      if (selectedUser.role === 'Coach') {
          // If they were already assigned to a DIFFERENT team, remove them from that team first
          if (selectedUser.teamId && selectedUser.teamId !== selectedTeamId) {
              const oldTeamRef = doc(db, 'teams', selectedUser.teamId);
              await updateDoc(oldTeamRef, { coachId: null });
          }
          // Set as coach for new team
          await updateDoc(newTeamDocRef, { coachId: selectedUser.uid });
      }

      // 2. Update User Profile
      await updateDoc(userDocRef, { teamId: selectedTeamId });

      setIsModalOpen(false);
      setSelectedUser(null);
      setSelectedTeamId('');
    } catch (error) {
      console.error("Error assigning team:", error);
      alert("Failed to assign team.");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    // SECURITY: Prevent Self-Deletion
    if (uid === user?.uid) {
        alert("You cannot delete your own admin account.");
        return;
    }

    if (!window.confirm("Are you sure? This will permanently delete the user and cannot be undone.")) return;
    
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user.");
    }
  };

  const handleResetPassword = async (email?: string) => {
      if (!email) return;
      if (!window.confirm(`Send password reset email to ${email}?`)) return;
      
      try {
          await sendPasswordResetEmail(auth, email);
          alert(`Reset link sent to ${email}`);
      } catch (error) {
          console.error("Error sending reset email:", error);
          alert("Failed to send reset email.");
      }
  }

  // --- HELPER: RENDER ACTIONS (Responsive) ---
  const renderActions = (targetUser: UserProfile, isMobile = false) => (
      <div className={`flex items-center gap-2 ${isMobile ? 'mt-4 pt-4 border-t border-slate-300 dark:border-zinc-800 w-full' : 'justify-end'}`}>
          {!targetUser.teamId && (
            <button 
                onClick={() => openAssignModal(targetUser)} 
                className={`flex items-center justify-center gap-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors font-medium border border-orange-300 dark:border-orange-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
                title="Assign to a Team"
            >
              <Link className="w-3 h-3" /> Assign
            </button>
          )}
          
          <button 
            onClick={() => handleResetPassword(targetUser.email)}
            className={`flex items-center justify-center gap-1 rounded-md bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors font-medium border border-sky-300 dark:border-sky-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
            title="Send Password Reset Email"
          >
             <Key className="w-3 h-3" /> Reset
          </button>

          <button 
            onClick={() => handleDeleteUser(targetUser.uid)} 
            className={`flex items-center justify-center gap-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium border border-red-300 dark:border-red-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
            title="Delete User"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
      </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Manage Users</h1>
          
          {/* FILTER CONTROLS */}
          <div className="flex flex-wrap bg-slate-50 dark:bg-black p-1 rounded-lg border border-slate-200 dark:border-zinc-700">
              {(['All', 'Coach', 'Parent'] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setFilterRole(role)}
                    className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all ${
                        filterRole === role 
                        ? 'bg-orange-600 text-white shadow-lg' 
                        : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                      {role === 'All' ? 'All' : role + 's'}
                      <span className="ml-2 text-xs opacity-60 bg-black/20 px-1.5 py-0.5 rounded-full">
                          {role === 'All' ? users.length : users.filter(u => u.role === role).length}
                      </span>
                  </button>
              ))}
          </div>
      </div>

      {/* --- MOBILE VIEW: CARDS --- */}
      <div className="md:hidden space-y-4">
          {loading ? <p className="text-center text-slate-500 dark:text-slate-400">Loading users...</p> : 
           filteredUsers.length === 0 ? <p className="text-center text-slate-500 dark:text-slate-400 py-8">No users found.</p> :
           filteredUsers.map(u => (
              <div key={u.uid} className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-5 shadow-lg">
                  <div className="flex justify-between items-start mb-3">
                      <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              {u.name}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-mono mt-1">
                              <AtSign className="w-3 h-3" /> {u.username || 'No Username'}
                          </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${u.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-800' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'}`}>
                          {u.role}
                      </span>
                  </div>

                  <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-2">
                      <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500 dark:text-slate-600" />
                          <span className="truncate">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-slate-500 dark:text-slate-600" />
                          <span className={u.teamId ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-500 italic'}>
                              Team: {u.teamId ? <span className="font-mono bg-slate-200 dark:bg-zinc-900 px-1 rounded">{u.teamId}</span> : 'Unassigned'}
                          </span>
                      </div>
                  </div>

                  {renderActions(u, true)}
              </div>
           ))
          }
      </div>

      {/* --- DESKTOP VIEW: TABLE --- */}
      <div className="hidden md:block bg-slate-50 dark:bg-zinc-950 rounded-lg shadow overflow-hidden border border-slate-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
                        <thead className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-white dark:bg-black">
              <tr>
                <th scope="col" className="px-6 py-3">Name</th>
                <th scope="col" className="px-6 py-3 text-orange-600 dark:text-orange-400">Username (ID)</th>
                <th scope="col" className="px-6 py-3">Role</th>
                <th scope="col" className="px-6 py-3">Team ID</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {loading ? (
                <tr><td colSpan={5} className="text-center p-4">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="text-center p-8 text-slate-500 dark:text-slate-500">No {filterRole === 'All' ? 'users' : filterRole.toLowerCase() + 's'} found.</td></tr>
              ) : (
                filteredUsers.map(u => (
                                <tr key={u.uid} className="bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-black transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {u.name}
                        {u.role === 'Parent' && <span className="block text-xs text-slate-500 font-normal">{u.email}</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-orange-600 dark:text-orange-400">{u.username || '---'}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'}`}>
                            {u.role}
                        </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">{u.teamId || 'Unassigned'}</td>
                    <td className="px-6 py-4 text-right">
                      {renderActions(u, false)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-slate-200 dark:border-zinc-800 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Assign Team to {selectedUser.name}</h2>
            
            {/* Warning for Coaches */}
            {selectedUser.role === 'Coach' && (
                <div className="mb-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg text-sm flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0"/>
                    <p>Assigning a new team will remove this coach from their current team if they have one.</p>
                </div>
            )}

            <div className="space-y-4">
               <label htmlFor="team" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Select a Team</label>
               <select id="team" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="w-full bg-slate-50 dark:bg-black p-3 rounded-lg border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">-- Choose a team --</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name} ({team.id})</option>
                  ))}
               </select>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">Cancel</button>
              <button onClick={handleAssignTeam} disabled={!selectedTeamId} className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20">Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;