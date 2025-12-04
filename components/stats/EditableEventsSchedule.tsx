import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, uploadEventAttachment, deleteEventAttachment } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { TeamEvent, EventAttachment } from '../../types';
import { Calendar, Plus, Edit2, Trash2, MapPin, Clock, X, Upload, FileText, Image, Paperclip, Download, Eye } from 'lucide-react';

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
    attachments: [],
  });
  
  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<EventAttachment[]>([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<EventAttachment[]>([]);
  
  // Event detail view state
  const [viewingEvent, setViewingEvent] = useState<TeamEvent | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<EventAttachment | null>(null);
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; date: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Accepted file types
  const acceptedFileTypes = '.jpg,.jpeg,.png,.gif,.webp,.pdf';
  const maxFileSize = 10 * 1024 * 1024; // 10MB

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

    setUploading(true);
    try {
      let eventId = editingId;
      let currentAttachments = existingAttachments;

      if (editingId) {
        // Delete attachments marked for removal
        for (const attachment of attachmentsToDelete) {
          try {
            await deleteEventAttachment(teamData.id, editingId, attachment);
          } catch (err) {
            console.warn('Failed to delete attachment:', err);
          }
        }
      } else {
        // Add new event first to get the ID
        const docRef = await addDoc(collection(db, 'teams', teamData.id, 'events'), {
          ...formData,
          attachments: [],
          teamId: teamData.id,
          createdAt: serverTimestamp(),
          createdBy: userData?.uid,
          updatedAt: serverTimestamp(),
        });
        eventId = docRef.id;
        currentAttachments = [];
      }

      // Upload new files
      const uploadedAttachments: EventAttachment[] = [];
      for (const file of pendingFiles) {
        try {
          const attachment = await uploadEventAttachment(
            teamData.id,
            eventId!,
            file,
            userData?.uid || 'unknown'
          );
          uploadedAttachments.push(attachment);
        } catch (err) {
          console.error('Failed to upload file:', file.name, err);
          alert(`Failed to upload ${file.name}`);
        }
      }

      // Combine existing and new attachments
      const allAttachments = [...currentAttachments, ...uploadedAttachments];

      // Update the event with attachments
      const eventRef = doc(db, 'teams', teamData.id, 'events', eventId!);
      await updateDoc(eventRef, {
        ...(editingId ? formData : {}),
        attachments: allAttachments,
        updatedAt: serverTimestamp(),
      });

      // Reset form
      setFormData({
        date: '',
        time: '',
        title: '',
        type: 'Practice',
        location: '',
        description: '',
        attachments: [],
      });
      setPendingFiles([]);
      setExistingAttachments([]);
      setAttachmentsToDelete([]);
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Failed to save event. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (event: TeamEvent) => {
    setFormData(event);
    setEditingId(event.id);
    setExistingAttachments(event.attachments || []);
    setAttachmentsToDelete([]);
    setPendingFiles([]);
    setShowForm(true);
  };

  // File handling functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    
    for (const file of files) {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }
      validFiles.push(file);
    }
    
    setPendingFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const markAttachmentForDeletion = (attachment: EventAttachment) => {
    setAttachmentsToDelete(prev => [...prev, attachment]);
    setExistingAttachments(prev => prev.filter(a => a.id !== attachment.id));
  };

  const getFileIcon = (type: string) => {
    if (type === 'image') return <Image className="w-4 h-4" />;
    if (type === 'pdf') return <FileText className="w-4 h-4" />;
    return <Paperclip className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

            {/* Attachments Section */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Attachments (Images, PDFs - Max 10MB each)
              </label>
              
              {/* Existing Attachments */}
              {existingAttachments.length > 0 && (
                <div className="mb-3 space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Current attachments:</p>
                  {existingAttachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded">
                      {getFileIcon(attachment.type)}
                      <span className="flex-1 text-sm truncate text-slate-700 dark:text-slate-300">{attachment.name}</span>
                      <span className="text-xs text-slate-500">{formatFileSize(attachment.size)}</span>
                      <button
                        type="button"
                        onClick={() => markAttachmentForDeletion(attachment)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Pending Files to Upload */}
              {pendingFiles.length > 0 && (
                <div className="mb-3 space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Files to upload:</p>
                  {pendingFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded border border-emerald-200 dark:border-emerald-800">
                      {file.type.startsWith('image/') ? <Image className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-emerald-600" />}
                      <span className="flex-1 text-sm truncate text-slate-700 dark:text-slate-300">{file.name}</span>
                      <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Upload Button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept={acceptedFileTypes}
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-300 dark:border-slate-600 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Add Files
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddOrEdit}
                disabled={uploading}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white px-4 py-2 rounded font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingId ? 'Update Event' : 'Add Event'
                )}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setPendingFiles([]);
                  setExistingAttachments([]);
                  setAttachmentsToDelete([]);
                  setFormData({
                    date: '',
                    time: '',
                    title: '',
                    type: 'Practice',
                    location: '',
                    description: '',
                    attachments: [],
                  });
                }}
                disabled={uploading}
                className="flex-1 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-900 dark:text-white px-4 py-2 rounded font-semibold transition-colors"
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
                    <span>{formatEventDate(event.date)}</span>
                    {event.time && (
                      <>
                        <Clock className="w-4 h-4 ml-2" />
                        <span>{formatTime12Hour(event.time)}</span>
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

                  {/* Attachments indicator */}
                  {event.attachments && event.attachments.length > 0 && (
                    <button
                      onClick={() => setViewingEvent(event)}
                      className="mt-2 flex items-center gap-2 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                    >
                      <Paperclip className="w-4 h-4" />
                      <span>{event.attachments.length} attachment{event.attachments.length > 1 ? 's' : ''}</span>
                      <Eye className="w-4 h-4" />
                    </button>
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
                      {formatEventDate(event.date, { month: 'short', day: 'numeric' })}
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
                {formatEventDate(deleteConfirm.date, { weekday: 'long', month: 'long', day: 'numeric' })}
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

export default EditableEventsSchedule;