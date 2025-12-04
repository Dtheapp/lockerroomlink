import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, limitToLast, doc, updateDoc, deleteField, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText } from '../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import type { Message } from '../types';
import { Send, AlertCircle, VolumeX, Volume2, MoreVertical, X, Trash2, Edit2, Check } from 'lucide-react';

// Activity logging function for moderation actions
const logModerationActivity = async (
  action: string,
  targetType: string,
  targetId: string,
  details: string,
  performedBy: string,
  performedByName: string
) => {
  try {
    await addDoc(collection(db, 'adminActivityLog'), {
      action,
      targetType,
      targetId,
      details,
      performedBy,
      performedByName,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log moderation activity:', error);
  }
};

interface MutedUser {
  mutedBy: string;
  mutedByName: string;
  mutedAt: Timestamp;
  reason?: string;
}

interface MutedUsers {
  [oduserId: string]: MutedUser;
}

const Chat: React.FC = () => {
  const { user, userData, teamData } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Mute feature state
  const [mutedUsers, setMutedUsers] = useState<MutedUsers>({});
  const [showMuteModal, setShowMuteModal] = useState<{ oduserId: string; userName: string } | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ messageId: string; messageText: string; senderName: string; senderId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Check if current user can moderate (Coach or SuperAdmin)
  const canModerate = userData?.role === 'Coach' || userData?.role === 'SuperAdmin';
  
  // Check if current user is muted
  const isMuted = user?.uid ? !!mutedUsers[user.uid] : false;
  const myMuteInfo = user?.uid ? mutedUsers[user.uid] : null;

  // Load messages
  useEffect(() => {
    if (!teamData?.id) return;
    const messagesCollection = collection(db, 'teams', teamData.id, 'messages');
    const messagesQuery = query(messagesCollection, orderBy('timestamp'), limitToLast(50));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Message));
      setMessages(messagesData);
    }, (error) => {
      console.error("Error loading chat:", error);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  // Load muted users from team document
  useEffect(() => {
    if (!teamData?.id) return;
    
    const teamDocRef = doc(db, 'teams', teamData.id);
    const unsubscribe = onSnapshot(teamDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMutedUsers(data.mutedUsers || {});
      }
    });

    return () => unsubscribe();
  }, [teamData?.id]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setActiveMessageMenu(null);
    if (activeMessageMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [activeMessageMenu]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !userData || !teamData?.id || sending) return;

    // Check if user is muted
    if (isMuted) {
      setRateLimitError("You are muted and cannot send messages.");
      setTimeout(() => setRateLimitError(null), 3000);
      return;
    }

    // Rate limit check
    const rateLimitKey = `chat:${user.uid}`;
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
      await addDoc(collection(db, 'teams', teamData.id, 'messages'), {
        text: sanitizeText(newMessage, 2000),
        sender: {
          uid: user.uid,
          name: sanitizeText(userData.name, 100),
          role: userData.role
        },
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleMuteUser = async () => {
    if (!showMuteModal || !teamData?.id || !userData || !user) return;
    
    try {
      const teamDocRef = doc(db, 'teams', teamData.id);
      await updateDoc(teamDocRef, {
        [`mutedUsers.${showMuteModal.oduserId}`]: {
          mutedBy: user?.uid,
          mutedByName: userData.name,
          mutedAt: serverTimestamp(),
          reason: muteReason.trim() || 'No reason provided'
        }
      });
      
      // Log the mute action to Activity Log
      await logModerationActivity(
        'MUTE_USER',
        'chat_user',
        showMuteModal.oduserId,
        `Muted user "${showMuteModal.userName}" in Team Chat. Reason: ${muteReason.trim() || 'No reason provided'}. Team: ${teamData.name || teamData.id}`,
        user.uid,
        userData.name || userData.email || 'Unknown Coach'
      );
      
      setShowMuteModal(null);
      setMuteReason('');
    } catch (error) {
      console.error("Error muting user:", error);
    }
  };

  const handleUnmuteUser = async (oduserId: string, userName: string) => {
    if (!teamData?.id || !user || !userData) return;
    
    try {
      const teamDocRef = doc(db, 'teams', teamData.id);
      await updateDoc(teamDocRef, {
        [`mutedUsers.${oduserId}`]: deleteField()
      });
      
      // Log the unmute action to Activity Log
      await logModerationActivity(
        'UNMUTE_USER',
        'chat_user',
        oduserId,
        `Unmuted user "${userName}" in Team Chat. Team: ${teamData.name || teamData.id}`,
        user.uid,
        userData.name || userData.email || 'Unknown Coach'
      );
    } catch (error) {
      console.error("Error unmuting user:", error);
    }
  };

  const handleDeleteMessage = async () => {
    if (!showDeleteConfirm || !teamData?.id || !user || !userData) return;
    
    // Check if deleting own message or someone else's (moderation)
    const isDeletingOwnMessage = showDeleteConfirm.senderId === user.uid;
    
    setDeleting(true);
    try {
      const messageDocRef = doc(db, 'teams', teamData.id, 'messages', showDeleteConfirm.messageId);
      await deleteDoc(messageDocRef);
      
      // Only log to Activity Log if moderating (deleting someone else's message)
      if (!isDeletingOwnMessage && canModerate) {
        const truncatedMessage = showDeleteConfirm.messageText.length > 50 
          ? showDeleteConfirm.messageText.substring(0, 50) + '...' 
          : showDeleteConfirm.messageText;
        
        await logModerationActivity(
          'DELETE_MESSAGE',
          'chat_message',
          showDeleteConfirm.messageId,
          `Deleted message from "${showDeleteConfirm.senderName}" in Team Chat. Message: "${truncatedMessage}". Team: ${teamData.name || teamData.id}`,
          user.uid,
          userData.name || userData.email || 'Unknown Moderator'
        );
      }
      
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting message:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!teamData?.id || !editingText.trim()) return;
    
    setSavingEdit(true);
    try {
      const messageDocRef = doc(db, 'teams', teamData.id, 'messages', messageId);
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

  const startEditing = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text);
    setActiveMessageMenu(null);
  };
  
  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950 rounded-lg shadow-lg dark:shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
      
      {/* HEADER */}
      <div className="sticky top-0 z-10 p-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            The Huddle <span className="text-orange-500 text-sm font-mono uppercase tracking-wider">(Team Chat)</span>
          </h1>
          
          {/* Muted Users Count Badge - Only for moderators */}
          {canModerate && Object.keys(mutedUsers).length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full text-xs font-medium">
              <VolumeX className="w-3.5 h-3.5" />
              {Object.keys(mutedUsers).length} muted
            </div>
          )}
        </div>
      </div>
      
      {/* MUTED NOTICE - For muted users */}
      {isMuted && myMuteInfo && (
        <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <VolumeX className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-500 font-semibold text-sm">You are muted</p>
              <p className="text-red-400/80 text-xs mt-1">
                You can read messages but cannot send new ones.
                {myMuteInfo.reason && <span className="block mt-1">Reason: {myMuteInfo.reason}</span>}
              </p>
              <p className="text-red-400/60 text-xs mt-2">
                Muted by {myMuteInfo.mutedByName}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* MESSAGES AREA */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-black/20">
        {messages.map(msg => {
          const isMe = msg.sender.uid === user?.uid;
          const isUserMuted = !!mutedUsers[msg.sender.uid];
          const senderRole = (msg.sender as any).role;
          const isParent = senderRole === 'Parent' || (!senderRole && !isMe); // Assume parent if no role
          const isEditing = editingMessageId === msg.id;
          const isEdited = (msg as any).edited;
          
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
              <div className={`max-w-xs lg:max-w-md p-3 rounded-2xl shadow-sm relative ${
                isMe 
                  ? 'bg-orange-600 text-white rounded-br-none'
                  : 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-zinc-700'
              }`}>
                {/* Header for OTHER users' messages */}
                {!isMe && (
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      {msg.sender.name}
                      {isUserMuted && (
                        <span className="text-red-500" title="This user is muted">
                          <VolumeX className="w-3 h-3" />
                        </span>
                      )}
                    </p>
                    
                    {/* Moderation Menu - Only for moderators on other users' messages */}
                    {canModerate && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id);
                          }}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1 -mr-1 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {activeMessageMenu === msg.id && (
                          <div className="absolute right-0 top-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl z-20 py-1 min-w-[160px]">
                            {/* Delete Message - Available for all messages from others */}
                            <button
                              onClick={() => {
                                setShowDeleteConfirm({ messageId: msg.id, messageText: msg.text, senderName: msg.sender.name, senderId: msg.sender.uid });
                                setActiveMessageMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Message
                            </button>
                            
                            {/* Mute/Unmute - Only for parents */}
                            {isParent && (
                              <>
                                <div className="border-t border-slate-200 dark:border-zinc-700 my-1" />
                                {isUserMuted ? (
                                  <button
                                    onClick={() => handleUnmuteUser(msg.sender.uid, msg.sender.name)}
                                    className="w-full px-3 py-2 text-left text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2"
                                  >
                                    <Volume2 className="w-4 h-4" />
                                    Unmute User
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setShowMuteModal({ oduserId: msg.sender.uid, userName: msg.sender.name });
                                      setActiveMessageMenu(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2"
                                  >
                                    <VolumeX className="w-4 h-4" />
                                    Mute User
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Message Content - with edit mode */}
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleEditMessage(msg.id);
                        }
                        if (e.key === 'Escape') {
                          setEditingMessageId(null);
                          setEditingText('');
                        }
                      }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setEditingMessageId(null); setEditingText(''); }}
                        className="text-xs text-white/70 hover:text-white px-2 py-1"
                        disabled={savingEdit}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleEditMessage(msg.id)}
                        disabled={savingEdit || !editingText.trim()}
                        className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                      >
                        {savingEdit ? (
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                )}
                
                {/* Footer - timestamp and actions */}
                {!isEditing && (
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className={`text-[10px] ${isMe ? 'text-orange-200' : 'text-slate-400'}`}>
                      {formatDate(msg.timestamp)}
                      {isEdited && <span className="ml-1 italic">(edited)</span>}
                    </p>
                    
                    {/* Actions for OWN messages - everyone can edit/delete their own */}
                    {isMe && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditing(msg)}
                          className="text-orange-200 hover:text-white p-0.5 transition-colors"
                          title="Edit message"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm({ messageId: msg.id, messageText: msg.text, senderName: msg.sender.name, senderId: msg.sender.uid })}
                          className="text-orange-200 hover:text-white p-0.5 transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        {/* Rate limit / mute warning */}
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
            placeholder={isMuted ? "You are muted..." : "Type your message..."}
            disabled={isMuted}
            className={`flex-1 bg-slate-100 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-full shadow-inner py-3 px-5 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all ${
              isMuted ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          <button 
            type="submit" 
            className={`p-3 rounded-full transition-colors shadow-lg shadow-orange-900/20 disabled:opacity-50 disabled:cursor-not-allowed ${
              isMuted 
                ? 'bg-zinc-500 cursor-not-allowed' 
                : 'bg-orange-600 hover:bg-orange-500'
            }`}
            disabled={!newMessage.trim() || sending || isMuted}
            aria-label="Send message"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isMuted ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </form>
      </div>

      {/* MUTE MODAL */}
      {showMuteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <VolumeX className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mute User</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">{showMuteModal.userName}</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowMuteModal(null); setMuteReason(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              This user will be able to read messages but cannot send new ones until unmuted.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={muteReason}
                onChange={(e) => setMuteReason(e.target.value)}
                placeholder="e.g., Inappropriate language"
                className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowMuteModal(null); setMuteReason(''); }}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMuteUser}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <VolumeX className="w-4 h-4" />
                Mute User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Message</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-slate-700 dark:text-zinc-300 line-clamp-3">
                "{showDeleteConfirm.messageText}"
              </p>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              Are you sure you want to delete this message? All team members will no longer see it.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMessage}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
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

export default Chat;