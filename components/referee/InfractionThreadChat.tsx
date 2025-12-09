/**
 * Infraction Thread Chat
 * 4-way communication between League, Referee, Team Director, and Head Coach
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  AlertTriangle, 
  Shield, 
  User,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  Paperclip,
  Users
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getInfractionMessages, 
  sendInfractionMessage, 
  markInfractionMessagesRead,
  getInfraction,
  getInfractionThread
} from '../../services/leagueService';
import type { Infraction, InfractionThread, InfractionMessage } from '../../types';

interface InfractionThreadChatProps {
  isOpen: boolean;
  onClose: () => void;
  infractionId: string;
  threadId: string;
  userRole: 'league' | 'referee' | 'team' | 'headcoach';
}

export const InfractionThreadChat: React.FC<InfractionThreadChatProps> = ({
  isOpen,
  onClose,
  infractionId,
  threadId,
  userRole,
}) => {
  const { user, userData } = useAuth();
  const [infraction, setInfraction] = useState<Infraction | null>(null);
  const [thread, setThread] = useState<InfractionThread | null>(null);
  const [messages, setMessages] = useState<InfractionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && infractionId && threadId) {
      loadData();
      markAsRead();
      
      // Set up real-time listener for messages
      const unsubscribe = onSnapshot(
        doc(db, 'infractionThreads', threadId),
        () => {
          loadMessages();
        }
      );
      
      return () => unsubscribe();
    }
  }, [isOpen, infractionId, threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [infractionData, threadData, messagesData] = await Promise.all([
        getInfraction(infractionId),
        getInfractionThread(threadId),
        getInfractionMessages(threadId),
      ]);
      setInfraction(infractionData);
      setThread(threadData);
      setMessages(messagesData);
    } catch (err) {
      console.error('Error loading thread:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const messagesData = await getInfractionMessages(threadId);
      setMessages(messagesData);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const markAsRead = async () => {
    if (user?.uid) {
      await markInfractionMessagesRead(threadId, user.uid, userRole);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!user?.uid || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendInfractionMessage(
        threadId,
        user.uid,
        userData?.name || 'Unknown',
        userRole,
        newMessage.trim()
      );
      setNewMessage('');
      loadMessages();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const severityColors = {
    minor: 'bg-blue-500/20 text-blue-400',
    moderate: 'bg-yellow-500/20 text-yellow-400',
    major: 'bg-orange-500/20 text-orange-400',
    severe: 'bg-red-500/20 text-red-400',
  };

  const statusColors = {
    submitted: 'text-blue-400',
    under_review: 'text-yellow-400',
    resolved: 'text-green-400',
    dismissed: 'text-slate-400',
    appealed: 'text-purple-400',
  };

  const roleColors = {
    league: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    referee: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    team: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    headcoach: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  const roleLabels = {
    league: 'League',
    referee: 'Referee',
    team: 'Team Director',
    headcoach: 'Head Coach',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {infraction?.title || 'Infraction Discussion'}
                </h2>
                <div className="flex items-center gap-2 text-xs">
                  {infraction && (
                    <>
                      <span className={`px-2 py-0.5 rounded-full ${severityColors[infraction.severity]}`}>
                        {infraction.severity}
                      </span>
                      <span className={statusColors[infraction.status]}>
                        {infraction.status.replace('_', ' ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Participants */}
          {thread && (
            <div className="px-4 pb-3 flex flex-wrap items-center gap-2 text-xs">
              <Users size={14} className="text-slate-400" />
              <span className="text-slate-400">Participants:</span>
              <span className={`px-2 py-0.5 rounded border ${roleColors.league}`}>
                League
              </span>
              <span className={`px-2 py-0.5 rounded border ${roleColors.referee}`}>
                {thread.participants.refereeName || 'Referee'}
              </span>
              <span className={`px-2 py-0.5 rounded border ${roleColors.team}`}>
                {thread.participants.teamDirectorName || 'Team Director'}
              </span>
              {thread.participants.headCoachId && (
                <span className={`px-2 py-0.5 rounded border ${roleColors.headcoach}`}>
                  {thread.participants.headCoachName || 'Head Coach'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <MessageCircle size={32} className="mb-2" />
              <p>No messages yet</p>
              <p className="text-xs text-slate-500">Start the conversation about this infraction</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.senderId === user?.uid;
              const isSystem = msg.senderId === 'system';
              
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] ${
                      isSystem
                        ? 'w-full bg-zinc-800/50 border border-white/5 rounded-lg p-3'
                        : isOwn
                        ? 'bg-orange-600/20 border border-orange-500/30 rounded-2xl rounded-br-md px-4 py-2'
                        : 'bg-zinc-800 border border-white/10 rounded-2xl rounded-bl-md px-4 py-2'
                    }`}
                  >
                    {!isSystem && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded border ${roleColors[msg.senderRole]}`}>
                          {roleLabels[msg.senderRole]}
                        </span>
                        <span className="text-xs text-slate-400">{msg.senderName}</span>
                      </div>
                    )}
                    <p className={`text-sm ${isSystem ? 'text-slate-300 whitespace-pre-wrap' : 'text-white'}`}>
                      {msg.content}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-slate-500">
                        {new Date((msg.createdAt as any)?.toDate?.() || msg.createdAt).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {thread?.status === 'active' && (
          <div className="flex-shrink-0 p-4 border-t border-white/10 bg-zinc-900/50">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="Type your message..."
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="flex-shrink-0 p-3 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${roleColors[userRole]}`}>
                Sending as: {roleLabels[userRole]}
              </span>
            </div>
          </div>
        )}

        {/* Closed Thread Notice */}
        {thread?.status === 'closed' && (
          <div className="flex-shrink-0 p-4 border-t border-white/10 bg-zinc-900/50 text-center">
            <p className="text-slate-400 text-sm">This thread has been closed</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfractionThreadChat;
