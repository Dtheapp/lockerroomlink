// =============================================================================
// ADD GAME MODAL - Multi-step wizard for adding games to season schedule
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Clock,
  Users,
  Tag,
  Trophy,
  Ticket,
  ChevronRight,
  ChevronLeft,
  Home,
  Plane,
  Check,
  Plus,
  Sparkles,
} from 'lucide-react';
import { 
  GameFormData, 
  GameTag, 
  PlayoffRound,
  GAME_TAGS, 
  PLAYOFF_ROUNDS 
} from '../../types/game';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (gameData: GameFormData) => Promise<void>;
  teamName: string;
  homeField?: string;
  existingOpponents?: string[];
  isPlayoffMode?: boolean;
  editGame?: GameFormData | null;
}

type Step = 'basic' | 'datetime' | 'special' | 'tickets' | 'review';

const STEPS: { id: Step; title: string; icon: React.ReactNode }[] = [
  { id: 'basic', title: 'Opponent', icon: <Users className="w-4 h-4" /> },
  { id: 'datetime', title: 'Date & Time', icon: <Calendar className="w-4 h-4" /> },
  { id: 'special', title: 'Special', icon: <Tag className="w-4 h-4" /> },
  { id: 'tickets', title: 'Tickets', icon: <Ticket className="w-4 h-4" /> },
  { id: 'review', title: 'Review', icon: <Check className="w-4 h-4" /> },
];

