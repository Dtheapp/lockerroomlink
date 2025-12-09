/**
 * OSYS Referee Game View
 * View game details, submit scores, add notes
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAssignmentNotes,
  addRefereeNote,
  updateRefereeNote,
  deleteRefereeNote,
  submitGameScore,
} from '../../services/refereeService';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Save,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Send,
  X,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { RefereeAssignment, RefereeNote } from '../../types/referee';

interface Props {
  assignmentId: string;
  onBack?: () => void;
}

export const RefereeGameView: React.FC<Props> = ({ assignmentId, onBack }) => {
  const { user, userData } = useAuth();
  const [assignment, setAssignment] = useState<RefereeAssignment | null>(null);
  const [notes, setNotes] = useState<RefereeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  
  // Score submission
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreSuccess, setScoreSuccess] = useState(false);
  
  // Note editing
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (assignmentId) {
      // Real-time subscription to assignment
      const unsubscribe = onSnapshot(
        doc(db, 'refereeAssignments', assignmentId),
        (docSnap) => {
          if (docSnap.exists()) {
            setAssignment({ id: docSnap.id, ...docSnap.data() } as RefereeAssignment);
          }
          setLoading(false);
        },
        (error) => {
          console.error('Error listening to assignment:', error);
          setLoading(false);
        }
      );
      
      return () => unsubscribe();
    }
  }, [assignmentId]);

  useEffect(() => {
    if (assignmentId && user?.uid) {
      loadNotes();
    }
  }, [assignmentId, user?.uid]);

  const loadNotes = async () => {
    if (!user?.uid) return;
    setNotesLoading(true);
    try {
      const notesData = await getAssignmentNotes(assignmentId, user.uid);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!user?.uid || !newNote.trim()) return;
    setSavingNote(true);
    try {
      await addRefereeNote({
        assignmentId,
        refereeId: user.uid,
        content: newNote.trim(),
        category: 'general',
      });
      setNewNote('');
      await loadNotes();
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingContent.trim()) return;
    setSavingNote(true);
    try {
      await updateRefereeNote(noteId, editingContent.trim());
      setEditingNoteId(null);
      setEditingContent('');
      await loadNotes();
    } catch (error) {
      console.error('Error updating note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteRefereeNote(noteId);
      await loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleSubmitScore = async () => {
    if (!user?.uid || !userData?.name) return;
    
    const home = parseInt(homeScore);
    const away = parseInt(awayScore);
    
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      setScoreError('Please enter valid scores');
      return;
    }
    
    setSubmittingScore(true);
    setScoreError(null);
    
    try {
      const result = await submitGameScore(
        assignmentId,
        home,
        away,
        user.uid,
        userData.name
      );
      
      if (result.success) {
        setScoreSuccess(true);
        setShowScoreForm(false);
      } else {
        setScoreError(result.error || 'Failed to submit score');
      }
    } catch (error: any) {
      setScoreError(error.message);
    } finally {
      setSubmittingScore(false);
    }
  };

  const formatDate = (date: Timestamp | Date | any) => {
    if (!date) return 'TBD';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatNoteDate = (date: Timestamp | Date | any) => {
    if (!date) return '';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isGameStarted = () => {
    if (!assignment) return false;
    const gameDate = assignment.gameDate instanceof Timestamp 
      ? assignment.gameDate.toDate() 
      : new Date(assignment.gameDate as any);
    return new Date() >= gameDate;
  };

  const canSubmitScore = () => {
    return assignment?.status === 'accepted' && isGameStarted() && !assignment?.scoreSubmitted;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Assignment Not Found</h2>
        <button
          onClick={onBack}
          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto mt-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {assignment.homeTeamName} vs {assignment.awayTeamName}
          </h1>
          <p className="text-slate-400 capitalize">{assignment.sport} Game</p>
        </div>
      </div>

      {/* Game Info Card */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Date</p>
                <p className="text-white font-medium">{formatDate(assignment.gameDate)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Time</p>
                <p className="text-white font-medium">
                  {assignment.gameTime ? formatTime(assignment.gameTime) : 'TBD'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Location</p>
                <p className="text-white font-medium">{assignment.location || 'TBD'}</p>
                {assignment.fieldNumber && (
                  <p className="text-sm text-slate-500">Field: {assignment.fieldNumber}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Your Role</p>
              <p className="text-white font-medium capitalize">
                {assignment.role || 'Official'} {assignment.position && `(${assignment.position})`}
              </p>
            </div>

            {assignment.paymentAmount != null && assignment.paymentAmount > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Payment</p>
                <p className="text-green-400 font-medium text-lg">
                  ${assignment.paymentAmount}
                  {assignment.paymentStatus === 'paid' && (
                    <span className="text-xs bg-green-500/20 px-2 py-0.5 rounded-full ml-2">
                      Paid
                    </span>
                  )}
                </p>
              </div>
            )}

            {assignment.leagueName && (
              <div>
                <p className="text-sm text-slate-400 mb-1">League</p>
                <p className="text-white font-medium">{assignment.leagueName}</p>
              </div>
            )}

            {assignment.ageGroup && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Age Group</p>
                <p className="text-white font-medium">{assignment.ageGroup}</p>
              </div>
            )}
          </div>
        </div>

        {assignment.notes && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Notes from Assigner</p>
            <p className="text-slate-300 italic">"{assignment.notes}"</p>
          </div>
        )}
      </div>

      {/* Score Section */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
          Game Score
        </h2>

        {assignment.scoreSubmitted ? (
          <div className="text-center py-6">
            <div className="flex items-center justify-center gap-8 mb-4">
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-1">{assignment.homeTeamName}</p>
                <p className="text-4xl font-bold text-white">{assignment.finalHomeScore}</p>
              </div>
              <span className="text-slate-500 text-2xl">-</span>
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-1">{assignment.awayTeamName}</p>
                <p className="text-4xl font-bold text-white">{assignment.finalAwayScore}</p>
              </div>
            </div>
            <p className="text-green-400 text-sm flex items-center justify-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Score Submitted
            </p>
          </div>
        ) : canSubmitScore() ? (
          showScoreForm ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    {assignment.homeTeamName} (Home)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-2xl text-center font-bold focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    {assignment.awayTeamName} (Away)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-2xl text-center font-bold focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {scoreError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {scoreError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowScoreForm(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitScore}
                  disabled={submittingScore || !homeScore || !awayScore}
                  className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingScore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Score
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-slate-400 mb-4">Game has started. Ready to submit the final score?</p>
              <button
                onClick={() => setShowScoreForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium transition-all"
              >
                Enter Final Score
              </button>
            </div>
          )
        ) : (
          <div className="text-center py-6 text-slate-400">
            {assignment.status !== 'accepted' ? (
              <p>Score submission available after accepting the assignment</p>
            ) : (
              <p>Score submission will be available once the game starts</p>
            )}
          </div>
        )}

        {scoreSuccess && (
          <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm text-center">
            Score submitted successfully! Standings have been updated.
          </div>
        )}
      </div>

      {/* Private Notes */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-yellow-400" />
          Private Notes
          <span className="text-xs text-slate-500 font-normal ml-2">(Only you can see these)</span>
        </h2>

        {/* Add Note */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a private note..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
          />
          <button
            onClick={handleAddNote}
            disabled={savingNote || !newNote.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Notes List */}
        {notesLoading ? (
          <div className="text-center py-4">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-slate-500 text-center py-4">No notes yet</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="bg-slate-700/50 rounded-lg p-3">
                {editingNoteId === note.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-1 text-white"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateNote(note.id!)}
                      disabled={savingNote}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingNoteId(null)}
                      className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-slate-200">{note.content}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatNoteDate(note.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingNoteId(note.id!);
                          setEditingContent(note.content);
                        }}
                        className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id!)}
                        className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RefereeGameView;
