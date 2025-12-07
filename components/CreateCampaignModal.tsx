// =============================================================================
// CREATE CAMPAIGN MODAL
// =============================================================================
// Zero-fee fundraising for teams and athletes

import React, { useState, useCallback } from 'react';
import { X, Upload, ChevronRight, ChevronLeft, Check, AlertCircle, DollarSign, Target, Calendar, Image } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createCampaign, uploadCampaignImage } from '../services/fundraising';
import { CreateCampaignRequest, CampaignCategory, CampaignType } from '../types/fundraising';
import { GlassPanel, Button, Badge } from './ui/OSYSComponents';
import { showToast } from '../services/toast';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (campaignId: string) => void;
  preselectedType?: CampaignType;
  teamId?: string;
  teamName?: string;
  teamLogo?: string;
  athleteId?: string;
  athleteName?: string;
  athletePhoto?: string;
  sport?: string;
}

type Step = 'type' | 'basics' | 'story' | 'goal' | 'payment' | 'review';

const CATEGORY_OPTIONS: { value: CampaignCategory; label: string; icon: string }[] = [
  { value: 'tournament', label: 'Tournament/Competition', icon: '🏆' },
  { value: 'equipment', label: 'Equipment & Gear', icon: '🎒' },
  { value: 'travel', label: 'Travel Expenses', icon: '✈️' },
  { value: 'training', label: 'Training & Camps', icon: '💪' },
  { value: 'uniforms', label: 'Uniforms & Apparel', icon: '👕' },
  { value: 'facility', label: 'Facility & Fields', icon: '🏟️' },
  { value: 'scholarship', label: 'Scholarship Fund', icon: '🎓' },
  { value: 'nil', label: 'NIL Support', icon: '💰' },
  { value: 'other', label: 'Other', icon: '📋' },
];

