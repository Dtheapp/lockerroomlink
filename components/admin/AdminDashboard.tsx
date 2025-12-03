import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext'; // IMPORTANTE: Faltaba esto para la seguridad
import { Shield, UserCheck, Users, Clock, User, AtSign, AlertTriangle } from 'lucide-react';
import type { UserProfile } from '../../types';

const AdminDashboard: React.FC = () => {
  const { userData } = useAuth(); // Accedemos al usuario actual
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({ teams: 0, coaches: 0, parents: 0 });
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. SECURITY CHECK: Fail-safe interno
  useEffect(() => {
      if (userData && userData.role !== 'SuperAdmin') {
          navigate('/'); // Expulsar si no es Admin
      }
  }, [userData, navigate]);

  useEffect(() => {
    // SECURITY: Don't run queries if not authorized
    if (userData?.role !== 'SuperAdmin') return;

    setLoading(true);

    // 2. TEAMS LISTENER
    const teamsUnsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setStats(prev => ({ ...prev, teams: snapshot.size }));
    }, (err) => {
        console.error("Error fetching teams:", err);
        setError("Failed to load team data.");
    });

    // 3. USERS LISTENER (Optimized Query)
    // Note: In a large production app, we would use 'count()' aggregation for stats
    // and a separate 'limit(5)' query for the table to save costs. 
    // For now, we keep the snapshot to maintain live counts.
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      let coaches = 0;
      let parents = 0;
      const allUsers: UserProfile[] = [];

      snapshot.forEach(doc => {
        const data = doc.data() as UserProfile;
        if (data.role === 'Coach') coaches++;
        if (data.role === 'Parent') parents++;
        // Exclude Admins from the "Recent Users" list visual
        if (data.role !== 'SuperAdmin') {
            allUsers.push({ ...data, uid: doc.id }); // Ensure ID is attached
        }
      });

      setStats(prev => ({ ...prev, coaches, parents }));
      
      // Client-side sort/slice since we downloaded everything anyway for the counts
      // Ideally, we'd add a 'createdAt' field to users for true chronological sorting
      setRecentUsers(allUsers.slice(0, 5)); 
      
      setLoading(false);
    }, (err) => {
        console.error("Error fetching users:", err);
        setError("Failed to load user data.");
    });

    return () => {
      teamsUnsub();
      usersUnsub();
    };
  }, [userData?.role]); // Only re-run if role is confirmed

  if (!userData || userData.role !== 'SuperAdmin') return null; // Render nothing while redirecting

  const statCards = [
    { 
        title: 'Total Teams', 
        value: stats.teams, 
        icon: Shield, 
        color: 'text-orange-600 dark:text-orange-400',
        borderColor: 'border-orange-200 dark:border-orange-900',
        path: '/admin/teams' 
    },
    { 
        title: 'Registered Coaches', 
        value: stats.coaches, 
        icon: UserCheck, 
        color: 'text-green-600 dark:text-green-400',
        borderColor: 'border-green-200 dark:border-green-900',
        path: '/admin/users' 
    },
    { 
        title: 'Registered Parents', 
        value: stats.parents, 
        icon: Users, 
        color: 'text-yellow-600 dark:text-yellow-400',
        borderColor: 'border-yellow-200 dark:border-yellow-900',
        path: '/admin/users' 
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
      
      {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center gap-2" role="alert">
              <AlertTriangle className="w-5 h-5"/>
              <span className="block sm:inline">{error}</span>
          </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
        </div>
      ) : (
        <>
            {/* STAT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statCards.map(card => (
                <div 
                    key={card.title} 
                    onClick={() => navigate(card.path)}
                    className={`bg-slate-50 dark:bg-zinc-950 p-6 rounded-lg flex items-center gap-6 border shadow-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all active:scale-[0.98] ${card.borderColor}`}
                >
                    <div className={`p-4 bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-zinc-800 shadow-sm ${card.color}`}>
                        <card.icon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">{card.title}</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{card.value}</p>
                    </div>
                </div>
            ))}
            </div>

            {/* RECENT USERS SECTION */}
            <div className="bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2 bg-white dark:bg-zinc-900/50">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Users</h2>
                </div>

                {/* --- MOBILE VIEW: CARDS --- */}
                <div className="md:hidden">
                    {recentUsers.map((user, index) => (
                        <div key={index} className="p-4 border-b border-slate-200 dark:border-zinc-800 last:border-0 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="font-bold text-slate-900 dark:text-white block">{user.name}</span>
                                    <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 font-mono">
                                        <AtSign className="w-3 h-3"/> {user.username || 'No ID'}
                                    </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${user.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'}`}>
                                    {user.role}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-2">
                                <User className="w-3 h-3"/> {user.email}
                            </div>
                        </div>
                    ))}
                </div>

                {/* --- DESKTOP VIEW: TABLE --- */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
                        <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-3 font-bold">Name</th>
                                <th className="px-6 py-3 font-bold">Email</th>
                                <th className="px-6 py-3 text-right font-bold">Role</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                            {recentUsers.map((user, index) => (
                                <tr key={index} className="bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 dark:text-white">{user.name}</div>
                                        <div className="text-xs text-slate-500 font-mono">@{user.username}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{user.email}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${user.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {recentUsers.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500 italic">No recent users found.</td>
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