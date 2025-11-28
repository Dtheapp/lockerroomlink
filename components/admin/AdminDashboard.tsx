
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Shield, UserCheck, Users } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ teams: 0, coaches: 0, parents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const teamsUnsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setStats(prev => ({ ...prev, teams: snapshot.size }));
    });

    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      let coaches = 0;
      let parents = 0;
      snapshot.forEach(doc => {
        if (doc.data().role === 'Coach') coaches++;
        if (doc.data().role === 'Parent') parents++;
      });
      setStats(prev => ({ ...prev, coaches, parents }));
      setLoading(false);
    });

    return () => {
      teamsUnsub();
      usersUnsub();
    };
  }, []);

  const statCards = [
    { title: 'Total Teams', value: stats.teams, icon: Shield, color: 'text-sky-400' },
    { title: 'Registered Coaches', value: stats.coaches, icon: UserCheck, color: 'text-green-400' },
    { title: 'Registered Parents', value: stats.parents, icon: Users, color: 'text-yellow-400' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
      
      {loading ? (
        <p className="text-slate-400">Loading stats...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map(card => (
            <div key={card.title} className="bg-slate-900 p-6 rounded-lg flex items-center gap-6">
              <div className={`p-4 bg-slate-800 rounded-lg ${card.color}`}>
                <card.icon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">{card.title}</p>
                <p className="text-3xl font-bold text-white">{card.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-900 p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <p className="text-slate-300">
          Use the navigation on the left to manage users and teams. You can create new teams, assign coaches, and moderate content.
        </p>
      </div>
    </div>
  );
};

export default AdminDashboard;
