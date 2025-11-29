import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { TeamEvent } from '../../types';
import { Calendar, MapPin, Megaphone } from 'lucide-react';

const EventAnnouncements: React.FC = () => {
  const { teamData } = useAuth();
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamData?.id) return;
    setLoading(true);

    const q = query(
      collection(db, 'teams', teamData.id, 'events'),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamEvent));
      setEvents(eventsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date(new Date().toISOString().split('T')[0]));
  const pastEvents = events.filter(e => new Date(e.date) < new Date(new Date().toISOString().split('T')[0]));

  const getTypeColor = (type: TeamEvent['type']) => {
    switch (type) {
      case 'Game':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300';
      case 'Practice':
        return 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-900/50 text-sky-700 dark:text-sky-300';
      default:
        return 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
    }
  };

  const getTypeBadge = (type: TeamEvent['type']) => {
    switch (type) {
      case 'Game':
        return 'bg-red-600 text-white';
      case 'Practice':
        return 'bg-sky-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Megaphone className="w-6 h-6 text-sky-500" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Team Events</h2>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            Upcoming Events
          </h3>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className={`p-4 rounded-lg border ${getTypeColor(event.type)} transition-all hover:shadow-md`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getTypeBadge(event.type)}`}>
                      {event.type}
                    </span>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">{event.title}</h4>
                  </div>
                </div>

                <div className="space-y-1 ml-0">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                    {event.time && <span className="ml-2 font-mono">{event.time}</span>}
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>
                  )}

                  {event.description && (
                    <p className="text-sm mt-2 pt-2 border-t border-current/20">{event.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Events (if any) */}
      {pastEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-3">Past Events</h3>
          <div className="space-y-3 opacity-60">
            {pastEvents.slice(-5).map((event) => (
              <div
                key={event.id}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-1 rounded text-xs font-bold bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                      {event.type}
                    </span>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">{event.title}</h4>
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
          Loading events...
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
          No events scheduled yet. Check back soon!
        </div>
      )}
    </div>
  );
};

export default EventAnnouncements;
