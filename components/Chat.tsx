import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, limitToLast, doc, updateDoc, deleteField, deleteDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText } from '../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import { moderateText, getModerationWarning } from '../services/moderation';
import { trackModeration } from '../services/analytics';
import type { Message } from '../types';
import { Send, AlertCircle, VolumeX, Volume2, MoreVertical, X, Trash2, Edit2, Check, CheckCheck, Reply, Pin, PinOff, Clock, Image, ChevronDown, ChevronUp, Flag, MessageSquare } from 'lucide-react';
import NoAthleteBlock from './NoAthleteBlock';
import ReportContentModal from './ReportContentModal';
import { uploadFile } from '../services/storage';
import { AnimatedBackground, GlassCard } from './ui/OSYSComponents';

// Extended message type with reply and read receipt support
interface ExtendedMessage extends Message {
  readBy?: string[];
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
    senderName?: string;
  };
  edited?: boolean;
  editedAt?: Timestamp;
  isPinned?: boolean;
  pinnedBy?: string;
  pinnedByName?: string;
  pinnedAt?: Timestamp;
  imageUrl?: string;
  imagePath?: string;
}

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
  muteExpiresAt?: Timestamp; // Optional: if not set, mute is unlimited
}

interface MutedUsers {
  [oduserId: string]: MutedUser;
}

