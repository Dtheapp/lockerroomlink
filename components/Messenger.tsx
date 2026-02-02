import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc, limitToLast, deleteDoc, writeBatch, arrayUnion, getDoc, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText } from '../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import { uploadFile } from '../services/storage';
import { moderateText, getModerationWarning } from '../services/moderation';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { Search, Send, MessageSquare, AlertCircle, Edit2, Trash2, X, Check, AlertTriangle, CheckCheck, Reply, CornerUpLeft } from 'lucide-react';
import type { PrivateChat, PrivateMessage, UserProfile } from '../types';

// Extended chat type that can be regular or grievance
interface ExtendedChat extends PrivateChat {
  isGrievance?: boolean;
  grievanceNumber?: number;
}

// Extended message type with reply support
interface ExtendedMessage extends PrivateMessage {
  readBy?: string[];
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
    senderName?: string;
  };
}

const Messenger: React.FC = () => {
  // ADDED: teamData to scope the search to teammates only
  const { user, userData, teamData } = useAuth();
  const { markAsRead } = useUnreadMessages();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [chats, setChats] = useState<ExtendedChat[]>([]);
  const [grievanceChats, setGrievanceChats] = useState<ExtendedChat[]>([]);
  const [activeChat, setActiveChat] = useState<ExtendedChat | null>(null);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
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
  
  // Reply to message state
  const [replyingTo, setReplyingTo] = useState<ExtendedMessage | null>(null);
  
  // Edit/Delete message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Delete chat state
  const [deleteChatConfirm, setDeleteChatConfirm] = useState<string | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);

  // Combine regular chats + grievance chats, filter out hidden ones
  const allChats = [...chats, ...grievanceChats]
    .filter(chat => {
      // Filter out chats that are hidden for this user
      const hiddenFor = (chat as any).hiddenFor || [];
      return !hiddenFor.includes(user?.uid);
    })
    .sort((a, b) => {
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
        // Filter out chats where current user is in hiddenFor array
        const allChats = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ExtendedChat));
        const visibleChats = allChats.filter(chat => {
          const hiddenFor = (chat as any).hiddenFor || [];
          return !hiddenFor.includes(user.uid);
        });
        setChats(visibleChats);
    });
    return () => unsubscribe();
  }, [user]);

  // 1a. AUTO-START CHAT from URL parameter (e.g., /messenger?userId=abc123)
  const autoStartingChatRef = useRef<string | null>(null);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  
  // Mark chats as loaded after initial fetch
  useEffect(() => {
    if (chats !== undefined) {
      // Small delay to ensure Firestore snapshot has completed
      const timer = setTimeout(() => setChatsLoaded(true), 300);
      return () => clearTimeout(timer);
    }
  }, [chats]);
  
  useEffect(() => {
    const targetUserId = searchParams.get('userId');
    if (!targetUserId || !user || !userData) return;
    
    // Wait for chats to be loaded before checking for existing
    if (!chatsLoaded) return;
    
    // Prevent duplicate executions for the same userId
    if (autoStartingChatRef.current === targetUserId) return;
    
    const autoStartChat = async () => {
      // Mark as in-progress to prevent duplicate calls
      autoStartingChatRef.current = targetUserId;
      
      // Check if chat already exists with this user
      const existingChat = chats.find(c => c.participants.includes(targetUserId));
      if (existingChat) {
        setActiveChat(existingChat);
        setSearchParams({});
        autoStartingChatRef.current = null;
        return;
      }
      
      // Also check Firestore directly in case local state is stale
      try {
        const existingChatsQuery = query(
          collection(db, 'private_chats'),
          where('participants', 'array-contains', user.uid)
        );
        const existingChatsSnap = await getDocs(existingChatsQuery);
        const foundChat = existingChatsSnap.docs.find(d => 
          (d.data().participants || []).includes(targetUserId)
        );
        
        if (foundChat) {
          const chatData = { id: foundChat.id, ...foundChat.data() } as ExtendedChat;
          setActiveChat(chatData);
          setSearchParams({});
          autoStartingChatRef.current = null;
          return;
        }
        
        // No existing chat found - fetch target user and create new
        const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
        if (!targetUserDoc.exists()) {
          console.error('Target user not found:', targetUserId);
          setSearchParams({});
          autoStartingChatRef.current = null;
          return;
        }
        
        const targetUser = { uid: targetUserId, ...targetUserDoc.data() } as UserProfile;
        
        // Create new chat
        const participantData = {
          [user.uid]: { username: userData.username || userData.name || 'Me', role: userData.role },
          [targetUserId]: { username: targetUser.username || targetUser.name || 'User', role: targetUser.role }
        };
        
        const newChatRef = await addDoc(collection(db, 'private_chats'), {
          participants: [user.uid, targetUserId],
          participantData,
          lastMessage: 'Chat started',
          updatedAt: serverTimestamp(),
          lastMessageTime: serverTimestamp()
        });
        
        setActiveChat({
          id: newChatRef.id,
          participants: [user.uid, targetUserId],
          participantData,
          lastMessage: 'Chat started',
          lastMessageTime: {} as any,
          updatedAt: {} as any
        });
        
        // Clear the URL parameter
        setSearchParams({});
        autoStartingChatRef.current = null;
      } catch (error) {
        console.error('Error auto-starting chat:', error);
        setSearchParams({});
        autoStartingChatRef.current = null;
      }
    };
    
    autoStartChat();
  }, [searchParams, user, userData, chats, chatsLoaded, setSearchParams]);

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
          setMessages(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ExtendedMessage)));
          setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
      return () => unsubscribe();
  }, [activeChat]);

  // 2b. MARK MESSAGES AS READ when viewing a chat
  useEffect(() => {
    if (!activeChat || !user || messages.length === 0) return;
    
    const markMessagesAsRead = async () => {
      const chatCollection = activeChat.isGrievance ? 'grievance_chats' : 'private_chats';
      
      // Find unread messages from other participants (not sent by me, and I haven't read them)
      const unreadMessages = messages.filter(msg => {
        if (msg.senderId === user.uid) return false; // Skip my own messages
        const readBy = msg.readBy || [];
        return !readBy.includes(user.uid);
      });
      
      if (unreadMessages.length === 0) return;
      
      // Batch update to mark as read
      try {
        const batch = writeBatch(db);
        unreadMessages.forEach(msg => {
          const msgRef = doc(db, chatCollection, activeChat.id, 'messages', msg.id);
          const currentReadBy = msg.readBy || [];
          // Only add if not already in the array
          if (!currentReadBy.includes(user.uid)) {
            batch.update(msgRef, {
              readBy: [...currentReadBy, user.uid],
              [`readAt.${user.uid}`]: serverTimestamp()
            });
          }
        });
        await batch.commit();
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };
    
    // Small delay to prevent marking as read during initial load
    const timer = setTimeout(markMessagesAsRead, 300);
    return () => clearTimeout(timer);
  }, [activeChat?.id, messages.length, user?.uid]); // Use messages.length instead of messages to prevent infinite loops

  // 3. LOAD USERS FOR SEARCH (Load team members: coaches, parents of players)
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!teamData?.id) return;

      try {
        const teamMemberIds = new Set<string>();
        
        // 1. Get team document to find coaches
        const teamDoc = await getDoc(doc(db, 'teams', teamData.id));
        if (teamDoc.exists()) {
          const team = teamDoc.data();
          // Add all coach IDs
          if (team.ownerId) teamMemberIds.add(team.ownerId);
          if (team.coachId) teamMemberIds.add(team.coachId);
          if (team.headCoachId) teamMemberIds.add(team.headCoachId);
          if (team.offensiveCoordinatorId) teamMemberIds.add(team.offensiveCoordinatorId);
          if (team.defensiveCoordinatorId) teamMemberIds.add(team.defensiveCoordinatorId);
          if (team.specialTeamsCoordinatorId) teamMemberIds.add(team.specialTeamsCoordinatorId);
          if (team.coachIds) team.coachIds.forEach((id: string) => teamMemberIds.add(id));
          // Add parent IDs from team's parentIds array
          if (team.parentIds) team.parentIds.forEach((id: string) => teamMemberIds.add(id));
        }
        
        // 2. Get roster to find parent IDs
        const rosterSnap = await getDocs(collection(db, 'teams', teamData.id, 'players'));
        rosterSnap.docs.forEach(playerDoc => {
          const player = playerDoc.data();
          if (player.parentId) teamMemberIds.add(player.parentId);
          if (player.parentUserId) teamMemberIds.add(player.parentUserId);
        });
        
        // Remove current user from the list
        teamMemberIds.delete(user?.uid || '');
        
        // 3. Fetch user profiles for all team members
        const memberIds = Array.from(teamMemberIds);
        if (memberIds.length === 0) {
          setAllUsers([]);
          return;
        }
        
        // Firestore 'in' query is limited to 30 items, so chunk if needed
        const users: UserProfile[] = [];
        const chunks = [];
        for (let i = 0; i < memberIds.length; i += 30) {
          chunks.push(memberIds.slice(i, i + 30));
        }
        
        for (const chunk of chunks) {
          const usersQuery = query(collection(db, 'users'), where('__name__', 'in', chunk));
          const snap = await getDocs(usersQuery);
          snap.docs.forEach(docSnap => {
            users.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
          });
        }
        
        console.log('📬 Loaded team members for messenger:', users.length);
        setAllUsers(users);
      } catch (error) {
        console.error("Error loading team members:", error);
      }
    };
    loadTeamMembers();
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
      
      // SECURITY: Moderate and sanitize message before storing
      const moderationResult = moderateText(newMessage);
      if (!moderationResult.isAllowed) {
        setRateLimitError('Message contains inappropriate content and cannot be sent.');
        setTimeout(() => setRateLimitError(null), 5000);
        return;
      }
      if (moderationResult.requiresReview) {
        // Allow but warn user
        const warning = getModerationWarning(moderationResult);
        if (warning) {
          console.warn('Message flagged for review:', warning);
        }
      }
      
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

        // Build message payload with readBy initialized and reply support
        const messagePayload: any = { 
          text, 
          senderId: user.uid, 
          timestamp: serverTimestamp(),
          readBy: [user.uid] // Initialize with sender as having "read" it
        };
        
        if (uploadedAttachments && uploadedAttachments.length > 0) {
          messagePayload.attachments = uploadedAttachments;
        }
        
        // Add reply reference if replying to a message
        if (replyingTo) {
          const replyingSenderName = replyingTo.senderId === user.uid 
            ? 'You' 
            : (activeChat.participantData[replyingTo.senderId]?.username || 'Unknown');
          messagePayload.replyTo = {
            id: replyingTo.id,
            text: replyingTo.text.substring(0, 100), // Truncate for storage
            senderId: replyingTo.senderId,
            senderName: replyingSenderName
          };
        }

        // Determine which collection to use based on chat type
        const chatCollection = activeChat.isGrievance ? 'grievance_chats' : 'private_chats';
        
        await addDoc(collection(db, chatCollection, activeChat.id, 'messages'), messagePayload);
        // Clear hiddenFor so chat reappears for users who "deleted" it
        await updateDoc(doc(db, chatCollection, activeChat.id), { 
          lastMessage: text, 
          updatedAt: serverTimestamp(), 
          lastMessageTime: serverTimestamp(), 
          lastSenderId: user.uid,
          hiddenFor: deleteField() // Remove hiddenFor array so chat reappears for all participants
        });
        
        // Clear reply state after sending
        setReplyingTo(null);
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

  // Delete entire chat conversation (soft delete - hides from user's view)
  const handleDeleteChat = async (chatId: string, isGrievance?: boolean) => {
    if (!chatId || !user?.uid) return;
    
    setDeletingChat(true);
    try {
      const chatCollection = isGrievance ? 'grievance_chats' : 'private_chats';
      
      // Soft delete: Add current user to hiddenFor array
      // This hides the chat from their view without deleting it for the other person
      const chatRef = doc(db, chatCollection, chatId);
      await updateDoc(chatRef, {
        hiddenFor: arrayUnion(user.uid)
      });
      
      // Remove from local state immediately
      setAllChats(prev => prev.filter(c => c.id !== chatId));
      
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
    <div className="flex h-[calc(100vh-140px)] gap-6">
      
      {/* LEFT SIDEBAR */}
      <div className={`w-full md:w-1/3 flex flex-col bg-white dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden shadow-lg dark:shadow-2xl ${activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/40 backdrop-blur-xl">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">Messenger</h2>
              
              {/* ALWAYS VISIBLE SEARCH */}
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-slate-500" />
                  <input 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                      placeholder="Search teammates..." 
                      className="w-full bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg pl-10 pr-3 py-2 text-zinc-900 dark:text-white text-sm placeholder-zinc-400 dark:placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none"
                  />
              </div>
          </div>

          {/* LIVE SEARCH RESULTS */}
          {searchQuery.trim() && (
              <div className="p-4 bg-zinc-50 dark:bg-black/30 border-b border-zinc-200 dark:border-white/10 max-h-64 overflow-y-auto">
                  {searchResults.length > 0 ? (
                  <div className="space-y-2">
                      {searchResults.map(u => (
                          <div 
                              key={u.uid} 
                              onClick={() => startChat(u)} 
                              className="p-3 bg-white dark:bg-white/5 hover:bg-purple-50 dark:hover:bg-purple-500/20 border border-zinc-200 dark:border-white/10 rounded-lg cursor-pointer transition-all hover:border-purple-300 dark:hover:border-purple-500/50"
                          >
                              <div className="flex items-center justify-between">
                                  <div>
                                      <p className="font-bold text-zinc-900 dark:text-white text-sm">{u.name}</p>
                                      <p className="text-xs text-zinc-500 dark:text-slate-400">@{u.username || 'No username'}</p>
                                  </div>
                                  <span className={`text-xs px-2 py-1 rounded ${u.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>{u.role}</span>
                              </div>
                          </div>
                      ))}
                  </div>
                  ) : (
                      <p className="text-zinc-500 dark:text-slate-500 text-sm text-center py-4">No users found</p>
                  )}
              </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {allChats.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 dark:text-slate-500 text-sm"><MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50"/>No conversations.</div>
              ) : (
                  allChats.map(chat => {
                      const other = getOtherParticipant(chat);
                      
                      // Check if this specific chat has unread messages
                      const lastSenderId = (chat as any).lastSenderId;
                      const hasUnread = lastSenderId && lastSenderId !== user?.uid;
                      
                      return (
                        <div key={chat.id} className={`p-4 border-b border-zinc-100 dark:border-white/5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors ${activeChat?.id === chat.id ? 'bg-purple-50 dark:bg-white/10 border-l-4 border-l-purple-500' : ''} ${chat.isGrievance ? 'bg-amber-50 dark:bg-amber-500/5' : ''}`}>
                            {deleteChatConfirm === chat.id ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs text-red-500 dark:text-red-400">Delete this conversation?</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteChatConfirm(null); }}
                                    className="flex-1 px-2 py-1 text-xs text-zinc-500 dark:text-slate-400 bg-zinc-100 dark:bg-white/10 rounded hover:bg-zinc-200 dark:hover:bg-white/20"
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
                                        {chat.isGrievance && <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
                                        <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
                                          {other.username}
                                          {/* Unread indicator - pulsing red dot */}
                                          {hasUnread && activeChat?.id !== chat.id && (
                                            <span className="relative flex h-2.5 w-2.5">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
                                            </span>
                                          )}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className={`text-[10px] uppercase px-1.5 rounded ${chat.isGrievance ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-slate-400'}`}>{other.role}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteChatConfirm(chat.id); }}
                                        className="p-1 text-zinc-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                        title="Delete conversation"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                </div>
                                <p className={`text-xs truncate ${hasUnread && activeChat?.id !== chat.id ? 'text-zinc-900 dark:text-white font-medium' : 'text-zinc-500 dark:text-slate-500'}`}>{chat.lastMessage}</p>
                              </div>
                            )}
                        </div>
                      );
                  })
              )}
          </div>
      </div>

      {/* RIGHT SIDE */}
      <div className={`w-full md:w-2/3 flex flex-col bg-white dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden shadow-lg dark:shadow-2xl ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
              <>
                <div className={`p-4 border-b border-zinc-200 dark:border-white/10 flex items-center gap-3 bg-zinc-50 dark:bg-black/40 backdrop-blur-xl ${activeChat.isGrievance ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}>
                    <button onClick={() => setActiveChat(null)} className="md:hidden text-zinc-500 dark:text-slate-400 mr-2">←</button>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white ${activeChat.isGrievance ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-purple-500 to-purple-600'}`}>
                        {activeChat.isGrievance ? <AlertTriangle className="w-5 h-5" /> : getOtherParticipant(activeChat).username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="text-zinc-900 dark:text-white font-bold">{getOtherParticipant(activeChat).username}</h3>
                        <p className={`text-xs uppercase tracking-wider ${activeChat.isGrievance ? 'text-amber-600 dark:text-amber-400' : 'text-purple-600 dark:text-purple-400'}`}>{activeChat.isGrievance ? 'Grievance Chat with Admin' : getOtherParticipant(activeChat).role}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-black/20 custom-scrollbar">
                    {messages.map((msg) => {
                        const isMe = msg.senderId === user?.uid;
                        const isEditing = editingMessageId === msg.id;
                        const isEdited = (msg as any).edited;
                        
                        const isSystemMessage = (msg as any).isSystemMessage;
                        
                        // Read receipt logic - check if other participant(s) have read this message
                        const readBy = msg.readBy || [];
                        const otherParticipants = activeChat?.participants.filter(p => p !== user?.uid) || [];
                        const isRead = otherParticipants.some(p => readBy.includes(p));
                        
                        // Get reply info if this message is a reply
                        const replyInfo = msg.replyTo;
                        
                        return (
                            <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isSystemMessage ? 'justify-center' : isMe ? 'justify-end' : 'justify-start'} group`}>
                                {/* Reply button - shows on hover for non-system messages */}
                                {!isSystemMessage && !isMe && (
                                  <button
                                    onClick={() => setReplyingTo(msg)}
                                    className="opacity-0 group-hover:opacity-100 self-center mr-1 p-1 text-zinc-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
                                    title="Reply"
                                  >
                                    <Reply className="w-4 h-4" />
                                  </button>
                                )}
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                                  isSystemMessage 
                                    ? 'bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-100'
                                    : isMe 
                                      ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-br-none' 
                                      : 'bg-white dark:bg-white/10 backdrop-blur-sm text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-bl-none'
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
                                            className="text-purple-200 hover:text-white p-1"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleEditMessage(msg.id)}
                                            disabled={savingEdit || !editingText.trim()}
                                            className="text-purple-200 hover:text-white p-1 disabled:opacity-50"
                                          >
                                            {savingEdit ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        {/* Reply preview - shows what message this is replying to */}
                                        {msg.replyTo?.id && msg.replyTo?.text && (
                                          <div 
                                            className={`mb-2 p-2 rounded cursor-pointer border-l-2 ${
                                              isMe 
                                                ? 'bg-purple-700/50 border-purple-300' 
                                                : 'bg-white/5 border-purple-500'
                                            }`}
                                            onClick={() => {
                                              const replyElement = document.getElementById(`msg-${msg.replyTo?.id}`);
                                              if (replyElement) {
                                                replyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                replyElement.classList.add('ring-2', 'ring-purple-500');
                                                setTimeout(() => replyElement.classList.remove('ring-2', 'ring-purple-500'), 2000);
                                              }
                                            }}
                                          >
                                            <p className={`text-[10px] font-semibold ${isMe ? 'text-purple-200' : 'text-purple-400'}`}>
                                              {msg.replyTo.senderName || 'Unknown'}
                                            </p>
                                            <p className={`text-xs truncate ${isMe ? 'text-purple-100/80' : 'text-slate-400'}`}>
                                              {msg.replyTo.text}
                                            </p>
                                          </div>
                                        )}
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
                                        {/* Footer with timestamp, read receipts, and actions */}
                                        <div className={`flex items-center justify-between mt-1 gap-2 text-[10px] ${isMe ? 'text-purple-200' : 'text-zinc-500 dark:text-slate-500'}`}>
                                          <span>{isEdited && '(edited)'}</span>
                                          <div className="flex items-center gap-1">
                                            {/* Read receipt checkmarks for sender's own messages */}
                                            {isMe && !isSystemMessage && (
                                              <span className="flex items-center" title={isRead ? 'Read' : 'Delivered'}>
                                                {isRead ? (
                                                  <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                                                ) : (
                                                  <Check className="w-3 h-3" />
                                                )}
                                              </span>
                                            )}
                                            {isMe && (
                                              <>
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
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                </div>
                                {/* Reply button - shows on hover for sender's own messages */}
                                {!isSystemMessage && isMe && (
                                  <button
                                    onClick={() => setReplyingTo(msg)}
                                    className="opacity-0 group-hover:opacity-100 self-center ml-1 p-1 text-zinc-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
                                    title="Reply"
                                  >
                                    <Reply className="w-4 h-4" />
                                  </button>
                                )}
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm && (
                  <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 border-t border-red-200 dark:border-red-500/30 flex items-center justify-between">
                    <p className="text-sm text-red-600 dark:text-red-400">Delete this message?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1 text-sm text-zinc-500 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-white/10 rounded"
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
                  <div className="px-4 py-2 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-500/10 border-t border-amber-200 dark:border-amber-500/30">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {rateLimitError}
                  </div>
                )}

                <form onSubmit={sendMessage} className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/40 backdrop-blur-xl">
                    {/* Reply preview - shows what message you're replying to */}
                    {replyingTo && (
                      <div className="mb-2 p-2 bg-purple-100 dark:bg-purple-500/20 border-l-4 border-purple-500 rounded flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                            Replying to {replyingTo.senderId === user?.uid ? 'yourself' : (allUsers.find(u => u.uid === replyingTo.senderId)?.name || 'Unknown')}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-slate-400 truncate">
                            {replyingTo.text}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="ml-2 p-1 text-zinc-400 dark:text-slate-500 hover:text-zinc-700 dark:hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Attachments preview */}
                    {attachments.length > 0 && (
                      <div className="mb-2 flex gap-2 items-center overflow-x-auto">
                        {attachments.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 px-3 py-1 rounded-full border border-zinc-200 dark:border-white/10">
                            <span className="text-xs text-zinc-700 dark:text-white">{f.name}</span>
                            <button type="button" onClick={() => removeAttachment(idx)} className="text-zinc-400 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-white ml-2">✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-full px-4 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"/>

                        <label className="relative inline-flex items-center justify-center p-2 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 cursor-pointer hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors">
                          <input type="file" accept="image/*,application/pdf" multiple onChange={handleFileChange} className="hidden" />
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/></svg>
                        </label>

                        <button type="submit" disabled={(attachments.length === 0 && !newMessage.trim()) || sending} aria-label="Send message" className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white p-2 rounded-full transition-colors disabled:opacity-50">
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
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-slate-500">
                  <div className="bg-zinc-100 dark:bg-white/5 p-6 rounded-full mb-4"><MessageSquare className="w-12 h-12 text-zinc-400 dark:text-slate-600" /></div>
                  <p className="text-lg text-zinc-500 dark:text-slate-400">Select a conversation</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default Messenger;