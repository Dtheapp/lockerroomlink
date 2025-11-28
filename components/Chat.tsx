
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
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
    const q = query(messagesCollection, orderBy('timestamp'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [teamData?.id]);
  
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
    <div className="h-full flex flex-col bg-slate-900 rounded-lg">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">The Huddle (Team Chat)</h1>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map(msg => {
          const isMe = msg.sender.uid === user?.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${isMe ? 'bg-sky-700 text-white' : 'bg-slate-700 text-slate-200'}`}>
                {!isMe && <p className="text-xs font-bold text-sky-400 mb-1">{msg.sender.name}</p>}
                <p className="text-sm">{msg.text}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-sky-200' : 'text-slate-400'} text-right`}>
                  {formatDate(msg.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-900">
        <form onSubmit={handleSendMessage} className="flex items-center gap-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-full shadow-sm py-2 px-4 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500"
          />
          <button type="submit" className="p-3 rounded-full bg-sky-600 hover:bg-sky-700 transition-colors disabled:bg-slate-600" disabled={!newMessage.trim()}>
            <Send className="w-5 h-5 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
