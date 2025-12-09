import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Program } from '../../types';
import { ChevronLeft, Search, Users, Building2, MapPin, Filter, MoreVertical, Check, X, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LeaguePrograms() {
  const { leagueData, user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);

  useEffect(() => {
    loadPrograms();
  }, [leagueData]);

  const loadPrograms = async () => {
    if (!leagueData) return;

    try {
      const q = query(
        collection(db, 'programs'),
        where('leagueId', '==', leagueData.id)
      );
      const snapshot = await getDocs(q);
      const programsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Program[];
      
      setPrograms(programsList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (programId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'programs', programId), {
        status: newStatus,
        updatedAt: new Date()
      });
      setPrograms(programs.map(p => 
        p.id === programId ? { ...p, status: newStatus as any } : p
      ));
      setSelectedProgram(null);
    } catch (error) {
      console.error('Error updating program status:', error);
    }
  };

  const handleRemoveProgram = async (programId: string) => {
    if (!confirm('Are you sure you want to remove this program from your league?')) return;

    try {
      await updateDoc(doc(db, 'programs', programId), {
        leagueId: null,
        status: 'inactive',
        updatedAt: new Date()
      });
      setPrograms(programs.filter(p => p.id !== programId));
    } catch (error) {
      console.error('Error removing program:', error);
    }
  };

  const filteredPrograms = programs.filter(program => {
    const matchesSearch = program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      program.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (program as any).status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (!leagueData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">No League Found</h2>
          <p className="text-gray-400 mt-2">You are not associated with any league.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/league" className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                Programs
              </h1>
              <p className="text-sm text-gray-400">{programs.length} programs in {leagueData.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400">No Programs Found</h3>
            <p className="text-gray-500 mt-2">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'No programs have joined your league yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPrograms.map(program => (
              <div key={program.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{program.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        {program.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {program.city}, {program.state}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {(program as any).teamCount || 0} teams
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor((program as any).status || 'active')}`}>
                          {(program as any).status || 'Active'}
                        </span>
                        {program.sport && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                            {program.sport.charAt(0).toUpperCase() + program.sport.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button
                      onClick={() => setSelectedProgram(selectedProgram === program.id ? null : program.id)}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {selectedProgram === program.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 z-10">
                        <Link
                          to={`/league/programs/${program.id}`}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-600 text-sm"
                        >
                          <Users className="w-4 h-4" />
                          View Details
                        </Link>
                        <button
                          onClick={() => handleStatusChange(program.id, 'active')}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-600 text-sm text-left"
                        >
                          <Check className="w-4 h-4 text-green-400" />
                          Set Active
                        </button>
                        <button
                          onClick={() => handleStatusChange(program.id, 'inactive')}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-600 text-sm text-left"
                        >
                          <X className="w-4 h-4 text-yellow-400" />
                          Set Inactive
                        </button>
                        <button
                          onClick={() => {
                            const email = (program as any).contactEmail;
                            if (email) {
                              window.location.href = `mailto:${email}`;
                            }
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-600 text-sm text-left"
                        >
                          <Mail className="w-4 h-4" />
                          Contact
                        </button>
                        <hr className="my-1 border-gray-600" />
                        <button
                          onClick={() => handleRemoveProgram(program.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-600 text-sm text-left text-red-400"
                        >
                          <X className="w-4 h-4" />
                          Remove from League
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
