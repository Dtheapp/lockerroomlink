import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Shield, UserCheck, Users, Clock, User, AtSign, AlertTriangle, 
    TrendingUp, Activity, AlertCircle, ChevronRight, UserX, UsersRound,
    BarChart3, RefreshCw
} from 'lucide-react';
import type { UserProfile, Team } from '../../types';

const AdminDashboard: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({ teams: 0, coaches: 0, parents: 0, totalUsers: 0 });
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // SECURITY CHECK
  useEffect(() => {
      if (userData && userData.role !== 'SuperAdmin') {
          navigate('/');
      }
  }, [userData, navigate]);

  useEffect(() => {
    if (userData?.role !== 'SuperAdmin') return;

    setLoading(true);

    // TEAMS LISTENER
    const teamsUnsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData);
      setStats(prev => ({ ...prev, teams: snapshot.size }));
    }, (err) => {
        console.error("Error fetching teams:", err);
        setError("Failed to load team data.");
    });

    // USERS LISTENER
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      let coaches = 0;
      let parents = 0;
      const allUsers: UserProfile[] = [];

      snapshot.forEach(doc => {
        const data = doc.data() as UserProfile;
        if (data.role === 'Coach') coaches++;
        if (data.role === 'Parent') parents++;
        if (data.role !== 'SuperAdmin') {
            allUsers.push({ ...data, uid: doc.id });
        }
      });

      setUsers(allUsers);
      setStats(prev => ({ ...prev, coaches, parents, totalUsers: allUsers.length }));
      setRecentUsers(allUsers.slice(0, 5)); 
      setLoading(false);
      setLastRefresh(new Date());
    }, (err) => {
        console.error("Error fetching users:", err);
        setError("Failed to load user data.");
    });

    return () => {
      teamsUnsub();
      usersUnsub();
    };
  }, [userData?.role]);

  // COMPUTED HEALTH METRICS
  const teamsWithoutCoach = teams.filter(t => !t.coachId);
  const unassignedUsers = users.filter(u => !u.teamId);
  const unassignedCoaches = users.filter(u => u.role === 'Coach' && !u.teamId);
  const unassignedParents = users.filter(u => u.role === 'Parent' && !u.teamId);

  // Calculate health score (0-100)
  const healthScore = Math.round(
    100 - (
      (teamsWithoutCoach.length * 15) + 
      (unassignedCoaches.length * 10) + 
      (unassignedParents.length * 2)
    )
  );
  const clampedHealthScore = Math.max(0, Math.min(100, healthScore));

  if (!userData || userData.role !== 'SuperAdmin') return null;

  const statCards = [
    { 
        title: 'Total Teams', 
        value: stats.teams, 
        icon: Shield, 
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        borderColor: 'border-orange-200 dark:border-orange-900/50',
        path: '/admin/teams' 
    },
    { 
        title: 'Total Users', 
        value: stats.totalUsers, 
        icon: UsersRound, 
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-900/50',
        path: '/admin/users' 
    },
    { 
        title: 'Coaches', 
        value: stats.coaches, 
        icon: UserCheck, 
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        borderColor: 'border-purple-200 dark:border-purple-900/50',
        path: '/admin/users' 
    },
    { 
        title: 'Parents', 
        value: stats.parents, 
        icon: Users, 
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
        borderColor: 'border-emerald-200 dark:border-emerald-900/50',
        path: '/admin/users' 
    },
  ];

  const healthAlerts = [
    {
      condition: teamsWithoutCoach.length > 0,
      severity: 'warning' as const,
      title: `${teamsWithoutCoach.length} team${teamsWithoutCoach.length > 1 ? 's' : ''} without a coach`,
      description: teamsWithoutCoach.slice(0, 3).map(t => t.name).join(', ') + (teamsWithoutCoach.length > 3 ? '...' : ''),
      action: () => navigate('/admin/teams'),
      actionLabel: 'Assign Coaches'
    },
    {
      condition: unassignedCoaches.length > 0,
      severity: 'error' as const,
      title: `${unassignedCoaches.length} coach${unassignedCoaches.length > 1 ? 'es' : ''} not assigned to any team`,
      description: unassignedCoaches.slice(0, 3).map(u => u.name).join(', ') + (unassignedCoaches.length > 3 ? '...' : ''),
      action: () => navigate('/admin/users'),
      actionLabel: 'Assign Teams'
    },
    {
      condition: unassignedParents.length > 5,
      severity: 'info' as const,
      title: `${unassignedParents.length} parents not assigned to any team`,
      description: 'These users may need help joining their child\'s team',
      action: () => navigate('/admin/users'),
      actionLabel: 'View Users'
    },
  ].filter(alert => alert.condition);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <RefreshCw className="w-3 h-3" />
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        
        {/* System Health Score */}
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32" cy="32" r="28"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-slate-200 dark:text-zinc-700"
              />
              <circle
                cx="32" cy="32" r="28"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeDasharray={175.9}
                strokeDashoffset={175.9 - (175.9 * clampedHealthScore / 100)}
                className={getHealthColor(clampedHealthScore)}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${getHealthColor(clampedHealthScore)}`}>
              {clampedHealthScore}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">System Health</p>
            <p className={`text-lg font-bold ${getHealthColor(clampedHealthScore)}`}>
              {clampedHealthScore >= 80 ? 'Excellent' : clampedHealthScore >= 60 ? 'Good' : 'Needs Attention'}
            </p>
          </div>
        </div>
      </div>
      
      {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 overflow-hidden">
              <AlertTriangle className="w-5 h-5 flex-shrink-0"/>
              <span className="break-words overflow-hidden">{error}</span>
          </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
        </div>
      ) : (
        <>
            {/* HEALTH ALERTS */}
            {healthAlerts.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Action Required
                </h2>
                {healthAlerts.map((alert, index) => (
                  <div 
                    key={index}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      alert.severity === 'error' 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' 
                        : alert.severity === 'warning'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        alert.severity === 'error' 
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                          : alert.severity === 'warning'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      }`}>
                        {alert.severity === 'error' ? <UserX className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className={`font-semibold ${
                          alert.severity === 'error' 
                            ? 'text-red-800 dark:text-red-300' 
                            : alert.severity === 'warning'
                            ? 'text-yellow-800 dark:text-yellow-300'
                            : 'text-blue-800 dark:text-blue-300'
                        }`}>{alert.title}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{alert.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={alert.action}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        alert.severity === 'error' 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : alert.severity === 'warning'
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {alert.actionLabel} <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* STAT CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(card => (
                <div 
                    key={card.title} 
                    onClick={() => navigate(card.path)}
                    className={`${card.bgColor} p-5 rounded-xl flex flex-col border ${card.borderColor} cursor-pointer hover:scale-[1.02] transition-all shadow-sm`}
                >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 bg-white dark:bg-black/30 rounded-lg ${card.color}`}>
                          <card.icon className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{card.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{card.title}</p>
                </div>
            ))}
            </div>

            {/* QUICK STATS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Unassigned Overview */}
              <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Unassigned Users</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Coaches</span>
                    <span className={`font-bold ${unassignedCoaches.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {unassignedCoaches.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Parents</span>
                    <span className={`font-bold ${unassignedParents.length > 5 ? 'text-yellow-500' : 'text-slate-900 dark:text-white'}`}>
                      {unassignedParents.length}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-zinc-800 pt-3 flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Total</span>
                    <span className="font-bold text-slate-900 dark:text-white">{unassignedUsers.length}</span>
                  </div>
                </div>
              </div>

              {/* Teams Overview */}
              <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Team Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">With Coach</span>
                    <span className="font-bold text-emerald-500">{teams.length - teamsWithoutCoach.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Without Coach</span>
                    <span className={`font-bold ${teamsWithoutCoach.length > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                      {teamsWithoutCoach.length}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-zinc-800 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Total Teams</span>
                      <span className="font-bold text-slate-900 dark:text-white">{teams.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Distribution */}
              <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">User Distribution</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-purple-600 dark:text-purple-400">Coaches</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {stats.totalUsers > 0 ? Math.round((stats.coaches / stats.totalUsers) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${stats.totalUsers > 0 ? (stats.coaches / stats.totalUsers) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-emerald-600 dark:text-emerald-400">Parents</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {stats.totalUsers > 0 ? Math.round((stats.parents / stats.totalUsers) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-2">
                      <div 
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${stats.totalUsers > 0 ? (stats.parents / stats.totalUsers) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RECENT USERS SECTION */}
            <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900/50">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Users</h2>
                    </div>
                    <button 
                      onClick={() => navigate('/admin/users')}
                      className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                    >
                      View All <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* MOBILE VIEW */}
                <div className="md:hidden">
                    {recentUsers.map((user, index) => (
                        <div key={index} className="p-4 border-b border-slate-200 dark:border-zinc-800 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="font-bold text-slate-900 dark:text-white block">{user.name}</span>
                                    <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 font-mono">
                                        <AtSign className="w-3 h-3"/> {user.username || 'No ID'}
                                    </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${user.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                                    {user.role}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-2">
                                <User className="w-3 h-3"/> {user.email}
                            </div>
                        </div>
                    ))}
                    {recentUsers.length === 0 && (
                      <p className="p-8 text-center text-slate-500 italic">No users found.</p>
                    )}
                </div>

                {/* DESKTOP VIEW */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
                        <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100 dark:bg-zinc-900">
                            <tr>
                                <th className="px-6 py-3 font-bold">Name</th>
                                <th className="px-6 py-3 font-bold">Email</th>
                                <th className="px-6 py-3 font-bold">Team</th>
                                <th className="px-6 py-3 text-right font-bold">Role</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                            {recentUsers.map((user, index) => (
                                <tr key={index} className="bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 dark:text-white">{user.name}</div>
                                        <div className="text-xs text-slate-500 font-mono">@{user.username || '---'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{user.email}</td>
                                    <td className="px-6 py-4">
                                      {user.teamId ? (
                                        <span className="text-slate-900 dark:text-white font-medium">{user.teamId}</span>
                                      ) : (
                                        <span className="text-slate-400 italic">Unassigned</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {recentUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">No users found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;