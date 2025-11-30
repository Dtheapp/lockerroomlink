import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { UserProfile } from '../../types';
import { Download, Filter, ArrowUp, ArrowDown } from 'lucide-react';

type FilterRole = 'All' | 'Coach' | 'Parent';
type SortOrder = 'asc' | 'desc' | null;

const UserReport: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<FilterRole>('All');
  const [sortTeam, setSortTeam] = useState<SortOrder>(null);
  const [sortRole, setSortRole] = useState<SortOrder>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('role'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(user => user.role !== 'SuperAdmin');
      
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter(user => {
    if (filterRole === 'All') return true;
    return user.role === filterRole;
  });

  // Sort by Team ID and Role
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    // First sort by Role if sortRole is active
    if (sortRole !== null) {
      const roleA = a.role || '';
      const roleB = b.role || '';
      
      if (sortRole === 'asc') {
        const comparison = roleA.localeCompare(roleB);
        if (comparison !== 0) return comparison;
      } else {
        const comparison = roleB.localeCompare(roleA);
        if (comparison !== 0) return comparison;
      }
    }

    // Then sort by Team ID if sortTeam is active
    if (sortTeam !== null) {
      const teamA = a.teamId || '';
      const teamB = b.teamId || '';
      
      if (sortTeam === 'asc') {
        return teamA.localeCompare(teamB);
      } else {
        return teamB.localeCompare(teamA);
      }
    }

    return 0;
  });

  const coachCount = users.filter(u => u.role === 'Coach').length;
  const parentCount = users.filter(u => u.role === 'Parent').length;

  const toggleTeamSort = () => {
    if (sortTeam === null) {
      setSortTeam('asc');
    } else if (sortTeam === 'asc') {
      setSortTeam('desc');
    } else {
      setSortTeam(null);
    }
  };

  const toggleRoleSort = () => {
    if (sortRole === null) {
      setSortRole('asc');
    } else if (sortRole === 'asc') {
      setSortRole('desc');
    } else {
      setSortRole(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Username', 'Team ID', 'Phone', 'Address'];
    const rows = filteredUsers.map(user => [
      user.name,
      user.email || '',
      user.role,
      user.username || '',
      user.teamId || 'Unassigned',
      user.phone || '',
      user.address || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gridironhub-users-${filterRole}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Report</h1>
        
        <div className="flex gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-300 dark:border-slate-700">
            {(['All', 'Coach', 'Parent'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  filterRole === role 
                    ? 'bg-orange-600 text-white shadow-lg' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {role === 'All' ? 'All Users' : role + 's'}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Total Users</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{users.length}</p>
        </div>
        <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Total Coaches</p>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">{coachCount}</p>
        </div>
        <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Total Parents</p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{parentCount}</p>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-slate-50 dark:bg-zinc-950 rounded-lg shadow overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
          <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
            <thead className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3">Name</th>
                <th scope="col" className="px-6 py-3">Email</th>
                <th scope="col" className="px-6 py-3">
                  <button
                    onClick={toggleRoleSort}
                    className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-slate-300 transition-colors group"
                  >
                    Role
                    <div className="flex flex-col gap-1">
                      <ArrowUp
                        className={`w-3 h-3 transition-all text-slate-900 dark:text-white ${
                          sortRole === 'asc' ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'
                        }`}
                        strokeWidth={4}
                      />
                      <ArrowDown
                        className={`w-3 h-3 transition-all text-slate-900 dark:text-white ${
                          sortRole === 'desc' ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'
                        }`}
                        strokeWidth={4}
                      />
                    </div>
                  </button>
                </th>
                <th scope="col" className="px-6 py-3">Username</th>
                <th scope="col" className="px-6 py-3">
                  <button
                    onClick={toggleTeamSort}
                    className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-slate-300 transition-colors group"
                  >
                    Team ID
                    <div className="flex flex-col gap-1">
                      <ArrowUp
                        className={`w-3 h-3 transition-all text-slate-900 dark:text-white ${
                          sortTeam === 'asc' ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'
                        }`}
                        strokeWidth={4}
                      />
                      <ArrowDown
                        className={`w-3 h-3 transition-all text-slate-900 dark:text-white ${
                          sortTeam === 'desc' ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'
                        }`}
                        strokeWidth={4}
                      />
                    </div>
                  </button>
                </th>
                <th scope="col" className="px-6 py-3">Phone</th>
                <th scope="col" className="px-6 py-3">Address</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center p-4 text-slate-700 dark:text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-slate-600 dark:text-slate-500">
                    No {filterRole === 'All' ? 'users' : filterRole.toLowerCase() + 's'} found.
                  </td>
                </tr>
              ) : (
                sortedUsers.map(user => (
                  <tr key={user.uid} className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-400">
                      {user.email || '--'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        user.role === 'Coach' 
                          ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400' 
                          : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sky-600 dark:text-sky-400">
                      {user.username || '--'}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      <span className={user.teamId ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-500'}>
                        {user.teamId || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-400">
                      {user.phone || '--'}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-400">
                      <span className="truncate block max-w-xs" title={user.address}>
                        {user.address || '--'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg dark:shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Report Summary</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-700 dark:text-slate-300">
          <div>
            <p className="font-medium text-slate-900 dark:text-white mb-1">Current Filter</p>
            <p>{filterRole === 'All' ? 'All Users' : `${filterRole}s`} - {filteredUsers.length} records</p>
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white mb-1">System Overview</p>
            <p>Total: {users.length} users ({coachCount} coaches, {parentCount} parents)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserReport;
