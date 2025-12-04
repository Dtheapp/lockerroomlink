import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { UserProfile, Team } from '../../types';
import { User, Crown, Users, Mail, Trophy, Calendar, MapPin, Home, X, Award, Shield } from 'lucide-react';

interface CoachData {
  coach: UserProfile;
  teams: Team[];
  isHeadCoach: boolean[];
}

const PublicCoachProfile: React.FC = () => {
  const { coachId } = useParams<{ coachId: string }>();
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    const fetchCoachData = async () => {
      if (!coachId) {
        setError('No coach ID provided');
        setLoading(false);
        return;
      }

      try {
        // Get coach document
        const coachDoc = await getDoc(doc(db, 'users', coachId));
        if (!coachDoc.exists()) {
          setError('Coach not found');
          setLoading(false);
          return;
        }

        const coach = { uid: coachDoc.id, ...coachDoc.data() } as UserProfile;
        
        // Verify this is a coach
        if (coach.role !== 'Coach') {
          setError('Profile not found');
          setLoading(false);
          return;
        }

        // Get teams this coach belongs to
        const teamIds = coach.teamIds || (coach.teamId ? [coach.teamId] : []);
        const teams: Team[] = [];
        const isHeadCoach: boolean[] = [];

        for (const teamId of teamIds) {
          const teamDoc = await getDoc(doc(db, 'teams', teamId));
          if (teamDoc.exists()) {
            const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
            teams.push(team);
            isHeadCoach.push(team.headCoachId === coachId || team.coachId === coachId);
          }
        }

        setData({ coach, teams, isHeadCoach });
      } catch (err) {
        console.error('Error fetching coach data:', err);
        setError('Failed to load coach profile');
      } finally {
        setLoading(false);
      }
    };

    fetchCoachData();
  }, [coachId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-800/50 rounded-2xl p-8 text-center max-w-md border border-zinc-700">
          <User className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Coach Not Found</h1>
          <p className="text-zinc-400 mb-6">
            The coach profile you're looking for doesn't exist or has been removed.
          </p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            <Home className="w-5 h-5" />
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const { coach, teams, isHeadCoach } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* Header Bar */}
      <header className="bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-black tracking-tighter">
            <span className="text-orange-500">LOCKER</span>
            <span className="text-white">ROOM</span>
          </Link>
          <span className="text-xs text-zinc-500">Coach Profile</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 rounded-2xl p-6 md:p-8 border border-zinc-700/50 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Coach Photo */}
            <div className="relative">
              {coach.photoUrl ? (
                <img 
                  src={coach.photoUrl} 
                  alt={coach.name} 
                  onClick={() => setShowPhotoModal(true)}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] cursor-pointer hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center border-4 border-amber-500">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
              {/* Head Coach Badge */}
              {isHeadCoach.some(Boolean) && (
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                  <Crown className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            {/* Coach Info */}
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{coach.name}</h1>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                {isHeadCoach.some(Boolean) ? (
                  <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Crown className="w-4 h-4" /> Head Coach
                  </span>
                ) : (
                  <span className="bg-zinc-700 text-zinc-300 px-3 py-1 rounded-full text-sm font-medium">
                    Assistant Coach
                  </span>
                )}
              </div>

              {/* Teams */}
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {teams.map((team, index) => (
                  <Link 
                    key={team.id}
                    to={`/team/${team.id}`}
                    className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors bg-sky-500/10 px-3 py-1 rounded-full"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="font-medium text-sm">{team.name}</span>
                    {isHeadCoach[index] && <Crown className="w-3 h-3 text-amber-400" />}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-orange-500" />
            About Coach {coach.name.split(' ')[0]}
          </h2>
          
          {coach.bio ? (
            <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{coach.bio}</p>
          ) : (
            <p className="text-zinc-500 italic">
              This coach hasn't added a bio yet.
            </p>
          )}
        </div>

        {/* Contact Info (if available and public) */}
        {coach.email && (
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-500" />
              Contact
            </h2>
            <p className="text-zinc-400">
              <span className="text-zinc-500">Email:</span>{' '}
              <a href={`mailto:${coach.email}`} className="text-sky-400 hover:text-sky-300 transition-colors">
                {coach.email}
              </a>
            </p>
          </div>
        )}

        {/* Teams Overview */}
        {teams.length > 0 && (
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Teams
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teams.map((team, index) => (
                <Link
                  key={team.id}
                  to={`/team/${team.id}`}
                  className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      isHeadCoach[index] ? 'bg-amber-500' : 'bg-zinc-700'
                    }`}>
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{team.name}</p>
                      <p className="text-xs text-zinc-500">
                        {isHeadCoach[index] ? 'Head Coach' : 'Assistant Coach'}
                      </p>
                      {team.record && (
                        <p className="text-xs text-zinc-400 mt-1">
                          Record: {team.record.wins}-{team.record.losses}-{team.record.ties}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-zinc-600 text-sm">
          <p>Powered by <span className="text-orange-500 font-bold">LockerRoom</span></p>
        </footer>
      </main>

      {/* Photo Modal */}
      {showPhotoModal && coach.photoUrl && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative max-w-2xl max-h-[80vh]">
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-zinc-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={coach.photoUrl} 
              alt={coach.name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <p className="text-center text-white font-bold mt-4">{coach.name}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicCoachProfile;
