import React, { useState } from 'react';
import { AnimatedBackground, GlassCard, Button, Badge } from './ui/OSYSComponents';
import { DemoNavigation } from './ui/DemoNavigation';
import { useDemoToast } from '../hooks/useOSYSData';

// Types
interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  isOnline: boolean;
  isGroup?: boolean;
  role?: 'coach' | 'athlete' | 'parent' | 'admin';
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  isOwn: boolean;
  reactions?: string[];
  attachment?: {
    type: 'image' | 'video' | 'file';
    url: string;
    name?: string;
  };
}

// Mock Data
const mockConversations: Conversation[] = [
  {
    id: '1',
    name: 'Coach Thompson',
    avatar: '👨‍🏫',
    lastMessage: 'Great game yesterday! Review film at 4pm',
    time: '2m ago',
    unread: 2,
    isOnline: true,
    role: 'coach'
  },
  {
    id: '2',
    name: 'Team Chat',
    avatar: '🏈',
    lastMessage: 'Marcus: Who else is ready for Friday?',
    time: '15m ago',
    unread: 5,
    isOnline: true,
    isGroup: true
  },
  {
    id: '3',
    name: 'Marcus Johnson',
    avatar: '🏃',
    lastMessage: 'Thanks for the ride to practice!',
    time: '1h ago',
    unread: 0,
    isOnline: true,
    role: 'athlete'
  },
  {
    id: '4',
    name: 'Parent Group',
    avatar: '👨‍👩‍👦',
    lastMessage: 'Carpool signup for away game',
    time: '2h ago',
    unread: 0,
    isOnline: false,
    isGroup: true
  },
  {
    id: '5',
    name: 'Tyler Chen',
    avatar: '🏃',
    lastMessage: 'See you at the weight room',
    time: '3h ago',
    unread: 0,
    isOnline: false,
    role: 'athlete'
  },
  {
    id: '6',
    name: 'Athletic Director',
    avatar: '🎯',
    lastMessage: 'Budget approved for new equipment',
    time: '1d ago',
    unread: 1,
    isOnline: false,
    role: 'admin'
  }
];

