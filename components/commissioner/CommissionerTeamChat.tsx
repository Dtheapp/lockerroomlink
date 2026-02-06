/**
 * Commissioner Team Chat Component
 * Team chat with team selector (for multiple teams) and full admin rights
 * Admin can: mute users, delete messages, pin messages
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team } from '../../types';
import { 
  Shield, 
  Loader2, 
  Send,
  ChevronDown,
  Trash2,
  Pin,
  VolumeX,
  MoreVertical,
  MessageSquare,
  Users,
  X
} from 'lucide-react';

interface ChatMessage {
  id: string;
  text: string;
  // New format (matches Coach Chat)
  sender?: {
    uid: string;
    name: string;
    role?: string;
  };
  // Legacy format (backwards compatibility)
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  timestamp: Timestamp;
  isPinned?: boolean;
  isDeleted?: boolean;
  readBy?: string[];
}

// Helper to get sender info from either format
const getSenderId = (msg: ChatMessage): string => msg.sender?.uid || msg.senderId || '';
const getSenderName = (msg: ChatMessage): string => msg.sender?.name || msg.senderName || 'Unknown';
const getSenderRole = (msg: ChatMessage): string | undefined => msg.sender?.role || msg.senderRole;
const getSenderPhoto = (msg: ChatMessage): string | null | undefined => (msg.sender as any)?.photoUrl;

interface MutedUser {
  odI: string;
  name: string;
  mutedAt: Timestamp;
  mutedBy: string;
  muteExpires?: Timestamp;
}

export const CommissionerTeamChat: React.FC = () => {
  const { userData, user } = useAuth();
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [mutedUsers, setMutedUsers] = useState<string[]>([]);

  // Load commissioner's teams
  useEffect(() => {
    if (!userData?.uid) {
      setLoading(false);
      return;
    }

    const loadTeams = async () => {
      try {
        const teamsQuery = query(
          collection(db, 'teams'),
          where('ownerId', '==', userData.uid)
        );
        const teamsSnap = await getDocs(teamsQuery);
        const teamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        setTeams(teamsData);
        
        // Auto-select first team if only one
        if (teamsData.length === 1) {
          setSelectedTeamId(teamsData[0].id!);
          setSelectedTeam(teamsData[0]);
        }
      } catch (error) {
        console.error('Error loading teams:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [user?.uid]);

  // Listen to messages when team is selected
  useEffect(() => {
    if (!selectedTeamId) return;

    const messagesRef = collection(db, 'teams', selectedTeamId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatMessage)).reverse();
      setMessages(msgs);
      
      // Scroll to bottom on new messages
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedTeamId]);

  // Load muted users for selected team
  useEffect(() => {
    if (!selectedTeamId) return;

    const loadMutedUsers = async () => {
      try {
        const mutedRef = collection(db, 'teams', selectedTeamId, 'mutedUsers');
        const mutedSnap = await getDocs(mutedRef);
        setMutedUsers(mutedSnap.docs.map(doc => doc.id));
      } catch (error) {
        console.error('Error loading muted users:', error);
      }
    };

    loadMutedUsers();
  }, [selectedTeamId]);

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    const team = teams.find(t => t.id === teamId);
    setSelectedTeam(team || null);
    setMessages([]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTeamId || sending) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'teams', selectedTeamId, 'messages'), {
        text: newMessage.trim(),
        sender: {
          uid: user?.uid,
          name: userData?.name || 'Commissioner',
          role: userData?.role || 'Commissioner',
          photoUrl: userData?.photoUrl || null
        },
        timestamp: serverTimestamp(),
        readBy: [user?.uid],
        isPinned: false
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedTeamId) return;
    
    try {
      await deleteDoc(doc(db, 'teams', selectedTeamId, 'messages', messageId));
      setShowMenu(null);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handlePinMessage = async (messageId: string, currentPinned: boolean) => {
    if (!selectedTeamId) return;
    
    try {
      await updateDoc(doc(db, 'teams', selectedTeamId, 'messages', messageId), {
        isPinned: !currentPinned
      });
      setShowMenu(null);
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  };

  const handleMuteUser = async (userId: string, userName: string) => {
    if (!selectedTeamId) return;
    
    try {
      // Add to muted users
      await addDoc(collection(db, 'teams', selectedTeamId, 'mutedUsers'), {
        odI: userId,
        name: userName,
        mutedAt: serverTimestamp(),
        mutedBy: user?.uid
      });
      setMutedUsers(prev => [...prev, userId]);
      setShowMenu(null);
    } catch (error) {
      console.error('Error muting user:', error);
    }
  };

  const handleUnmuteUser = async (userId: string) => {
    if (!selectedTeamId) return;
    
    try {
      // Find and delete the muted user document
      const mutedRef = collection(db, 'teams', selectedTeamId, 'mutedUsers');
      const q = query(mutedRef, where('odI', '==', userId));
      const snap = await getDocs(q);
      
      for (const docSnap of snap.docs) {
        await deleteDoc(doc(db, 'teams', selectedTeamId, 'mutedUsers', docSnap.id));
      }
      
      setMutedUsers(prev => prev.filter(id => id !== userId));
    } catch (error) {
      console.error('Error unmuting user:', error);
    }
  };

  // Get pinned messages
  const pinnedMessages = messages.filter(m => m.isPinned);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Link to="/commissioner" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
                <Shield className="w-5 h-5" />
              </Link>
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Team Chat</h1>
            </div>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className={`rounded-xl p-12 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>No Teams Yet</h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Create teams to start chatting with coaches and players.
            </p>
            <Link
              to="/commissioner/teams/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Create Team
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] flex flex-col rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b flex-shrink-0 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/commissioner" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
                <Shield className="w-5 h-5" />
              </Link>
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Team Chat</h1>
            </div>
            
            {/* Team Selector */}
            <div className="relative">
              <select
                value={selectedTeamId}
                onChange={(e) => handleTeamChange(e.target.value)}
                className={`appearance-none pl-4 pr-10 py-2 rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">Select a team...</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
          </div>
        </div>
      </div>

      {!selectedTeamId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Select a team to view chat</p>
          </div>
        </div>
      ) : (
        <>
          {/* Pinned Messages */}
          {pinnedMessages.length > 0 && (
            <div className={`border-b ${theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="max-w-4xl mx-auto px-4 py-2">
                <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-1">
                  <Pin className="w-3 h-3" /> Pinned
                </p>
                {pinnedMessages.slice(0, 2).map(msg => (
                  <p key={msg.id} className={`text-sm truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    <strong>{getSenderName(msg)}:</strong> {msg.text}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const senderId = getSenderId(msg);
                  const senderName = getSenderName(msg);
                  const senderRole = getSenderRole(msg);
                  const senderPhoto = getSenderPhoto(msg);
                  const isOwn = senderId === user?.uid;
                  const isMuted = mutedUsers.includes(senderId);
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end gap-2`}
                    >
                      {/* Avatar for received messages */}
                      {!isOwn && (
                        <div className="flex-shrink-0">
                          {senderPhoto ? (
                            <img 
                              src={senderPhoto} 
                              alt={senderName}
                              className="w-8 h-8 rounded-full object-cover"
                              style={{ border: '2px solid rgba(147, 51, 234, 0.5)' }}
                            />
                          ) : (
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: '#9333ea', border: '2px solid rgba(255,255,255,0.2)' }}
                            >
                              {senderName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className={`max-w-[80%] group relative ${msg.isPinned ? 'ring-2 ring-yellow-500/50' : ''}`}>
                        <div 
                          className={`rounded-2xl px-4 py-2 ${isOwn ? 'rounded-br-none' : 'rounded-bl-none'}`}
                          style={isOwn 
                            ? { backgroundColor: '#9333ea' }
                            : { backgroundColor: 'white', border: '1px solid #e2e8f0' }
                          }
                        >
                          {!isOwn && (
                            <p className="text-xs font-medium mb-1" style={{ color: '#9333ea' }}>
                              {senderName}
                              {senderRole && <span style={{ color: '#9333ea', opacity: 0.7 }} className="ml-1">• {senderRole}</span>}
                              {isMuted && <span className="ml-1 text-red-400">🔇</span>}
                            </p>
                          )}
                          <p style={{ color: isOwn ? '#ffffff' : '#1e293b' }}>{msg.text}</p>
                          <p className="text-xs mt-1" style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>
                            {msg.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
                          </p>
                        </div>
                        
                        {/* Admin Menu */}
                        <button
                          onClick={() => setShowMenu(showMenu === msg.id ? null : msg.id)}
                          className={`absolute -right-8 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                            theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          }`}
                        >
                          <MoreVertical className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                        </button>
                        
                        {showMenu === msg.id && (
                          <div className={`absolute right-0 top-full mt-1 rounded-lg shadow-xl border z-50 py-1 min-w-[160px] ${
                            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                          }`}>
                            <button
                              onClick={() => handlePinMessage(msg.id, !!msg.isPinned)}
                              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                              }`}
                            >
                              <Pin className="w-4 h-4" />
                              {msg.isPinned ? 'Unpin' : 'Pin Message'}
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 text-red-500 ${
                                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Message
                            </button>
                            {!isOwn && (
                              <button
                                onClick={() => isMuted 
                                  ? handleUnmuteUser(senderId) 
                                  : handleMuteUser(senderId, senderName)
                                }
                                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                  theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                              >
                                <VolumeX className="w-4 h-4" />
                                {isMuted ? 'Unmute User' : 'Mute User'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Avatar for own messages */}
                      {isOwn && (
                        <div className="flex-shrink-0">
                          {userData?.photoUrl ? (
                            <img 
                              src={userData.photoUrl} 
                              alt={userData.name}
                              className="w-8 h-8 rounded-full object-cover"
                              style={{ border: '2px solid rgba(147, 51, 234, 0.5)' }}
                            />
                          ) : (
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: '#9333ea', border: '2px solid rgba(147, 51, 234, 0.5)' }}
                            >
                              {userData?.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Message Input */}
          <div className={`border-t flex-shrink-0 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto px-4 py-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${selectedTeam?.name || 'team'}...`}
                  className={`flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default CommissionerTeamChat;
