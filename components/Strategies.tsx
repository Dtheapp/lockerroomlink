import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, limitToLast } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText } from '../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import type { Message } from '../types';
import { Send, AlertCircle, Shield, Lock } from 'lucide-react';

const Strategies: React.FC = () => {
  const { user, userData, teamData } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Only coaches can access this chat
  const isCoach = userData?.role === 'Coach';

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
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
  
  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // If not a coach, show access denied
  if (!isCoach) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 rounded-lg shadow-lg border border-slate-200 dark:border-zinc-800 p-8">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Coaches Only</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-center max-w-md">
          The Strategy Room is a private space for coaches to discuss game plans, plays, and team strategies.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950 rounded-lg shadow-lg dark:shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
      
      {/* HEADER */}
      <div className="sticky top-0 z-10 p-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            Strategy Room
            <span className="text-orange-500 text-sm font-mono uppercase tracking-wider">(Coaches Only)</span>
          </h1>
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
            <Lock className="w-3 h-3" />
            Private
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
          Discuss plays and game plans with your coaching staff
        </p>
      </div>
      
      {/* MESSAGES AREA */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-black/20">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-orange-500" />
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
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md p-3 rounded-2xl shadow-sm ${
                  isMe 
                    ? 'bg-gradient-to-br from-orange-600 to-orange-700 text-white rounded-br-none'
                    : 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-zinc-700'
                }`}>
                  {!isMe && (
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {msg.sender.name}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-orange-200' : 'text-slate-400'}`}>
                    {formatDate(msg.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        {/* Rate limit warning */}
        {rateLimitError && (
          <div className="mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
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
            className="flex-1 bg-slate-100 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-full shadow-inner py-3 px-5 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
          />
          <button 
            type="submit" 
            className="p-3 rounded-full bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 transition-colors shadow-lg shadow-orange-900/20 disabled:opacity-50 disabled:cursor-not-allowed" 
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
    </div>
  );
};

export default Strategies;