const Chat: React.FC = () => {
  const { user, userData, teamData } = useAuth();
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Mute feature state
  const [mutedUsers, setMutedUsers] = useState<MutedUsers>({});
  const [showMuteModal, setShowMuteModal] = useState<{ oduserId: string; userName: string } | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [muteDurationHours, setMuteDurationHours] = useState<string>(''); // Empty = unlimited
  const [muteCountdown, setMuteCountdown] = useState<string>('');
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ messageId: string; messageText: string; senderName: string; senderId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState<ExtendedMessage | null>(null);
  
  // Pinned messages expansion state (collapsed by default)
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  
  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-select delete state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Content moderation state
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [reportModalData, setReportModalData] = useState<{
    contentId: string;
    contentText: string;
    contentAuthor: string;
    contentAuthorId: string;
  } | null>(null);

  // Check if current user can moderate (Coach or SuperAdmin)
  const canModerate = userData?.role === 'Coach' || userData?.role === 'SuperAdmin';
  
  // Check if current user is muted (considering expiration)
  const myMuteInfo = user?.uid ? mutedUsers[user.uid] : null;
  const isMuteExpired = myMuteInfo?.muteExpiresAt 
    ? myMuteInfo.muteExpiresAt.toDate() < new Date() 
    : false;
  const isMuted = user?.uid ? (!!mutedUsers[user.uid] && !isMuteExpired) : false;

  // Countdown timer for muted users
  useEffect(() => {
    if (!isMuted || !myMuteInfo?.muteExpiresAt) {
      setMuteCountdown('');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const expiresAt = myMuteInfo.muteExpiresAt!.toDate();
      const diff = expiresAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setMuteCountdown('');
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        setMuteCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setMuteCountdown(`${minutes}m ${seconds}s`);
      } else {
        setMuteCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isMuted, myMuteInfo?.muteExpiresAt]);

  // Load messages
  useEffect(() => {
    if (!teamData?.id) return;
    const messagesCollection = collection(db, 'teams', teamData.id, 'messages');
    const messagesQuery = query(messagesCollection, orderBy('timestamp'), limitToLast(50));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ExtendedMessage));
      setMessages(messagesData);
    }, (error) => {
      console.error("Error loading chat:", error);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  // Mark messages as read when viewing the chat
  useEffect(() => {
    if (!teamData?.id || !user || messages.length === 0) return;
    
    const markMessagesAsRead = async () => {
      const unreadMessages = messages.filter(msg => {
        const readBy = msg.readBy || [];
        return msg.sender.uid !== user.uid && !readBy.includes(user.uid);
      });
      
      if (unreadMessages.length === 0) return;
      
      try {
        const batch = writeBatch(db);
        unreadMessages.forEach(msg => {
          const msgRef = doc(db, 'teams', teamData.id, 'messages', msg.id);
          batch.update(msgRef, {
            readBy: arrayUnion(user.uid)
          });
        });
        await batch.commit();
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };
    
    const timer = setTimeout(markMessagesAsRead, 500);
    return () => clearTimeout(timer);
  }, [teamData?.id, messages, user]);

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

  // Auto-add parent to team's parentIds if they have a child on the roster
  // This fixes chat access for parents whose children were drafted before this feature
  useEffect(() => {
    const ensureParentAccess = async () => {
      if (!teamData?.id || !user?.uid || userData?.role !== 'Parent') return;
      
      // Check if parent already has access (is in parentIds)
      const teamDoc = await import('firebase/firestore').then(m => m.getDoc(doc(db, 'teams', teamData.id)));
      if (!teamDoc.exists()) return;
      
      const teamDocData = teamDoc.data();
      const parentIds = teamDocData?.parentIds || [];
      
      // Already has access
      if (parentIds.includes(user.uid)) return;
      
      // Check if this parent has a child on the roster
      const { getDocs, collection: firestoreCollection, query: firestoreQuery, where } = await import('firebase/firestore');
      const rosterQuery = firestoreQuery(
        firestoreCollection(db, 'teams', teamData.id, 'players'),
        where('parentUserId', '==', user.uid)
      );
      const rosterSnap = await getDocs(rosterQuery);
      
      if (rosterSnap.docs.length > 0) {
        // Parent has a child on this team - add them to parentIds
        console.log('🔧 Auto-fixing parent chat access...');
        try {
          await updateDoc(doc(db, 'teams', teamData.id), {
            parentIds: arrayUnion(user.uid)
          });
          console.log('✅ Parent added to team parentIds for chat access');
        } catch (err) {
          console.error('Could not auto-add parent to parentIds:', err);
        }
      }
    };
    
    ensureParentAccess();
  }, [teamData?.id, user?.uid, userData?.role]);
  
  // Auto-scroll to bottom when new messages arrive (but not on initial load)
  const prevMessagesLengthRef = useRef<number>(0);
  useEffect(() => {
    // Only scroll if we have new messages (not on initial load when going from 0 to N)
    if (prevMessagesLengthRef.current > 0 && messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
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
    if ((!newMessage.trim() && !selectedImage) || !user || !userData || !teamData?.id || sending) return;

    // Check if user is muted
    if (isMuted) {
      setRateLimitError("You are muted and cannot send messages.");
      setTimeout(() => setRateLimitError(null), 3000);
      return;
    }

    // Content moderation check
    if (newMessage.trim()) {
      const moderationResult = moderateText(newMessage);
      if (!moderationResult.isAllowed) {
        // Track blocked content
        trackModeration.contentBlocked('message', moderationResult.severity);
        setModerationWarning(getModerationWarning(moderationResult) || 'Message blocked');
        setTimeout(() => setModerationWarning(null), 5000);
        return;
      }
      if (moderationResult.requiresReview) {
        // Track flagged content
        trackModeration.contentFlagged('message', moderationResult.severity);
        // Allow but show warning
        const warning = getModerationWarning(moderationResult);
        if (warning) {
          setModerationWarning(warning);
          setTimeout(() => setModerationWarning(null), 5000);
        }
      }
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
      let imageUrl: string | undefined;
      let imagePath: string | undefined;
      
      // Upload image if selected
      if (selectedImage) {
        setUploadingImage(true);
        try {
          const timestamp = Date.now();
          imagePath = `teams/${teamData.id}/chat-images/${user.uid}_${timestamp}_${selectedImage.name}`;
          const uploadedFile = await uploadFile(selectedImage, imagePath, (progress) => {
            setUploadProgress(progress);
          });
          imageUrl = uploadedFile.url;
        } catch (uploadError: any) {
          console.error("Error uploading image:", uploadError);
          setRateLimitError(`Failed to upload image: ${uploadError.message || 'Unknown error'}`);
          setTimeout(() => setRateLimitError(null), 5000);
          setUploadingImage(false);
          setSending(false);
          return;
        }
        setUploadingImage(false);
      }
      
      const messagePayload: any = {
        text: sanitizeText(newMessage, 2000),
        sender: {
          uid: user.uid,
          name: sanitizeText(userData.name, 100),
          role: userData.role
        },
        timestamp: serverTimestamp(),
        readBy: [user.uid] // Sender has "read" their own message
      };
      
      // Add image URL if uploaded
      if (imageUrl) {
        messagePayload.imageUrl = imageUrl;
        messagePayload.imagePath = imagePath;
      }
      
      // Add reply reference if replying
      if (replyingTo) {
        messagePayload.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text.substring(0, 100),
          senderId: replyingTo.sender.uid,
          senderName: replyingTo.sender.name
        };
      }
      
      await addDoc(collection(db, 'teams', teamData.id, 'messages'), messagePayload);
      setNewMessage('');
      setReplyingTo(null);
      setSelectedImage(null);
      setImagePreview(null);
      setUploadProgress(0);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setRateLimitError(`Failed to send message: ${error.message || 'Unknown error'}`);
      setTimeout(() => setRateLimitError(null), 5000);
      setUploadingImage(false);
    } finally {
      setSending(false);
    }
  };
  
  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setRateLimitError("Image must be less than 10MB");
        setTimeout(() => setRateLimitError(null), 3000);
        return;
      }
      if (!file.type.startsWith('image/')) {
        setRateLimitError("Only image files are allowed");
        setTimeout(() => setRateLimitError(null), 3000);
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };
  
  // Handle multi-select delete
  const handleMultiDelete = async () => {
    if (selectedMessages.size === 0 || !teamData?.id || !user) return;
    
    setDeleting(true);
    setShowBulkDeleteConfirm(false);
    try {
      const batch = writeBatch(db);
      selectedMessages.forEach(msgId => {
        const msgRef = doc(db, 'teams', teamData.id, 'messages', msgId);
        batch.delete(msgRef);
      });
      await batch.commit();
      
      // Log if moderator deleting others' messages
      if (canModerate) {
        await logModerationActivity(
          'BULK_DELETE_MESSAGES',
          'chat_messages',
          Array.from(selectedMessages).join(','),
          `Bulk deleted ${selectedMessages.size} message(s) in Team Chat. Team: ${teamData.name || teamData.id}`,
          user.uid,
          userData?.name || userData?.email || 'Unknown Moderator'
        );
      }
      
      setSelectedMessages(new Set());
      setMultiSelectMode(false);
    } catch (error) {
      console.error("Error deleting messages:", error);
    } finally {
      setDeleting(false);
    }
  };
  
  // Toggle message selection
  const toggleMessageSelection = (msgId: string) => {
    const newSelection = new Set(selectedMessages);
    if (newSelection.has(msgId)) {
      newSelection.delete(msgId);
    } else {
      newSelection.add(msgId);
    }
    setSelectedMessages(newSelection);
  };

  const handleMuteUser = async () => {
    if (!showMuteModal || !teamData?.id || !userData || !user) return;
    
    try {
      const teamDocRef = doc(db, 'teams', teamData.id);
      
      // Calculate expiration time if duration is provided
      let muteData: any = {
        mutedBy: user?.uid,
        mutedByName: userData.name,
        mutedAt: serverTimestamp(),
        reason: muteReason.trim() || 'No reason provided'
      };
      
      const durationHours = parseInt(muteDurationHours);
      if (durationHours && durationHours > 0) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + durationHours);
        muteData.muteExpiresAt = Timestamp.fromDate(expiresAt);
      }
      
      await updateDoc(teamDocRef, {
        [`mutedUsers.${showMuteModal.oduserId}`]: muteData
      });
      
      // Log the mute action to Activity Log
      const durationText = durationHours && durationHours > 0 
        ? `for ${durationHours} hour${durationHours > 1 ? 's' : ''}`
        : 'indefinitely';
      await logModerationActivity(
        'MUTE_USER',
        'chat_user',
        showMuteModal.oduserId,
        `Muted user "${showMuteModal.userName}" ${durationText} in Team Chat. Reason: ${muteReason.trim() || 'No reason provided'}. Team: ${teamData.name || teamData.id}`,
        user.uid,
        userData.name || userData.email || 'Unknown Coach'
      );
      
      setShowMuteModal(null);
      setMuteReason('');
      setMuteDurationHours('');
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

  const startEditing = (msg: ExtendedMessage) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text);
    setActiveMessageMenu(null);
  };

  // Pin message function
  const handlePinMessage = async (msg: ExtendedMessage) => {
    if (!teamData?.id || !user || !userData || !canModerate) return;
    
    try {
      const messageDocRef = doc(db, 'teams', teamData.id, 'messages', msg.id);
      await updateDoc(messageDocRef, {
        isPinned: true,
        pinnedBy: user.uid,
        pinnedByName: userData.name,
        pinnedAt: serverTimestamp()
      });
      setActiveMessageMenu(null);
    } catch (error) {
      console.error("Error pinning message:", error);
    }
  };

  // Unpin message function
  const handleUnpinMessage = async (msg: ExtendedMessage) => {
    if (!teamData?.id || !canModerate) return;
    
    try {
      const messageDocRef = doc(db, 'teams', teamData.id, 'messages', msg.id);
      await updateDoc(messageDocRef, {
        isPinned: deleteField(),
        pinnedBy: deleteField(),
        pinnedByName: deleteField(),
        pinnedAt: deleteField()
      });
      setActiveMessageMenu(null);
    } catch (error) {
      console.error("Error unpinning message:", error);
    }
  };
  
  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <NoAthleteBlock featureName="Team Chat">
    <div className="relative h-full min-h-screen">
      <AnimatedBackground />
      <div className="relative z-10 h-full flex flex-col">
        <GlassCard className="flex-1 flex flex-col overflow-hidden !p-0">
      
      {/* HEADER */}
      <div className="sticky top-0 z-10 p-4 border-b border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 dark:bg-orange-500/20 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">The Huddle</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Team Chat</p>
            </div>
          </div>
          
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
        <div className="mx-4 mt-4 bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <VolumeX className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-500 font-semibold text-sm">You are muted</p>
              <p className="text-red-400/80 text-xs mt-1">
                You can read messages but cannot send new ones.
                {myMuteInfo.reason && <span className="block mt-1">Reason: {myMuteInfo.reason}</span>}
              </p>
              <p className="text-red-400/60 text-xs mt-2">
                Muted by {myMuteInfo.mutedByName}
              </p>
              
              {/* Countdown timer for timed mutes */}
              {muteCountdown && (
                <div className="mt-3 flex items-center gap-2 bg-red-500/20 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-red-400 animate-pulse" />
                  <div>
                    <p className="text-red-300 text-[10px] uppercase tracking-wider">Unmuted in</p>
                    <p className="text-red-400 font-mono font-bold text-sm">{muteCountdown}</p>
                  </div>
                </div>
              )}
              
              {/* No expiration notice */}
              {!myMuteInfo.muteExpiresAt && (
                <p className="text-red-400/50 text-[10px] mt-2 italic">
                  This mute has no expiration. Contact a coach to be unmuted.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* PINNED MESSAGES SECTION */}
      {(() => {
        // Sort pinned messages by pinnedAt timestamp (most recent first)
        const pinnedMessages = messages
          .filter(m => m.isPinned)
          .sort((a, b) => {
            const aTime = a.pinnedAt?.seconds || 0;
            const bTime = b.pinnedAt?.seconds || 0;
            return bTime - aTime; // Most recent first
          });
        const pinnedCount = pinnedMessages.length;
        
        if (pinnedCount === 0) return null;
        
        const scrollToPinnedMessage = (msgId: string) => {
          const element = document.getElementById(`chat-msg-${msgId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-2', 'ring-amber-500');
            setTimeout(() => element.classList.remove('ring-2', 'ring-amber-500'), 2000);
          }
        };
        
        return (
          <div className="mx-4 mt-4 bg-amber-500/10 backdrop-blur-sm border border-amber-500/30 rounded-lg overflow-hidden">
            {/* Collapsed header - always visible */}
            <button
              onClick={() => setShowPinnedMessages(!showPinnedMessages)}
              className="w-full px-3 py-2 bg-amber-500/20 flex items-center justify-between hover:bg-amber-500/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Pinned ({pinnedCount})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {showPinnedMessages ? 'Hide' : 'View'}
                </span>
                {showPinnedMessages ? (
                  <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
            </button>
            
            {/* Expanded pinned messages list */}
            {showPinnedMessages && (
              <div className="max-h-60 overflow-y-auto divide-y divide-amber-500/20 border-t border-amber-500/30">
                {pinnedMessages.map(msg => (
                  <div 
                    key={`pinned-${msg.id}`} 
                    className="px-3 py-2 flex items-start justify-between gap-2 hover:bg-amber-500/20 cursor-pointer"
                    onClick={() => scrollToPinnedMessage(msg.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">{msg.sender.name}</p>
                      <p className="text-sm text-amber-700 dark:text-amber-100 truncate">{msg.text || (msg.imageUrl ? '📷 Image' : '')}</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                        Pinned by {msg.pinnedByName} • Click to view
                      </p>
                    </div>
                    {canModerate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnpinMessage(msg);
                        }}
                        className="p-1 text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 flex-shrink-0"
                        title="Unpin message"
                      >
                        <PinOff className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      
      {/* MESSAGES AREA */}
      <div className="flex-1 p-4 overflow-y-auto overflow-x-visible space-y-4 bg-slate-50/50 dark:bg-black/20">
        {/* Multi-select controls */}
        {multiSelectMode && (
          <div className="sticky top-0 z-10 bg-purple-500/10 dark:bg-purple-500/10 backdrop-blur-sm border border-purple-500/30 rounded-lg p-3 flex items-center justify-between mb-2 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                {selectedMessages.size} selected
              </span>
              <button
                onClick={() => {
                  // Select all own messages (or all if moderator)
                  const selectableIds = messages
                    .filter(m => canModerate || m.sender.uid === user?.uid)
                    .map(m => m.id);
                  setSelectedMessages(new Set(selectableIds));
                }}
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 underline"
              >
                Select all
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setMultiSelectMode(false); setSelectedMessages(new Set()); }}
                className="px-3 py-1.5 text-xs bg-white/50 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-white/80 dark:hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={selectedMessages.size === 0 || deleting}
                className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
              >
                {deleting ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Delete ({selectedMessages.size})
              </button>
            </div>
          </div>
        )}
        
        {messages.map(msg => {
          const isMe = msg.sender.uid === user?.uid;
          const isUserMuted = !!mutedUsers[msg.sender.uid];
          const senderRole = (msg.sender as any).role;
          const isParent = senderRole === 'Parent' || (!senderRole && !isMe); // Assume parent if no role
          const isEditing = editingMessageId === msg.id;
          const isEdited = msg.edited;
          const canSelectMessage = multiSelectMode && (canModerate || isMe);
          const isSelected = selectedMessages.has(msg.id);
          
          // Read receipt: count how many people have read this message (excluding sender)
          const readBy = msg.readBy || [];
          const readCount = readBy.filter(uid => uid !== msg.sender.uid).length;
          const hasBeenRead = readCount > 0;
          
          return (
            <div 
              key={msg.id} 
              id={`chat-msg-${msg.id}`} 
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} group ${canSelectMessage ? 'cursor-pointer' : ''}`}
              onClick={() => canSelectMessage && toggleMessageSelection(msg.id)}
            >
              {/* Multi-select checkbox */}
              {multiSelectMode && canSelectMessage && (
                <div className={`self-center mr-2 ${isMe ? 'order-first' : ''}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelected 
                      ? 'bg-purple-500 border-purple-500' 
                      : 'border-slate-500'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              )}
              
              {/* Reply button for received messages */}
              {!isMe && !isMuted && !multiSelectMode && (
                <button
                  onClick={() => setReplyingTo(msg)}
                  className="opacity-0 group-hover:opacity-100 self-center mr-1 p-1 text-slate-500 hover:text-purple-400 transition-all"
                  title="Reply"
                >
                  <Reply className="w-4 h-4" />
                </button>
              )}
              <div className={`max-w-xs lg:max-w-md p-3 rounded-2xl shadow-lg relative ${
                isMe 
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 dark:from-orange-600 dark:to-orange-500 text-white rounded-br-none'
                  : 'bg-white/80 dark:bg-white/10 backdrop-blur-sm text-slate-900 dark:text-white rounded-bl-none border border-slate-200/50 dark:border-white/10'
              } ${msg.isPinned ? 'ring-2 ring-amber-400' : ''} ${isSelected ? 'ring-2 ring-purple-500 dark:ring-orange-500' : ''}`}>
                {/* Pinned indicator */}
                {msg.isPinned && (
                  <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center ${isMe ? 'bg-amber-400' : 'bg-amber-500'}`}>
                    <Pin className="w-3 h-3 text-white" />
                  </div>
                )}
                
                {/* Header for OTHER users' messages */}
                {!isMe && (
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-bold text-purple-600 dark:text-orange-400 flex items-center gap-1">
                      {msg.sender.name}
                      {isUserMuted && (
                        <span className="text-red-500" title="This user is muted">
                          <VolumeX className="w-3 h-3" />
                        </span>
                      )}
                    </p>
                    
                    {/* Moderation Menu - Only for moderators on other users' messages */}
                    {canModerate && !multiSelectMode && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id);
                          }}
                          className="text-slate-400 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1 -mr-1 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {activeMessageMenu === msg.id && (
                          <div className="absolute left-full top-0 ml-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/20 rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                            {/* Delete Message - Available for all messages from others */}
                            <button
                              onClick={() => {
                                setShowDeleteConfirm({ messageId: msg.id, messageText: msg.text, senderName: msg.sender.name, senderId: msg.sender.uid });
                                setActiveMessageMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Message
                            </button>
                            
                            {/* Mute/Unmute - Only for parents */}
                            {isParent && (
                              <>
                                <div className="border-t border-white/10 my-1" />
                                {isUserMuted ? (
                                  <button
                                    onClick={() => handleUnmuteUser(msg.sender.uid, msg.sender.name)}
                                    className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-2"
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
                                    className="w-full px-3 py-2 text-left text-sm text-amber-400 hover:bg-amber-500/20 flex items-center gap-2"
                                  >
                                    <VolumeX className="w-4 h-4" />
                                    Mute User
                                  </button>
                                )}
                              </>
                            )}
                            
                            {/* Pin/Unpin Message */}
                            <div className="border-t border-white/10 my-1" />
                            {msg.isPinned ? (
                              <button
                                onClick={() => handleUnpinMessage(msg)}
                                className="w-full px-3 py-2 text-left text-sm text-amber-400 hover:bg-amber-500/20 flex items-center gap-2"
                              >
                                <PinOff className="w-4 h-4" />
                                Unpin Message
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePinMessage(msg)}
                                className="w-full px-3 py-2 text-left text-sm text-amber-400 hover:bg-amber-500/20 flex items-center gap-2"
                              >
                                <Pin className="w-4 h-4" />
                                Pin Message
                              </button>
                            )}
                            
                            {/* Report Message - for non-moderators or anyone */}
                            {msg.sender.uid !== user?.uid && (
                              <>
                                <div className="border-t border-white/10 my-1" />
                                <button
                                  onClick={() => {
                                    setReportModalData({
                                      contentId: msg.id,
                                      contentText: msg.text,
                                      contentAuthor: msg.sender.name,
                                      contentAuthorId: msg.sender.uid,
                                    });
                                    setActiveMessageMenu(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
                                >
                                  <Flag className="w-4 h-4" />
                                  Report Message
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Reply preview - shows what message this is replying to */}
                {msg.replyTo?.id && msg.replyTo?.text && (
                  <div 
                    className={`mb-2 p-2 rounded cursor-pointer border-l-2 ${
                      isMe 
                        ? 'bg-purple-700/50 border-purple-300' 
                        : 'bg-white/5 border-purple-500'
                    }`}
                    onClick={() => {
                      const replyElement = document.getElementById(`chat-msg-${msg.replyTo?.id}`);
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
                  <>
                    {/* Image display */}
                    {msg.imageUrl && (
                      <div className="mb-2">
                        <img 
                          src={msg.imageUrl} 
                          alt="Shared image"
                          className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(msg.imageUrl, '_blank');
                          }}
                        />
                      </div>
                    )}
                    {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                  </>
                )}
                
                {/* Footer - timestamp, read receipts, and actions */}
                {!isEditing && (
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className={`text-[10px] ${isMe ? 'text-purple-200' : 'text-slate-500'}`}>
                      {formatDate(msg.timestamp)}
                      {isEdited && <span className="ml-1 italic">(edited)</span>}
                    </p>
                    
                    {/* Actions for OWN messages - everyone can edit/delete their own + read receipts */}
                    {isMe && !multiSelectMode && (
                      <div className="flex items-center gap-1">
                        {/* Read receipt checkmarks */}
                        <span className="flex items-center" title={hasBeenRead ? `Read by ${readCount}` : 'Delivered'}>
                          {hasBeenRead ? (
                            <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                          ) : (
                            <Check className="w-3 h-3 text-purple-200" />
                          )}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditing(msg); }}
                          className="text-purple-200 hover:text-white p-0.5 transition-colors"
                          title="Edit message"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm({ messageId: msg.id, messageText: msg.text, senderName: msg.sender.name, senderId: msg.sender.uid }); }}
                          className="text-purple-200 hover:text-white p-0.5 transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Reply button for own messages */}
              {isMe && !isMuted && !multiSelectMode && (
                <button
                  onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); }}
                  className="opacity-0 group-hover:opacity-100 self-center ml-1 p-1 text-slate-500 hover:text-purple-400 transition-all"
                  title="Reply"
                >
                  <Reply className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 border-t border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-black/40 backdrop-blur-xl">
        {/* Reply preview bar */}
        {replyingTo && (
          <div className="mb-3 p-2 bg-purple-100/80 dark:bg-purple-500/20 backdrop-blur-sm border-l-4 border-purple-500 dark:border-orange-500 rounded flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-purple-600 dark:text-orange-400">
                Replying to {replyingTo.sender.uid === user?.uid ? 'yourself' : replyingTo.sender.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {replyingTo.text || (replyingTo.imageUrl ? '📷 Image' : '')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="ml-2 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Image preview bar */}
        {imagePreview && (
          <div className="mb-3 p-2 bg-slate-100/80 dark:bg-white/5 backdrop-blur-sm rounded-lg flex items-center gap-3 border border-slate-200/50 dark:border-white/10">
            <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{selectedImage?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                {selectedImage && (selectedImage.size / 1024).toFixed(1)} KB
              </p>
              {uploadingImage && (
                <div className="mt-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 dark:bg-orange-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setSelectedImage(null); setImagePreview(null); }}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"
              disabled={uploadingImage}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Rate limit / mute warning */}
        {rateLimitError && (
          <div className="mb-3 flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/30">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {rateLimitError}
          </div>
        )}

        {/* Content moderation warning */}
        {moderationWarning && (
          <div className="mb-3 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/30">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {moderationWarning}
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Multi-select button */}
          {!isMuted && (
            <button
              type="button"
              onClick={() => setMultiSelectMode(!multiSelectMode)}
              className={`p-2.5 rounded-full transition-colors ${
                multiSelectMode 
                  ? 'bg-purple-500 dark:bg-orange-500 text-white' 
                  : 'bg-slate-100/80 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white'
              }`}
              title="Select multiple messages to delete"
            >
              <Check className="w-5 h-5" />
            </button>
          )}
          
          {/* Image upload button */}
          {!isMuted && (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="p-2.5 bg-slate-100/80 dark:bg-white/5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition-colors disabled:opacity-50"
                title="Attach image"
              >
                <Image className="w-5 h-5" />
              </button>
            </>
          )}
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isMuted ? "You are muted..." : replyingTo ? "Type your reply..." : selectedImage ? "Add a caption..." : "Type your message..."}
            disabled={isMuted}
            className={`flex-1 bg-white/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-full py-3 px-5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-orange-500/50 transition-all ${
              isMuted ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          <button 
            type="submit" 
            className={`p-3 rounded-full transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              isMuted 
                ? 'bg-slate-400 dark:bg-zinc-600 cursor-not-allowed' 
                : 'bg-gradient-to-r from-purple-600 to-purple-500 dark:from-orange-600 dark:to-orange-500 hover:from-purple-500 hover:to-purple-400 dark:hover:from-orange-500 dark:hover:to-orange-400'
            }`}
            disabled={(!newMessage.trim() && !selectedImage) || sending || isMuted || uploadingImage}
            aria-label="Send message"
          >
            {sending || uploadingImage ? (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-slate-200/50 dark:border-white/10 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <VolumeX className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mute User</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{showMuteModal.userName}</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowMuteModal(null); setMuteReason(''); setMuteDurationHours(''); }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              This user will be able to read messages but cannot send new ones until unmuted or the timer expires.
            </p>
            
            {/* Duration Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Duration (hours)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={muteDurationHours}
                  onChange={(e) => setMuteDurationHours(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className="flex-1 bg-slate-50/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-red-500/50 focus:border-transparent"
                />
                <div className="flex gap-1">
                  {[1, 6, 24].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setMuteDurationHours(h.toString())}
                      className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        muteDurationHours === h.toString()
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-100/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                {muteDurationHours ? `User will be unmuted in ${muteDurationHours} hour${parseInt(muteDurationHours) > 1 ? 's' : ''}` : 'No time limit - manual unmute required'}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={muteReason}
                onChange={(e) => setMuteReason(e.target.value)}
                placeholder="e.g., Inappropriate language"
                className="w-full bg-slate-50/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-red-500/50 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowMuteModal(null); setMuteReason(''); setMuteDurationHours(''); }}
                className="flex-1 py-2.5 bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-colors"
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

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-slate-200/50 dark:border-white/10 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete {selectedMessages.size} Messages</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">This action cannot be undone</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-600 dark:text-red-300 font-medium">
                ⚠️ You are about to permanently delete {selectedMessages.size} message{selectedMessages.size > 1 ? 's' : ''}.
              </p>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to delete these messages? This will remove them for all team members and cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMultiDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-slate-200/50 dark:border-white/10 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Message</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">This action cannot be undone</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-slate-50/80 dark:bg-white/5 rounded-lg p-3 mb-4 border border-slate-200/50 dark:border-white/10">
              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
                "{showDeleteConfirm.messageText}"
              </p>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to delete this message? All team members will no longer see it.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
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

      {/* Report Content Modal */}
      {reportModalData && teamData?.id && (
        <ReportContentModal
          isOpen={!!reportModalData}
          onClose={() => setReportModalData(null)}
          contentId={reportModalData.contentId}
          contentType="message"
          contentText={reportModalData.contentText}
          contentAuthor={reportModalData.contentAuthor}
          contentAuthorId={reportModalData.contentAuthorId}
          teamId={teamData.id}
        />
      )}
        </GlassCard>
      </div>
    </div>
    </NoAthleteBlock>
  );
};

export default Chat;