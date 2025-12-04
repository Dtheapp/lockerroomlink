import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { TeamEvent } from '../../types';
import { Calendar, Plus, Edit2, Trash2, MapPin, Clock, X } from 'lucide-react';

const EditableEventsSchedule: React.FC = () => {
  const { teamData, userData } = useAuth();
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<TeamEvent>>({
    date: '',
    time: '',
    title: '',
    type: 'Practice',
    location: '',
    description: '',
  });
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; date: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleAddOrEdit = async () => {
    if (!teamData?.id || !formData.date || !formData.title) {
      alert('Date and Title are required');
      return;
    }

    try {
      if (editingId) {
        // Update existing event
        const eventRef = doc(db, 'teams', teamData.id, 'events', editingId);
        await updateDoc(eventRef, {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        setEditingId(null);
      } else {
        // Add new event
        await addDoc(collection(db, 'teams', teamData.id, 'events'), {
          ...formData,
          teamId: teamData.id,
          createdAt: serverTimestamp(),
          createdBy: userData?.uid,
          updatedAt: serverTimestamp(),
        });
      }

      setFormData({
        date: '',
        time: '',
        title: '',
        type: 'Practice',
        location: '',
        description: '',
      });
      setShowForm(false);
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleEdit = (event: TeamEvent) => {
    setFormData(event);
    setEditingId(event.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!teamData?.id || !deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'teams', teamData.id, 'events', deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting event:', error);
    } finally {
      setDeleting(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Game':
        return 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300';
      case 'Practice':
        return 'bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-900/50 text-sky-700 dark:text-sky-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'Game':
        return 'bg-red-600 text-white';
      case 'Practice':
        return 'bg-orange-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter(e => e.date >= today);
  const pastEvents = events.filter(e => e.date < today);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-sky-500" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Events Schedule</h2>
        </div>
        <button
          onClick={() => {
            setFormData({
              date: '',
              time: '',
              title: '',
              type: 'Practice',
              location: '',
              description: '',
            });
            setEditingId(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Event
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            {editingId ? 'Edit Event' : 'Add New Event'}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time (optional)</label>
                <input
                  type="time"
                  value={formData.time || ''}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
              <input
                type="text"
                placeholder="e.g., Practice Session, Away Game vs Tigers"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Event Type</label>
                <select
                  value={formData.type || 'Practice'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="Practice">Practice</option>
                  <option value="Game">Game</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
                <input
                  type="text"
                  placeholder="Field, Stadium, etc."
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                placeholder="Additional details for parents..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 resize-none h-24"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddOrEdit}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded font-semibold transition-colors"
              >
                {editingId ? 'Update Event' : 'Add Event'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    date: '',
                    time: '',
                    title: '',
                    type: 'Practice',
                    location: '',
                    description: '',
                  });
                }}
                className="flex-1 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-4 py-2 rounded font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Upcoming Events</h3>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className={`p-4 rounded-lg border ${getTypeColor(event.type)} transition-all`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getTypeBadgeColor(event.type)}`}>
                      {event.type}
                    </span>
                    <h4 className="text-lg font-bold">{event.title}</h4>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(event)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ id: event.id, title: event.title, date: event.date })}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                    {event.time && (
                      <>
                        <Clock className="w-4 h-4 ml-2" />
                        <span className="font-mono">{event.time}</span>
                      </>
                    )}
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>
                  )}

                  {event.description && (
                    <p className="mt-2 pt-2 border-t border-current/20">{event.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Events */}
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
                    <span className="px-2 py-1 rounded text-xs font-bold bg-slate-300 dark:bg-slate-600">
                      {event.type}
                    </span>
                    <h4 className="text-sm font-bold mt-1">{event.title}</h4>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm({ id: event.id, title: event.title, date: event.date })}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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

      {!loading && events.length === 0 && !showForm && (
        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
          No events scheduled yet. Click "Add Event" to get started!
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Event</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
              <p className="font-bold text-slate-900 dark:text-white">{deleteConfirm.title}</p>
              <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
                {new Date(deleteConfirm.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              Are you sure you want to delete this event? All team members will no longer see it on the schedule.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Event
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableEventsSchedule;