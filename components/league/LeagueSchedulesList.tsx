import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LeagueSeason } from '../../types';
import { Calendar, ChevronRight, Loader2, Trophy, Users, CheckCircle, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface SeasonWithScheduleInfo extends LeagueSeason {
  gamesCount: number;
  scheduledAgeGroups: string[];
  totalAgeGroups: number;
}

export default function LeagueSchedulesList() {
  const { leagueData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<SeasonWithScheduleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeasons();
  }, [leagueData]);

  const loadSeasons = async () => {
    if (!leagueData) return;

    try {
      // Load seasons
      const seasonsQuery = query(
        collection(db, 'leagueSeasons'),
        where('leagueId', '==', leagueData.id),
        orderBy('startDate', 'desc')
      );
      const seasonsSnap = await getDocs(seasonsQuery);
      const seasonsList = seasonsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeagueSeason[];

      // For each season, get schedule info AND teams to know which age groups have teams
      const seasonsWithInfo = await Promise.all(
        seasonsList.map(async (season) => {
          // Load schedules
          const schedulesQuery = query(
            collection(db, 'leagueSchedules'),
            where('seasonId', '==', season.id)
          );
          const schedulesSnap = await getDocs(schedulesQuery);
          
          // Load teams registered to this season to determine which age groups have teams
          const teamsQuery = query(
            collection(db, 'teams'),
            where('leagueId', '==', leagueData.id)
          );
          const teamsSnap = await getDocs(teamsQuery);
          
          // Get unique age groups that have at least 1 team registered
          const ageGroupsWithTeams = new Set<string>();
          teamsSnap.docs.forEach(doc => {
            const team = doc.data();
            // Check if team is registered for this season and has an age group
            if (team.seasonId === season.id && team.ageGroup) {
              ageGroupsWithTeams.add(team.ageGroup);
            }
          });
          
          let gamesCount = 0;
          const scheduledAgeGroups: string[] = [];
          
          schedulesSnap.docs.forEach(doc => {
            const data = doc.data();
            const games = data.games || [];
            gamesCount += games.length;
            if (data.ageGroup && !scheduledAgeGroups.includes(data.ageGroup)) {
              scheduledAgeGroups.push(data.ageGroup);
            }
          });

          return {
            ...season,
            gamesCount,
            scheduledAgeGroups,
            // Only count age groups that actually have teams, not ALL age groups
            totalAgeGroups: ageGroupsWithTeams.size > 0 ? ageGroupsWithTeams.size : (season.ageGroups?.length || 0),
          };
        })
      );

      // Only show seasons with schedules or active/upcoming seasons
      const filteredSeasons = seasonsWithInfo.filter(s => 
        s.gamesCount > 0 || s.status === 'active' || s.status === 'upcoming'
      );

      setSeasons(filteredSeasons);
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (season: SeasonWithScheduleInfo) => {
    const { status, scheduledAgeGroups, totalAgeGroups, gamesCount } = season;
    
    if (status === 'completed') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-zinc-500/20 text-zinc-400">
          Completed
        </span>
      );
    }
    
    if (gamesCount === 0) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400">
          No Schedule
        </span>
      );
    }
    
    if (scheduledAgeGroups.length < totalAgeGroups) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400">
          Partial ({scheduledAgeGroups.length}/{totalAgeGroups})
        </span>
      );
    }
    
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
        Complete
      </span>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
            }`}>
              <Calendar className={`w-6 h-6 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Schedules
              </h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                View and manage season schedules
              </p>
            </div>
          </div>
        </div>

        {/* Seasons List */}
        {seasons.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl border ${
            theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
          }`}>
            <Calendar className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
            <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              No Schedules Yet
            </h3>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Create a season and add games to see schedules here
            </p>
            <Link
              to="/league/seasons"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
            >
              <Trophy className="w-4 h-4" />
              Go to Seasons
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {seasons.map(season => (
              <div
                key={season.id}
                onClick={() => navigate(`/league/seasons/${season.id}`)}
                className={`p-5 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${
                  theme === 'dark'
                    ? 'bg-white/5 border-white/10 hover:border-purple-500/50 hover:bg-white/10'
                    : 'bg-white border-slate-200 hover:border-purple-400 hover:shadow-lg'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
                    }`}>
                      <Trophy className={`w-6 h-6 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                    </div>
                    <div>
                      <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {season.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {season.gamesCount} games
                        </span>
                        {season.scheduledAgeGroups.length > 0 && (
                          <span className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                            • {season.scheduledAgeGroups.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(season)}
                    <ChevronRight className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
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
