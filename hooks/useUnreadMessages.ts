import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface UnreadState {
  teamChat: boolean;
  strategy: boolean;
  messenger: boolean;
}

export const useUnreadMessages = () => {
  const { user, userData, teamData } = useAuth();
  const [unread, setUnread] = useState<UnreadState>({
    teamChat: false,
    strategy: false,
    messenger: false,
  });

  useEffect(() => {
    if (!user || !userData) return;

    const unsubscribes: (() => void)[] = [];

    // Get user's lastRead timestamps
    const lastReadRef = doc(db, 'users', user.uid, 'meta', 'lastRead');

    const checkUnread = async () => {
      try {
        const lastReadSnap = await getDoc(lastReadRef);
        const lastReadData = lastReadSnap.exists() ? lastReadSnap.data() : {};

        // Team Chat listener
        if (teamData?.id) {
          const teamChatQuery = query(
            collection(db, 'teams', teamData.id, 'messages'),
            orderBy('timestamp', 'desc'),
            limit(1)
          );

          const teamChatUnsub = onSnapshot(teamChatQuery, (snapshot) => {
            if (!snapshot.empty) {
              const latestMsg = snapshot.docs[0].data();
              const latestTime = latestMsg.timestamp as Timestamp;
              const lastRead = lastReadData.teamChat as Timestamp;
              
              // Check if there's a newer message (not from current user)
              const hasUnread = latestTime && 
                (!lastRead || latestTime.seconds > lastRead.seconds) &&
                latestMsg.sender?.uid !== user.uid;
              
              setUnread(prev => ({ ...prev, teamChat: hasUnread }));
            } else {
              setUnread(prev => ({ ...prev, teamChat: false }));
            }
          });
          unsubscribes.push(teamChatUnsub);

          // Strategy Chat listener (coaches only)
          if (userData.role === 'Coach') {
            const strategyQuery = query(
              collection(db, 'teams', teamData.id, 'strategies'),
              orderBy('timestamp', 'desc'),
              limit(1)
            );

            const strategyUnsub = onSnapshot(strategyQuery, (snapshot) => {
              if (!snapshot.empty) {
                const latestMsg = snapshot.docs[0].data();
                const latestTime = latestMsg.timestamp as Timestamp;
                const lastRead = lastReadData.strategy as Timestamp;
                
                const hasUnread = latestTime && 
                  (!lastRead || latestTime.seconds > lastRead.seconds) &&
                  latestMsg.sender?.uid !== user.uid;
                
                setUnread(prev => ({ ...prev, strategy: hasUnread }));
              } else {
                setUnread(prev => ({ ...prev, strategy: false }));
              }
            });
            unsubscribes.push(strategyUnsub);
          }
        }

        // Private Messenger listener
        const chatsQuery = query(
          collection(db, 'privateChats'),
          orderBy('lastMessageTime', 'desc'),
          limit(20)
        );

        const messengerUnsub = onSnapshot(chatsQuery, (snapshot) => {
          let hasUnreadMessages = false;
          
          snapshot.docs.forEach(chatDoc => {
            const chatData = chatDoc.data();
            // Check if user is participant
            if (chatData.participants?.includes(user.uid)) {
              const lastMsgTime = chatData.lastMessageTime as Timestamp;
              const lastRead = lastReadData[`messenger_${chatDoc.id}`] as Timestamp;
              const lastSenderId = chatData.lastSenderId;
              
              // Has unread if: newer message exists AND wasn't sent by current user
              if (lastMsgTime && 
                  (!lastRead || lastMsgTime.seconds > lastRead.seconds) &&
                  lastSenderId !== user.uid) {
                hasUnreadMessages = true;
              }
            }
          });
          
          setUnread(prev => ({ ...prev, messenger: hasUnreadMessages }));
        });
        unsubscribes.push(messengerUnsub);

      } catch (error) {
        console.error('Error checking unread messages:', error);
      }
    };

    checkUnread();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, userData, teamData?.id]);

  // Function to mark a chat as read
  const markAsRead = async (chatType: 'teamChat' | 'strategy' | 'messenger', chatId?: string) => {
    if (!user) return;

    try {
      const lastReadRef = doc(db, 'users', user.uid, 'meta', 'lastRead');
      const lastReadSnap = await getDoc(lastReadRef);
      const lastReadData = lastReadSnap.exists() ? lastReadSnap.data() : {};

      const key = chatType === 'messenger' && chatId ? `messenger_${chatId}` : chatType;
      
      await setDoc(lastReadRef, {
        ...lastReadData,
        [key]: Timestamp.now()
      }, { merge: true });

      // Update local state immediately
      if (chatType !== 'messenger') {
        setUnread(prev => ({ ...prev, [chatType]: false }));
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  return { unread, markAsRead };
};
