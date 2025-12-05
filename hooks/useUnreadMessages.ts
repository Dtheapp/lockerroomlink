import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface UnreadState {
  teamChat: boolean;
  strategy: boolean;
  messenger: boolean;
  grievances: boolean;
}

export const useUnreadMessages = () => {
  const { user, userData, teamData } = useAuth();
  const [unread, setUnread] = useState<UnreadState>({
    teamChat: false,
    strategy: false,
    messenger: false,
    grievances: false,
  });
  const [lastReadData, setLastReadData] = useState<Record<string, Timestamp>>({});

  // Listen to lastRead document for real-time updates
  useEffect(() => {
    if (!user) return;

    const lastReadRef = doc(db, 'users', user.uid, 'meta', 'lastRead');
    
    const unsubscribe = onSnapshot(lastReadRef, (snapshot) => {
      if (snapshot.exists()) {
        setLastReadData(snapshot.data() as Record<string, Timestamp>);
      } else {
        setLastReadData({});
      }
    }, (error) => {
      console.error('Error listening to lastRead:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Team Chat unread listener
  useEffect(() => {
    if (!user || !teamData?.id) return;

    const teamChatQuery = query(
      collection(db, 'teams', teamData.id, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(teamChatQuery, (snapshot) => {
      if (!snapshot.empty) {
        const latestMsg = snapshot.docs[0].data();
        const latestTime = latestMsg.timestamp as Timestamp;
        const lastRead = lastReadData.teamChat as Timestamp;
        
        const hasUnread = latestTime && 
          (!lastRead || latestTime.seconds > lastRead.seconds) &&
          latestMsg.sender?.uid !== user.uid;
        
        setUnread(prev => ({ ...prev, teamChat: !!hasUnread }));
      } else {
        setUnread(prev => ({ ...prev, teamChat: false }));
      }
    });

    return () => unsubscribe();
  }, [user, teamData?.id, lastReadData.teamChat]);

  // Strategy Chat unread listener (coaches only)
  useEffect(() => {
    if (!user || !teamData?.id || userData?.role !== 'Coach') {
      setUnread(prev => ({ ...prev, strategy: false }));
      return;
    }

    const strategyQuery = query(
      collection(db, 'teams', teamData.id, 'strategies'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(strategyQuery, (snapshot) => {
      if (!snapshot.empty) {
        const latestMsg = snapshot.docs[0].data();
        const latestTime = latestMsg.timestamp as Timestamp;
        const lastRead = lastReadData.strategy as Timestamp;
        
        const hasUnread = latestTime && 
          (!lastRead || latestTime.seconds > lastRead.seconds) &&
          latestMsg.sender?.uid !== user.uid;
        
        setUnread(prev => ({ ...prev, strategy: !!hasUnread }));
      } else {
        setUnread(prev => ({ ...prev, strategy: false }));
      }
    });

    return () => unsubscribe();
  }, [user, userData?.role, teamData?.id, lastReadData.strategy]);

  // Messenger unread listener
  useEffect(() => {
    if (!user) return;

    const chatsQuery = query(
      collection(db, 'private_chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      let hasUnreadMessages = false;
      
      snapshot.docs.forEach(chatDoc => {
        const chatData = chatDoc.data();
        const lastMsgTime = chatData.lastMessageTime as Timestamp;
        const lastRead = lastReadData[`messenger_${chatDoc.id}`] as Timestamp;
        const lastSenderId = chatData.lastSenderId;
        
        // Has unread if: newer message exists AND wasn't sent by current user
        if (lastMsgTime && 
            (!lastRead || lastMsgTime.seconds > lastRead.seconds) &&
            lastSenderId && 
            lastSenderId !== user.uid) {
          hasUnreadMessages = true;
        }
      });
      
      setUnread(prev => ({ ...prev, messenger: hasUnreadMessages }));
    }, (error) => {
      // If index not created yet, just ignore
      console.log('Messenger unread check:', error.message);
      setUnread(prev => ({ ...prev, messenger: false }));
    });

    return () => unsubscribe();
  }, [user, lastReadData]);

  // Grievance unread listener (admin only)
  useEffect(() => {
    if (!user || userData?.role !== 'Admin') {
      setUnread(prev => ({ ...prev, grievances: false }));
      return;
    }

    const grievanceChatsQuery = query(
      collection(db, 'grievance_chats'),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(grievanceChatsQuery, (snapshot) => {
      let hasUnreadGrievances = false;
      
      snapshot.docs.forEach(chatDoc => {
        const chatData = chatDoc.data();
        const lastMsgTime = chatData.updatedAt as Timestamp;
        const lastRead = lastReadData[`grievance_${chatDoc.id}`] as Timestamp;
        const lastSenderId = chatData.lastSenderId;
        
        // Has unread if: newer message exists AND wasn't sent by admin (grievance-system)
        if (lastMsgTime && 
            (!lastRead || lastMsgTime.seconds > lastRead.seconds) &&
            lastSenderId && 
            lastSenderId !== 'grievance-system') {
          hasUnreadGrievances = true;
        }
      });
      
      setUnread(prev => ({ ...prev, grievances: hasUnreadGrievances }));
    }, (error) => {
      console.log('Grievance unread check:', error.message);
      setUnread(prev => ({ ...prev, grievances: false }));
    });

    return () => unsubscribe();
  }, [user, userData?.role, lastReadData]);

  // Function to mark a chat as read
  const markAsRead = useCallback(async (chatType: 'teamChat' | 'strategy' | 'messenger' | 'grievance', chatId?: string) => {
    if (!user) return;

    try {
      const lastReadRef = doc(db, 'users', user.uid, 'meta', 'lastRead');
      
      let key = chatType;
      if (chatType === 'messenger' && chatId) {
        key = `messenger_${chatId}` as any;
      } else if (chatType === 'grievance' && chatId) {
        key = `grievance_${chatId}` as any;
      }
      
      await setDoc(lastReadRef, {
        [key]: Timestamp.now()
      }, { merge: true });

      // Local state will update via the onSnapshot listener
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [user]);

  // Mark all messenger chats as read when opening messenger
  const markAllMessengerAsRead = useCallback(async (chatIds: string[]) => {
    if (!user || chatIds.length === 0) return;

    try {
      const lastReadRef = doc(db, 'users', user.uid, 'meta', 'lastRead');
      const updates: Record<string, Timestamp> = {};
      
      chatIds.forEach(id => {
        updates[`messenger_${id}`] = Timestamp.now();
      });
      
      await setDoc(lastReadRef, updates, { merge: true });
    } catch (error) {
      console.error('Error marking messenger as read:', error);
    }
  }, [user]);

  return { unread, markAsRead, markAllMessengerAsRead };
};