const SUGGESTED_AMOUNTS_PRESETS = [
  { label: 'Small Campaign', amounts: [500, 1000, 2500, 5000] },
  { label: 'Medium Campaign', amounts: [1000, 2500, 5000, 10000] },
  { label: 'Large Campaign', amounts: [2500, 5000, 10000, 25000] },
];

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedType,
  teamId,
  teamName,
  teamLogo,
  athleteId,
  athleteName,
  athletePhoto,
  sport = 'Sports'
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(preselectedType ? 'basics' : 'type');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<{
    type: CampaignType;
    title: string;
    description: string;
    story: string;
    category: CampaignCategory;
    goalAmount: number; // In dollars for form, converted to cents on submit
    endDate: string;
    paypalEmail: string;
    suggestedAmounts: number[]; // In cents
  }>({
    type: preselectedType || 'team',
    title: '',
    description: '',
    story: '',
    category: 'tournament',
    goalAmount: 5000,
    endDate: '',
    paypalEmail: '',
    suggestedAmounts: [500, 1000, 2500, 5000, 10000]
  });

  const steps: Step[] = ['type', 'basics', 'story', 'goal', 'payment', 'review'];
  const stepIndex = steps.indexOf(currentStep);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1]);
    }
  };

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be under 5MB', 'error');
        return;
      }
      setCoverImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setCoverImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'type':
        return true;
      case 'basics':
        return formData.title.trim().length >= 10 && formData.description.trim().length >= 20;
      case 'story':
        return formData.story.trim().length >= 50;
      case 'goal':
        return formData.goalAmount >= 100 && formData.goalAmount <= 1000000;
      case 'payment':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.paypalEmail);
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      showToast('Please sign in to create a campaign', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const request: CreateCampaignRequest = {
        type: formData.type,
        teamId: formData.type === 'team' ? teamId : undefined,
        athleteId: formData.type === 'athlete' ? athleteId : undefined,
        title: formData.title.trim(),
        description: formData.description.trim(),
        story: formData.story.trim(),
        category: formData.category,
        goalAmount: Math.round(formData.goalAmount * 100), // Convert to cents
        paypalEmail: formData.paypalEmail.trim(),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        suggestedAmounts: formData.suggestedAmounts
      };

      const campaign = await createCampaign(request, user.uid, {
        teamName: formData.type === 'team' ? teamName : undefined,
        teamLogo: formData.type === 'team' ? teamLogo : undefined,
        athleteName: formData.type === 'athlete' ? athleteName : undefined,
        athletePhoto: formData.type === 'athlete' ? athletePhoto : undefined,
        sport
      });

      // Upload cover image if provided
      if (coverImageFile && campaign.id) {
        const imageUrl = await uploadCampaignImage(campaign.id, coverImageFile);
        // Note: We'd need to update the campaign with the image URL
        // For now, we can handle this in the create function or do a follow-up update
      }

      showToast('Campaign created successfully! 🎉', 'success');
      onSuccess?.(campaign.id);
      onClose();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      showToast('Failed to create campaign. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.filter(s => !preselectedType || s !== 'type').map((step, i) => {
        const actualIndex = preselectedType ? i + 1 : i;
        const isActive = stepIndex === actualIndex;
        const isPast = stepIndex > actualIndex;
        
        return (
          <React.Fragment key={step}>
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                isPast 
                  ? 'bg-emerald-500 text-white' 
                  : isActive 
                    ? 'bg-purple-600 text-white ring-4 ring-purple-600/30' 
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
              }`}
            >
              {isPast ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < steps.length - 2 && (
              <div className={`w-8 h-0.5 ${isPast ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 'type':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Who is this campaign for?</h3>
              <p className="text-zinc-500 dark:text-slate-400">Choose whether you're raising funds for a team or an individual athlete.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setFormData(d => ({ ...d, type: 'team' })); handleNext(); }}
                className={`p-6 rounded-xl border-2 transition-all text-left ${
                  formData.type === 'team' 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                }`}
              >
                <div className="text-4xl mb-3">👥</div>
                <div className="font-bold text-lg">Team Campaign</div>
                <p className="text-sm text-zinc-500 dark:text-slate-400 mt-1">
                  Raise funds for tournaments, equipment, travel, or team needs
                </p>
              </button>
              
              <button
                onClick={() => { setFormData(d => ({ ...d, type: 'athlete' })); handleNext(); }}
                className={`p-6 rounded-xl border-2 transition-all text-left ${
                  formData.type === 'athlete' 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                }`}
              >
                <div className="text-4xl mb-3">🏃</div>
                <div className="font-bold text-lg">Athlete Campaign</div>
                <p className="text-sm text-zinc-500 dark:text-slate-400 mt-1">
                  Support an individual athlete's training, camps, or competitions
                </p>
              </button>
            </div>
          </div>
        );

      case 'basics':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Campaign Basics</h3>
              <p className="text-zinc-500 dark:text-slate-400">Give your campaign a catchy title and brief description.</p>
            </div>

            {/* Cover Image */}
            <div>
              <label className="text-sm font-medium block mb-2">Cover Image</label>
              <div 
                className={`relative h-48 rounded-xl border-2 border-dashed transition-colors ${
                  coverImagePreview 
                    ? 'border-purple-500' 
                    : 'border-zinc-300 dark:border-zinc-600 hover:border-purple-400'
                } overflow-hidden`}
              >
                {coverImagePreview ? (
                  <>
                    <img src={coverImagePreview} alt="Cover" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); }}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                    <Image className="w-12 h-12 text-zinc-400 mb-2" />
                    <span className="text-sm text-zinc-500">Click to upload cover image</span>
                    <span className="text-xs text-zinc-400 mt-1">Recommended: 1200x630px</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-medium block mb-2">Campaign Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(d => ({ ...d, title: e.target.value }))}
                placeholder="e.g., Help Us Get to Nationals! 🏆"
                maxLength={100}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-zinc-900 dark:text-white"
              />
              <span className="text-xs text-zinc-400 mt-1 block">{formData.title.length}/100 characters (min 10)</span>
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium block mb-2">Category *</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_OPTIONS.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setFormData(d => ({ ...d, category: cat.value }))}
                    className={`p-3 rounded-lg border transition-all text-left ${
                      formData.category === cat.value
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                    }`}
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <div className="text-xs font-medium mt-1 truncate">{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Short Description */}
            <div>
              <label className="text-sm font-medium block mb-2">Short Description *</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                placeholder="A brief summary that appears in campaign previews..."
                rows={3}
                maxLength={300}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-zinc-900 dark:text-white resize-none"
              />
              <span className="text-xs text-zinc-400 mt-1 block">{formData.description.length}/300 characters (min 20)</span>
            </div>
          </div>
        );

      case 'story':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Tell Your Story</h3>
              <p className="text-zinc-500 dark:text-slate-400">Share why this campaign matters. Be personal and specific!</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div className="text-sm">
                  <div className="font-bold text-amber-800 dark:text-amber-300">Tips for a great story:</div>
                  <ul className="text-amber-700 dark:text-amber-400 mt-1 space-y-1">
                    <li>• Share who you are and your athletic journey</li>
                    <li>• Explain exactly what the funds will be used for</li>
                    <li>• Include specific goals or achievements you're working toward</li>
                    <li>• Make it personal - donors connect with real stories!</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Your Story *</label>
              <textarea
                value={formData.story}
                onChange={e => setFormData(d => ({ ...d, story: e.target.value }))}
                placeholder={`Hi, I'm [name] and I've been playing [sport] for [X] years...

Our team has qualified for [tournament/event] and we need help covering [expenses]. 

This opportunity means so much to us because...

The funds will go toward:
• [Specific item/expense]
• [Specific item/expense]
• [Specific item/expense]

Every donation, no matter the size, brings us closer to our dream! 🙏`}
                rows={12}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-zinc-900 dark:text-white resize-none"
              />
              <span className="text-xs text-zinc-400 mt-1 block">{formData.story.length} characters (min 50)</span>
            </div>
          </div>
        );

      case 'goal':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Set Your Goal</h3>
              <p className="text-zinc-500 dark:text-slate-400">How much do you need to raise?</p>
            </div>

            {/* Goal Amount */}
            <div>
              <label className="text-sm font-medium block mb-2">Fundraising Goal *</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="number"
                  value={formData.goalAmount}
                  onChange={e => setFormData(d => ({ ...d, goalAmount: Math.max(0, parseInt(e.target.value) || 0) }))}
                  min={100}
                  max={1000000}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-12 pr-4 py-4 text-2xl font-bold text-zinc-900 dark:text-white"
                />
              </div>
              <span className="text-xs text-zinc-400 mt-1 block">Minimum: $100 • Maximum: $1,000,000</span>
            </div>

            {/* End Date (Optional) */}
            <div>
              <label className="text-sm font-medium block mb-2">
                End Date <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData(d => ({ ...d, endDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-12 pr-4 py-3 text-zinc-900 dark:text-white [&::-webkit-calendar-picker-indicator]:dark:invert"
                />
              </div>
              <span className="text-xs text-zinc-400 mt-1 block">Leave empty for no deadline</span>
            </div>

            {/* Suggested Donation Amounts */}
            <div>
              <label className="text-sm font-medium block mb-2">Suggested Donation Amounts</label>
              <div className="flex gap-2 mb-3">
                {SUGGESTED_AMOUNTS_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => setFormData(d => ({ ...d, suggestedAmounts: preset.amounts }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      JSON.stringify(formData.suggestedAmounts) === JSON.stringify(preset.amounts)
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.suggestedAmounts.map((amount, i) => (
                  <div key={i} className="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg flex items-center gap-2">
                    <span className="font-medium">${(amount / 100).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Payment Setup</h3>
              <p className="text-zinc-500 dark:text-slate-400">Where should donations be sent?</p>
            </div>

            {/* Zero Fees Banner */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white text-center">
              <div className="text-4xl mb-2">🎉</div>
              <div className="text-2xl font-bold">0% Platform Fees</div>
              <p className="text-purple-100 mt-2">
                Donations go directly to your PayPal account. Only PayPal's standard processing fee applies (2.9% + $0.30).
              </p>
            </div>

            {/* PayPal Email */}
            <div>
              <label className="text-sm font-medium block mb-2">PayPal Email Address *</label>
              <input
                type="email"
                value={formData.paypalEmail}
                onChange={e => setFormData(d => ({ ...d, paypalEmail: e.target.value }))}
                placeholder="your-paypal@email.com"
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-zinc-900 dark:text-white"
              />
              <span className="text-xs text-zinc-400 mt-1 block">
                This is where all donations will be sent directly
              </span>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Important:</strong> Make sure this is the correct PayPal email. 
                  All donations will be sent directly to this account and cannot be rerouted after the fact.
                </div>
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Review & Launch 🚀</h3>
              <p className="text-zinc-500 dark:text-slate-400">Make sure everything looks good!</p>
            </div>

            {/* Preview Card */}
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden">
              {coverImagePreview ? (
                <img src={coverImagePreview} alt="Cover" className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                  <span className="text-6xl">
                    {CATEGORY_OPTIONS.find(c => c.value === formData.category)?.icon || '🏆'}
                  </span>
                </div>
              )}
              
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={formData.type === 'team' ? 'primary' : 'gold'}>
                    {formData.type === 'team' ? '👥 Team' : '🏃 Athlete'}
                  </Badge>
                  <Badge>{CATEGORY_OPTIONS.find(c => c.value === formData.category)?.label}</Badge>
                </div>
                
                <h4 className="text-lg font-bold mb-2">{formData.title || 'Campaign Title'}</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">{formData.description}</p>
                
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-zinc-500">Goal</div>
                    <div className="text-xl font-bold">${formData.goalAmount.toLocaleString()}</div>
                  </div>
                  {formData.endDate && (
                    <div className="text-right">
                      <div className="text-sm text-zinc-500">Ends</div>
                      <div className="font-medium">{new Date(formData.endDate).toLocaleDateString()}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Checklist */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <Check className="w-5 h-5 text-emerald-500" />
                <span className="text-sm">
                  <strong>PayPal:</strong> {formData.paypalEmail}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <Check className="w-5 h-5 text-emerald-500" />
                <span className="text-sm">
                  <strong>Story:</strong> {formData.story.length} characters
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <Check className="w-5 h-5 text-emerald-500" />
                <span className="text-sm">
                  <strong>Visibility:</strong> Public (anyone can discover and donate)
                </span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 relative shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <Badge variant="gold" className="mb-2">💰 Zero Platform Fees</Badge>
          <h2 className="text-2xl font-bold text-white">Create Fundraising Campaign</h2>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-6 shrink-0">
          {renderStepIndicator()}
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shrink-0">
          <div className="flex gap-2">
            {currentStep !== 'type' && (
              <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
            
            <div className="flex-1" />
            
            {currentStep === 'review' ? (
              <Button variant="gold" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Launch Campaign 🚀
                  </span>
                )}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleNext} disabled={!canProceed()}>
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCampaignModal;
