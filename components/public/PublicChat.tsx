import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limitToLast, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { sanitizeText } from '../../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../../services/rateLimit';
import type { PublicChatMessage, PublicChatSettings, PublicChatMutedUser, Player } from '../../types';
import { Send, MessageCircle, Heart, Reply, Trash2, X, AlertTriangle, User, Clock, Shield, Ban, ChevronDown, Loader2, Settings } from 'lucide-react';

interface PublicChatProps {
  teamId: string;
  playerId: string;
  playerName: string;
  parentId?: string; // The parent who owns this athlete profile (for moderation)
}

const PublicChat: React.FC<PublicChatProps> = ({ teamId, playerId, playerName, parentId }) => {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<PublicChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSettings, setChatSettings] = useState<PublicChatSettings>({
    chatEnabled: true,
    allowFanChat: true,
    requireApproval: false,
    slowModeSeconds: 0
  });
  const [mutedUsers, setMutedUsers] = useState<Record<string, PublicChatMutedUser>>({});
  const [isExpanded, setIsExpanded] = useState(true);
  const [replyingTo, setReplyingTo] = useState<PublicChatMessage | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<number>(0);
  
  // For "Chat As Athlete" feature
  const [chatAsAthlete, setChatAsAthlete] = useState(false);
  const [myAthletes, setMyAthletes] = useState<Player[]>([]);
  
  // Moderation modal
  const [showMuteModal, setShowMuteModal] = useState<PublicChatMessage | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState<string>('1'); // hours, empty = permanent

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Show settings modal for parent moderator
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempSettings, setTempSettings] = useState<PublicChatSettings>(chatSettings);

  const isParentModerator = userData?.role === 'Parent' && user?.uid === parentId;
  const isFan = userData?.role === 'Fan';
  const canChat = !!user && !!userData; // Any authenticated user can chat on public profiles

  // Load chat settings
  useEffect(() => {
    const settingsRef = doc(db, 'teams', teamId, 'players', playerId, 'config', 'chatSettings');
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const settings = snap.data() as PublicChatSettings;
        setChatSettings(settings);
        setTempSettings(settings);
      }
    });

    return () => unsubSettings();
  }, [teamId, playerId]);

  // Load muted users
  useEffect(() => {
    const mutedRef = collection(db, 'teams', teamId, 'players', playerId, 'publicChatMuted');
    const unsubMuted = onSnapshot(mutedRef, (snap) => {
      const muted: Record<string, PublicChatMutedUser> = {};
      snap.docs.forEach(d => {
        muted[d.id] = d.data() as PublicChatMutedUser;
      });
      setMutedUsers(muted);
    });

    return () => unsubMuted();
  }, [teamId, playerId]);

  // Load messages
  useEffect(() => {
    const messagesRef = collection(db, 'teams', teamId, 'players', playerId, 'publicChatMessages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limitToLast(100));
    
    const unsubMessages = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as PublicChatMessage));
      setMessages(msgs.filter(m => !m.isDeleted));
    });

    return () => unsubMessages();
  }, [teamId, playerId]);

  // Load parent's athletes for "Chat As" feature
  useEffect(() => {
    if (isParentModerator && user) {
      const loadMyAthletes = async () => {
        // Get athletes owned by this parent
        const playersRef = collection(db, 'teams', teamId, 'players');
        const unsubPlayers = onSnapshot(playersRef, (snap) => {
          const athletes = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Player))
            .filter(p => p.parentId === user.uid);
          setMyAthletes(athletes);
        });
        return () => unsubPlayers();
      };
      loadMyAthletes();
    }
  }, [isParentModerator, user, teamId]);

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
    
    // Check if mute has expired
    if (muteData.expiresAt) {
      const expiresAt = muteData.expiresAt.toDate?.() || new Date(muteData.expiresAt);
      if (new Date() > expiresAt) {
        // Mute expired - could clean up here
        return false;
      }
    }
    return true;
  };

  // Check slow mode
  const canSendMessage = (): boolean => {
    if (chatSettings.slowModeSeconds <= 0) return true;
    if (isParentModerator) return true; // Moderators bypass slow mode
    
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
    if (!chatSettings.chatEnabled || (!chatSettings.allowFanChat && isFan)) return;
    if (isUserMuted()) {
      setError('You are muted from this chat');
      return;
    }
    if (!canSendMessage()) {
      setError(`Slow mode active. Wait ${getSlowModeRemaining()}s`);
      return;
    }

    // Rate limiting
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
        likeCount: 0
      };
      
      // Only add optional fields if they have values (Firestore doesn't accept undefined)
      if (userData.photoUrl) {
        messageData.senderPhotoUrl = userData.photoUrl;
      }

      // Handle "Chat As Athlete" - parent posting as their child
      if (chatAsAthlete && isParentModerator && myAthletes.length > 0) {
        // Use the current athlete's identity (the one whose profile we're on)
        const currentAthlete = myAthletes.find(a => a.id === playerId);
        if (currentAthlete) {
          messageData.isAthletePost = true;
          messageData.athleteId = currentAthlete.id;
          messageData.athleteName = currentAthlete.name;
          messageData.senderRole = 'Athlete';
          messageData.senderName = currentAthlete.name;
          if (currentAthlete.photoUrl) {
            messageData.senderPhotoUrl = currentAthlete.photoUrl;
          }
        }
      }

      // Handle reply
      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text.substring(0, 100),
          senderName: replyingTo.isAthletePost ? replyingTo.athleteName || replyingTo.senderName : replyingTo.senderName
        };
      }

      const messagesRef = collection(db, 'teams', teamId, 'players', playerId, 'publicChatMessages');
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

  const handleLikeMessage = async (message: PublicChatMessage) => {
    if (!user) return;

    try {
      const messageRef = doc(db, 'teams', teamId, 'players', playerId, 'publicChatMessages', message.id);
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

  const handleDeleteMessage = async (message: PublicChatMessage) => {
    if (!isParentModerator) return;

    try {
      const messageRef = doc(db, 'teams', teamId, 'players', playerId, 'publicChatMessages', message.id);
      await updateDoc(messageRef, {
        isDeleted: true,
        deletedBy: user?.uid,
        deletedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const handleMuteUser = async () => {
    if (!isParentModerator || !showMuteModal || !user) return;

    try {
      const muteData: PublicChatMutedUser = {
        oduserId: showMuteModal.senderId,
        odusername: showMuteModal.senderUsername,
        mutedBy: user.uid,
        mutedByName: userData?.name || 'Moderator',
        mutedAt: serverTimestamp(),
        reason: muteReason || undefined,
        expiresAt: muteDuration ? Timestamp.fromDate(new Date(Date.now() + parseInt(muteDuration) * 60 * 60 * 1000)) : null
      };

      // Add the muted user document directly using setDoc
      const mutedUserRef = doc(db, 'teams', teamId, 'players', playerId, 'publicChatMuted', showMuteModal.senderId);
      await setDoc(mutedUserRef, muteData);

      setShowMuteModal(null);
      setMuteReason('');
      setMuteDuration('1');
    } catch (err) {
      console.error('Error muting user:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!isParentModerator) return;
    
    try {
      const settingsRef = doc(db, 'teams', teamId, 'players', playerId, 'config', 'chatSettings');
      await setDoc(settingsRef, tempSettings);
      setChatSettings(tempSettings);
      setShowSettingsModal(false);
    } catch (err) {
      console.error('Error saving chat settings:', err);
    }
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Chat disabled state
  if (!chatSettings.chatEnabled) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <div className="flex items-center gap-2 text-zinc-500">
          <MessageCircle className="w-5 h-5" />
          <span>Chat is disabled for this profile</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Chat Header */}
      <div 
        className="flex items-center justify-between p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors"
      >
        <div 
          className="flex items-center gap-2 flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <MessageCircle className="w-5 h-5 text-purple-400" />
          <h3 className="font-bold text-white">Fan Chat</h3>
          <span className="text-xs text-zinc-500">({messages.length})</span>
          {isParentModerator && (
            <span className="px-2 py-0.5 bg-orange-600/20 text-orange-400 text-xs rounded-full flex items-center gap-1">
              <Shield className="w-3 h-3" /> Moderator
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isParentModerator && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTempSettings(chatSettings);
                setShowSettingsModal(true);
              }}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-700"
              title="Chat Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setIsExpanded(!isExpanded)}>
            <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Messages Container */}
          <div className="h-64 overflow-y-auto p-4 space-y-3 bg-black/30">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No messages yet</p>
                <p className="text-zinc-600 text-xs mt-1">Be the first to say hi to {playerName}!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = message.senderId === user?.uid;
                const hasLiked = user && message.likes?.includes(user.uid);
                
                return (
                  <div key={message.id} className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] ${isOwn ? 'order-2' : 'order-1'}`}>
                      {/* Reply reference */}
                      {message.replyTo && (
                        <div className="text-xs text-zinc-500 mb-1 pl-2 border-l-2 border-zinc-700 truncate">
                          Replying to {message.replyTo.senderName}: {message.replyTo.text}
                        </div>
                      )}
                      
                      <div className={`flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
                          {message.senderPhotoUrl ? (
                            <img src={message.senderPhotoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-500">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        
                        {/* Message bubble */}
                        <div>
                          <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <span className={`text-xs font-medium ${message.isAthletePost ? 'text-orange-400' : message.senderRole === 'Parent' ? 'text-sky-400' : 'text-purple-400'}`}>
                              {message.isAthletePost ? message.athleteName : message.senderName}
                            </span>
                            {message.isAthletePost && (
                              <span className="px-1.5 py-0.5 bg-orange-600/20 text-orange-400 text-[10px] rounded">ATHLETE</span>
                            )}
                            {message.senderRole === 'Parent' && !message.isAthletePost && (
                              <span className="px-1.5 py-0.5 bg-sky-600/20 text-sky-400 text-[10px] rounded">FAMILY</span>
                            )}
                            <span className="text-[10px] text-zinc-600">{formatTimestamp(message.timestamp)}</span>
                          </div>
                          
                          <div className={`px-3 py-2 rounded-2xl ${
                            isOwn 
                              ? 'bg-purple-600 text-white rounded-tr-sm' 
                              : message.isAthletePost 
                                ? 'bg-orange-600/20 text-white rounded-tl-sm border border-orange-500/30'
                                : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                          </div>

                          {/* Actions */}
                          <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            {/* Like button */}
                            <button
                              onClick={() => handleLikeMessage(message)}
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
                                className="text-zinc-600 hover:text-purple-400 transition-colors"
                              >
                                <Reply className="w-3 h-3" />
                              </button>
                            )}

                            {/* Moderation actions */}
                            {isParentModerator && !isOwn && (
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
                    Replying to <span className="text-purple-400">{replyingTo.isAthletePost ? replyingTo.athleteName : replyingTo.senderName}</span>
                  </span>
                  <button onClick={() => setReplyingTo(null)} className="text-zinc-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Chat As Athlete toggle (for parent moderators) */}
              {isParentModerator && myAthletes.some(a => a.id === playerId) && (
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chatAsAthlete}
                      onChange={(e) => setChatAsAthlete(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-orange-500 focus:ring-orange-500"
                    />
                    <span>Chat as <span className="text-orange-400">{playerName}</span></span>
                  </label>
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
                  placeholder={chatAsAthlete ? `Message as ${playerName}...` : "Say something nice..."}
                  disabled={sending || isUserMuted() || !canSendMessage()}
                  maxLength={500}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim() || isUserMuted() || !canSendMessage()}
                  className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-4 border-t border-zinc-800 text-center">
              {!user ? (
                <Link to="/auth" className="text-purple-400 hover:text-purple-300 text-sm">
                  Sign in to join the chat →
                </Link>
              ) : !chatSettings.chatEnabled ? (
                <p className="text-zinc-500 text-sm">Chat is currently disabled</p>
              ) : !chatSettings.allowFanChat && isFan ? (
                <p className="text-zinc-500 text-sm">Fan chat is disabled on this profile</p>
              ) : (
                <p className="text-zinc-500 text-sm">Sign in to chat</p>
              )}
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
              Mute <span className="text-purple-400">@{showMuteModal.senderUsername || showMuteModal.senderName}</span> from chatting on this profile?
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
                  <option value="24">24 hours</option>
                  <option value="168">1 week</option>
                  <option value="">Permanent</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMuteUser}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Mute User
              </button>
              <button
                onClick={() => {
                  setShowMuteModal(null);
                  setMuteReason('');
                  setMuteDuration('1');
                }}
                className="flex-1 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Settings Modal (Parent Only) */}
      {showSettingsModal && isParentModerator && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Chat Settings
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Enable Chat Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Enable Fan Chat</p>
                  <p className="text-xs text-zinc-500">Allow fans to chat on this profile</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempSettings.chatEnabled}
                    onChange={(e) => setTempSettings({ ...tempSettings, chatEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Allow Fan Chat Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Allow Fans to Post</p>
                  <p className="text-xs text-zinc-500">If off, only family can chat</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempSettings.allowFanChat}
                    onChange={(e) => setTempSettings({ ...tempSettings, allowFanChat: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Slow Mode */}
              <div>
                <p className="text-white font-medium mb-2">Slow Mode</p>
                <p className="text-xs text-zinc-500 mb-2">Limit how often fans can send messages</p>
                <select
                  value={tempSettings.slowModeSeconds}
                  onChange={(e) => setTempSettings({ ...tempSettings, slowModeSeconds: parseInt(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="0">Off</option>
                  <option value="5">5 seconds</option>
                  <option value="10">10 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveSettings}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-medium"
              >
                Save Settings
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicChat;
