/**
 * PromoCodeManager - Commissioner UI for managing promo/discount codes
 * 
 * Features:
 * - Create new codes (multi-use, limited, single-use)
 * - Discount types: free, percentage, fixed amount
 * - Toggle codes on/off
 * - Edit/delete codes
 * - View usage history
 * - Bulk generate single-use codes
 */

import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Power,
  Copy,
  Check,
  X,
  Percent,
  DollarSign,
  Gift,
  Users,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Download
} from 'lucide-react';
import { Button, Badge, GlassCard } from '../ui/OSYSComponents';
import { OSYSInput, OSYSSelect, OSYSTextarea, OSYSModal } from '../ui/OSYSFormElements';
import { toastSuccess, toastError, toastInfo } from '../../services/toast';
import { useAuth } from '../../contexts/AuthContext';
import { PromoCode } from '../../types';
import {
  getAllPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  togglePromoCodeActive,
  generateBulkSingleUseCodes,
  formatDiscount,
  getCodeStatus,
  CreatePromoCodeData
} from '../../services/promoCodeService';

interface PromoCodeManagerProps {
  programId: string;
}

const PromoCodeManager: React.FC<PromoCodeManagerProps> = ({ programId }) => {
  const { user } = useAuth();
  
  // State
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreatePromoCodeData>({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    usageType: 'unlimited',
    maxUses: 100,
    startDate: '',
    expirationDate: ''
  });
  
  // Bulk form state
  const [bulkData, setBulkData] = useState({
    prefix: '',
    count: 10,
    discountType: 'free' as 'percentage' | 'fixed' | 'free',
    discountValue: 100,
    name: 'One-Time Code'
  });
  
  const [saving, setSaving] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  // Load codes
  useEffect(() => {
    loadCodes();
  }, [programId]);

  const loadCodes = async () => {
    try {
      setLoading(true);
      const allCodes = await getAllPromoCodes(programId);
      setCodes(allCodes);
    } catch (error) {
      console.error('Error loading promo codes:', error);
      toastError('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCode = async () => {
    if (!formData.code || !formData.name) {
      toastError('Please fill in code and name');
      return;
    }

    setSaving(true);
    try {
      await createPromoCode(programId, formData, user?.uid || '');
      toastSuccess('Promo code created!');
      setShowCreateModal(false);
      resetForm();
      loadCodes();
    } catch (error: any) {
      toastError(error.message || 'Failed to create code');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCode = async () => {
    if (!editingCode) return;

    setSaving(true);
    try {
      await updatePromoCode(programId, editingCode.id, {
        name: formData.name,
        description: formData.description,
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        usageType: formData.usageType,
        maxUses: formData.maxUses,
        startDate: formData.startDate,
        expirationDate: formData.expirationDate
      });
      toastSuccess('Promo code updated!');
      setEditingCode(null);
      resetForm();
      loadCodes();
    } catch (error) {
      toastError('Failed to update code');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!confirm('Are you sure you want to delete this promo code?')) return;

    try {
      await deletePromoCode(programId, codeId);
      toastSuccess('Promo code deleted');
      loadCodes();
    } catch (error) {
      toastError('Failed to delete code');
    }
  };

  const handleToggleActive = async (code: PromoCode) => {
    try {
      await togglePromoCodeActive(programId, code.id, !code.isActive);
      toastSuccess(code.isActive ? 'Code deactivated' : 'Code activated');
      loadCodes();
    } catch (error) {
      toastError('Failed to toggle code');
    }
  };

  const handleBulkGenerate = async () => {
    if (!bulkData.name || bulkData.count < 1) {
      toastError('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      const generated = await generateBulkSingleUseCodes(
        programId,
        bulkData,
        user?.uid || ''
      );
      setGeneratedCodes(generated);
      toastSuccess(`Generated ${generated.length} codes!`);
      loadCodes();
    } catch (error) {
      toastError('Failed to generate codes');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toastInfo('Code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const exportCodes = () => {
    const csv = generatedCodes.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'promo-codes.csv';
    a.click();
    URL.revokeObjectURL(url);
    toastSuccess('Codes exported!');
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: 10,
      usageType: 'unlimited',
      maxUses: 100,
      startDate: '',
      expirationDate: ''
    });
  };

  const openEditModal = (code: PromoCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      name: code.name,
      description: code.description || '',
      discountType: code.discountType,
      discountValue: code.discountValue,
      usageType: code.usageType,
      maxUses: code.maxUses || 100,
      startDate: code.startDate || '',
      expirationDate: code.expirationDate || ''
    });
  };

  const getStatusBadge = (code: PromoCode) => {
    const status = getCodeStatus(code);
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'inactive':
        return <Badge variant="default">Inactive</Badge>;
      case 'expired':
        return <Badge variant="warning">Expired</Badge>;
      case 'exhausted':
        return <Badge variant="error">Used Up</Badge>;
    }
  };

  const getDiscountIcon = (type: string) => {
    switch (type) {
      case 'free':
        return <Gift className="w-4 h-4" />;
      case 'percentage':
        return <Percent className="w-4 h-4" />;
      case 'fixed':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const getUsageDisplay = (code: PromoCode) => {
    if (code.usageType === 'unlimited') {
      return `${code.usedCount} uses (unlimited)`;
    } else if (code.usageType === 'single') {
      return code.usedCount >= 1 ? 'Used' : 'Single use';
    } else {
      return `${code.usedCount} / ${code.maxUses} uses`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-purple-400" />
            Promo Codes
          </h2>
          <p className="text-slate-400 text-sm">
            Create and manage discount codes for all registrations
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowBulkModal(true)}>
            <Zap className="w-4 h-4 mr-2" />
            Bulk Generate
          </Button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Code
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-white">{codes.length}</p>
          <p className="text-xs text-slate-400">Total Codes</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">
            {codes.filter(c => getCodeStatus(c) === 'active').length}
          </p>
          <p className="text-xs text-slate-400">Active</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">
            {codes.reduce((sum, c) => sum + c.usedCount, 0)}
          </p>
          <p className="text-xs text-slate-400">Total Uses</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">
            {codes.filter(c => c.usageType === 'single').length}
          </p>
          <p className="text-xs text-slate-400">One-Time Codes</p>
        </GlassCard>
      </div>

      {/* Codes List */}
      {codes.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Tag className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Promo Codes Yet</h3>
          <p className="text-slate-400 mb-4">Create your first promo code to offer discounts on registrations</p>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Code
          </Button>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {codes.map(code => (
            <GlassCard key={code.id} className="overflow-hidden">
              {/* Main Row */}
              <div 
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedCode(expandedCode === code.id ? null : code.id)}
              >
                {/* Discount Type Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  code.discountType === 'free' ? 'bg-emerald-500/20 text-emerald-400' :
                  code.discountType === 'percentage' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {getDiscountIcon(code.discountType)}
                </div>

                {/* Code Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-white text-lg">{code.code}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyCode(code.code); }}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      {copiedCode === code.code ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 truncate">{code.name}</p>
                </div>

                {/* Discount Display */}
                <div className="text-right hidden sm:block">
                  <p className={`font-bold ${
                    code.discountType === 'free' ? 'text-emerald-400' : 'text-white'
                  }`}>
                    {formatDiscount(code)}
                  </p>
                  <p className="text-xs text-slate-500">{getUsageDisplay(code)}</p>
                </div>

                {/* Status */}
                <div className="hidden md:block">
                  {getStatusBadge(code)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(code); }}
                    className={`p-2 rounded-lg transition-colors ${
                      code.isActive 
                        ? 'hover:bg-red-500/20 text-emerald-400 hover:text-red-400' 
                        : 'hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400'
                    }`}
                    title={code.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(code); }}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCode(code.id); }}
                    className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedCode === code.id ? (
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedCode === code.id && (
                <div className="px-4 pb-4 pt-2 border-t border-white/10 bg-black/20">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Discount</p>
                      <p className="text-white">{formatDiscount(code)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Usage Type</p>
                      <p className="text-white capitalize">{code.usageType}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Times Used</p>
                      <p className="text-white">{code.usedCount}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Status</p>
                      {getStatusBadge(code)}
                    </div>
                    {code.startDate && (
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Valid From</p>
                        <p className="text-white">{code.startDate}</p>
                      </div>
                    )}
                    {code.expirationDate && (
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Expires</p>
                        <p className="text-white">{code.expirationDate}</p>
                      </div>
                    )}
                    {code.description && (
                      <div className="col-span-2">
                        <p className="text-slate-500 text-xs mb-1">Notes</p>
                        <p className="text-slate-300">{code.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <OSYSModal
        isOpen={showCreateModal || !!editingCode}
        onClose={() => { setShowCreateModal(false); setEditingCode(null); resetForm(); }}
        title={editingCode ? 'Edit Promo Code' : 'Create Promo Code'}
      >
        <div className="space-y-4">
          {/* Code Input - only editable on create */}
          {!editingCode && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                placeholder="e.g., SPRING25, FREEKIDS"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono uppercase placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                maxLength={20}
              />
              <p className="text-xs text-slate-500 mt-1">Letters and numbers only, auto-capitalized</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Spring 25% Off"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
          </div>

          {/* Discount Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Discount Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'free', label: 'Free', icon: Gift, color: 'emerald' },
                { value: 'percentage', label: '% Off', icon: Percent, color: 'purple' },
                { value: 'fixed', label: '$ Off', icon: DollarSign, color: 'amber' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ 
                    ...formData, 
                    discountType: opt.value as any,
                    discountValue: opt.value === 'free' ? 100 : formData.discountValue
                  })}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                    formData.discountType === opt.value
                      ? `bg-${opt.color}-500/20 border-${opt.color}-500 text-${opt.color}-400`
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <opt.icon className="w-5 h-5" />
                  <span className="text-sm">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Discount Value - only for percentage and fixed */}
          {formData.discountType !== 'free' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {formData.discountType === 'percentage' ? 'Percentage Off' : 'Amount Off ($)'}
              </label>
              <div className="relative">
                {formData.discountType === 'percentage' && (
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                )}
                {formData.discountType === 'fixed' && (
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                )}
                <input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                  min={1}
                  max={formData.discountType === 'percentage' ? 100 : undefined}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* Usage Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Usage Limit
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'unlimited', label: 'Unlimited', desc: 'No limit' },
                { value: 'limited', label: 'Limited', desc: 'Set max uses' },
                { value: 'single', label: 'One-Time', desc: 'Single use' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, usageType: opt.value as any })}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    formData.usageType === opt.value
                      ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs text-slate-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Max Uses - only for limited */}
          {formData.usageType === 'limited' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Max Uses
              </label>
              <input
                type="number"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: Number(e.target.value) })}
                min={1}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              />
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Start Date (optional)
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Expiration Date (optional)
              </label>
              <input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Internal Notes (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., For board members only"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => { setShowCreateModal(false); setEditingCode(null); resetForm(); }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={editingCode ? handleUpdateCode : handleCreateCode}
              disabled={saving}
              className="flex-1"
            >
              {saving ? 'Saving...' : editingCode ? 'Update Code' : 'Create Code'}
            </Button>
          </div>
        </div>
      </OSYSModal>

      {/* Bulk Generate Modal */}
      <OSYSModal
        isOpen={showBulkModal}
        onClose={() => { setShowBulkModal(false); setGeneratedCodes([]); }}
        title="Bulk Generate One-Time Codes"
      >
        <div className="space-y-4">
          {generatedCodes.length === 0 ? (
            <>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-purple-400 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Generate Multiple Single-Use Codes</p>
                    <p className="text-sm text-slate-400">
                      Perfect for giveaways, sponsor packages, or board members. Each code can only be used once.
                    </p>
                  </div>
                </div>
              </div>

              {/* Name/Label */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Code Label
                </label>
                <input
                  type="text"
                  value={bulkData.name}
                  onChange={(e) => setBulkData({ ...bulkData, name: e.target.value })}
                  placeholder="e.g., Board Member Code"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>

              {/* Prefix */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Code Prefix (optional)
                </label>
                <input
                  type="text"
                  value={bulkData.prefix}
                  onChange={(e) => setBulkData({ ...bulkData, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  placeholder="e.g., VIP"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono uppercase placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  maxLength={6}
                />
                <p className="text-xs text-slate-500 mt-1">Codes will be like: VIP4X8K2M</p>
              </div>

              {/* Count */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  How Many Codes?
                </label>
                <input
                  type="number"
                  value={bulkData.count}
                  onChange={(e) => setBulkData({ ...bulkData, count: Number(e.target.value) })}
                  min={1}
                  max={100}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                />
              </div>

              {/* Discount Type for Bulk */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Discount
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'free', label: 'Free', icon: Gift },
                    { value: 'percentage', label: '% Off', icon: Percent },
                    { value: 'fixed', label: '$ Off', icon: DollarSign }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBulkData({ 
                        ...bulkData, 
                        discountType: opt.value as any,
                        discountValue: opt.value === 'free' ? 100 : bulkData.discountValue
                      })}
                      className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                        bulkData.discountType === opt.value
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <opt.icon className="w-5 h-5" />
                      <span className="text-sm">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {bulkData.discountType !== 'free' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {bulkData.discountType === 'percentage' ? 'Percentage Off' : 'Amount Off ($)'}
                  </label>
                  <input
                    type="number"
                    value={bulkData.discountValue}
                    onChange={(e) => setBulkData({ ...bulkData, discountValue: Number(e.target.value) })}
                    min={1}
                    max={bulkData.discountType === 'percentage' ? 100 : undefined}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBulkGenerate}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Generating...' : `Generate ${bulkData.count} Codes`}
                </Button>
              </div>
            </>
          ) : (
            /* Generated Codes Display */
            <>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Generated {generatedCodes.length} codes!</span>
                </div>
              </div>

              <div className="bg-black/30 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {generatedCodes.map((code, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white/5 rounded px-3 py-2"
                    >
                      <span className="font-mono text-white text-sm">{code}</span>
                      <button
                        onClick={() => copyCode(code)}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        {copiedCode === code ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={exportCodes}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="primary"
                  onClick={() => { setShowBulkModal(false); setGeneratedCodes([]); }}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </OSYSModal>
    </div>
  );
};

export default PromoCodeManager;
