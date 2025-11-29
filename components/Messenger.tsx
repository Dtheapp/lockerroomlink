import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Send, MessageSquare, User, Clock } from 'lucide-react';
import type { PrivateChat, PrivateMessage, UserProfile } from '../types';

const Messenger: React.FC = () => {
  const { user, userData } = useAuth();
  
  // STATES
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const [activeChat, setActiveChat] = useState<PrivateChat | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // SEARCH STATES
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. LISTEN TO MY CONVERSATIONS
  useEffect(() => {
    if (!user) return;
    
    // Query chats where I am a participant
    const q = query(
        collection(db, 'private_chats'), 
        where('participants', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const chatsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PrivateChat));
        setChats(chatsData);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. LISTEN TO ACTIVE CHAT MESSAGES
  useEffect(() => {
      if (!activeChat) return;

      const q = query(
          collection(db, 'private_chats', activeChat.id, 'messages'),
          orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PrivateMessage));
          setMessages(msgs);
          // Auto scroll
          setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });

      return () => unsubscribe();
  }, [activeChat]);

  // --- HANDLERS ---

  const handleSearchInput = async (inputQuery: string) => {
      setSearchQuery(inputQuery);
      
      if (!inputQuery.trim()) {
          setSearchResults([]);
          return;
      }
      
      setSearching(true);

      try {
          // FETCH ALL USERS & FILTER CLIENT-SIDE (Better UX for names/usernames)
          const q = query(collection(db, 'users'));
          const snap = await getDocs(q);
          const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
          
          const term = inputQuery.toLowerCase();
          
          const results = allUsers.filter(u => {
              const uName = (u.name || '').toLowerCase();
              const uUser = (u.username || '').toLowerCase();
              
              // Exclude myself
              if (u.uid === user?.uid) return false;
              
              // MATCH Logic: Name OR Username
              return uName.includes(term) || uUser.includes(term);
          });

          setSearchResults(results);
      } catch (error) {
          console.error("Search error:", error);
      } finally {
          setSearching(false);
      }
  };

  const startChat = async (targetUser: UserProfile) => {
      if (!user || !userData) return;

      // 1. Check if chat already exists
      const existingChat = chats.find(c => c.participants.includes(targetUser.uid));
      if (existingChat) {
          setActiveChat(existingChat);
          setSearchQuery('');
          setSearchResults([]);
          return;
      }

      // 2. Create New Chat
      try {
          const participantData = {
              [user.uid]: { username: userData.username || 'Me', role: userData.role },
              [targetUser.uid]: { username: targetUser.username || 'User', role: targetUser.role }
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
          console.error("Error creating chat:", error);
      }
  };

  const sendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !activeChat || !user) return;

      const text = newMessage;
      setNewMessage(''); 

      try {
          await addDoc(collection(db, 'private_chats', activeChat.id, 'messages'), {
              text,
              senderId: user.uid,
              timestamp: serverTimestamp()
          });

          await updateDoc(doc(db, 'private_chats', activeChat.id), {
              lastMessage: text,
              updatedAt: serverTimestamp(),
              lastMessageTime: serverTimestamp()
          });
      } catch (error) {
          console.error("Send failed:", error);
      }
  };

  const getOtherParticipant = (chat: PrivateChat) => {
      if (!user) return { username: 'Unknown', role: '' };
      const otherId = chat.participants.find(id => id !== user.uid);
      if (otherId && chat.participantData[otherId]) {
          return chat.participantData[otherId];
      }
      return { username: 'Unknown User', role: '' };
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      
      {/* LEFT SIDEBAR: CHAT LIST */}
      <div className={`w-full md:w-1/3 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg dark:shadow-xl ${activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Messenger</h2>
              
              {/* SEARCH UI - ALWAYS VISIBLE */}
              <div className="flex gap-2 mb-2">
                  <input 
                    value={searchQuery}
                    onChange={e => handleSearchInput(e.target.value)}
                    placeholder="Search Name or Username..." 
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm focus:outline-none focus:ring-sky-500"
                  />
              </div>
              {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                      {searchResults.map(u => (
                          <div key={u.uid} onClick={() => startChat(u)} className="flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors">
                              <div>
                                  <p className="text-slate-900 dark:text-white text-sm font-bold">{u.name}</p>
                                  <p className="text-xs text-sky-600 dark:text-sky-400">@{u.username}</p>
                              </div>
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{u.role}</span>
                          </div>
                      ))}
                  </div>
              )}
              {searchResults.length === 0 && searchQuery && !searching && <p className="text-xs text-slate-600 dark:text-slate-500">No user found.</p>}
          </div>

          {/* LIST OF CHATS */}
          <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                  <div className="p-8 text-center text-slate-600 dark:text-slate-500 text-sm">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50"/>
                      No conversations yet.<br/>Search to start.
                  </div>
              ) : (
                  chats.map(chat => {
                      const other = getOtherParticipant(chat);
                      return (
                        <div 
                            key={chat.id} 
                            onClick={() => setActiveChat(chat)}
                            className={`p-4 border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${activeChat?.id === chat.id ? 'bg-sky-50 dark:bg-slate-800 border-l-4 border-l-sky-500' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{other.username}</h3>
                                <span className="text-[10px] text-slate-600 dark:text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{other.role}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs truncate">{chat.lastMessage}</p>
                        </div>
                      );
                  })
              )}
          </div>
      </div>

      {/* RIGHT SIDE: ACTIVE CHAT */}
      <div className={`w-full md:w-2/3 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg dark:shadow-xl ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/30">
                    <button onClick={() => setActiveChat(null)} className="md:hidden text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mr-2">← Back</button>
                    <div className="h-10 w-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center font-bold text-white">
                        {getOtherParticipant(activeChat).username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-bold">{getOtherParticipant(activeChat).username}</h3>
                        <p className="text-xs text-sky-600 dark:text-sky-400 uppercase tracking-wider">{getOtherParticipant(activeChat).role}</p>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                    {messages.map((msg, index) => {
                        const isMe = msg.senderId === user?.uid;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-sky-500 dark:bg-sky-600 text-white rounded-br-none' : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-bl-none'}`}>
                                    <p>{msg.text}</p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={sendMessage} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
                    <input 
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Type a message..." 
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-sky-500 transition-colors"
                    />
                    <button type="submit" disabled={!newMessage.trim()} className="bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 text-white p-2 rounded-full transition-colors disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-700">
                        <Send className="w-5 h-5" />
                    </button>
                </form>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 dark:text-slate-500">
                  <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
                      <MessageSquare className="w-12 h-12 text-slate-400 dark:text-slate-600" />
                  </div>
                  <p className="text-lg">Select a conversation to start messaging</p>
              </div>
          )}
      </div>

    </div>
  );
};

export default Messenger;