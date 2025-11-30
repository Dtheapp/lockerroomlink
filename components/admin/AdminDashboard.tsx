import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; // <--- Added for navigation
import { db } from '../../services/firebase';
import { Shield, UserCheck, Users, Clock, User, AtSign } from 'lucide-react';
import type { UserProfile } from '../../types';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate(); // <--- Hook
  const [stats, setStats] = useState({ teams: 0, coaches: 0, parents: 0 });
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Stats Listener
    const teamsUnsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setStats(prev => ({ ...prev, teams: snapshot.size }));
    });

    // 2. Users Listener
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      let coaches = 0;
      let parents = 0;
      const allUsers: UserProfile[] = [];

      snapshot.forEach(doc => {
        const data = doc.data() as UserProfile;
        if (data.role === 'Coach') coaches++;
        if (data.role === 'Parent') parents++;
        if (data.role !== 'SuperAdmin') allUsers.push(data);
      });

      setStats(prev => ({ ...prev, coaches, parents }));
      setRecentUsers(allUsers.slice(0, 5));
      setLoading(false);
    });

    return () => {
      teamsUnsub();
      usersUnsub();
    };
  }, []);

  const statCards = [
    { 
        title: 'Total Teams', 
        value: stats.teams, 
        icon: Shield, 
        color: 'text-orange-600 dark:text-orange-400',
        path: '/admin/teams' // <--- Destination
    },
    { 
        title: 'Registered Coaches', 
        value: stats.coaches, 
        icon: UserCheck, 
        color: 'text-green-600 dark:text-green-400',
        path: '/admin/users' // <--- Destination
    },
    { 
        title: 'Registered Parents', 
        value: stats.parents, 
        icon: Users, 
        color: 'text-yellow-600 dark:text-yellow-400',
        path: '/admin/users' // <--- Destination
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
      
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
                    onClick={() => navigate(card.path)} // <--- CLICK ACTION
                    className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-lg flex items-center gap-6 border border-slate-200 dark:border-zinc-800 shadow-lg cursor-pointer hover:border-orange-500/50 dark:hover:bg-zinc-900 hover:bg-slate-100 transition-all active:scale-[0.98]"
                >
                    <div className={`p-4 bg-white dark:bg-black rounded-lg border border-slate-300 dark:border-zinc-800 ${card.color}`}>
                        <card.icon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">{card.title}</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{card.value}</p>
                    </div>
                </div>
            ))}
            </div>

            {/* RECENT USERS SECTION */}
            <div className="bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-lg overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Users</h2>
                </div>

                {/* --- MOBILE VIEW: CARDS --- */}
                <div className="md:hidden">
                    {recentUsers.map((user, index) => (
                        <div key={index} className="p-4 border-b border-slate-200 dark:border-zinc-800 last:border-0 hover:bg-slate-100 dark:hover:bg-zinc-950 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="font-bold text-slate-900 dark:text-white block">{user.name}</span>
                                    <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                        <AtSign className="w-3 h-3"/> {user.username || 'No ID'}
                                    </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${user.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-800' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'}`}>
                                    {user.role}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-2">
                                <User className="w-3 h-3"/> {user.email}
                            </div>
                        </div>
                    ))}
                </div>

                {/* --- DESKTOP VIEW: TABLE --- */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
                        <thead className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-white dark:bg-black">
                            <tr>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3 text-right">Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentUsers.map((user, index) => (
                                <tr key={index} className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-black">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 dark:text-white">{user.name}</div>
                                        <div className="text-xs text-slate-500">@{user.username}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{user.email}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${user.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                </tr>
                            ))}
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