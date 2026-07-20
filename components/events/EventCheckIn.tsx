/**
 * EventCheckIn
 * Lets families RSVP their athletes to an event and shows coaches a live list
 * of who's coming. Stored in a subcollection: events/{eventId}/checkins/{athleteId}.
 *
 * - Parents can check their own athlete(s) in / out.
 * - Coaches can check in any roster player and see the full attendance list.
 * - Everyone sees the running "Who's Coming" list + count.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Users, Check, X } from 'lucide-react';

type CheckinStatus = 'coming' | 'not';

interface CheckinDoc {
  athleteId: string;
  playerName: string;
  status: CheckinStatus;
  teamId?: string;
  checkedInBy?: string;
  checkedInByName?: string;
}

interface RosterPlayer {
  id: string;
  name?: string;
  parentId?: string;
  parentUserId?: string;
  photoUrl?: string;
}

interface EventCheckInProps {
  eventId: string;
  teamId?: string;
  roster: RosterPlayer[];
  currentUserId?: string;
  currentUserName?: string;
  isCoach?: boolean;
  theme: string;
}

export const EventCheckIn: React.FC<EventCheckInProps> = ({
  eventId,
  teamId,
  roster,
  currentUserId,
  currentUserName,
  isCoach = false,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [checkins, setCheckins] = useState<Record<string, CheckinDoc>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Live subscription to this event's check-ins.
  useEffect(() => {
    if (!eventId) return;
    const ref = collection(db, 'events', eventId, 'checkins');
    const unsub = onSnapshot(ref, (snap) => {
      const map: Record<string, CheckinDoc> = {};
      snap.forEach((d) => {
        map[d.id] = d.data() as CheckinDoc;
      });
      setCheckins(map);
    });
    return () => unsub();
  }, [eventId]);

  // Players this user is allowed to check in: coaches manage everyone,
  // parents manage only their own athletes.
  const manageable = useMemo(() => {
    if (isCoach) return roster;
    return roster.filter(
      (p) => p.parentId === currentUserId || p.parentUserId === currentUserId
    );
  }, [roster, isCoach, currentUserId]);

  const comingList = useMemo(
    () => Object.values(checkins).filter((c) => c.status === 'coming'),
    [checkins]
  );
  const notComingCount = useMemo(
    () => Object.values(checkins).filter((c) => c.status === 'not').length,
    [checkins]
  );

  const setStatus = async (player: RosterPlayer, status: CheckinStatus) => {
    if (!eventId || saving) return;
    setSaving(player.id);
    try {
      await setDoc(
        doc(db, 'events', eventId, 'checkins', player.id),
        {
          athleteId: player.id,
          playerName: player.name || 'Player',
          status,
          teamId: teamId || null,
          checkedInBy: currentUserId || null,
          checkedInByName: currentUserName || null,
          checkedInAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('[EventCheckIn] Failed to save check-in:', err);
    } finally {
      setSaving(null);
    }
  };

  const btnBase =
    'px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50';

  return (
    <div>
      <h5 className={`flex items-center gap-2 text-sm font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
        <Users className="w-4 h-4" />
        Who's Coming
        <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
          {comingList.length} coming
        </span>
        {notComingCount > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
            {notComingCount} out
          </span>
        )}
      </h5>

      {/* RSVP controls for the current user's manageable players */}
      {manageable.length > 0 && (
        <div className={`p-3 rounded-lg mb-3 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
          <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {isCoach ? 'Check in players' : manageable.length > 1 ? 'Check in your players' : 'Check in your player'}
          </p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {manageable.map((p) => {
              const status = checkins[p.id]?.status;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{p.name}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setStatus(p, 'coming')}
                      disabled={saving === p.id}
                      className={`${btnBase} flex items-center gap-1 ${
                        status === 'coming'
                          ? 'bg-emerald-600 text-white'
                          : isDark ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" /> Coming
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(p, 'not')}
                      disabled={saving === p.id}
                      className={`${btnBase} flex items-center gap-1 ${
                        status === 'not'
                          ? 'bg-red-500 text-white'
                          : isDark ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" /> Can't
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Attendance list (visible to everyone) */}
      {comingList.length > 0 ? (
        <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
          {comingList
            .sort((a, b) => (a.playerName || '').localeCompare(b.playerName || ''))
            .map((c, i, arr) => (
              <div
                key={c.athleteId}
                className={`flex items-center gap-2 px-3 py-2 ${
                  i !== arr.length - 1 ? (isDark ? 'border-b border-white/10' : 'border-b border-slate-200') : ''
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                  <Check className={`w-3 h-3 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`} />
                </span>
                <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{c.playerName}</span>
              </div>
            ))}
        </div>
      ) : (
        <p className={`text-sm italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No check-ins yet</p>
      )}
    </div>
  );
};

export default EventCheckIn;
