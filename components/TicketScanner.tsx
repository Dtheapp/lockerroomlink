// Ticket Scanner Component
// ========================
// For gate volunteers to scan and validate tickets

import React, { useState, useEffect, useRef } from 'react';
import { GlassCard, Button, Badge } from './ui/OSYSComponents';
import { scanTicket, getTicketSalesSummary } from '../services/tickets';
import { Ticket } from '../types/tickets';

interface TicketScannerProps {
  teamId: string;
  eventId: string;
  eventTitle: string;
  scannerId: string;
  scannerName: string;
  theme?: 'light' | 'dark';
}

type ScanResult = 'idle' | 'scanning' | 'valid' | 'already_used' | 'invalid' | 'expired';

export const TicketScanner: React.FC<TicketScannerProps> = ({
  teamId,
  eventId,
  eventTitle,
  scannerId,
  scannerName,
  theme = 'dark'
}) => {
  // State
  const [scanResult, setScanResult] = useState<ScanResult>('idle');
  const [lastTicket, setLastTicket] = useState<Ticket | null>(null);
  const [message, setMessage] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [stats, setStats] = useState<{ scanned: number; total: number } | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Theme styles
  const isDark = theme === 'dark';
  const textColor = isDark ? '#fff' : '#1a1a2e';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(26, 26, 46, 0.2)';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';

  // Load stats
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [eventId]);

  // Focus input for scanner
  useEffect(() => {
    if (inputRef.current && !showManualEntry) {
      inputRef.current.focus();
    }
  }, [showManualEntry, scanResult]);

  // Auto-reset after scan result
  useEffect(() => {
    if (scanResult !== 'idle' && scanResult !== 'scanning') {
      resetTimeoutRef.current = setTimeout(() => {
        setScanResult('idle');
        setLastTicket(null);
        setMessage('');
        if (inputRef.current) {
          inputRef.current.value = '';
          inputRef.current.focus();
        }
      }, 3000);
    }

    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, [scanResult]);

  const loadStats = async () => {
    try {
      const summary = await getTicketSalesSummary(eventId);
      if (summary) {
        setStats({
          scanned: summary.ticketsSold - (summary.ticketsAvailable || 0), // Approximate
          total: summary.ticketsSold
        });
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleScan = async (qrCode: string) => {
    if (!qrCode.trim() || isProcessing) return;

    setIsProcessing(true);
    setScanResult('scanning');

    try {
      const result = await scanTicket({
        qrCode: qrCode.trim(),
        eventId,
        scannerId,
        scannerName
      });

      setScanResult(result.result);
      setMessage(result.message);
      setLastTicket(result.ticket || null);

      if (result.result === 'valid') {
        setScanCount(prev => prev + 1);
        // Play success sound (optional)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleZiFfHd8epqFgnRdXWFzkJmQgW1OTVN0nKuijGY/OEFpoLK2oXxWSlBqhJSShHhqa3WAj5OJeWxqbnh/goJ7cWxucHZ6eXVxbm5wcnR1c3BtbG1vcXJycG5sbG5vcHBwbm1sbG5vcG9vbm1tbW5vb29ubm1tbm5ubm5ubm1tbW5ubm5ubW1tbW5ubm5tbW1tbW5ubm5tbW1tbW1ubm1tbW1tbW1tbW1tbW1tbW1tbW1t');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch {}
      }
    } catch (err) {
      setScanResult('invalid');
      setMessage('Error scanning ticket');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value;
      handleScan(value);
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setManualCode('');
      setShowManualEntry(false);
    }
  };

  const getResultColor = () => {
    switch (scanResult) {
      case 'valid': return '#10b981';
      case 'already_used': return '#f59e0b';
      case 'invalid': 
      case 'expired': return '#ef4444';
      default: return borderColor;
    }
  };

  const getResultIcon = () => {
    switch (scanResult) {
      case 'valid': return '✓';
      case 'already_used': return '⚠️';
      case 'invalid': return '✗';
      case 'expired': return '⏰';
      case 'scanning': return '...';
      default: return '📷';
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      minHeight: '100vh',
      background: isDark ? '#0a0a0f' : '#f5f5f5',
      padding: '1rem'
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: '1.5rem'
    },
    title: {
      fontSize: '1.25rem',
      fontWeight: 700,
      color: textColor,
      margin: '0 0 0.25rem'
    },
    subtitle: {
      fontSize: '0.875rem',
      color: mutedColor,
      margin: 0
    },
    scanArea: {
      background: cardBg,
      borderRadius: '20px',
      border: `3px solid ${getResultColor()}`,
      padding: '2rem',
      textAlign: 'center' as const,
      marginBottom: '1.5rem',
      transition: 'border-color 0.3s, background-color 0.3s',
      ...(scanResult === 'valid' && { background: 'rgba(16, 185, 129, 0.1)' }),
      ...(scanResult === 'already_used' && { background: 'rgba(245, 158, 11, 0.1)' }),
      ...((scanResult === 'invalid' || scanResult === 'expired') && { background: 'rgba(239, 68, 68, 0.1)' })
    },
    scanIcon: {
      width: '100px',
      height: '100px',
      borderRadius: '50%',
      background: `${getResultColor()}20`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 1rem',
      fontSize: '3rem',
      transition: 'all 0.3s'
    },
    scanMessage: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: scanResult === 'idle' ? mutedColor : getResultColor(),
      marginBottom: '0.5rem'
    },
    ticketInfo: {
      fontSize: '0.875rem',
      color: textColor
    },
    ticketNumber: {
      fontFamily: 'monospace',
      fontSize: '1rem',
      color: '#fbbf24',
      marginTop: '0.5rem'
    },
    hiddenInput: {
      position: 'absolute' as const,
      opacity: 0,
      pointerEvents: 'none' as const
    },
    statsRow: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '1.5rem'
    },
    statCard: {
      flex: 1,
      background: cardBg,
      borderRadius: '12px',
      padding: '1rem',
      textAlign: 'center' as const,
      border: `1px solid ${borderColor}`
    },
    statValue: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#fbbf24'
    },
    statLabel: {
      fontSize: '0.75rem',
      color: mutedColor,
      marginTop: '0.25rem'
    },
    manualEntry: {
      background: cardBg,
      borderRadius: '12px',
      padding: '1rem',
      border: `1px solid ${borderColor}`
    },
    manualInput: {
      width: '100%',
      padding: '0.75rem 1rem',
      borderRadius: '10px',
      border: `1px solid ${borderColor}`,
      background: inputBg,
      color: textColor,
      fontSize: '1rem',
      marginBottom: '0.75rem',
      boxSizing: 'border-box' as const,
      fontFamily: 'monospace'
    },
    instructions: {
      background: cardBg,
      borderRadius: '12px',
      padding: '1rem',
      marginTop: '1rem',
      border: `1px solid ${borderColor}`
    },
    instructionTitle: {
      fontSize: '0.875rem',
      fontWeight: 600,
      color: textColor,
      margin: '0 0 0.5rem'
    },
    instructionList: {
      margin: 0,
      padding: '0 0 0 1.25rem',
      color: mutedColor,
      fontSize: '0.75rem',
      lineHeight: 1.8
    }
  };

  return (
    <div style={styles.container}>
      {/* Hidden input for scanner */}
      <input
        ref={inputRef}
        type="text"
        style={styles.hiddenInput}
        onKeyDown={handleKeyDown}
        autoFocus
      />

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎟️ Ticket Scanner</h1>
        <p style={styles.subtitle}>{eventTitle}</p>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{scanCount}</div>
          <div style={styles.statLabel}>Scanned This Session</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats?.total || '—'}</div>
          <div style={styles.statLabel}>Total Tickets Sold</div>
        </div>
      </div>

      {/* Scan Area */}
      <div style={styles.scanArea} onClick={() => inputRef.current?.focus()}>
        <div style={styles.scanIcon}>
          {getResultIcon()}
        </div>
        
        <div style={styles.scanMessage}>
          {scanResult === 'idle' && 'Ready to Scan'}
          {scanResult === 'scanning' && 'Scanning...'}
          {scanResult === 'valid' && 'VALID ✓'}
          {scanResult === 'already_used' && 'ALREADY USED'}
          {scanResult === 'invalid' && 'INVALID'}
          {scanResult === 'expired' && 'EXPIRED'}
        </div>

        {message && (
          <div style={styles.ticketInfo}>{message}</div>
        )}

        {lastTicket && (
          <>
            <div style={styles.ticketInfo}>{lastTicket.ownerName}</div>
            <div style={styles.ticketNumber}>{lastTicket.ticketNumber}</div>
          </>
        )}

        {scanResult === 'idle' && (
          <p style={{ color: mutedColor, fontSize: '0.875rem', marginTop: '1rem' }}>
            Point barcode scanner at ticket QR code
          </p>
        )}
      </div>

      {/* Manual Entry Toggle */}
      <Button 
        variant="outline" 
        style={{ width: '100%', marginBottom: '1rem' }}
        onClick={() => setShowManualEntry(!showManualEntry)}
      >
        {showManualEntry ? '✗ Cancel Manual Entry' : '⌨️ Enter Code Manually'}
      </Button>

      {/* Manual Entry */}
      {showManualEntry && (
        <div style={styles.manualEntry}>
          <p style={{ fontSize: '0.875rem', color: mutedColor, margin: '0 0 0.75rem' }}>
            Enter the ticket number (e.g., OSYS-XXXX-XXXX)
          </p>
          <input
            type="text"
            style={styles.manualInput}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="OSYS-XXXX-XXXX"
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          />
          <Button 
            variant="gold" 
            style={{ width: '100%' }}
            onClick={handleManualSubmit}
            disabled={!manualCode.trim() || isProcessing}
          >
            Verify Ticket
          </Button>
        </div>
      )}

      {/* Instructions */}
      <div style={styles.instructions}>
        <h3 style={styles.instructionTitle}>📋 Scanner Instructions</h3>
        <ol style={styles.instructionList}>
          <li>Keep this page open and focused</li>
          <li>Use a USB/Bluetooth barcode scanner</li>
          <li>Point scanner at ticket QR code</li>
          <li>Green = Let them in, Red/Yellow = Check with manager</li>
        </ol>
      </div>

      {/* Scanner Info */}
      <p style={{ fontSize: '0.75rem', color: mutedColor, textAlign: 'center', marginTop: '1rem' }}>
        Scanner: {scannerName}
      </p>
    </div>
  );
};

export default TicketScanner;
