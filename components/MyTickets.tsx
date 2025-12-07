// My Tickets Page
// ================
// Shows all tickets purchased by the user with QR codes and wallet options

import React, { useState, useEffect } from 'react';
import { AnimatedBackground, GlassCard, Button, Badge } from './ui/OSYSComponents';
import { 
  getTicketsByEmail, 
  formatTicketPrice,
  getAppleWalletPassUrl,
  getGoogleWalletPassUrl
} from '../services/tickets';
import { Ticket } from '../types/tickets';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

// Simple QR Code component using SVG
const QRCodeDisplay: React.FC<{ data: string; size?: number }> = ({ data, size = 150 }) => {
  // This creates a visual representation - in production, use a proper QR library
  // For demo, we'll create a styled placeholder that shows the ticket number
  const ticketNum = data.split(':')[2] || 'TICKET';
  
  return (
    <div style={{
      width: size,
      height: size,
      background: 'white',
      borderRadius: '12px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }}>
      <div style={{
        width: size - 40,
        height: size - 60,
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎟️</div>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '8px', 
          color: '#fbbf24',
          textAlign: 'center',
          wordBreak: 'break-all'
        }}>
          {ticketNum}
        </div>
      </div>
      <div style={{ 
        fontSize: '8px', 
        color: '#6b7280', 
        marginTop: '4px',
        fontWeight: 500 
      }}>
        SCAN AT GATE
      </div>
    </div>
  );
};

interface MyTicketsProps {
  userEmail: string;
  theme?: 'light' | 'dark';
}

interface TicketWithEvent extends Ticket {
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  teamName?: string;
}

export const MyTickets: React.FC<MyTicketsProps> = ({ userEmail, theme = 'dark' }) => {
  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithEvent | null>(null);
  const [lookupEmail, setLookupEmail] = useState(userEmail || '');

  // Theme styles
  const isDark = theme === 'dark';
  const textColor = isDark ? '#fff' : '#1a1a2e';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(26, 26, 46, 0.2)';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';

  useEffect(() => {
    if (userEmail) {
      loadTickets(userEmail);
    }
  }, [userEmail]);

  const loadTickets = async (email: string) => {
    setLoading(true);
    try {
      const userTickets = await getTicketsByEmail(email.toLowerCase().trim());
      
      // Enhance tickets with event data
      const enhancedTickets = await Promise.all(
        userTickets.map(async (ticket) => {
          try {
            const eventDoc = await getDoc(doc(db, 'events', ticket.eventId));
            const teamDoc = await getDoc(doc(db, 'teams', ticket.teamId));
            const eventData = eventDoc.data();
            const teamData = teamDoc.data();
            
            return {
              ...ticket,
              eventTitle: eventData?.title || 'Event',
              eventDate: eventData?.eventStartDate?.toDate().toLocaleDateString() || '',
              eventTime: eventData?.eventStartDate?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '',
              eventLocation: eventData?.location?.name || '',
              teamName: teamData?.name || ''
            };
          } catch {
            return ticket;
          }
        })
      );

      setTickets(enhancedTickets);
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = () => {
    if (lookupEmail.trim()) {
      loadTickets(lookupEmail);
    }
  };

  const handleAddToWallet = async (ticket: TicketWithEvent, type: 'apple' | 'google') => {
    const getPassUrl = type === 'apple' ? getAppleWalletPassUrl : getGoogleWalletPassUrl;
    const passUrl = await getPassUrl(ticket.id);
    if (passUrl) {
      window.open(passUrl, '_blank');
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh',
      background: isDark ? '#0a0a0f' : '#f5f5f5',
      position: 'relative',
      overflow: 'hidden'
    },
    container: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem 1rem',
      position: 'relative',
      zIndex: 1
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: '2rem'
    },
    logo: {
      fontSize: '2rem',
      fontWeight: 800,
      background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      marginBottom: '0.5rem'
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: textColor,
      margin: '0 0 0.5rem'
    },
    subtitle: {
      color: mutedColor,
      fontSize: '0.875rem'
    },
    lookupForm: {
      display: 'flex',
      gap: '0.75rem',
      marginBottom: '2rem'
    },
    lookupInput: {
      flex: 1,
      padding: '0.75rem 1rem',
      borderRadius: '10px',
      border: `1px solid ${borderColor}`,
      background: cardBg,
      color: textColor,
      fontSize: '1rem'
    },
    ticketCard: {
      background: cardBg,
      borderRadius: '16px',
      border: `1px solid ${borderColor}`,
      overflow: 'hidden',
      marginBottom: '1rem',
      cursor: 'pointer',
      transition: 'transform 0.2s, border-color 0.2s'
    },
    ticketCardHover: {
      transform: 'translateY(-2px)',
      borderColor: '#fbbf24'
    },
    ticketHeader: {
      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))',
      padding: '1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    ticketTeam: {
      fontSize: '0.75rem',
      color: '#fbbf24',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px'
    },
    ticketStatus: {
      fontSize: '0.75rem',
      padding: '0.25rem 0.75rem',
      borderRadius: '20px',
      background: 'rgba(16, 185, 129, 0.2)',
      color: '#10b981',
      fontWeight: 500
    },
    ticketBody: {
      padding: '1rem',
      display: 'flex',
      gap: '1rem'
    },
    ticketInfo: {
      flex: 1
    },
    ticketTitle: {
      fontSize: '1.125rem',
      fontWeight: 600,
      color: textColor,
      marginBottom: '0.5rem'
    },
    ticketDetail: {
      fontSize: '0.875rem',
      color: mutedColor,
      marginBottom: '0.25rem'
    },
    ticketNumber: {
      fontFamily: 'monospace',
      fontSize: '0.875rem',
      color: '#fbbf24',
      marginTop: '0.5rem'
    },
    ticketQR: {
      flexShrink: 0
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '3rem 1rem'
    },
    emptyIcon: {
      fontSize: '4rem',
      marginBottom: '1rem'
    },
    emptyTitle: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: textColor,
      marginBottom: '0.5rem'
    },
    emptyText: {
      color: mutedColor,
      fontSize: '0.875rem'
    },
    modal: {
      position: 'fixed' as const,
      inset: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    },
    modalContent: {
      background: isDark ? 'rgba(26, 26, 46, 0.98)' : 'rgba(255, 255, 255, 0.98)',
      borderRadius: '20px',
      border: `1px solid ${borderColor}`,
      maxWidth: '400px',
      width: '100%',
      padding: '2rem',
      textAlign: 'center' as const
    },
    modalTitle: {
      fontSize: '1.25rem',
      fontWeight: 700,
      color: textColor,
      marginBottom: '0.5rem'
    },
    modalEvent: {
      fontSize: '1rem',
      color: '#fbbf24',
      marginBottom: '0.25rem'
    },
    modalDetail: {
      fontSize: '0.875rem',
      color: mutedColor,
      marginBottom: '0.25rem'
    },
    modalQR: {
      margin: '1.5rem auto'
    },
    modalTicketNumber: {
      fontFamily: 'monospace',
      fontSize: '1.25rem',
      color: '#fbbf24',
      marginBottom: '1.5rem'
    },
    walletButtons: {
      display: 'flex',
      gap: '0.75rem',
      marginBottom: '1rem'
    },
    walletBtn: {
      flex: 1,
      padding: '0.75rem',
      borderRadius: '10px',
      border: 'none',
      fontSize: '0.75rem',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem'
    }
  };

  return (
    <div style={styles.page}>
      {isDark && <AnimatedBackground />}
      
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>OSYS</div>
          <h1 style={styles.title}>🎟️ My Tickets</h1>
          <p style={styles.subtitle}>View and manage your event tickets</p>
        </div>

        {/* Email Lookup */}
        {!userEmail && (
          <div style={styles.lookupForm}>
            <input
              type="email"
              style={styles.lookupInput}
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              placeholder="Enter your email to find tickets"
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            />
            <Button variant="gold" onClick={handleLookup}>
              Find Tickets
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: mutedColor }}>
            Loading tickets...
          </div>
        )}

        {/* Empty State */}
        {!loading && tickets.length === 0 && (
          <GlassCard>
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🎟️</div>
              <h2 style={styles.emptyTitle}>No Tickets Found</h2>
              <p style={styles.emptyText}>
                {lookupEmail 
                  ? `No active tickets found for ${lookupEmail}`
                  : 'Enter your email to find your tickets'
                }
              </p>
            </div>
          </GlassCard>
        )}

        {/* Ticket List */}
        {!loading && tickets.map((ticket) => (
          <div 
            key={ticket.id} 
            style={styles.ticketCard}
            onClick={() => setSelectedTicket(ticket)}
          >
            <div style={styles.ticketHeader}>
              <span style={styles.ticketTeam}>🏈 {ticket.teamName || 'Team'}</span>
              <span style={{
                ...styles.ticketStatus,
                ...(ticket.status === 'used' && { background: 'rgba(107, 114, 128, 0.2)', color: '#6b7280' }),
                ...(ticket.status === 'cancelled' && { background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' })
              }}>
                {ticket.status === 'valid' ? '✓ Valid' : 
                 ticket.status === 'used' ? '✓ Used' : 
                 ticket.status}
              </span>
            </div>
            <div style={styles.ticketBody}>
              <div style={styles.ticketInfo}>
                <h3 style={styles.ticketTitle}>{ticket.eventTitle || 'Event'}</h3>
                {ticket.eventDate && (
                  <p style={styles.ticketDetail}>📅 {ticket.eventDate} at {ticket.eventTime}</p>
                )}
                {ticket.eventLocation && (
                  <p style={styles.ticketDetail}>📍 {ticket.eventLocation}</p>
                )}
                <p style={styles.ticketNumber}>{ticket.ticketNumber}</p>
              </div>
              <div style={styles.ticketQR}>
                <QRCodeDisplay data={ticket.qrCode} size={80} />
              </div>
            </div>
          </div>
        ))}

        {/* Ticket Detail Modal */}
        {selectedTicket && (
          <div style={styles.modal} onClick={() => setSelectedTicket(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2 style={styles.modalTitle}>🎟️ Your Ticket</h2>
              
              <p style={styles.modalEvent}>{selectedTicket.eventTitle}</p>
              <p style={styles.modalDetail}>🏈 {selectedTicket.teamName}</p>
              {selectedTicket.eventDate && (
                <p style={styles.modalDetail}>📅 {selectedTicket.eventDate} at {selectedTicket.eventTime}</p>
              )}
              {selectedTicket.eventLocation && (
                <p style={styles.modalDetail}>📍 {selectedTicket.eventLocation}</p>
              )}

              <div style={styles.modalQR}>
                <QRCodeDisplay data={selectedTicket.qrCode} size={180} />
              </div>

              <div style={styles.modalTicketNumber}>{selectedTicket.ticketNumber}</div>

              <p style={{ fontSize: '0.75rem', color: mutedColor, marginBottom: '1rem' }}>
                Add to wallet for quick access at the gate
              </p>

              <div style={styles.walletButtons}>
                <button 
                  style={{ ...styles.walletBtn, background: '#000', color: '#fff' }}
                  onClick={() => handleAddToWallet(selectedTicket, 'apple')}
                >
                   Apple Wallet
                </button>
                <button 
                  style={{ ...styles.walletBtn, background: '#4285f4', color: '#fff' }}
                  onClick={() => handleAddToWallet(selectedTicket, 'google')}
                >
                  📱 Google Wallet
                </button>
              </div>

              <Button 
                variant="ghost" 
                style={{ width: '100%' }}
                onClick={() => setSelectedTicket(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTickets;
