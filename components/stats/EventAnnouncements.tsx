import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { TeamEvent, EventAttachment } from '../../types';
import { Calendar, MapPin, Megaphone, Paperclip, FileText, Download, X, Eye } from 'lucide-react';

// Helper: Format date string (YYYY-MM-DD) to readable format without timezone issues
const formatEventDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', options || { weekday: 'long', month: 'short', day: 'numeric' });
};

// Helper: Convert 24-hour time (HH:MM) to 12-hour format with AM/PM
const formatTime12Hour = (time24: string) => {
  if (!time24) return '';
  const [hourStr, minute] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
};

// Helper: Compare date strings without timezone issues
const compareDateToToday = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const eventDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventDate >= today;
};

const EventAnnouncements: React.FC = () => {
  const { teamData } = useAuth();
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Attachment viewing state
  const [viewingEvent, setViewingEvent] = useState<TeamEvent | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<EventAttachment | null>(null);

  useEffect(() => {
    if (!teamData?.id) return;
    setLoading(true);

    const eventsQuery = query(
      collection(db, 'teams', teamData.id, 'events'),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as TeamEvent));
      setEvents(eventsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  const upcomingEvents = events.filter(e => compareDateToToday(e.date));
  const pastEvents = events.filter(e => !compareDateToToday(e.date));

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
        return 'bg-orange-600 text-white';
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
                    <span>{formatEventDate(event.date)}</span>
                    {event.time && <span className="ml-2">{formatTime12Hour(event.time)}</span>}
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

                  {/* Attachments indicator */}
                  {event.attachments && event.attachments.length > 0 && (
                    <button
                      onClick={() => setViewingEvent(event)}
                      className="mt-2 flex items-center gap-2 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium"
                    >
                      <Paperclip className="w-4 h-4" />
                      <span>View {event.attachments.length} attachment{event.attachments.length > 1 ? 's' : ''}</span>
                      <Eye className="w-4 h-4" />
                    </button>
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
                    {formatEventDate(event.date, { month: 'short', day: 'numeric' })}
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

      {/* VIEW ATTACHMENTS MODAL */}
      {viewingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{viewingEvent.title}</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  {viewingEvent.attachments?.length || 0} attachment{(viewingEvent.attachments?.length || 0) !== 1 ? 's' : ''}
                </p>
              </div>
              <button 
                onClick={() => setViewingEvent(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {viewingEvent.attachments && viewingEvent.attachments.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {viewingEvent.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden"
                    >
                      {attachment.type === 'image' ? (
                        <button
                          onClick={() => setViewingAttachment(attachment)}
                          className="w-full aspect-square bg-slate-100 dark:bg-zinc-800 hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="aspect-square bg-slate-100 dark:bg-zinc-800 flex flex-col items-center justify-center p-4">
                          <FileText className="w-12 h-12 text-orange-500 mb-2" />
                          <span className="text-xs text-slate-600 dark:text-zinc-400 text-center truncate w-full px-2">
                            {attachment.name}
                          </span>
                        </div>
                      )}
                      <div className="p-2 bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-between">
                        <span className="text-xs text-slate-600 dark:text-zinc-400 truncate flex-1">
                          {attachment.name}
                        </span>
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 dark:text-orange-400 hover:text-orange-700 p-1"
                          title="Open / Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 dark:text-zinc-400 py-8">
                  No attachments for this event
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL IMAGE VIEWER MODAL */}
      {viewingAttachment && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90"
          onClick={() => setViewingAttachment(null)}
        >
          <button 
            onClick={() => setViewingAttachment(null)}
            className="absolute top-4 right-4 text-white hover:text-slate-300 p-2 bg-black/50 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={viewingAttachment.url}
            alt={viewingAttachment.name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={viewingAttachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      )}
    </div>
  );
};

export default EventAnnouncements;
