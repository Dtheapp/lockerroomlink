import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { CoachFeedback as CoachFeedbackType } from '../../types';
import { 
  MessageSquare, AlertTriangle, CheckCircle, Clock, User, Shield, 
  Search, X, Eye, Send
} from 'lucide-react';

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  timestamp: any;
  isSystemMessage?: boolean;
}

const categoryLabels: Record<string, string> = {
  communication: 'Communication',
  conduct: 'Conduct/Behavior',
  fairness: 'Fairness/Playing Time',
  safety: 'Safety Concern',
  other: 'Other'
};

const categoryColors: Record<string, string> = {
  communication: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  conduct: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  fairness: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  safety: 'bg-red-500/20 text-red-400 border-red-500/30',
  other: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
};

const statusColors: Record<string, string> = {
  new: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  reviewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30'
};

const GRIEVANCE_SYSTEM_ID = 'grievance-system';

const CoachFeedback: React.FC = () => {
  const { userData } = useAuth();
  const [feedback, setFeedback] = useState<CoachFeedbackType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<CoachFeedbackType | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load grievances
  useEffect(() => {
    const q = query(collection(db, 'coachFeedback'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feedbackData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CoachFeedbackType[];
      
      setFeedback(feedbackData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load chat messages when a grievance is selected
  useEffect(() => {
    if (!selectedFeedback?.chatId) {
      setChatMessages([]);
      return;
    }

    setChatLoading(true);
    const messagesQuery = query(
      collection(db, 'private_chats', selectedFeedback.chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      
      setChatMessages(messages);
      setChatLoading(false);
    });

    return () => unsubscribe();
  }, [selectedFeedback?.chatId]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Send a message in the grievance chat
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedFeedback?.chatId) return;

    setSendingMessage(true);
    try {
      await addDoc(collection(db, 'private_chats', selectedFeedback.chatId, 'messages'), {
        text: newMessage.trim(),
        senderId: GRIEVANCE_SYSTEM_ID,
        timestamp: serverTimestamp(),
        isSystemMessage: false,
        adminName: userData?.name || 'Admin'
      });

      await updateDoc(doc(db, 'private_chats', selectedFeedback.chatId), {
        lastMessage: newMessage.trim(),
        updatedAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
        lastSenderId: GRIEVANCE_SYSTEM_ID
      });

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Update grievance status
  const handleUpdateStatus = async (feedbackId: string, newStatus: 'reviewed' | 'resolved') => {
    if (!selectedFeedback) return;
    
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'coachFeedback', feedbackId), {
        status: newStatus,
        reviewedAt: serverTimestamp(),
        reviewedBy: userData?.name || 'Admin'
      });

      // Send status update message to the grievance chat
      if (selectedFeedback.chatId) {
        const statusLabel = newStatus === 'reviewed' ? 'Under Review' : 'Resolved';
        const statusEmoji = newStatus === 'reviewed' ? '👁️' : '✅';
        const statusMessage = `${statusEmoji} Status Update: This grievance has been marked as "${statusLabel}" by ${userData?.name || 'Admin'}.`;

        await addDoc(collection(db, 'private_chats', selectedFeedback.chatId, 'messages'), {
          text: statusMessage,
          senderId: GRIEVANCE_SYSTEM_ID,
          timestamp: serverTimestamp(),
          isSystemMessage: true
        });

        await updateDoc(doc(db, 'private_chats', selectedFeedback.chatId), {
          lastMessage: `${statusEmoji} Status: ${statusLabel}`,
          updatedAt: serverTimestamp(),
          lastMessageTime: serverTimestamp(),
          lastSenderId: GRIEVANCE_SYSTEM_ID
        });
      }

      // Update local state to reflect the change
      setSelectedFeedback({ ...selectedFeedback, status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  // Filter feedback
  const filteredFeedback = feedback.filter(f => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.coachName.toLowerCase().includes(q) ||
        f.parentName.toLowerCase().includes(q) ||
        f.teamName.toLowerCase().includes(q) ||
        f.message.toLowerCase().includes(q) ||
        (f.grievanceNumber && `#${f.grievanceNumber}`.includes(q))
      );
    }
    return true;
  });

  // Stats
  const newCount = feedback.filter(f => f.status === 'new').length;
  const reviewedCount = feedback.filter(f => f.status === 'reviewed').length;
  const resolvedCount = feedback.filter(f => f.status === 'resolved').length;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-orange-500" />
          Grievances
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Grievances filed by parents about coaches
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-yellow-400">{newCount}</p>
              <p className="text-sm text-yellow-300/70">New</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-blue-400">{reviewedCount}</p>
              <p className="text-sm text-blue-300/70">Reviewed</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-green-400">{resolvedCount}</p>
              <p className="text-sm text-green-300/70">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search grievances (by #number, coach, parent...)"
                className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Categories</option>
            <option value="communication">Communication</option>
            <option value="conduct">Conduct/Behavior</option>
            <option value="fairness">Fairness/Playing Time</option>
            <option value="safety">Safety Concern</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Grievances List */}
      {filteredFeedback.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <MessageSquare className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
          <p className="text-zinc-600 dark:text-zinc-400">No grievances found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFeedback.map((item) => (
            <div 
              key={item.id}
              className={`bg-white dark:bg-zinc-900 rounded-xl border ${
                item.status === 'new' ? 'border-yellow-500/50' : 'border-zinc-200 dark:border-zinc-800'
              } p-4 cursor-pointer hover:border-orange-500/50 transition-colors`}
              onClick={() => setSelectedFeedback(item)}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {item.grievanceNumber && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        #{item.grievanceNumber}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusColors[item.status]}`}>
                      {item.status.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColors[item.category]}`}>
                      {categoryLabels[item.category]}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      About: <strong className="text-zinc-900 dark:text-white">{item.coachName}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-4 h-4" />
                      {item.teamName}
                    </span>
                  </div>
                  
                  <p className="text-zinc-700 dark:text-zinc-300 line-clamp-2">{item.message}</p>
                </div>
                
                <div className="text-right text-sm text-zinc-500">
                  <p className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDate(item.createdAt)}
                  </p>
                  <p className="text-xs mt-1">From: {item.parentName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal with Embedded Chat */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                    Grievance {selectedFeedback.grievanceNumber ? `#${selectedFeedback.grievanceNumber}` : ''}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusColors[selectedFeedback.status]}`}>
                    {selectedFeedback.status.toUpperCase()}
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedFeedback(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left side - Grievance Details */}
              <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${categoryColors[selectedFeedback.category]}`}>
                      {categoryLabels[selectedFeedback.category]}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Coach</p>
                      <p className="font-bold text-zinc-900 dark:text-white">{selectedFeedback.coachName}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Team</p>
                      <p className="font-bold text-zinc-900 dark:text-white">{selectedFeedback.teamName}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Submitted By</p>
                      <p className="font-bold text-zinc-900 dark:text-white">{selectedFeedback.parentName}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Date</p>
                      <p className="font-bold text-zinc-900 dark:text-white">{formatDate(selectedFeedback.createdAt)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-2">Original Grievance</p>
                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
                      <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{selectedFeedback.message}</p>
                    </div>
                  </div>

                  {/* Status Update Buttons */}
                  {selectedFeedback.status !== 'resolved' && (
                    <div className="flex gap-3 pt-2">
                      {selectedFeedback.status === 'new' && (
                        <button
                          onClick={() => handleUpdateStatus(selectedFeedback.id, 'reviewed')}
                          disabled={updating}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Eye className="w-4 h-4" />
                          Mark as Reviewed
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateStatus(selectedFeedback.id, 'resolved')}
                        disabled={updating}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark as Resolved
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right side - Chat */}
              <div className="w-full md:w-1/2 flex flex-col h-[400px] md:h-auto">
                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                    Chat with {selectedFeedback.parentName}
                  </h4>
                  <p className="text-xs text-zinc-500">Messages appear in the parent's Messenger</p>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50 dark:bg-black/30">
                  {chatLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-6 h-6 border-2 border-dashed rounded-full animate-spin border-orange-500"></div>
                    </div>
                  ) : !selectedFeedback.chatId ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm text-center">
                      <div>
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No chat available for this grievance.</p>
                        <p className="text-xs mt-1">(Legacy grievance without chat system)</p>
                      </div>
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                      No messages yet
                    </div>
                  ) : (
                    <>
                      {chatMessages.map((msg) => {
                        const isAdmin = msg.senderId === GRIEVANCE_SYSTEM_ID;
                        return (
                          <div 
                            key={msg.id}
                            className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                              msg.isSystemMessage
                                ? 'bg-orange-500/20 border border-orange-500/30 text-orange-200'
                                : isAdmin
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white'
                            }`}>
                              <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                              <p className={`text-xs mt-1 ${
                                msg.isSystemMessage ? 'text-orange-400' : isAdmin ? 'text-orange-200' : 'text-zinc-500'
                              }`}>
                                {formatMessageTime(msg.timestamp)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Chat Input */}
                {selectedFeedback.chatId && selectedFeedback.status !== 'resolved' && (
                  <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        placeholder="Type a message to the parent..."
                        className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendingMessage}
                        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {selectedFeedback.status === 'resolved' && (
                  <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-green-500/10 text-center">
                    <p className="text-sm text-green-400 flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      This grievance has been resolved
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachFeedback;