const mockMessages: Message[] = [
  {
    id: '1',
    senderId: 'coach',
    text: 'Great hustle at practice today! 💪',
    time: '4:32 PM',
    isOwn: false
  },
  {
    id: '2',
    senderId: 'me',
    text: 'Thanks Coach! Feeling good about Friday\'s game',
    time: '4:33 PM',
    isOwn: true
  },
  {
    id: '3',
    senderId: 'coach',
    text: 'We\'re going to review the game film at 4pm tomorrow. Make sure the whole team knows.',
    time: '4:35 PM',
    isOwn: false
  },
  {
    id: '4',
    senderId: 'me',
    text: 'Got it, I\'ll let everyone know in the group chat',
    time: '4:36 PM',
    isOwn: true,
    reactions: ['👍', '✅']
  },
  {
    id: '5',
    senderId: 'coach',
    text: 'Perfect. Also, I wanted to share this play diagram for the new formation',
    time: '4:38 PM',
    isOwn: false,
    attachment: {
      type: 'image',
      url: '#',
      name: 'play_diagram.png'
    }
  },
  {
    id: '6',
    senderId: 'me',
    text: 'This looks great! I\'ll study it tonight',
    time: '4:40 PM',
    isOwn: true
  }
];

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--osys-bg-dark)',
    color: 'white',
    fontFamily: 'Inter, system-ui, sans-serif',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    position: 'relative',
    zIndex: 10,
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'white',
    textDecoration: 'none'
  },
  navBrandIcon: {
    width: '40px',
    height: '40px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem'
  },
  layout: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    position: 'relative' as const,
    zIndex: 1
  },
  conversationList: {
    width: '360px',
    borderRight: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'rgba(0,0,0,0.2)'
  },
  conversationHeader: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  conversationTitle: {
    fontSize: '1.25rem',
    fontWeight: 600
  },
  searchBox: {
    margin: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '0.9375rem',
    outline: 'none'
  },
  conversationItems: {
    flex: 1,
    overflowY: 'auto' as const
  },
  conversationItem: {
    display: 'flex',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    cursor: 'pointer',
    transition: 'background 0.2s',
    borderLeft: '3px solid transparent'
  },
  conversationItemActive: {
    background: 'rgba(102,126,234,0.2)',
    borderLeftColor: '#667eea'
  },
  conversationAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'var(--osys-gradient-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    position: 'relative' as const,
    flexShrink: 0
  },
  onlineIndicator: {
    position: 'absolute' as const,
    bottom: '2px',
    right: '2px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#22c55e',
    border: '2px solid var(--osys-bg-dark)'
  },
  conversationInfo: {
    flex: 1,
    minWidth: 0
  },
  conversationName: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem'
  },
  conversationNameText: {
    fontWeight: 600,
    fontSize: '0.9375rem'
  },
  conversationTime: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 'auto'
  },
  conversationPreview: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  unreadBadge: {
    minWidth: '20px',
    height: '20px',
    borderRadius: '10px',
    background: 'var(--osys-gradient-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 600
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: 0
  },
  chatHeader: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: 'rgba(0,0,0,0.2)'
  },
  chatAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'var(--osys-gradient-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem'
  },
  chatInfo: {
    flex: 1
  },
  chatName: {
    fontWeight: 600,
    marginBottom: '0.125rem'
  },
  chatStatus: {
    fontSize: '0.875rem',
    color: '#22c55e',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem'
  },
  chatActions: {
    display: 'flex',
    gap: '0.5rem'
  },
  chatActionBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(255,255,255,0.1)',
    color: 'white',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem'
  },
  messageRow: {
    display: 'flex',
    gap: '0.75rem',
    maxWidth: '70%'
  },
  messageRowOwn: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse' as const
  },
  messageAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'var(--osys-gradient-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    flexShrink: 0
  },
  messageBubble: {
    background: 'rgba(255,255,255,0.1)',
    padding: '0.75rem 1rem',
    borderRadius: '16px',
    borderTopLeftRadius: '4px'
  },
  messageBubbleOwn: {
    background: 'var(--osys-gradient-primary)',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '4px'
  },
  messageText: {
    fontSize: '0.9375rem',
    lineHeight: 1.5
  },
  messageTime: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.375rem'
  },
  messageReactions: {
    display: 'flex',
    gap: '0.25rem',
    marginTop: '0.375rem'
  },
  reaction: {
    padding: '0.125rem 0.375rem',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '6px',
    fontSize: '0.75rem'
  },
  attachmentPreview: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  attachmentIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  attachmentInfo: {
    flex: 1
  },
  attachmentName: {
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '0.125rem'
  },
  attachmentSize: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)'
  },
  inputArea: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-end',
    background: 'rgba(0,0,0,0.2)'
  },
  inputActions: {
    display: 'flex',
    gap: '0.25rem'
  },
  inputBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(255,255,255,0.1)',
    color: 'white',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputField: {
    flex: 1,
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '16px',
    padding: '0.875rem 1rem',
    color: 'white',
    fontSize: '0.9375rem',
    outline: 'none',
    resize: 'none' as const,
    minHeight: '44px',
    maxHeight: '120px'
  },
  sendBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--osys-gradient-primary)',
    color: 'white',
    fontSize: '1.25rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoPanel: {
    width: '300px',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.2)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem'
  },
  infoPanelProfile: {
    textAlign: 'center' as const
  },
  infoPanelAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    background: 'var(--osys-gradient-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2.5rem',
    margin: '0 auto 1rem'
  },
  infoPanelName: {
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '0.25rem'
  },
  infoPanelRole: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)'
  },
  infoPanelActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem'
  },
  infoPanelAction: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    cursor: 'pointer'
  },
  infoPanelActionIcon: {
    fontSize: '1.25rem'
  },
  infoPanelActionLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)'
  },
  infoSection: {
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  infoSectionTitle: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '0.75rem'
  },
  sharedMedia: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem'
  },
  mediaItem: {
    aspectRatio: '1',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  }
};

