import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc, limitToLast } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Send, MessageSquare } from 'lucide-react';
import type { PrivateChat, PrivateMessage, UserProfile } from '../types';

const Messenger: React.FC = () => {
  // ADDED: teamData to scope the search to teammates only
  const { user, userData, teamData } = useAuth();
  
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const [activeChat, setActiveChat] = useState<PrivateChat | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. LOAD CHATS
  useEffect(() => {
    if (!user) return;
    const chatsQuery = query(collection(db, 'private_chats'), where('participants', 'array-contains', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
        setChats(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PrivateChat)));
    });
    return () => unsubscribe();
  }, [user]);

  // 2. LOAD MESSAGES (Optimized with limitToLast)
  useEffect(() => {
      if (!activeChat) return;
      // FIX: Added limitToLast(50) to prevent loading thousands of old messages
      const messagesQuery = query(collection(db, 'private_chats', activeChat.id, 'messages'), orderBy('timestamp', 'asc'), limitToLast(50));
      
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
      const text = newMessage; setNewMessage('');
      setSending(true);
      try {
          await addDoc(collection(db, 'private_chats', activeChat.id, 'messages'), { text, senderId: user.uid, timestamp: serverTimestamp() });
          await updateDoc(doc(db, 'private_chats', activeChat.id), { lastMessage: text, updatedAt: serverTimestamp(), lastMessageTime: serverTimestamp() });
      } catch (error) { console.error(error); }
      finally { setSending(false); }
  };

  const getOtherParticipant = (chat: PrivateChat) => {
      if (!user) return { username: 'Unknown', role: '' };
      const otherId = chat.participants.find(id => id !== user.uid);
      if (otherId && chat.participantData[otherId]) return chat.participantData[otherId];
      return { username: 'Unknown User', role: '' };
  };

  return (
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
              {chats.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-sm"><MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50"/>No conversations.</div>
              ) : (
                  chats.map(chat => {
                      const other = getOtherParticipant(chat);
                      return (
                        <div key={chat.id} onClick={() => setActiveChat(chat)} className={`p-4 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors ${activeChat?.id === chat.id ? 'bg-zinc-100 dark:bg-zinc-900 border-l-4 border-l-orange-500' : ''}`}>
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-zinc-900 dark:text-white text-sm">{other.username}</h3>
                                <span className="text-[10px] text-zinc-500 uppercase bg-zinc-200 dark:bg-black px-1.5 rounded">{other.role}</span>
                            </div>
                            <p className="text-zinc-500 text-xs truncate">{chat.lastMessage}</p>
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
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50">
                    <button onClick={() => setActiveChat(null)} className="md:hidden text-zinc-500 mr-2">←</button>
                    <div className="h-10 w-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center font-bold text-white">
                        {getOtherParticipant(activeChat).username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="text-zinc-900 dark:text-white font-bold">{getOtherParticipant(activeChat).username}</h3>
                        <p className="text-xs text-orange-500 uppercase tracking-wider">{getOtherParticipant(activeChat).role}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-black/20 custom-scrollbar">
                    {messages.map((msg) => {
                        const isMe = msg.senderId === user?.uid;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-orange-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-bl-none'}`}>
                                    <p>{msg.text}</p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>

                <form onSubmit={sendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex gap-2">
                    <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-full px-4 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"/>
                    <button type="submit" disabled={!newMessage.trim() || sending} aria-label="Send message" className="bg-orange-600 hover:bg-orange-500 text-white p-2 rounded-full transition-colors disabled:opacity-50">
                      {sending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
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
  );
};

export default Messenger;