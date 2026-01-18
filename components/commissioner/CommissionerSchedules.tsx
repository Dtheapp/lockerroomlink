/**
 * Commissioner Schedules List
 * Shows all seasons and their schedule status for the selected sport
 * Allows quick navigation to build/edit schedules
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { Calendar, ChevronRight, Loader2, AlertCircle, Plus, Clock, CheckCircle2, Edit3 } from 'lucide-react';
import { GlassCard, Button, Badge } from '../ui/OSYSComponents';

interface SeasonScheduleInfo {
  id: string;
  name: string;
  sport: string;
  status: 'upcoming' | 'active' | 'completed' | 'draft';
  startDate: Date;
  endDate: Date;
  ageGroups: string[];
  scheduledAgeGroups: string[];
  totalGames: number;
  hasSchedule: boolean;
}

export default function CommissionerSchedules() {
  const { programData, userData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const selectedSport = localStorage.getItem('commissioner_selected_sport') || 'football';
  
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<SeasonScheduleInfo[]>([]);

  useEffect(() => {
    loadSeasons();
  }, [programData?.id, selectedSport]);

  const loadSeasons = async () => {
    if (!programData?.id) {
      console.log('[CommissionerSchedules] No programData.id, skipping load');
      setLoading(false);
      return;
    }
    
    console.log('[CommissionerSchedules] Loading seasons for program:', programData.id, 'sport:', selectedSport);
    
    setLoading(true);
    try {
      // Load ALL seasons for this program (sport case varies in database)
      // Filter by sport client-side with case-insensitive comparison
      // Note: Not using orderBy to avoid index requirements - we'll sort client-side
      const seasonsSnap = await getDocs(collection(db, 'programs', programData.id, 'seasons'));
      
      console.log('[CommissionerSchedules] Found', seasonsSnap.docs.length, 'total seasons');
      seasonsSnap.docs.forEach(doc => {
        const d = doc.data();
        console.log('[CommissionerSchedules] Season:', doc.id, 'sport:', d.sport, 'name:', d.name);
      });
      
      const selectedSportLower = selectedSport.toLowerCase();
      const seasonsList: SeasonScheduleInfo[] = [];
      
      for (const seasonDoc of seasonsSnap.docs) {
        const data = seasonDoc.data();
        
        // Filter by sport (case-insensitive)
        // If season doesn't have a sport field, include it (legacy data or program-level sport)
        const seasonSport = (data.sport || '').toLowerCase();
        const matchesSport = !data.sport || seasonSport === selectedSportLower;
        console.log('[CommissionerSchedules] Comparing:', seasonSport || '(none)', 'vs', selectedSportLower, '→ match:', matchesSport);
        if (!matchesSport) continue;
        
        // Load schedules for this season
        const schedulesQuery = query(
          collection(db, 'programs', programData.id, 'schedules'),
          where('seasonId', '==', seasonDoc.id)
        );
        const schedulesSnap = await getDocs(schedulesQuery);
        
        const scheduledAgeGroups: string[] = [];
        let totalGames = 0;
        
        schedulesSnap.docs.forEach(schedDoc => {
          const schedData = schedDoc.data();
          if (schedData.ageGroup) {
            scheduledAgeGroups.push(schedData.ageGroup);
          }
          if (schedData.games && Array.isArray(schedData.games)) {
            totalGames += schedData.games.length;
          }
        });
        
        const startDate = data.startDate?.toDate?.() || new Date(data.startDate);
        const endDate = data.endDate?.toDate?.() || new Date(data.endDate);
        const now = new Date();
        
        let status: SeasonScheduleInfo['status'] = 'draft';
        if (data.status) {
          status = data.status;
        } else if (endDate < now) {
          status = 'completed';
        } else if (startDate <= now && endDate >= now) {
          status = 'active';
        } else if (startDate > now) {
          status = 'upcoming';
        }
        
        seasonsList.push({
          id: seasonDoc.id,
          name: data.name || 'Unnamed Season',
          sport: data.sport || selectedSport,
          status,
          startDate,
          endDate,
          ageGroups: data.ageGroups || [],
          scheduledAgeGroups,
          totalGames,
          hasSchedule: schedulesSnap.docs.length > 0,
        });
      }
      
      // Sort by startDate descending (newest first)
      seasonsList.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
      
      console.log('[CommissionerSchedules] Final seasons list:', seasonsList.length);
      setSeasons(seasonsList);
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildSchedule = (seasonId: string, ageGroup?: string) => {
    if (ageGroup) {
      navigate(`/commissioner/schedule-studio/${seasonId}?ageGroup=${encodeURIComponent(ageGroup)}`);
    } else {
      navigate(`/commissioner/schedule-studio/${seasonId}`);
    }
  };

  const getStatusBadge = (status: SeasonScheduleInfo['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'upcoming':
        return <Badge variant="primary">Upcoming</Badge>;
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      default:
        return <Badge variant="warning">Draft</Badge>;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getSportEmoji = (sport: string) => {
    const emojis: Record<string, string> = {
      football: '🏈',
      basketball: '🏀',
      soccer: '⚽',
      baseball: '⚾',
      volleyball: '🏐',
      hockey: '🏒',
    };
    return emojis[sport.toLowerCase()] || '🏆';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-purple-400" />
            Manage Schedules
          </h1>
          <p className="text-slate-400 mt-1">
            {getSportEmoji(selectedSport)} {selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1)} Season Schedules
          </p>
        </div>
      </div>

      {/* Seasons List */}
      {seasons.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Seasons Found</h3>
          <p className="text-slate-400 mb-4">
            Create a season first to start building schedules for {selectedSport}.
          </p>
          <Button variant="primary" onClick={() => navigate('/commissioner')}>
            <Plus className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {seasons.map(season => (
            <GlassCard key={season.id} className="p-5 hover:bg-white/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{season.name}</h3>
                    {getStatusBadge(season.status)}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(season.startDate)} - {formatDate(season.endDate)}
                    </span>
                    {season.hasSchedule && (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        {season.totalGames} games scheduled
                      </span>
                    )}
                  </div>

                  {/* Age Groups */}
                  {season.ageGroups.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {season.ageGroups.map(ag => {
                        const isScheduled = season.scheduledAgeGroups.includes(ag);
                        return (
                          <button
                            key={ag}
                            onClick={() => handleBuildSchedule(season.id, ag)}
                            className={`
                              px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5
                              ${isScheduled 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' 
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
                              }
                            `}
                          >
                            {isScheduled ? (
                              <>
                                <Edit3 className="w-3.5 h-3.5" />
                                {ag} - Edit
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                {ag} - Build
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  onClick={() => handleBuildSchedule(season.id)}
                  className="shrink-0"
                >
                  <span className="mr-2">Open Studio</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
