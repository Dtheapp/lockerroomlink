/**
 * TeamPolls
 * Coaches create polls; team members (parents + coaches) vote. Results update
 * live. One vote per user (stored in a votes map on the poll doc), and voters
 * can change their choice while the poll is open.
 *
 * Firestore: teams/{teamId}/polls/{pollId}
 *   { question, options: [{id, text}], votes: { [uid]: optionId },
 *     status: 'open'|'closed', createdBy, createdByName, createdAt }
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText } from '../services/sanitize';
import { BarChart3, Plus, X, Trash2, Check, Lock } from 'lucide-react';

interface PollOption {
  id: string;
  text: string;
}
interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  votes?: Record<string, string>;
  status?: 'open' | 'closed';
  createdByName?: string;
}

interface TeamPollsProps {
  teamId?: string;
  isCoach?: boolean;
  currentUserId?: string;
  theme: string;
}

const optId = () => `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const TeamPolls: React.FC<TeamPollsProps> = ({ teamId, isCoach = false, currentUserId, theme }) => {
  const isDark = theme === 'dark';
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    const q = query(collection(db, 'teams', teamId, 'polls'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPolls(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Poll[]);
    });
    return () => unsub();
  }, [teamId]);

  const openPolls = useMemo(() => polls.filter((p) => p.status !== 'closed'), [polls]);
  const newCount = useMemo(
    () => openPolls.filter((p) => currentUserId && !(p.votes && p.votes[currentUserId])).length,
    [openPolls, currentUserId]
  );

  const vote = async (poll: Poll, optionId: string) => {
    if (!teamId || !currentUserId) return;
    try {
      await updateDoc(doc(db, 'teams', teamId, 'polls', poll.id), {
        [`votes.${currentUserId}`]: optionId,
      });
    } catch (err) {
      console.error('[TeamPolls] vote failed:', err);
    }
  };

  const createPoll = async () => {
    if (!teamId || saving) return;
    const q = sanitizeText(question, 200).trim();
    const opts = options.map((o) => sanitizeText(o, 100).trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'teams', teamId, 'polls'), {
        question: q,
        options: opts.map((text) => ({ id: optId(), text })),
        votes: {},
        status: 'open',
        createdBy: currentUserId || null,
        createdAt: serverTimestamp(),
      });
      setQuestion('');
      setOptions(['', '']);
      setShowCreate(false);
    } catch (err) {
      console.error('[TeamPolls] create failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const closePoll = async (poll: Poll) => {
    if (!teamId) return;
    await updateDoc(doc(db, 'teams', teamId, 'polls', poll.id), {
      status: poll.status === 'closed' ? 'open' : 'closed',
    }).catch(() => {});
  };

  const removePoll = async (pollId: string) => {
    if (!teamId) return;
    await deleteDoc(doc(db, 'teams', teamId, 'polls', pollId)).catch(() => {});
    setDeleteId(null);
  };

  const cardBg = isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          <BarChart3 className="w-5 h-5 text-purple-500" /> Team Polls
          {newCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
              {newCount} NEW
            </span>
          )}
        </h2>
        {isCoach && (
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white"
          >
            <Plus className="w-3.5 h-3.5" /> New Poll
          </button>
        )}
      </div>
      <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        {isCoach ? 'Create a poll so your team can vote.' : 'Vote so your coaches know where the team stands.'}
      </p>

      {/* Create form */}
      {isCoach && showCreate && (
        <div className={`p-3 rounded-xl border mb-3 ${cardBg}`}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question… (e.g. New jersey color?)"
            maxLength={200}
            className={`w-full mb-2 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-white/10 border border-white/20 text-white placeholder-slate-500' : 'bg-white border border-slate-300 text-zinc-900'}`}
          />
          <div className="space-y-2 mb-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
                  placeholder={`Option ${i + 1}`}
                  maxLength={100}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-white/10 border border-white/20 text-white placeholder-slate-500' : 'bg-white border border-slate-300 text-zinc-900'}`}
                />
                {options.length > 2 && (
                  <button onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            {options.length < 6 ? (
              <button onClick={() => setOptions((prev) => [...prev, ''])} className="text-xs font-medium text-purple-500 hover:text-purple-400">
                + Add option
              </button>
            ) : <span />}
            <button
              onClick={createPoll}
              disabled={saving || !question.trim() || options.filter((o) => o.trim()).length < 2}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
            >
              {saving ? 'Posting…' : 'Post Poll'}
            </button>
          </div>
        </div>
      )}

      {/* Polls list */}
      {polls.length === 0 ? (
        <p className={`text-sm italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No polls yet</p>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => {
            const votes = poll.votes || {};
            const total = Object.keys(votes).length;
            const myVote = currentUserId ? votes[currentUserId] : undefined;
            const closed = poll.status === 'closed';
            const showResults = !!myVote || closed || isCoach;
            return (
              <div key={poll.id} className={`p-3 rounded-xl border ${cardBg}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{poll.question}</p>
                  {isCoach && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => closePoll(poll)} title={closed ? 'Reopen' : 'Close voting'} className={`p-1 rounded ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(poll.id)} title="Delete poll" className={`p-1 rounded ${isDark ? 'text-slate-400 hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  {poll.options.map((opt) => {
                    const count = Object.values(votes).filter((v) => v === opt.id).length;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const mine = myVote === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !closed && vote(poll, opt.id)}
                        disabled={closed}
                        className={`relative w-full text-left px-3 py-2 rounded-lg overflow-hidden border transition ${
                          mine
                            ? 'border-purple-500'
                            : isDark ? 'border-white/10 hover:border-white/30' : 'border-slate-200 hover:border-slate-300'
                        } ${closed ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {showResults && (
                          <span
                            className={`absolute inset-y-0 left-0 ${mine ? 'bg-purple-500/25' : isDark ? 'bg-white/10' : 'bg-slate-200/70'}`}
                            style={{ width: `${pct}%` }}
                          />
                        )}
                        <span className="relative flex items-center justify-between gap-2">
                          <span className={`text-sm flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            {mine && <Check className="w-3.5 h-3.5 text-purple-500" />}
                            {opt.text}
                          </span>
                          {showResults && (
                            <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{pct}%</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className={`mt-2 flex items-center justify-between text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  <span>{total} vote{total !== 1 ? 's' : ''}{closed ? ' • Closed' : ''}</span>
                  {!myVote && !closed && <span className="text-purple-500 font-medium">Tap an option to vote</span>}
                </div>

                {deleteId === poll.id && (
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Delete this poll?</span>
                    <button onClick={() => setDeleteId(null)} className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-700'}`}>Cancel</button>
                    <button onClick={() => removePoll(poll.id)} className="text-xs px-2 py-1 rounded bg-red-600 text-white">Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamPolls;