export function AddGameModal({
  isOpen,
  onClose,
  onSubmit,
  teamName,
  homeField = '',
  existingOpponents = [],
  isPlayoffMode = false,
  editGame = null,
}: AddGameModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOpponentDropdown, setShowOpponentDropdown] = useState(false);

  // Form state
  const [formData, setFormData] = useState<GameFormData>({
    opponent: '',
    opponentLogoUrl: '',
    date: '',
    time: '14:00',
    location: '',
    address: '',
    isHome: true,
    isPlayoff: isPlayoffMode,
    playoffRound: isPlayoffMode ? 'quarterfinal' : undefined,
    tags: [],
    notes: '',
    ticketsEnabled: false,
    ticketPrice: undefined,
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (editGame) {
        setFormData(editGame);
      } else {
        setFormData({
          opponent: '',
          opponentLogoUrl: '',
          date: '',
          time: '14:00',
          location: homeField,
          address: '',
          isHome: true,
          isPlayoff: isPlayoffMode,
          playoffRound: isPlayoffMode ? 'quarterfinal' : undefined,
          tags: [],
          notes: '',
          ticketsEnabled: false,
          ticketPrice: undefined,
        });
      }
      setCurrentStep('basic');
    }
  }, [isOpen, editGame, isPlayoffMode, homeField]);

  if (!isOpen) return null;

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error creating game:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tag: GameTag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const filteredOpponents = existingOpponents.filter(op =>
    op.toLowerCase().includes(formData.opponent.toLowerCase())
  );

  const canProceed = () => {
    switch (currentStep) {
      case 'basic':
        return formData.opponent.trim().length > 0;
      case 'datetime':
        return formData.date && formData.time && formData.location.trim().length > 0;
      case 'special':
        return true; // Optional
      case 'tickets':
        return true; // Optional
      case 'review':
        return true;
      default:
        return false;
    }
  };

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format time for display
  const formatTimeDisplay = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {isPlayoffMode ? (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-400" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {editGame ? 'Edit Game' : isPlayoffMode ? 'Add Playoff Game' : 'Add Game'}
              </h2>
              <p className="text-sm text-slate-400">
                {teamName}'s {isPlayoffMode ? 'playoff' : ''} schedule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-6 py-4 bg-black/20">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => index <= stepIndex && setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  step.id === currentStep
                    ? 'bg-orange-500/20 text-orange-400'
                    : index < stepIndex
                    ? 'text-green-400 hover:bg-white/5 cursor-pointer'
                    : 'text-slate-500 cursor-not-allowed'
                }`}
                disabled={index > stepIndex}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index < stepIndex 
                    ? 'bg-green-500/30 text-green-400'
                    : step.id === currentStep
                    ? 'bg-orange-500/30 text-orange-400'
                    : 'bg-slate-700 text-slate-500'
                }`}>
                  {index < stepIndex ? <Check className="w-3 h-3" /> : index + 1}
                </div>
                <span className="text-sm font-medium hidden sm:block">{step.title}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${
                  index < stepIndex ? 'bg-green-500/50' : 'bg-slate-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 min-h-[320px]">
          {/* Step 1: Basic Info */}
          {currentStep === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Opponent Team Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.opponent}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, opponent: e.target.value }));
                      setShowOpponentDropdown(true);
                    }}
                    onFocus={() => setShowOpponentDropdown(true)}
                    onBlur={() => setTimeout(() => setShowOpponentDropdown(false), 200)}
                    placeholder="e.g., Eagles, Wildcats, Panthers"
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50"
                  />
                  {showOpponentDropdown && filteredOpponents.length > 0 && formData.opponent && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-white/10 rounded-xl overflow-hidden shadow-xl z-10">
                      <div className="text-xs text-slate-500 px-3 py-2 border-b border-white/5">
                        Previous opponents
                      </div>
                      {filteredOpponents.slice(0, 5).map(op => (
                        <button
                          key={op}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, opponent: op }));
                            setShowOpponentDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Home or Away? *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      isHome: true,
                      location: homeField || prev.location
                    }))}
                    className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                      formData.isHome
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                        : 'bg-zinc-800/50 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <Home className="w-5 h-5" />
                    <span className="font-medium">Home</span>
                  </button>
                  <button
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      isHome: false,
                      location: ''
                    }))}
                    className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                      !formData.isHome
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-zinc-800/50 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <Plane className="w-5 h-5" />
                    <span className="font-medium">Away</span>
                  </button>
                </div>
              </div>

              {isPlayoffMode && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Playoff Round
                  </label>
                  <select
                    value={formData.playoffRound || 'quarterfinal'}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      playoffRound: e.target.value as PlayoffRound 
                    }))}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                  >
                    {PLAYOFF_ROUNDS.map(round => (
                      <option key={round.id} value={round.id}>
                        {round.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date & Time */}
          {currentStep === 'datetime' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Game Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Game Time *
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Location / Field Name *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder={formData.isHome ? 'e.g., Memorial Stadium' : 'e.g., Visitor Stadium'}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Address (optional - for maps)
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Stadium Way, City, State 12345"
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
          )}

          {/* Step 3: Special Tags */}
          {currentStep === 'special' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  Special Game Tags (optional)
                </label>
                <p className="text-sm text-slate-500 mb-4">
                  Tag this game with special events - this helps with marketing and ticket designs!
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {GAME_TAGS.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                        formData.tags.includes(tag.id)
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                          : 'bg-zinc-800/50 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span className="text-lg">{tag.icon}</span>
                      <span className="text-sm font-medium">{tag.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Internal Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any notes for coaches about this game..."
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: Tickets */}
          {currentStep === 'tickets' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-xl p-4 border border-orange-500/20">
                <div className="flex items-start gap-3">
                  <Ticket className="w-5 h-5 text-orange-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-white">Game Tickets</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Enable ticket sales for this game. You can create a custom ticket design 
                      in Design Studio later - it will automatically link to this game!
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.ticketsEnabled}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        ticketsEnabled: e.target.checked 
                      }))}
                      className="sr-only"
                    />
                    <div className={`w-12 h-6 rounded-full transition-colors ${
                      formData.ticketsEnabled ? 'bg-orange-500' : 'bg-zinc-700'
                    }`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        formData.ticketsEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>
                  <span className="text-white font-medium">Enable ticket sales for this game</span>
                </label>
              </div>

              {formData.ticketsEnabled && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Default Ticket Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.ticketPrice || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        ticketPrice: parseFloat(e.target.value) || undefined 
                      }))}
                      placeholder="5.00"
                      className="w-full pl-8 pr-4 py-3 bg-zinc-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    You can set different prices for different ticket types in Design Studio
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
                  formData.isHome 
                    ? 'bg-gradient-to-br from-orange-500/30 to-red-500/30' 
                    : 'bg-gradient-to-br from-blue-500/30 to-purple-500/30'
                }`}>
                  {formData.isHome ? (
                    <Home className="w-8 h-8 text-orange-400" />
                  ) : (
                    <Plane className="w-8 h-8 text-blue-400" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mt-3">
                  {formData.isHome ? 'vs' : '@'} {formData.opponent}
                </h3>
                {formData.isPlayoff && formData.playoffRound && (
                  <span className="inline-block mt-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
                    🏆 {PLAYOFF_ROUNDS.find(r => r.id === formData.playoffRound)?.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Calendar className="w-4 h-4" />
                    Date
                  </div>
                  <p className="text-white font-medium">{formatDateDisplay(formData.date)}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    Time
                  </div>
                  <p className="text-white font-medium">{formatTimeDisplay(formData.time)}</p>
                </div>
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                  <MapPin className="w-4 h-4" />
                  Location
                </div>
                <p className="text-white font-medium">{formData.location}</p>
                {formData.address && (
                  <p className="text-slate-400 text-sm mt-1">{formData.address}</p>
                )}
              </div>

              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tagId => {
                    const tag = GAME_TAGS.find(t => t.id === tagId);
                    return tag ? (
                      <span
                        key={tagId}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm"
                      >
                        {tag.icon} {tag.label}
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {formData.ticketsEnabled && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
                  <Ticket className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-green-400 font-medium">Tickets Enabled</p>
                    {formData.ticketPrice && (
                      <p className="text-slate-400 text-sm">Default price: ${formData.ticketPrice.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10 bg-black/20">
          <button
            onClick={currentStep === 'basic' ? onClose : handleBack}
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep === 'basic' ? 'Cancel' : 'Back'}
          </button>

          {currentStep === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {editGame ? 'Save Changes' : 'Add Game'}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddGameModal;
