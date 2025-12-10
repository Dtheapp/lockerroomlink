import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface UnreadState {
  teamChat: boolean;
  strategy: boolean;
  messenger: boolean;
  grievances: boolean;
  infractions: boolean;
}

export const useUnreadMessages = () => {
  const { user, userData, teamData } = useAuth();
  const [unread, setUnread] = useState<UnreadState>({
    teamChat: false,
    strategy: false,
    messenger: false,
    grievances: false,
    infractions: false,
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
    if (!user || !teamData?.id) {
      setUnread(prev => ({ ...prev, teamChat: false }));
      return;
    }

    const teamChatQuery = query(
      collection(db, 'teams', teamData.id, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = onSnapshot(teamChatQuery, (snapshot) => {
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
      }, (error) => {
        console.log('Team chat unread check:', error.message);
        setUnread(prev => ({ ...prev, teamChat: false }));
      });
    } catch (error) {
      console.log('Team chat unread setup error:', error);
      setUnread(prev => ({ ...prev, teamChat: false }));
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
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

    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = onSnapshot(strategyQuery, (snapshot) => {
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
      }, (error) => {
        console.log('Strategy chat unread check:', error.message);
        setUnread(prev => ({ ...prev, strategy: false }));
      });
    } catch (error) {
      console.log('Strategy chat unread setup error:', error);
      setUnread(prev => ({ ...prev, strategy: false }));
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, userData?.role, teamData?.id, lastReadData.strategy]);

  // Messenger unread listener
  useEffect(() => {
    if (!user) return;

    // Simplified query without orderBy to avoid composite index requirement
    const chatsQuery = query(
      collection(db, 'private_chats'),
      where('participants', 'array-contains', user.uid)
    );

    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
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
        // If permission denied or index not created yet, just ignore
        console.log('Messenger unread check:', error.message);
        setUnread(prev => ({ ...prev, messenger: false }));
      });
    } catch (error) {
      console.log('Messenger unread setup error:', error);
      setUnread(prev => ({ ...prev, messenger: false }));
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, lastReadData]);

  // Grievance chat unread listener for Parents (shows in Messenger)
  useEffect(() => {
    if (!user || userData?.role !== 'Parent') return;

    // Simple query - just filter by parentId (no orderBy to avoid composite index requirement)
    const grievanceChatsQuery = query(
      collection(db, 'grievance_chats'),
      where('parentId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(grievanceChatsQuery, (snapshot) => {
      let hasUnreadGrievanceMessages = false;
      
      snapshot.docs.forEach(chatDoc => {
        const chatData = chatDoc.data();
        const lastMsgTime = chatData.updatedAt as Timestamp;
        const lastRead = lastReadData[`grievance_${chatDoc.id}`] as Timestamp;
        const lastSenderId = chatData.lastSenderId;
        
        // Has unread if: newer message exists AND was sent by admin (grievance-system)
        if (lastMsgTime && 
            (!lastRead || lastMsgTime.seconds > lastRead.seconds) &&
            lastSenderId && 
            lastSenderId === 'grievance-system') {
          hasUnreadGrievanceMessages = true;
        }
      });
      
      // If parent has unread grievance messages, also show messenger indicator
      if (hasUnreadGrievanceMessages) {
        setUnread(prev => ({ ...prev, messenger: true }));
      }
    }, (error) => {
      console.log('Parent grievance unread check:', error.message);
    });

    return () => unsubscribe();
  }, [user, userData?.role, lastReadData]);

  // Grievance unread listener (admin and commissioners)
  useEffect(() => {
    const isCommissioner = ['Commissioner', 'TeamCommissioner', 'LeagueCommissioner', 'ProgramCommissioner', 'SuperAdmin'].includes(userData?.role || '');
    
    if (!user || !isCommissioner) {
      setUnread(prev => ({ ...prev, grievances: false }));
      return;
    }

    // Simple query without orderBy to avoid index requirement
    const grievanceChatsQuery = query(
      collection(db, 'grievance_chats')
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

  // Infractions unread listener (commissioners only)
  useEffect(() => {
    const isCommissioner = ['Commissioner', 'TeamCommissioner', 'LeagueCommissioner', 'ProgramCommissioner', 'SuperAdmin'].includes(userData?.role || '');
    
    if (!user || !isCommissioner) {
      setUnread(prev => ({ ...prev, infractions: false }));
      return;
    }

    // Query for new/unread infractions
    const infractionsQuery = query(
      collection(db, 'infractions'),
      where('status', 'in', ['submitted', 'under_review'])
    );

    const unsubscribe = onSnapshot(infractionsQuery, (snapshot) => {
      let hasNewInfractions = false;
      
      snapshot.docs.forEach(infrDoc => {
        const infrData = infrDoc.data();
        const createdAt = infrData.createdAt as Timestamp;
        const lastRead = lastReadData['infractions'] as Timestamp;
        
        // Has new if: created after last read OR no lastRead
        if (createdAt && (!lastRead || createdAt.seconds > lastRead.seconds)) {
          hasNewInfractions = true;
        }
      });
      
      setUnread(prev => ({ ...prev, infractions: hasNewInfractions }));
    }, (error) => {
      console.log('Infractions unread check:', error.message);
      setUnread(prev => ({ ...prev, infractions: false }));
    });

    return () => unsubscribe();
  }, [user, userData?.role, lastReadData]);

  // Function to mark a chat as read
  const markAsRead = useCallback(async (chatType: 'teamChat' | 'strategy' | 'messenger' | 'grievance' | 'infractions' | 'grievances', chatId?: string) => {
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
