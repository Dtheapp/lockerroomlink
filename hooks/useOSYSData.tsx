/**
 * OSYS Data Hooks
 * 
 * React hooks for fetching data in OSYS demo pages.
 * Automatically handles demo mode vs real data.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  mockAthlete,
  mockTeam,
  mockCoach,
  mockRoster,
  mockSchedule,
  mockEvents,
  mockPlays,
  mockConversations,
  mockFundraisingCampaign,
  fetchTeamData,
  fetchRoster,
  fetchPlays,
  fetchEvents,
  followAthlete,
  sendKudos,
  formatNumber,
  timeAgo
} from '../services/osysDataService';
import type { Player } from '../types';

// Re-export utilities
export { formatNumber, timeAgo };

/**
 * Hook for athlete profile data
 */
export function useAthleteData(athleteUsername?: string) {
  const { userData, selectedPlayer, teamData } = useAuth();
  const [data, setData] = useState(mockAthlete);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In demo mode, use mock data
    if (!athleteUsername && !selectedPlayer) {
      setData(mockAthlete);
      setLoading(false);
      return;
    }

    // If we have a selected player from auth context, use that
    if (selectedPlayer && teamData) {
      setData({
        ...mockAthlete,
        id: selectedPlayer.id,
        name: selectedPlayer.name || mockAthlete.name,
        number: selectedPlayer.number || mockAthlete.number,
        position: selectedPlayer.position || mockAthlete.position,
        teamId: selectedPlayer.teamId,
        teamName: teamData.name || mockAthlete.teamName,
        photoUrl: selectedPlayer.photoUrl || null,
        stats: {
          ...mockAthlete.stats,
          followers: selectedPlayer.followerCount || mockAthlete.stats.followers,
          kudos: selectedPlayer.kudosCount || mockAthlete.stats.kudos
        }
      });
    }
    
    setLoading(false);
  }, [athleteUsername, selectedPlayer, teamData]);

  return { data, loading };
}

/**
 * Hook for team data
 */
export function useTeamData(teamId?: string) {
  const { teamData: authTeamData } = useAuth();
  const [data, setData] = useState(mockTeam);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      
      // Use auth team data if available
      if (authTeamData && !teamId) {
        setData({
          ...mockTeam,
          id: authTeamData.id,
          name: authTeamData.name || mockTeam.name,
          record: authTeamData.record || mockTeam.record
        });
        setLoading(false);
        return;
      }

      const teamData = await fetchTeamData(teamId);
      setData(teamData);
      setLoading(false);
    }
    
    load();
  }, [teamId, authTeamData]);

  return { data, loading };
}

/**
 * Hook for roster data
 */
export function useRosterData(teamId?: string) {
  const { teamData } = useAuth();
  const [data, setData] = useState<Player[]>(mockRoster);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const effectiveTeamId = teamId || teamData?.id;
      const roster = await fetchRoster(effectiveTeamId);
      setData(roster);
      setLoading(false);
    }
    
    load();
  }, [teamId, teamData?.id]);

  return { data, loading };
}

/**
 * Hook for playbook data
 */
export function usePlaybookData(coachId?: string) {
  const { userData } = useAuth();
  const [data, setData] = useState(mockPlays);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const effectiveCoachId = coachId || (userData?.role === 'Coach' ? userData.uid : undefined);
      const plays = await fetchPlays(effectiveCoachId);
      setData(plays);
      setLoading(false);
    }
    
    load();
  }, [coachId, userData]);

  return { data, loading };
}

/**
 * Hook for events data
 */
export function useEventsData(teamId?: string) {
  const { teamData } = useAuth();
  const [data, setData] = useState(mockEvents);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const effectiveTeamId = teamId || teamData?.id;
      const events = await fetchEvents(effectiveTeamId);
      setData(events);
      setLoading(false);
    }
    
    load();
  }, [teamId, teamData?.id]);

  return { data, loading };
}

/**
 * Hook for coach data
 */
export function useCoachData(coachId?: string) {
  const { userData } = useAuth();
  const [data, setData] = useState(mockCoach);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For now, use mock data or auth user data
    if (userData?.role === 'Coach' && !coachId) {
      setData({
        ...mockCoach,
        id: userData.uid,
        name: userData.name || mockCoach.name,
        photoUrl: userData.photoUrl || null
      });
    }
    setLoading(false);
  }, [coachId, userData]);

  return { data, loading };
}

/**
 * Hook for schedule data
 */
export function useScheduleData() {
  const [data] = useState(mockSchedule);
  const [loading] = useState(false);
  return { data, loading };
}

/**
 * Hook for conversations data
 */
export function useConversationsData() {
  const [data] = useState(mockConversations);
  const [loading] = useState(false);
  return { data, loading };
}

/**
 * Hook for fundraising data
 */
export function useFundraisingData() {
  const [data] = useState(mockFundraisingCampaign);
  const [loading] = useState(false);
  return { data, loading };
}

/**
 * Hook for interactive actions (follow, kudos, etc.)
 */
export function useAthleteActions() {
  const { user, userData } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [kudosLoading, setKudosLoading] = useState(false);

  const handleFollow = useCallback(async (
    athleteUsername: string,
    teamId: string,
    playerId: string
  ) => {
    // In demo mode, just toggle state
    if (!user) {
      setIsFollowing(prev => !prev);
      return true;
    }

    setFollowLoading(true);
    const success = await followAthlete(user.uid, athleteUsername, teamId, playerId);
    if (success) {
      setIsFollowing(true);
    }
    setFollowLoading(false);
    return success;
  }, [user]);

  const handleSendKudos = useCallback(async (
    teamId: string,
    playerId: string,
    category: string,
    amount: number,
    message?: string
  ) => {
    // In demo mode, just return success
    if (!user || !userData) {
      return true;
    }

    setKudosLoading(true);
    const success = await sendKudos(
      user.uid,
      userData.name || 'Anonymous',
      teamId,
      playerId,
      category,
      amount,
      message
    );
    setKudosLoading(false);
    return success;
  }, [user, userData]);

  return {
    isFollowing,
    followLoading,
    kudosLoading,
    handleFollow,
    handleSendKudos
  };
}

/**
 * Hook for demo notifications/toasts
 */
export function useDemoToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const ToastComponent = toast ? (
    <div
      style={{
        position: 'fixed',
        bottom: '6rem',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0.75rem 1.5rem',
        background: toast.type === 'success' ? 'rgba(34, 197, 94, 0.95)' : 
                    toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 
                    'rgba(99, 102, 241, 0.95)',
        color: 'white',
        borderRadius: '50px',
        fontSize: '0.875rem',
        fontWeight: 500,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        zIndex: 10000,
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      {toast.type === 'success' && '✓ '}
      {toast.type === 'error' && '✕ '}
      {toast.type === 'info' && 'ℹ '}
      {toast.message}
    </div>
  ) : null;

  return { showToast, ToastComponent };
}
