import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, limitToLast, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText } from '../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import type { Message } from '../types';
import { Send, AlertCircle, Shield, Lock, Edit2, Trash2, X, Check } from 'lucide-react';
import { AnimatedBackground, GlassCard } from './ui/OSYSComponents';

const Strategies: React.FC = () => {
  const { user, userData, teamData } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Edit/Delete message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Only coaches can access this chat
  const isCoach = userData?.role === 'Coach';

  // Track if initial load is complete using a ref (not state) to avoid re-renders
  const isInitialLoadRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);

  // Scroll to top of page when component mounts
  useEffect(() => {
    // Immediate scroll
    window.scrollTo(0, 0);
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
    
    // Also scroll after a delay to catch any async renders
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = 0;
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!teamData?.id || !isCoach) return;
    
    // Strategies messages are stored in a separate subcollection
    const strategiesCollection = collection(db, 'teams', teamData.id, 'strategies');
    const strategiesQuery = query(strategiesCollection, orderBy('timestamp'), limitToLast(50));

    const unsubscribe = onSnapshot(strategiesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Message));
      setMessages(messagesData);
    }, (error) => {
      console.error("Error loading strategies chat:", error);
    });

    return () => unsubscribe();
  }, [teamData?.id, isCoach]);
  
  // Auto-scroll to bottom only for NEW messages (after initial load)
  useEffect(() => {
    // Skip scroll on initial load - instead scroll to TOP
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevMessagesLengthRef.current = messages.length;
      // Scroll container to TOP on initial load
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = 0;
      }
      return;
    }
    
    // Only scroll if new message was added (not just re-render)
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !userData || !teamData?.id || sending || !isCoach) return;

    // Rate limit check
    const rateLimitKey = `strategies:${user.uid}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.CHAT_MESSAGE);
    
    if (!rateLimitResult.allowed) {
      const seconds = Math.ceil(rateLimitResult.retryAfterMs / 1000);
      setRateLimitError(`Slow down! Please wait ${seconds}s before sending another message.`);
      setTimeout(() => setRateLimitError(null), 3000);
      return;
    }

    setSending(true);
    setRateLimitError(null);
    try {
      await addDoc(collection(db, 'teams', teamData.id, 'strategies'), {
        text: sanitizeText(newMessage, 2000),
        sender: {
          uid: user.uid,
          name: sanitizeText(userData.name, 100)
        },
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending strategy message:", error);
    } finally {
      setSending(false);
    }
  };

  // Edit own message
  const handleEditMessage = async (messageId: string) => {
    if (!teamData?.id || !editingText.trim()) return;
    
    setSavingEdit(true);
    try {
      const messageDocRef = doc(db, 'teams', teamData.id, 'strategies', messageId);
      await updateDoc(messageDocRef, {
        text: sanitizeText(editingText, 2000),
        edited: true,
        editedAt: serverTimestamp()
      });
      setEditingMessageId(null);
      setEditingText('');
    } catch (error) {
      console.error("Error editing message:", error);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete own message
  const handleDeleteMessage = async (messageId: string) => {
    if (!teamData?.id) return;
    
    setDeleting(true);
    try {
      const messageDocRef = doc(db, 'teams', teamData.id, 'strategies', messageId);
      await deleteDoc(messageDocRef);
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting message:", error);
    } finally {
      setDeleting(false);
    }
  };
  
  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // If not a coach, show access denied
  if (!isCoach) {
    return (
      <div className="relative h-full min-h-screen">
        <AnimatedBackground />
        <div className="relative z-10 h-full flex items-center justify-center p-8">
          <GlassCard className="max-w-md text-center p-8">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Lock className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Coaches Only</h2>
            <p className="text-slate-500 dark:text-zinc-400">
              The Strategy Room is a private space for coaches to discuss game plans, plays, and team strategies.
            </p>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-screen">
      <AnimatedBackground />
      <div className="relative z-10 h-full flex flex-col">
        <GlassCard className="flex-1 flex flex-col overflow-hidden !p-0">
      
      {/* HEADER */}
      <div className="sticky top-0 z-10 p-4 border-b border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 dark:bg-orange-500/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Strategy Room</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Coaches Only</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
            <Lock className="w-3 h-3" />
            Private
          </div>
        </div>
      </div>
      
      {/* MESSAGES AREA */}
      <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-black/20">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 bg-purple-100/80 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-purple-500 dark:text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-zinc-300 mb-2">
              Start Planning
            </h3>
            <p className="text-slate-500 dark:text-zinc-500 max-w-sm">
              This is your private coaching channel. Share strategies, discuss plays, and coordinate with other coaches.
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender.uid === user?.uid;
            const isEditing = editingMessageId === msg.id;
            const isEdited = (msg as any).edited;
            
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md p-3 rounded-2xl shadow-lg ${
                  isMe 
                    ? 'bg-gradient-to-br from-purple-600 to-purple-700 dark:from-orange-500 dark:to-orange-600 text-white rounded-br-none'
                    : 'bg-white/80 dark:bg-white/10 backdrop-blur-sm text-slate-900 dark:text-slate-200 rounded-bl-none border border-slate-200/50 dark:border-white/10'
                }`}>
                  {!isMe && (
                    <p className="text-xs font-bold text-purple-600 dark:text-orange-400 mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {msg.sender.name}
                    </p>
                  )}
                  
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="bg-white/20 border border-white/30 rounded px-2 py-1 text-sm text-white focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleEditMessage(msg.id); }
                          if (e.key === 'Escape') { setEditingMessageId(null); setEditingText(''); }
                        }}
                      />
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => { setEditingMessageId(null); setEditingText(''); }}
                          className="text-purple-200 dark:text-orange-200 hover:text-white p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditMessage(msg.id)}
                          disabled={savingEdit || !editingText.trim()}
                          className="text-purple-200 dark:text-orange-200 hover:text-white p-1 disabled:opacity-50"
                        >
                          {savingEdit ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      {/* Footer with timestamp and actions */}
                      <div className={`text-[10px] mt-1 flex items-center justify-between gap-2 ${isMe ? 'text-purple-200 dark:text-orange-200' : 'text-slate-400 dark:text-slate-500'}`}>
                        <span>{isEdited && '(edited)'}</span>
                        <div className="flex items-center gap-2">
                          {isMe && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { setEditingMessageId(msg.id); setEditingText(msg.text); }}
                                className="hover:text-white p-0.5 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(msg.id)}
                                className="hover:text-white p-0.5 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <span>{formatDate(msg.timestamp)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="px-4 py-3 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border-t border-red-200/50 dark:border-red-900/30 flex items-center justify-between">
          <p className="text-sm text-red-600 dark:text-red-400">Delete this message?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-3 py-1 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteMessage(deleteConfirm)}
              disabled={deleting}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* INPUT AREA */}
      <div className="p-4 border-t border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-black/40 backdrop-blur-xl">
        {/* Rate limit warning */}
        {rateLimitError && (
          <div className="mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-sm px-3 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {rateLimitError}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Share a strategy or play idea..."
            className="flex-1 bg-white/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-full shadow-inner py-3 px-5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-orange-500/50 transition-all"
          />
          <button 
            type="submit" 
            className="p-3 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 dark:from-orange-500 dark:to-orange-600 hover:from-purple-500 hover:to-purple-600 dark:hover:from-orange-400 dark:hover:to-orange-500 transition-colors shadow-lg shadow-purple-900/20 dark:shadow-orange-900/20 disabled:opacity-50 disabled:cursor-not-allowed" 
            disabled={!newMessage.trim() || sending}
            aria-label="Send message"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </form>
      </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default Strategies;
