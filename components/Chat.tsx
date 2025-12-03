import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
// ADDED: limitToLast
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, limitToLast } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Message } from '../types';
import { Send } from 'lucide-react';

const Chat: React.FC = () => {
  const { user, userData, teamData } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teamData?.id) return;
    const messagesCollection = collection(db, 'teams', teamData.id, 'messages');
    
    // OPTIMIZATION: Only load the last 50 messages to save data/memory
    const messagesQuery = query(messagesCollection, orderBy('timestamp'), limitToLast(50));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Message));
      setMessages(messagesData);
    }, (error) => {
        console.error("Error loading chat:", error);
    });

    return () => unsubscribe();
  }, [teamData?.id]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !userData || !teamData?.id) return;

    try {
      await addDoc(collection(db, 'teams', teamData.id, 'messages'), {
        text: newMessage,
        sender: {
            uid: user.uid,
            name: userData.name
        },
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };
  
  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    // CONTAINER: Dark Background (Zinc-950) with Border
    <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950 rounded-lg shadow-lg dark:shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
      
      {/* HEADER */}
      <div className="sticky top-0 z-10 p-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            The Huddle <span className="text-orange-500 text-sm font-mono uppercase tracking-wider">(Team Chat)</span>
        </h1>
      </div>
      
      {/* MESSAGES AREA */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-black/20">
        {messages.map(msg => {
          const isMe = msg.sender.uid === user?.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md p-3 rounded-2xl shadow-sm ${
                  isMe 
                  ? 'bg-orange-600 text-white rounded-br-none' // ME: Orange Neon
                  : 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-zinc-700' // OTHERS: Dark Zinc
              }`}>
                {!isMe && <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1">{msg.sender.name}</p>}
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-orange-200' : 'text-slate-400'}`}>
                  {formatDate(msg.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-slate-100 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-full shadow-inner py-3 px-5 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
          />
          <button type="submit" className="p-3 rounded-full bg-orange-600 hover:bg-orange-500 transition-colors shadow-lg shadow-orange-900/20 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!newMessage.trim()}>
            <Send className="w-5 h-5 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;