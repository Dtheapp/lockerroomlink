import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limitToLast, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { sanitizeText } from '../../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../../services/rateLimit';
import type { CoachChatMessage, CoachChatSettings, CoachMutedUser } from '../../types';
import { Send, MessageCircle, Heart, Reply, Trash2, X, AlertTriangle, User, Clock, Shield, Ban, ChevronDown, Loader2, Settings, Crown } from 'lucide-react';

interface CoachPublicChatProps {
  coachId: string;
  coachName: string;
}

const CoachPublicChat: React.FC<CoachPublicChatProps> = ({ coachId, coachName }) => {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSettings, setChatSettings] = useState<CoachChatSettings>({
    chatEnabled: true,
    allowPublicChat: true,
    slowModeSeconds: 0
  });
  const [mutedUsers, setMutedUsers] = useState<Record<string, CoachMutedUser>>({});
  const [isExpanded, setIsExpanded] = useState(true);
  const [replyingTo, setReplyingTo] = useState<CoachChatMessage | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<number>(0);
  
  // Moderation modal
  const [showMuteModal, setShowMuteModal] = useState<CoachChatMessage | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState<string>('1');
  
  // Settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempSettings, setTempSettings] = useState<CoachChatSettings>(chatSettings);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCoachOwner = user?.uid === coachId;
  const canChat = !!user && !!userData;
  const canModerate = isCoachOwner;

  // Load chat settings
  useEffect(() => {
    const settingsRef = doc(db, 'users', coachId, 'config', 'chatSettings');
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const settings = snap.data() as CoachChatSettings;
        setChatSettings(settings);
        setTempSettings(settings);
      }
    });

    return () => unsubSettings();
  }, [coachId]);

  // Load muted users
  useEffect(() => {
    const mutedRef = collection(db, 'users', coachId, 'mutedUsers');
    const unsubMuted = onSnapshot(mutedRef, (snap) => {
      const muted: Record<string, CoachMutedUser> = {};
      snap.docs.forEach(d => {
        muted[d.id] = d.data() as CoachMutedUser;
      });
      setMutedUsers(muted);
    });

    return () => unsubMuted();
  }, [coachId]);

  // Load messages
  useEffect(() => {
    const messagesRef = collection(db, 'users', coachId, 'publicChatMessages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limitToLast(100));
    
    const unsubMessages = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CoachChatMessage));
      setMessages(msgs.filter(m => !m.isDeleted));
    });

    return () => unsubMessages();
  }, [coachId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Check if user is muted
  const isUserMuted = (): boolean => {
    if (!user) return false;
    const muteData = mutedUsers[user.uid];
    if (!muteData) return false;
    
    if (muteData.expiresAt) {
      const expiresAt = muteData.expiresAt.toDate?.() || new Date(muteData.expiresAt);
      if (new Date() > expiresAt) {
        return false;
      }
    }
    return true;
  };

  // Check slow mode
  const canSendMessage = (): boolean => {
    if (chatSettings.slowModeSeconds <= 0) return true;
    if (isCoachOwner) return true;
    
    const now = Date.now();
    const timeSinceLastMessage = (now - lastMessageTime) / 1000;
    return timeSinceLastMessage >= chatSettings.slowModeSeconds;
  };

  const getSlowModeRemaining = (): number => {
    if (chatSettings.slowModeSeconds <= 0) return 0;
    const now = Date.now();
    const timeSinceLastMessage = (now - lastMessageTime) / 1000;
    const remaining = chatSettings.slowModeSeconds - timeSinceLastMessage;
    return Math.max(0, Math.ceil(remaining));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData || !newMessage.trim()) return;
    if (!chatSettings.chatEnabled || !chatSettings.allowPublicChat) return;
    if (isUserMuted()) {
      setError('You are muted from this chat');
      return;
    }
    if (!canSendMessage()) {
      setError(`Slow mode active. Wait ${getSlowModeRemaining()}s`);
      return;
    }

    const rateLimitResult = checkRateLimit(user.uid, RATE_LIMITS.CHAT_MESSAGE);
    if (!rateLimitResult.allowed) {
      setError('Sending too fast. Please wait a moment.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const sanitizedText = sanitizeText(newMessage.trim());
      
      const messageData: Record<string, any> = {
        text: sanitizedText,
        senderId: user.uid,
        senderName: userData.name || 'Anonymous',
        senderUsername: userData.username || '',
        senderRole: userData.role,
        timestamp: serverTimestamp(),
        likes: [],
        likeCount: 0,
        isCoachPost: isCoachOwner
      };
      
      if (userData.photoUrl) {
        messageData.senderPhotoUrl = userData.photoUrl;
      }

      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text.substring(0, 100),
          senderName: replyingTo.isCoachPost ? coachName : replyingTo.senderName
        };
      }

      const messagesRef = collection(db, 'users', coachId, 'publicChatMessages');
      await addDoc(messagesRef, messageData);

      setNewMessage('');
      setReplyingTo(null);
      setLastMessageTime(Date.now());
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleLikeMessage = async (message: CoachChatMessage) => {
    if (!user) return;

    try {
      const messageRef = doc(db, 'users', coachId, 'publicChatMessages', message.id);
      const hasLiked = message.likes?.includes(user.uid);

      if (hasLiked) {
        await updateDoc(messageRef, {
          likes: arrayRemove(user.uid),
          likeCount: (message.likeCount || 1) - 1
        });
      } else {
        await updateDoc(messageRef, {
          likes: arrayUnion(user.uid),
          likeCount: (message.likeCount || 0) + 1
        });
      }
    } catch (err) {
      console.error('Error liking message:', err);
    }
  };

  const handleDeleteMessage = async (message: CoachChatMessage) => {
    if (!canModerate) return;

    try {
      const messageRef = doc(db, 'users', coachId, 'publicChatMessages', message.id);
      await updateDoc(messageRef, { isDeleted: true });
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const handleMuteUser = async () => {
    if (!canModerate || !showMuteModal || !userData) return;

    try {
      const muteData: Record<string, any> = {
        oduserId: showMuteModal.senderId,
        odusername: showMuteModal.senderUsername || showMuteModal.senderName,
        mutedBy: user!.uid,
        mutedByName: userData.name,
        mutedAt: serverTimestamp()
      };

      if (muteReason.trim()) {
        muteData.reason = muteReason.trim();
      }

      if (muteDuration && muteDuration !== 'permanent') {
        const hours = parseInt(muteDuration);
        if (!isNaN(hours) && hours > 0) {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + hours);
          muteData.expiresAt = expiresAt;
        }
      }

      await setDoc(
        doc(db, 'users', coachId, 'mutedUsers', showMuteModal.senderId),
        muteData
      );

      setShowMuteModal(null);
      setMuteReason('');
      setMuteDuration('1');
    } catch (err) {
      console.error('Error muting user:', err);
    }
  };

  const handleUnmuteUser = async (userId: string) => {
    if (!canModerate) return;

    try {
      await deleteDoc(doc(db, 'users', coachId, 'mutedUsers', userId));
    } catch (err) {
      console.error('Error unmuting user:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!canModerate) return;

    try {
      await setDoc(doc(db, 'users', coachId, 'config', 'chatSettings'), tempSettings);
      setShowSettingsModal(false);
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Coach': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Parent': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Fan': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  if (!chatSettings.chatEnabled) {
    return (
      <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
        <div className="flex items-center gap-3 text-zinc-500">
          <MessageCircle className="w-5 h-5" />
          <span>Chat is currently disabled</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b border-zinc-700 cursor-pointer hover:bg-zinc-700/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              Coach's Message Board
              {canModerate && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                  Moderator
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-500">{messages.length} messages</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canModerate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingsModal(true);
              }}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Welcome Message */}
          {chatSettings.welcomeMessage && (
            <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
              <p className="text-sm text-blue-300 flex items-center gap-2">
                <Crown className="w-4 h-4" />
                {chatSettings.welcomeMessage}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Be the first to say hello!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = message.senderId === user?.uid;
                const hasLiked = message.likes?.includes(user?.uid || '');
                const isMuted = mutedUsers[message.senderId];

                return (
                  <div 
                    key={message.id} 
                    className={`group flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.isCoachPost 
                        ? 'bg-gradient-to-br from-blue-600 to-cyan-600' 
                        : 'bg-zinc-700'
                    }`}>
                      {message.senderPhotoUrl ? (
                        <img src={message.senderPhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : message.isCoachPost ? (
                        <Crown className="w-4 h-4 text-white" />
                      ) : (
                        <User className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className={`flex-1 max-w-[80%] ${isOwn ? 'text-right' : ''}`}>
                      {/* Sender Info */}
                      <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : ''}`}>
                        <span className={`text-sm font-medium ${message.isCoachPost ? 'text-blue-400' : 'text-zinc-300'}`}>
                          {message.isCoachPost ? `Coach ${coachName.split(' ')[0]}` : message.senderName}
                        </span>
                        {message.isCoachPost && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">
                            Coach
                          </span>
                        )}
                        {!message.isCoachPost && message.senderRole && (
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${getRoleBadgeColor(message.senderRole)}`}>
                            {message.senderRole}
                          </span>
                        )}
                        <span className="text-xs text-zinc-600">{formatTime(message.timestamp)}</span>
                        {isMuted && canModerate && (
                          <span className="text-xs text-red-400">(muted)</span>
                        )}
                      </div>

                      {/* Reply indicator */}
                      {message.replyTo && (
                        <div className={`text-xs text-zinc-500 mb-1 flex items-center gap-1 ${isOwn ? 'justify-end' : ''}`}>
                          <Reply className="w-3 h-3" />
                          Replying to {message.replyTo.senderName}
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div className={`inline-block rounded-2xl px-4 py-2 ${
                        message.isCoachPost
                          ? 'bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-blue-500/30'
                          : isOwn 
                            ? 'bg-purple-600/30 border border-purple-500/30' 
                            : 'bg-zinc-700/50 border border-zinc-600/50'
                      }`}>
                        <p className="text-sm text-white whitespace-pre-wrap break-words">{message.text}</p>
                      </div>

                      {/* Actions */}
                      <div className={`flex items-center gap-3 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                        {/* Like button */}
                        <button
                          onClick={() => handleLikeMessage(message)}
                          disabled={!user}
                          className={`flex items-center gap-1 text-xs transition-colors ${
                            hasLiked ? 'text-pink-500' : 'text-zinc-600 hover:text-pink-400'
                          }`}
                        >
                          <Heart className={`w-3 h-3 ${hasLiked ? 'fill-current' : ''}`} />
                          {(message.likeCount || 0) > 0 && <span>{message.likeCount}</span>}
                        </button>
                        
                        {/* Reply button */}
                        {canChat && (
                          <button
                            onClick={() => {
                              setReplyingTo(message);
                              inputRef.current?.focus();
                            }}
                            className="text-zinc-600 hover:text-blue-400 transition-colors"
                          >
                            <Reply className="w-3 h-3" />
                          </button>
                        )}

                        {/* Moderation actions */}
                        {canModerate && !isOwn && (
                          <>
                            <button
                              onClick={() => handleDeleteMessage(message)}
                              className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setShowMuteModal(message)}
                              className="text-zinc-600 hover:text-yellow-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Mute user"
                            >
                              <Ban className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          {canChat ? (
            <div className="p-3 border-t border-zinc-800">
              {/* Reply indicator */}
              {replyingTo && (
                <div className="flex items-center justify-between bg-zinc-800/50 px-3 py-2 rounded-lg mb-2 text-xs">
                  <span className="text-zinc-400 truncate">
                    Replying to <span className="text-blue-400">{replyingTo.isCoachPost ? coachName : replyingTo.senderName}</span>
                  </span>
                  <button onClick={() => setReplyingTo(null)} className="text-zinc-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs mb-2 overflow-hidden">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span className="break-words overflow-hidden">{error}</span>
                </div>
              )}

              {/* Slow mode indicator */}
              {chatSettings.slowModeSeconds > 0 && !canSendMessage() && (
                <div className="flex items-center gap-2 text-yellow-500 text-xs mb-2">
                  <Clock className="w-3 h-3" />
                  Slow mode: wait {getSlowModeRemaining()}s
                </div>
              )}

              {/* Muted indicator */}
              {isUserMuted() && (
                <div className="flex items-center gap-2 text-red-400 text-xs mb-2">
                  <Ban className="w-3 h-3" />
                  You are muted from this chat
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={isCoachOwner ? "Message your followers..." : "Say something to the coach..."}
                  disabled={sending || isUserMuted() || !canSendMessage()}
                  maxLength={500}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim() || isUserMuted() || !canSendMessage()}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-4 border-t border-zinc-800 text-center">
              <a href="#/auth" className="text-blue-400 hover:text-blue-300 text-sm">
                Sign in to join the conversation →
              </a>
            </div>
          )}
        </>
      )}

      {/* Mute User Modal */}
      {showMuteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">Mute User</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Mute <span className="text-blue-400">@{showMuteModal.senderUsername || showMuteModal.senderName}</span> from your message board?
            </p>
            
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                  placeholder="e.g., Spam, inappropriate behavior"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Duration</label>
                <select
                  value={muteDuration}
                  onChange={(e) => setMuteDuration(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="1">1 hour</option>
                  <option value="6">6 hours</option>
                  <option value="24">24 hours</option>
                  <option value="168">1 week</option>
                  <option value="permanent">Permanent</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowMuteModal(null)}
                className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMuteUser}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Mute User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Chat Settings
            </h3>
            
            <div className="space-y-4 mb-6">
              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Enable Chat</span>
                <input
                  type="checkbox"
                  checked={tempSettings.chatEnabled}
                  onChange={(e) => setTempSettings(s => ({ ...s, chatEnabled: e.target.checked }))}
                  className="w-5 h-5 rounded bg-zinc-700 border-zinc-600 text-blue-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Allow Public Chat</span>
                <input
                  type="checkbox"
                  checked={tempSettings.allowPublicChat}
                  onChange={(e) => setTempSettings(s => ({ ...s, allowPublicChat: e.target.checked }))}
                  className="w-5 h-5 rounded bg-zinc-700 border-zinc-600 text-blue-500"
                />
              </label>
              
              <div>
                <label className="block text-sm text-zinc-300 mb-1">Slow Mode (seconds)</label>
                <select
                  value={tempSettings.slowModeSeconds}
                  onChange={(e) => setTempSettings(s => ({ ...s, slowModeSeconds: parseInt(e.target.value) }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="0">Off</option>
                  <option value="5">5 seconds</option>
                  <option value="10">10 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-1">Welcome Message</label>
                <textarea
                  value={tempSettings.welcomeMessage || ''}
                  onChange={(e) => setTempSettings(s => ({ ...s, welcomeMessage: e.target.value }))}
                  placeholder="Welcome to my message board!"
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>

              {/* Muted Users List */}
              {Object.keys(mutedUsers).length > 0 && (
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Muted Users</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {Object.entries(mutedUsers).map(([userId, mute]) => (
                      <div key={userId} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                        <span className="text-sm text-zinc-400">@{mute.odusername}</span>
                        <button
                          onClick={() => handleUnmuteUser(userId)}
                          className="text-xs text-green-400 hover:text-green-300"
                        >
                          Unmute
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setTempSettings(chatSettings);
                  setShowSettingsModal(false);
                }}
                className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachPublicChat;
