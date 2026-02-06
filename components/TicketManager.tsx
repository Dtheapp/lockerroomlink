// Ticket Manager Component
// ========================
// For coaches to set up and manage ticket sales for events

import React, { useState, useEffect } from 'react';
import { GlassCard, Button, Badge } from './ui/OSYSComponents';
import { 
  getTicketConfig, 
  saveTicketConfig, 
  getTicketSalesSummary,
  formatTicketPrice 
} from '../services/tickets';
import { TicketConfig } from '../types/tickets';
import { Timestamp } from 'firebase/firestore';

interface TicketManagerProps {
  teamId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  userId: string;
  theme?: 'light' | 'dark';
  onClose?: () => void;
}

export const TicketManager: React.FC<TicketManagerProps> = ({
  teamId,
  eventId,
  eventTitle,
  eventDate,
  userId,
  theme = 'dark',
  onClose
}) => {
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Partial<TicketConfig> | null>(null);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [price, setPrice] = useState('10.00');
  const [totalCapacity, setTotalCapacity] = useState('100');
  const [reservedCount, setReservedCount] = useState('0');
  const [maxPerOrder, setMaxPerOrder] = useState('10');
  const [showRemaining, setShowRemaining] = useState(true);

  // Theme styles
  const isDark = theme === 'dark';
  const textColor = isDark ? '#fff' : '#1a1a2e';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(26, 26, 46, 0.2)';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';

  // Load existing config
  useEffect(() => {
    loadConfig();
  }, [eventId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const existingConfig = await getTicketConfig(eventId);
      if (existingConfig) {
        setConfig(existingConfig);
        setEnabled(existingConfig.enabled);
        setPrice((existingConfig.price / 100).toFixed(2));
        setTotalCapacity(existingConfig.totalCapacity.toString());
        setReservedCount((existingConfig.reservedCount || 0).toString());
        setMaxPerOrder((existingConfig.maxPerOrder || 10).toString());
        setShowRemaining(existingConfig.showRemainingCount !== false);
      }

      // Load sales summary
      const summary = await getTicketSalesSummary(eventId);
      setSalesSummary(summary);
    } catch (err) {
      console.error('Error loading ticket config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    // Validate
    const priceNum = parseFloat(price);
    const capacityNum = parseInt(totalCapacity);
    const reservedNum = parseInt(reservedCount);
    const maxOrderNum = parseInt(maxPerOrder);

    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid price');
      setSaving(false);
      return;
    }

    if (isNaN(capacityNum) || capacityNum < 1) {
      setError('Please enter a valid capacity');
      setSaving(false);
      return;
    }

    if (reservedNum >= capacityNum) {
      setError('Reserved tickets must be less than total capacity');
      setSaving(false);
      return;
    }

    try {
      await saveTicketConfig(teamId, eventId, {
        enabled,
        price: Math.round(priceNum * 100), // Convert to cents
        totalCapacity: capacityNum,
        reservedCount: reservedNum,
        maxPerOrder: maxOrderNum,
        showRemainingCount: showRemaining,
        salesStartDate: Timestamp.now(), // Could add date picker
        salesEndDate: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)), // 1 year
      }, userId);

      setSuccess('Ticket settings saved!');
      await loadConfig();
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      padding: '1.5rem',
      maxWidth: '600px',
      margin: '0 auto'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '1.5rem'
    },
    title: {
      margin: 0,
      fontSize: '1.5rem',
      fontWeight: 700,
      color: textColor
    },
    subtitle: {
      margin: '0.25rem 0 0',
      fontSize: '0.875rem',
      color: mutedColor
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      fontSize: '1.5rem',
      cursor: 'pointer',
      color: mutedColor,
      padding: 0
    },
    section: {
      marginBottom: '1.5rem'
    },
    sectionTitle: {
      fontSize: '1rem',
      fontWeight: 600,
      color: textColor,
      margin: '0 0 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1rem',
      marginBottom: '1.5rem'
    },
    statCard: {
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
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: 500,
      color: textColor,
      marginBottom: '0.5rem'
    },
    input: {
      width: '100%',
      padding: '0.75rem 1rem',
      borderRadius: '10px',
      border: `1px solid ${borderColor}`,
      background: inputBg,
      color: textColor,
      fontSize: '1rem',
      outline: 'none',
      boxSizing: 'border-box'
    },
    inputGroup: {
      marginBottom: '1rem'
    },
    inputRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem'
    },
    toggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '1rem',
      background: cardBg,
      borderRadius: '12px',
      cursor: 'pointer',
      border: `1px solid ${borderColor}`,
      marginBottom: '1rem'
    },
    toggleSwitch: {
      width: '48px',
      height: '28px',
      borderRadius: '14px',
      background: enabled ? '#fbbf24' : borderColor,
      position: 'relative' as const,
      transition: 'background 0.2s'
    },
    toggleKnob: {
      width: '24px',
      height: '24px',
      borderRadius: '12px',
      background: '#fff',
      position: 'absolute' as const,
      top: '2px',
      left: enabled ? '22px' : '2px',
      transition: 'left 0.2s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    },
    checkbox: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 0',
      cursor: 'pointer'
    },
    checkboxInput: {
      width: '20px',
      height: '20px',
      accentColor: '#fbbf24'
    },
    error: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      color: '#ef4444',
      fontSize: '0.875rem',
      marginBottom: '1rem'
    },
    success: {
      background: 'rgba(16, 185, 129, 0.1)',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      color: '#10b981',
      fontSize: '0.875rem',
      marginBottom: '1rem'
    },
    buttonRow: {
      display: 'flex',
      gap: '0.75rem',
      marginTop: '1.5rem'
    },
    helpText: {
      fontSize: '0.75rem',
      color: mutedColor,
      marginTop: '0.25rem'
    },
    revenueBreakdown: {
      background: cardBg,
      borderRadius: '12px',
      padding: '1rem',
      border: `1px solid ${borderColor}`
    },
    revenueRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.5rem 0',
      borderBottom: `1px solid ${borderColor}`
    },
    revenueTotal: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.75rem 0 0',
      fontWeight: 600
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '2rem', color: mutedColor }}>
          Loading ticket settings...
        </div>
      </div>
    );
  }

  const availableTickets = parseInt(totalCapacity || '0') - parseInt(reservedCount || '0') - (salesSummary?.ticketsSold || 0);
  const previewFee = Math.round(parseFloat(price || '0') * 100 * 0.05) + 50;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🎟️ Ticket Settings</h2>
          <p style={styles.subtitle}>{eventTitle}</p>
        </div>
        {onClose && (
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        )}
      </div>

      {/* Sales Summary (if tickets have been sold) */}
      {salesSummary && salesSummary.ticketsSold > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📊 Sales Overview</h3>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{salesSummary.ticketsSold}</div>
              <div style={styles.statLabel}>Tickets Sold</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{formatTicketPrice(salesSummary.netRevenue)}</div>
              <div style={styles.statLabel}>Your Revenue</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{salesSummary.percentSold}%</div>
              <div style={styles.statLabel}>Sold</div>
            </div>
          </div>

          <div style={styles.revenueBreakdown}>
            <div style={styles.revenueRow}>
              <span style={{ color: mutedColor }}>Gross Sales</span>
              <span style={{ color: textColor }}>{formatTicketPrice(salesSummary.totalRevenue)}</span>
            </div>
            <div style={styles.revenueRow}>
              <span style={{ color: mutedColor }}>Platform Fees (5% + $0.50/ticket)</span>
              <span style={{ color: '#ef4444' }}>-{formatTicketPrice(salesSummary.platformFees)}</span>
            </div>
            <div style={styles.revenueTotal}>
              <span style={{ color: textColor }}>Your Payout</span>
              <span style={{ color: '#10b981' }}>{formatTicketPrice(salesSummary.netRevenue)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div style={styles.toggle} onClick={() => setEnabled(!enabled)}>
        <div style={styles.toggleSwitch}>
          <div style={styles.toggleKnob} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: textColor }}>
            {enabled ? '✅ Ticket Sales Enabled' : '⭕ Ticket Sales Disabled'}
          </div>
          <div style={{ fontSize: '0.75rem', color: mutedColor }}>
            {enabled ? 'Fans can purchase tickets' : 'Enable to start selling tickets'}
          </div>
        </div>
      </div>

      {error && <div style={styles.error}>⚠️ {error}</div>}
      {success && <div style={styles.success}>✓ {success}</div>}

      {/* Pricing */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>💰 Pricing</h3>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>Ticket Price ($)</label>
          <input
            type="number"
            style={styles.input}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="10.00"
            min="0"
            step="0.01"
          />
          <p style={styles.helpText}>
            Buyer pays: {formatTicketPrice(Math.round(parseFloat(price || '0') * 100) + previewFee)} 
            (includes {formatTicketPrice(previewFee)} processing fee)
          </p>
        </div>
      </div>

      {/* Capacity */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🎫 Capacity</h3>
        
        <div style={styles.inputRow}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Total Tickets</label>
            <input
              type="number"
              style={styles.input}
              value={totalCapacity}
              onChange={(e) => setTotalCapacity(e.target.value)}
              placeholder="100"
              min="1"
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Reserved (Team/Sponsors)</label>
            <input
              type="number"
              style={styles.input}
              value={reservedCount}
              onChange={(e) => setReservedCount(e.target.value)}
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        <div style={{ ...styles.statCard, marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: mutedColor }}>Available for sale:</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: availableTickets > 0 ? '#10b981' : '#ef4444' }}>
            {availableTickets} tickets
          </div>
        </div>
      </div>

      {/* Options */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>⚙️ Options</h3>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>Max Tickets Per Order</label>
          <input
            type="number"
            style={styles.input}
            value={maxPerOrder}
            onChange={(e) => setMaxPerOrder(e.target.value)}
            placeholder="10"
            min="1"
            max="50"
          />
        </div>

        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={showRemaining}
            onChange={(e) => setShowRemaining(e.target.checked)}
            style={styles.checkboxInput}
          />
          <span style={{ color: textColor }}>Show remaining ticket count to buyers</span>
        </label>
      </div>

      {/* Actions */}
      <div style={styles.buttonRow}>
        {onClose && (
          <Button variant="outline" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button 
          variant="gold" 
          style={{ flex: 2 }} 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Preview Link */}
      {enabled && config?.id && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: mutedColor, marginBottom: '0.5rem' }}>
            Share this link to sell tickets:
          </p>
          <code style={{ 
            background: cardBg, 
            padding: '0.5rem 1rem', 
            borderRadius: '8px', 
            fontSize: '0.75rem',
            color: '#fbbf24',
            wordBreak: 'break-all'
          }}>
            https://osys.team/event/{eventId}/tickets
          </code>
        </div>
      )}
    </div>
  );
};

export default TicketManager;
