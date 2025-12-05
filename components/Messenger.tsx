import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc, limitToLast, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText } from '../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import { uploadFile } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { Search, Send, MessageSquare, AlertCircle, Edit2, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import type { PrivateChat, PrivateMessage, UserProfile } from '../types';
import NoAthleteBlock from './NoAthleteBlock';

// Extended chat type that can be regular or grievance
interface ExtendedChat extends PrivateChat {
  isGrievance?: boolean;
  grievanceNumber?: number;
}

const Messenger: React.FC = () => {
  // ADDED: teamData to scope the search to teammates only
  const { user, userData, teamData } = useAuth();
  const { markAsRead } = useUnreadMessages();
  
  const [chats, setChats] = useState<ExtendedChat[]>([]);
  const [grievanceChats, setGrievanceChats] = useState<ExtendedChat[]>([]);
  const [activeChat, setActiveChat] = useState<ExtendedChat | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Edit/Delete message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Delete chat state
  const [deleteChatConfirm, setDeleteChatConfirm] = useState<string | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);

  // Combine regular chats + grievance chats
  const allChats = [...chats, ...grievanceChats].sort((a, b) => {
    const aTime = a.updatedAt?.seconds || 0;
    const bTime = b.updatedAt?.seconds || 0;
    return bTime - aTime;
  });

  // Mark conversation as read when opening it
  useEffect(() => {
    if (activeChat?.id) {
      // Use appropriate key based on chat type
      if (activeChat.isGrievance) {
        markAsRead('grievance', activeChat.id);
      } else {
        markAsRead('messenger', activeChat.id);
      }
    }
  }, [activeChat?.id, activeChat?.isGrievance, markAsRead]);

  // 1. LOAD CHATS
  useEffect(() => {
    if (!user) return;
    const chatsQuery = query(collection(db, 'private_chats'), where('participants', 'array-contains', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
        setChats(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ExtendedChat)));
    });
    return () => unsubscribe();
  }, [user]);

  // 1b. LOAD GRIEVANCE CHATS (For parents only)
  useEffect(() => {
    if (!user || userData?.role !== 'Parent') return;
    
    // Simple query without orderBy to avoid composite index requirement
    const grievanceChatsQuery = query(
      collection(db, 'grievance_chats'), 
      where('parentId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(grievanceChatsQuery, (snapshot) => {
      const gChats = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          participants: [user.uid, 'admin'],
          participantData: {
            [user.uid]: { username: userData?.username || 'Me', role: 'Parent' },
            admin: { username: `Grievance #${data.grievanceNumber || '?'}`, role: 'Admin' }
          },
          lastMessage: data.lastMessage || 'Grievance filed',
          lastMessageTime: data.updatedAt,
          updatedAt: data.updatedAt,
          isGrievance: true,
          grievanceNumber: data.grievanceNumber
        } as ExtendedChat;
      });
      setGrievanceChats(gChats);
    });
    
    return () => unsubscribe();
  }, [user, userData?.role, userData?.username]);

  // 2. LOAD MESSAGES (Optimized with limitToLast)
  useEffect(() => {
      if (!activeChat) return;
      
      // Determine which collection to query based on chat type
      const chatCollection = activeChat.isGrievance ? 'grievance_chats' : 'private_chats';
      
      // FIX: Added limitToLast(50) to prevent loading thousands of old messages
      const messagesQuery = query(collection(db, chatCollection, activeChat.id, 'messages'), orderBy('timestamp', 'asc'), limitToLast(50));
      
      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
          setMessages(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PrivateMessage)));
          setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
      return () => unsubscribe();
  }, [activeChat]);

  // 3. LOAD USERS FOR SEARCH (Security Fix: Scope to Team)
  useEffect(() => {
    const loadUsers = async () => {
      // SECURITY FIX: Only load users from the SAME TEAM.
      // Prevents parents from seeing strangers from other teams and prevents downloading the whole DB.
      if (!teamData?.id) return;

      const usersQuery = query(collection(db, 'users'), where('teamId', '==', teamData.id));
      
      try {
        const snap = await getDocs(usersQuery);
        const users = snap.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() } as UserProfile));
        setAllUsers(users.filter(u => u.uid !== user?.uid));
      } catch (error) {
        console.error("Error loading teammates:", error);
      }
    };
    loadUsers();
  }, [user?.uid, teamData?.id]);

  // Debounce search query to prevent excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Live search using debounced query
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const term = debouncedSearchQuery.toLowerCase();
    const filtered = allUsers.filter(u => 
      (u.name || '').toLowerCase().includes(term) || 
      (u.username || '').toLowerCase().includes(term)
    );
    setSearchResults(filtered);
  }, [debouncedSearchQuery, allUsers]);


  const startChat = async (targetUser: UserProfile) => {
      if (!user || !userData) return;
      const existingChat = chats.find(c => c.participants.includes(targetUser.uid));
      if (existingChat) { setActiveChat(existingChat); setSearchQuery(''); setSearchResults([]); return; }

      try {
          const participantData = {
              [user.uid]: { username: userData.username || 'Me', role: userData.role },
              [targetUser.uid]: { username: targetUser.username || 'User', role: targetUser.role }
          };
          const newChatRef = await addDoc(collection(db, 'private_chats'), {
              participants: [user.uid, targetUser.uid], participantData, lastMessage: 'Chat started', updatedAt: serverTimestamp(), lastMessageTime: serverTimestamp()
          });
          setActiveChat({ id: newChatRef.id, participants: [user.uid, targetUser.uid], participantData, lastMessage: 'Chat started', lastMessageTime: {} as any, updatedAt: {} as any });
          setSearchQuery(''); setSearchResults([]);
      } catch (error) { console.error(error); }
  };

  const sendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !activeChat || !user || sending) return;
      
      // Rate limit check
      const rateLimitKey = `pm:${user.uid}`;
      const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.PRIVATE_MESSAGE);
      
      if (!rateLimitResult.allowed) {
        const seconds = Math.ceil(rateLimitResult.retryAfterMs / 1000);
        setRateLimitError(`Please wait ${seconds}s before sending another message.`);
        setTimeout(() => setRateLimitError(null), 3000);
        return;
      }
      
      // SECURITY: Sanitize message before storing
      const text = sanitizeText(newMessage, 2000);
      setNewMessage('');
      setSending(true);
      setRateLimitError(null);

      // If there are attachments, enforce upload rate limit
      try {
        if (attachments.length > 0) {
          const rl = checkRateLimit(`fileUpload:${user.uid}`, RATE_LIMITS.FILE_UPLOAD);
          if (!rl.allowed) {
            const seconds = Math.ceil(rl.retryAfterMs / 1000);
            setRateLimitError(`File upload rate limit reached. Wait ${seconds}s.`);
            setTimeout(() => setRateLimitError(null), 4000);
            setSending(false);
            return;
          }
        }

        let uploadedAttachments: any[] | undefined = undefined;

        if (attachments.length > 0 && activeChat) {
          setUploadingAttachments(true);
          uploadedAttachments = [];
          for (const file of attachments) {
            const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
            const path = `attachments/${activeChat.id}/${safeName}`;
            const uploaded = await uploadFile(file, path, (percent) => {
              setUploadProgress(prev => ({ ...prev, [file.name]: percent }));
            });
            uploadedAttachments.push(uploaded);
          }
          setUploadingAttachments(false);
          setUploadProgress({});
          setAttachments([]);
        }

        const messagePayload: any = { text, senderId: user.uid, timestamp: serverTimestamp() };
        if (uploadedAttachments && uploadedAttachments.length > 0) {
          messagePayload.attachments = uploadedAttachments;
        }

        // Determine which collection to use based on chat type
        const chatCollection = activeChat.isGrievance ? 'grievance_chats' : 'private_chats';
        
        await addDoc(collection(db, chatCollection, activeChat.id, 'messages'), messagePayload);
        await updateDoc(doc(db, chatCollection, activeChat.id), { lastMessage: text, updatedAt: serverTimestamp(), lastMessageTime: serverTimestamp(), lastSenderId: user.uid });
      } catch (error) { console.error(error); alert('Failed to send message or upload attachments.'); }
      finally { setSending(false); }
  };

  // Edit own message
  const handleEditMessage = async (messageId: string) => {
    if (!activeChat || !editingText.trim()) return;
    
    setSavingEdit(true);
    try {
      const chatCollection = activeChat.isGrievance ? 'grievance_chats' : 'private_chats';
      const messageDocRef = doc(db, chatCollection, activeChat.id, 'messages', messageId);
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
    if (!activeChat) return;
    
    setDeleting(true);
    try {
      const chatCollection = activeChat.isGrievance ? 'grievance_chats' : 'private_chats';
      const messageDocRef = doc(db, chatCollection, activeChat.id, 'messages', messageId);
      await deleteDoc(messageDocRef);
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting message:", error);
    } finally {
      setDeleting(false);
    }
  };

  // Delete entire chat conversation
  const handleDeleteChat = async (chatId: string, isGrievance?: boolean) => {
    if (!chatId) return;
    
    setDeletingChat(true);
    try {
      const chatCollection = isGrievance ? 'grievance_chats' : 'private_chats';
      
      // First delete all messages in the chat
      const messagesRef = collection(db, chatCollection, chatId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      const deletePromises = messagesSnapshot.docs.map(msgDoc => deleteDoc(msgDoc.ref));
      await Promise.all(deletePromises);
      
      // Then delete the chat document itself
      await deleteDoc(doc(db, chatCollection, chatId));
      
      // Clear active chat if it was the deleted one
      if (activeChat?.id === chatId) {
        setActiveChat(null);
      }
      
      setDeleteChatConfirm(null);
    } catch (error) {
      console.error("Error deleting chat:", error);
    } finally {
      setDeletingChat(false);
    }
  };

  const getOtherParticipant = (chat: ExtendedChat) => {
      if (!user) return { username: 'Unknown', role: '' };
      
      // For grievance chats, return the grievance number as the name
      if (chat.isGrievance) {
        return { username: `Grievance #${chat.grievanceNumber || '?'}`, role: 'Admin' };
      }
      
      const otherId = chat.participants.find(id => id !== user.uid);
      if (otherId && chat.participantData[otherId]) return chat.participantData[otherId];
      return { username: 'Unknown User', role: '' };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    // Append, but keep small limit
    setAttachments(prev => [...prev, ...files].slice(0, 5));
    // reset input
    e.currentTarget.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <NoAthleteBlock featureName="Messenger">
    <div className="flex h-[calc(100vh-140px)] gap-6">
      
      {/* LEFT SIDEBAR */}
      <div className={`w-full md:w-1/3 flex flex-col bg-slate-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-lg ${activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">Messenger</h2>
              
              {/* ALWAYS VISIBLE SEARCH */}
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                      placeholder="Search teammates..." 
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-10 pr-3 py-2 text-zinc-900 dark:text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
              </div>
          </div>

          {/* LIVE SEARCH RESULTS */}
          {searchQuery.trim() && (
              <div className="p-4 bg-zinc-100 dark:bg-black border-b border-zinc-200 dark:border-zinc-800 max-h-64 overflow-y-auto">
                  {searchResults.length > 0 ? (
                  <div className="space-y-2">
                      {searchResults.map(u => (
                          <div 
                              key={u.uid} 
                              onClick={() => startChat(u)} 
                              className="p-3 bg-white dark:bg-zinc-900 hover:bg-orange-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer transition-all hover:border-orange-500"
                          >
                              <div className="flex items-center justify-between">
                                  <div>
                                      <p className="font-bold text-zinc-900 dark:text-white text-sm">{u.name}</p>
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400">@{u.username || 'No username'}</p>
                                  </div>
                                  <span className={`text-xs px-2 py-1 rounded ${u.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'}`}>{u.role}</span>
                              </div>
                          </div>
                      ))}
                  </div>
                  ) : (
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-4">No users found</p>
                  )}
              </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {allChats.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-sm"><MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50"/>No conversations.</div>
              ) : (
                  allChats.map(chat => {
                      const other = getOtherParticipant(chat);
                      return (
                        <div key={chat.id} className={`p-4 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors ${activeChat?.id === chat.id ? 'bg-zinc-100 dark:bg-zinc-900 border-l-4 border-l-orange-500' : ''} ${chat.isGrievance ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                            {deleteChatConfirm === chat.id ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs text-red-600 dark:text-red-400">Delete this conversation?</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteChatConfirm(null); }}
                                    className="flex-1 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id, chat.isGrievance); }}
                                    disabled={deletingChat}
                                    className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {deletingChat ? '...' : 'Delete'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div onClick={() => setActiveChat(chat)}>
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        {chat.isGrievance && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                                        <h3 className="font-bold text-zinc-900 dark:text-white text-sm">{other.username}</h3>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className={`text-[10px] uppercase px-1.5 rounded ${chat.isGrievance ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400' : 'bg-zinc-200 dark:bg-black text-zinc-500'}`}>{other.role}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteChatConfirm(chat.id); }}
                                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                                        title="Delete conversation"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                </div>
                                <p className="text-zinc-500 text-xs truncate">{chat.lastMessage}</p>
                              </div>
                            )}
                        </div>
                      );
                  })
              )}
          </div>
      </div>

      {/* RIGHT SIDE */}
      <div className={`w-full md:w-2/3 flex flex-col bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-lg ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
              <>
                <div className={`p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3 ${activeChat.isGrievance ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-zinc-50 dark:bg-zinc-900/50'}`}>
                    <button onClick={() => setActiveChat(null)} className="md:hidden text-zinc-500 mr-2">←</button>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white ${activeChat.isGrievance ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-orange-500 to-red-600'}`}>
                        {activeChat.isGrievance ? <AlertTriangle className="w-5 h-5" /> : getOtherParticipant(activeChat).username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="text-zinc-900 dark:text-white font-bold">{getOtherParticipant(activeChat).username}</h3>
                        <p className={`text-xs uppercase tracking-wider ${activeChat.isGrievance ? 'text-amber-600' : 'text-orange-500'}`}>{activeChat.isGrievance ? 'Grievance Chat with Admin' : getOtherParticipant(activeChat).role}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-black/20 custom-scrollbar">
                    {messages.map((msg) => {
                        const isMe = msg.senderId === user?.uid;
                        const isEditing = editingMessageId === msg.id;
                        const isEdited = (msg as any).edited;
                        
                        const isSystemMessage = (msg as any).isSystemMessage;
                        
                        return (
                            <div key={msg.id} className={`flex ${isSystemMessage ? 'justify-center' : isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                                  isSystemMessage 
                                    ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100'
                                    : isMe 
                                      ? 'bg-orange-600 text-white rounded-br-none' 
                                      : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-bl-none'
                                }`}>
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
                                            className="text-orange-200 hover:text-white p-1"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleEditMessage(msg.id)}
                                            disabled={savingEdit || !editingText.trim()}
                                            className="text-orange-200 hover:text-white p-1 disabled:opacity-50"
                                          >
                                            {savingEdit ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <p>{msg.text}</p>
                                        {/* Attachments */}
                                        {((msg as any).attachments || []).length > 0 && (
                                          <div className="mt-2 space-y-2">
                                            {((msg as any).attachments || []).map((att: any, i: number) => (
                                              <div key={i} className="mt-1">
                                                {att.mimeType && att.mimeType.startsWith('image') ? (
                                                  <img src={att.url} alt={att.name} className="max-w-xs rounded shadow-sm" />
                                                ) : (
                                                  <a href={att.url} target="_blank" rel="noreferrer" className="text-sm text-sky-600 underline">{att.name}</a>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {/* Footer with timestamp and actions */}
                                        <div className={`flex items-center justify-between mt-1 gap-2 text-[10px] ${isMe ? 'text-orange-200' : 'text-zinc-400'}`}>
                                          <span>{isEdited && '(edited)'}</span>
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
                                        </div>
                                      </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm && (
                  <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-900/30 flex items-center justify-between">
                    <p className="text-sm text-red-600 dark:text-red-400">Delete this message?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded"
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

                {/* Rate limit warning */}
                {rateLimitError && (
                  <div className="px-4 py-2 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-900/30">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {rateLimitError}
                  </div>
                )}

                <form onSubmit={sendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    {/* Attachments preview */}
                    {attachments.length > 0 && (
                      <div className="mb-2 flex gap-2 items-center overflow-x-auto">
                        {attachments.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800">
                            <span className="text-xs">{f.name}</span>
                            <button type="button" onClick={() => removeAttachment(idx)} className="text-zinc-500 hover:text-zinc-700 ml-2">✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-full px-4 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"/>

                        <label className="relative inline-flex items-center justify-center p-2 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                          <input type="file" accept="image/*,application/pdf" multiple onChange={handleFileChange} className="hidden" />
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/></svg>
                        </label>

                        <button type="submit" disabled={(attachments.length === 0 && !newMessage.trim()) || sending} aria-label="Send message" className="bg-orange-600 hover:bg-orange-500 text-white p-2 rounded-full transition-colors disabled:opacity-50">
                          {sending ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </button>
                    </div>
                </form>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                  <div className="bg-zinc-100 dark:bg-zinc-900 p-6 rounded-full mb-4"><MessageSquare className="w-12 h-12 text-zinc-400" /></div>
                  <p className="text-lg">Select a conversation</p>
              </div>
          )}
      </div>
    </div>
    </NoAthleteBlock>
  );
};

export default Messenger;