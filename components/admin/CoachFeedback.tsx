import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { CoachFeedback as CoachFeedbackType } from '../../types';
import { 
  MessageSquare, AlertTriangle, CheckCircle, Clock, User, Shield, 
  ChevronDown, ChevronUp, Filter, Search, X, Eye, Archive
} from 'lucide-react';

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

const CoachFeedback: React.FC = () => {
  const { userData } = useAuth();
  const [feedback, setFeedback] = useState<CoachFeedbackType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<CoachFeedbackType | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState(false);

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

  const handleUpdateStatus = async (feedbackId: string, newStatus: 'reviewed' | 'resolved') => {
    if (!selectedFeedback) return;
    
    setUpdating(true);
    try {
      // Update the grievance status
      await updateDoc(doc(db, 'coachFeedback', feedbackId), {
        status: newStatus,
        reviewedAt: serverTimestamp(),
        reviewedBy: userData?.name || 'Admin',
        ...(adminNotes && { adminNotes })
      });
      
      // Send notification message to the parent (via System Admin channel, NOT to coach)
      // Uses the same system admin ID as the initial acknowledgment
      try {
        const parentId = selectedFeedback.parentId;
        const ADMIN_SYSTEM_ID = 'lockerroom-admin'; // Same system admin account for all grievances
        
        // Find existing chat between parent and system admin
        const chatsQuery = query(
          collection(db, 'private_chats'),
          where('participants', 'array-contains', parentId)
        );
        const chatsSnapshot = await getDocs(chatsQuery);
        let existingChatId: string | null = null;
        
        chatsSnapshot.forEach(chatDoc => {
          const chatData = chatDoc.data();
          // Find chat with system admin (lockerroom-admin), NOT with any coach
          if (chatData.participants.includes(ADMIN_SYSTEM_ID)) {
            existingChatId = chatDoc.id;
          }
        });
        
        // Build the notification message
        const statusLabel = newStatus === 'reviewed' ? 'Under Review' : 'Resolved';
        const statusEmoji = newStatus === 'reviewed' ? '👁️' : '✅';
        let notificationMessage = `${statusEmoji} Grievance Update: ${statusLabel}

Your grievance regarding Coach ${selectedFeedback.coachName} has been marked as ${statusLabel.toLowerCase()}.`;

        if (adminNotes.trim()) {
          notificationMessage += `

📝 Response from Administration:
"${adminNotes.trim()}"`;
        }

        notificationMessage += `

— LockerRoom Administration`;
        
        if (existingChatId) {
          await addDoc(collection(db, 'private_chats', existingChatId, 'messages'), {
            text: notificationMessage,
            senderId: ADMIN_SYSTEM_ID,
            timestamp: serverTimestamp(),
            isSystemMessage: true
          });
          await updateDoc(doc(db, 'private_chats', existingChatId), {
            lastMessage: `${statusEmoji} Grievance Update: ${statusLabel}`,
            updatedAt: serverTimestamp(),
            lastMessageTime: serverTimestamp(),
            lastSenderId: ADMIN_SYSTEM_ID
          });
        } else {
          // Create new chat between system admin and parent (coach cannot see this)
          const newChatRef = await addDoc(collection(db, 'private_chats'), {
            participants: [parentId, ADMIN_SYSTEM_ID],
            participantData: {
              [parentId]: { username: selectedFeedback.parentName, role: 'Parent' },
              [ADMIN_SYSTEM_ID]: { username: 'LockerRoom Administration', role: 'SuperAdmin' }
            },
            lastMessage: `${statusEmoji} Grievance Update: ${statusLabel}`,
            updatedAt: serverTimestamp(),
            lastMessageTime: serverTimestamp(),
            lastSenderId: ADMIN_SYSTEM_ID
          });
          await addDoc(collection(db, 'private_chats', newChatRef.id, 'messages'), {
            text: notificationMessage,
            senderId: ADMIN_SYSTEM_ID,
            timestamp: serverTimestamp(),
            isSystemMessage: true
          });
        }
      } catch (msgError) {
        console.error('Error sending status update message:', msgError);
      }
      
      setSelectedFeedback(null);
      setAdminNotes('');
    } catch (err) {
      console.error('Error updating feedback:', err);
    } finally {
      setUpdating(false);
    }
  };

  // Filter feedback
  const filteredFeedback = feedback.filter(f => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        f.coachName.toLowerCase().includes(query) ||
        f.parentName.toLowerCase().includes(query) ||
        f.teamName.toLowerCase().includes(query) ||
        f.message.toLowerCase().includes(query)
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
                placeholder="Search grievances..."
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
              onClick={() => {
                setSelectedFeedback(item);
                setAdminNotes(item.adminNotes || '');
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
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

      {/* Detail Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-700 shadow-2xl">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Feedback Details</h3>
                <button 
                  onClick={() => setSelectedFeedback(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-bold border ${statusColors[selectedFeedback.status]}`}>
                  {selectedFeedback.status.toUpperCase()}
                </span>
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
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-2">Grievance Details</p>
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
                  <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{selectedFeedback.message}</p>
                </div>
              </div>

              {selectedFeedback.status !== 'new' && selectedFeedback.reviewedBy && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-400 mb-1">
                    Reviewed by {selectedFeedback.reviewedBy} on {formatDate(selectedFeedback.reviewedAt)}
                  </p>
                  {selectedFeedback.adminNotes && (
                    <p className="text-blue-200">{selectedFeedback.adminNotes}</p>
                  )}
                </div>
              )}

              {selectedFeedback.status !== 'resolved' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2">
                      Response to Parent (optional)
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add a response that will be sent to the parent..."
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 resize-none"
                      rows={3}
                    />
                    <p className="text-xs text-zinc-500 mt-1">This response will be sent as a private message to the parent.</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    {selectedFeedback.status === 'new' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedFeedback.id, 'reviewed')}
                        disabled={updating}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Eye className="w-4 h-4" />
                        Mark as Reviewed
                      </button>
                    )}
                    <button
                      onClick={() => handleUpdateStatus(selectedFeedback.id, 'resolved')}
                      disabled={updating}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark as Resolved
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachFeedback;