export const OSYSMessenger: React.FC = () => {
  const [activeConversation, setActiveConversation] = useState(mockConversations[0]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { showToast, ToastComponent } = useDemoToast();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'coach':
        return <Badge variant="primary">Coach</Badge>;
      case 'admin':
        return <Badge variant="warning">Staff</Badge>;
      default:
        return null;
    }
  };

  return (
    <div style={styles.page}>
      <AnimatedBackground />
      
      {/* Navigation */}
      <nav style={styles.nav}>
        <a href="/welcome" style={styles.navBrand}>
          <div style={styles.navBrandIcon}>🏆</div>
          <span>OSYS</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => showToast('No new notifications', 'info')}>🔔</Button>
          <Button variant="primary" onClick={() => showToast('Profile coming soon!', 'info')}>My Profile</Button>
        </div>
      </nav>

      <div style={styles.layout}>
        {/* Conversation List */}
        <div style={styles.conversationList}>
          <div style={styles.conversationHeader}>
            <span style={styles.conversationTitle}>💬 Messages</span>
            <Button variant="primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => showToast('New conversation coming soon!', 'info')}>
              + New
            </Button>
          </div>
          
          <div style={styles.searchBox}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={styles.conversationItems}>
            {mockConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                style={{
                  ...styles.conversationItem,
                  ...(activeConversation.id === conv.id ? styles.conversationItemActive : {})
                }}
              >
                <div style={styles.conversationAvatar}>
                  {conv.avatar}
                  {conv.isOnline && <div style={styles.onlineIndicator} />}
                </div>
                <div style={styles.conversationInfo}>
                  <div style={styles.conversationName}>
                    <span style={styles.conversationNameText}>{conv.name}</span>
                    {conv.isGroup && <Badge variant="default">Group</Badge>}
                    <span style={styles.conversationTime}>{conv.time}</span>
                  </div>
                  <div style={styles.conversationPreview}>{conv.lastMessage}</div>
                </div>
                {conv.unread > 0 && (
                  <div style={styles.unreadBadge}>{conv.unread}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div style={styles.chatArea}>
          <div style={styles.chatHeader}>
            <div style={styles.chatAvatar}>{activeConversation.avatar}</div>
            <div style={styles.chatInfo}>
              <div style={styles.chatName}>
                {activeConversation.name}
                {getRoleBadge(activeConversation.role)}
              </div>
              <div style={styles.chatStatus}>
                {activeConversation.isOnline ? (
                  <>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                    Online
                  </>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Last seen 2h ago</span>
                )}
              </div>
            </div>
            <div style={styles.chatActions}>
              <button style={styles.chatActionBtn} onClick={() => showToast('Voice call coming soon!', 'info')}>📞</button>
              <button style={styles.chatActionBtn} onClick={() => showToast('Video call coming soon!', 'info')}>📹</button>
              <button style={styles.chatActionBtn} onClick={() => showToast('More options coming soon!', 'info')}>⋮</button>
            </div>
          </div>

          <div style={styles.messagesContainer}>
            {mockMessages.map(msg => (
              <div
                key={msg.id}
                style={{
                  ...styles.messageRow,
                  ...(msg.isOwn ? styles.messageRowOwn : {})
                }}
              >
                {!msg.isOwn && (
                  <div style={styles.messageAvatar}>👨‍🏫</div>
                )}
                <div>
                  <div style={{
                    ...styles.messageBubble,
                    ...(msg.isOwn ? styles.messageBubbleOwn : {})
                  }}>
                    <div style={styles.messageText}>{msg.text}</div>
                    {msg.attachment && (
                      <div style={styles.attachmentPreview}>
                        <div style={styles.attachmentIcon}>📎</div>
                        <div style={styles.attachmentInfo}>
                          <div style={styles.attachmentName}>{msg.attachment.name}</div>
                          <div style={styles.attachmentSize}>Click to view</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{
                    ...styles.messageTime,
                    textAlign: msg.isOwn ? 'right' : 'left'
                  } as React.CSSProperties}>
                    {msg.time}
                  </div>
                  {msg.reactions && (
                    <div style={styles.messageReactions}>
                      {msg.reactions.map((r, i) => (
                        <span key={i} style={styles.reaction}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.inputArea}>
            <div style={styles.inputActions}>
              <button style={styles.inputBtn} onClick={() => showToast('Attachments coming soon!', 'info')}>➕</button>
              <button style={styles.inputBtn} onClick={() => showToast('Camera coming soon!', 'info')}>📷</button>
              <button style={styles.inputBtn} onClick={() => showToast('Emoji picker coming soon!', 'info')}>😊</button>
            </div>
            <textarea
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={styles.inputField}
              rows={1}
            />
            <button style={styles.sendBtn} onClick={() => { if (messageText.trim()) { showToast('Message sent!', 'success'); setMessageText(''); } }}>➤</button>
          </div>
        </div>

        {/* Info Panel */}
        <div style={styles.infoPanel}>
          <div style={styles.infoPanelProfile}>
            <div style={styles.infoPanelAvatar}>{activeConversation.avatar}</div>
            <div style={styles.infoPanelName}>{activeConversation.name}</div>
            <div style={styles.infoPanelRole}>
              {activeConversation.role ? activeConversation.role.charAt(0).toUpperCase() + activeConversation.role.slice(1) : 'Member'}
            </div>
          </div>

          <div style={styles.infoPanelActions}>
            <div style={styles.infoPanelAction}>
              <span style={styles.infoPanelActionIcon}>👤</span>
              <span style={styles.infoPanelActionLabel}>Profile</span>
            </div>
            <div style={styles.infoPanelAction}>
              <span style={styles.infoPanelActionIcon}>🔔</span>
              <span style={styles.infoPanelActionLabel}>Mute</span>
            </div>
            <div style={styles.infoPanelAction}>
              <span style={styles.infoPanelActionIcon}>🔍</span>
              <span style={styles.infoPanelActionLabel}>Search</span>
            </div>
          </div>

          <div style={styles.infoSection}>
            <div style={styles.infoSectionTitle}>Shared Media</div>
            <div style={styles.sharedMedia}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={styles.mediaItem}>
                  📸
                </div>
              ))}
            </div>
          </div>

          <div style={styles.infoSection}>
            <div style={styles.infoSectionTitle}>Shared Files</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <span>📄</span>
                <div style={{ flex: 1, fontSize: '0.875rem' }}>play_diagram.pdf</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <span>📄</span>
                <div style={{ flex: 1, fontSize: '0.875rem' }}>schedule.xlsx</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DemoNavigation />
      {ToastComponent}
    </div>
  );
};

export default OSYSMessenger;
