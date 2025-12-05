import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc, limitToLast, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { sanitizeText } from '../../services/sanitize';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Send, MessageSquare, Users, Shield, UserCheck, Trash2, Check, CheckCheck } from 'lucide-react';
import { uploadFile } from '../../services/storage';
import type { PrivateChat, PrivateMessage, UserProfile } from '../../types';

const AdminMessenger: React.FC = () => {
  const { user, userData } = useAuth();
  
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const [activeChat, setActiveChat] = useState<PrivateChat | null>(null);
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
  const [roleFilter, setRoleFilter] = useState<'all' | 'Coach' | 'Parent'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Delete chat state
  const [deleteChatConfirm, setDeleteChatConfirm] = useState<string | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);

  // 1. LOAD CHATS - All chats where SuperAdmin is a participant
  useEffect(() => {
    if (!user) return;
    const chatsQuery = query(
      collection(db, 'private_chats'), 
      where('participants', 'array-contains', user.uid), 
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      setChats(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PrivateChat)));
    });
    return () => unsubscribe();
  }, [user]);

  // 2. LOAD MESSAGES
  useEffect(() => {
    if (!activeChat) return;
    const messagesQuery = query(
      collection(db, 'private_chats', activeChat.id, 'messages'), 
      orderBy('timestamp', 'asc'), 
      limitToLast(100)
    );
    
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PrivateMessage)));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [activeChat]);

  // 2b. MARK MESSAGES AS READ when viewing a chat
  useEffect(() => {
    if (!activeChat || !user) return;
    
    const markMessagesAsRead = async () => {
      // Find unread messages from other participants
      const unreadMessages = messages.filter(msg => {
        const readBy = (msg as any).readBy || [];
        return msg.senderId !== user.uid && !readBy.includes(user.uid);
      });
      
      if (unreadMessages.length === 0) return;
      
      // Batch update to mark as read
      try {
        const batch = writeBatch(db);
        unreadMessages.forEach(msg => {
          const msgRef = doc(db, 'private_chats', activeChat.id, 'messages', msg.id);
          const currentReadBy = (msg as any).readBy || [];
          batch.update(msgRef, {
            readBy: [...currentReadBy, user.uid],
            [`readAt.${user.uid}`]: serverTimestamp()
          });
        });
        await batch.commit();
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };
    
    // Small delay to prevent marking as read during initial load
    const timer = setTimeout(markMessagesAsRead, 500);
    return () => clearTimeout(timer);
  }, [activeChat?.id, messages, user]);

  // 3. LOAD ALL USERS (SuperAdmin can message anyone)
  useEffect(() => {
    const loadUsers = async () => {
      if (!user) return;

      try {
        // Load all users (SuperAdmin has access to everyone)
        const usersQuery = query(collection(db, 'users'));
        const snap = await getDocs(usersQuery);
        const users = snap.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() } as UserProfile));
        // Exclude self
        setAllUsers(users.filter(u => u.uid !== user.uid));
      } catch (error) {
        console.error("Error loading users:", error);
      }
    };
    loadUsers();
  }, [user?.uid]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Live search with role filter
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const term = debouncedSearchQuery.toLowerCase();
    const filtered = allUsers.filter(u => {
      const matchesSearch = (u.name || '').toLowerCase().includes(term) || 
                           (u.username || '').toLowerCase().includes(term) ||
                           (u.email || '').toLowerCase().includes(term);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
    setSearchResults(filtered);
  }, [debouncedSearchQuery, allUsers, roleFilter]);

  const startChat = async (targetUser: UserProfile) => {
    if (!user || !userData) return;
    
    // Check if chat already exists
    const existingChat = chats.find(c => c.participants.includes(targetUser.uid));
    if (existingChat) { 
      setActiveChat(existingChat); 
      setSearchQuery(''); 
      setSearchResults([]); 
      return; 
    }

    try {
      const participantData = {
        [user.uid]: { username: userData.username || userData.name || 'Admin', role: userData.role },
        [targetUser.uid]: { username: targetUser.username || targetUser.name || 'User', role: targetUser.role }
      };
      const newChatRef = await addDoc(collection(db, 'private_chats'), {
        participants: [user.uid, targetUser.uid], 
        participantData, 
        lastMessage: 'Chat started', 
        updatedAt: serverTimestamp(), 
        lastMessageTime: serverTimestamp()
      });
      setActiveChat({ 
        id: newChatRef.id, 
        participants: [user.uid, targetUser.uid], 
        participantData, 
        lastMessage: 'Chat started', 
        lastMessageTime: {} as any, 
        updatedAt: {} as any 
      });
      setSearchQuery(''); 
      setSearchResults([]);
    } catch (error) { 
      console.error(error); 
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && attachments.length === 0) || !activeChat || !user || sending) return;

    const text = sanitizeText(newMessage, 2000);
    setNewMessage('');
    setSending(true);

    try {
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

      const payload: any = { text, senderId: user.uid, timestamp: serverTimestamp() };
      if (uploadedAttachments && uploadedAttachments.length > 0) payload.attachments = uploadedAttachments;

      await addDoc(collection(db, 'private_chats', activeChat.id, 'messages'), payload);
      await updateDoc(doc(db, 'private_chats', activeChat.id), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
        lastSenderId: user.uid
      });
    } catch (error) {
      console.error(error);
      alert('Failed to send message or upload attachments.');
    } finally {
      setSending(false);
    }
  };

  const getOtherParticipant = (chat: PrivateChat) => {
    if (!user) return { username: 'Unknown', role: '' };
    const otherId = chat.participants.find(id => id !== user.uid);
    if (otherId && chat.participantData[otherId]) return chat.participantData[otherId];
    return { username: 'Unknown User', role: '' };
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Coach': return <Shield className="w-3 h-3" />;
      case 'Parent': return <Users className="w-3 h-3" />;
      case 'SuperAdmin': return <UserCheck className="w-3 h-3" />;
      default: return null;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Coach': return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400';
      case 'Parent': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400';
      case 'SuperAdmin': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400';
      default: return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
    }
  };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const files = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...files].slice(0, 5));
      e.currentTarget.value = '';
    };

    const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
    };

  // Delete entire chat conversation
  const handleDeleteChat = async (chatId: string) => {
    if (!chatId) return;
    
    setDeletingChat(true);
    try {
      // First delete all messages in the chat
      const messagesRef = collection(db, 'private_chats', chatId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      const deletePromises = messagesSnapshot.docs.map(msgDoc => deleteDoc(msgDoc.ref));
      await Promise.all(deletePromises);
      
      // Then delete the chat document itself
      await deleteDoc(doc(db, 'private_chats', chatId));
      
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Messenger</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Direct communication with coaches and parents</p>
      </div>

      <div className="flex h-[calc(100vh-220px)] gap-6">
        
        {/* LEFT SIDEBAR */}
        <div className={`w-full md:w-1/3 flex flex-col bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-lg ${activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">Conversations</h2>
            
            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder="Search all users..." 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-10 pr-3 py-2 text-zinc-900 dark:text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
              />
            </div>

            {/* Role Filter */}
            {searchQuery.trim() && (
              <div className="flex gap-2">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${roleFilter === 'all' ? 'bg-orange-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setRoleFilter('Coach')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${roleFilter === 'Coach' ? 'bg-purple-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}
                >
                  Coaches
                </button>
                <button
                  onClick={() => setRoleFilter('Parent')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${roleFilter === 'Parent' ? 'bg-green-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}
                >
                  Parents
                </button>
              </div>
            )}
          </div>

          {/* LIVE SEARCH RESULTS */}
          {searchQuery.trim() && (
            <div className="p-4 bg-zinc-100 dark:bg-black border-b border-zinc-200 dark:border-zinc-800 max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.slice(0, 20).map(u => (
                    <div 
                      key={u.uid} 
                      onClick={() => startChat(u)} 
                      className="p-3 bg-white dark:bg-zinc-900 hover:bg-orange-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer transition-all hover:border-orange-500"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-zinc-900 dark:text-white text-sm truncate">{u.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{u.username || u.email || 'No username'}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 flex-shrink-0 ml-2 ${getRoleBadgeStyle(u.role)}`}>
                          {getRoleIcon(u.role)}
                          {u.role}
                        </span>
                      </div>
                    </div>
                  ))}
                  {searchResults.length > 20 && (
                    <p className="text-xs text-zinc-500 text-center py-2">
                      Showing 20 of {searchResults.length} results. Refine your search.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-4">No users found</p>
              )}
            </div>
          )}

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {chats.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50"/>
                <p>No conversations yet.</p>
                <p className="text-xs mt-2">Search for a user to start messaging.</p>
              </div>
            ) : (
              chats.map(chat => {
                const other = getOtherParticipant(chat);
                return (
                  <div 
                    key={chat.id} 
                    className={`p-4 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors ${activeChat?.id === chat.id ? 'bg-zinc-100 dark:bg-zinc-900 border-l-4 border-l-orange-500' : ''}`}
                  >
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
                            onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
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
                          <h3 className="font-bold text-zinc-900 dark:text-white text-sm truncate">{other.username}</h3>
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${getRoleBadgeStyle(other.role)}`}>
                              {getRoleIcon(other.role)}
                              {other.role}
                            </span>
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

        {/* RIGHT SIDE - Chat Window */}
        <div className={`w-full md:w-2/3 flex flex-col bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-lg ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
            <>
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50">
                <button onClick={() => setActiveChat(null)} className="md:hidden text-zinc-500 mr-2">←</button>
                <div className="h-10 w-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center font-bold text-white">
                  {getOtherParticipant(activeChat).username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-zinc-900 dark:text-white font-bold">{getOtherParticipant(activeChat).username}</h3>
                  <p className="text-xs text-orange-500 uppercase tracking-wider flex items-center gap-1">
                    {getRoleIcon(getOtherParticipant(activeChat).role)}
                    {getOtherParticipant(activeChat).role}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-black/20 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-zinc-500 py-12">
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === user?.uid;
                    
                    // Read receipt logic - check if other participant(s) have read this message
                    const readBy = (msg as any).readBy || [];
                    const otherParticipants = activeChat?.participants.filter(p => p !== user?.uid) || [];
                    const isRead = otherParticipants.some(p => readBy.includes(p));
                    
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-bl-none'}`}>
                          <p className="break-words">{msg.text}</p>
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
                          {/* Read receipt for sender's messages */}
                          {isMe && (
                            <div className="flex justify-end mt-1">
                              <span className="flex items-center text-[10px]" title={isRead ? 'Read' : 'Delivered'}>
                                {isRead ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                                ) : (
                                  <Check className="w-3 h-3 text-orange-200" />
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={scrollRef} />
              </div>

              <form onSubmit={sendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
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
                  <input 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Type a message..." 
                    className="flex-1 bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-full px-4 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />

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
              <div className="bg-zinc-100 dark:bg-zinc-900 p-6 rounded-full mb-4">
                <MessageSquare className="w-12 h-12 text-zinc-400" />
              </div>
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mt-2">Or search for a user to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMessenger;
