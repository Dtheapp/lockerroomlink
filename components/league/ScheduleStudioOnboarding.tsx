import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, GripVertical, Clock, MapPin, Users, Wand2, Play } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string; // CSS selector to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: React.ReactNode;
  highlight?: 'palette' | 'canvas' | 'header' | 'teams' | 'times' | 'venues' | 'autofill' | 'save';
}

interface ScheduleStudioOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
  theme: string;
}

// ============================================================================
// ONBOARDING STEPS
// ============================================================================

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '🎨 Welcome to Schedule Studio',
    description: 'The most powerful visual scheduler in youth sports. Let\'s take a quick tour to get you building schedules like a pro!',
    position: 'center',
    icon: <Sparkles className="w-6 h-6 text-purple-400" />,
  },
  {
    id: 'palette',
    title: '📋 Your Palette',
    description: 'This is your palette - it contains Teams, Time Slots, and Venues. Everything you need to build your schedule lives here.',
    highlight: 'palette',
    position: 'right',
    icon: <GripVertical className="w-6 h-6 text-purple-400" />,
  },
  {
    id: 'teams',
    title: '👥 Drag Teams to Create Matchups',
    description: 'Simply drag a team from here and drop it onto a game card\'s "Home" or "Away" slot. It\'s that easy!',
    highlight: 'teams',
    position: 'right',
    icon: <Users className="w-6 h-6 text-purple-400" />,
  },
  {
    id: 'times',
    title: '⏰ Add Game Times',
    description: 'Drag a time slot onto any game to set when it will be played.',
    highlight: 'times',
    position: 'right',
    icon: <Clock className="w-6 h-6 text-purple-400" />,
  },
  {
    id: 'venues',
    title: '📍 Set Venues',
    description: 'Drag a venue to assign where the game will be played. Team home fields are automatically available here.',
    highlight: 'venues',
    position: 'right',
    icon: <MapPin className="w-6 h-6 text-amber-400" />,
  },
  {
    id: 'canvas',
    title: '📆 The Schedule Canvas',
    description: 'Each week is a "lane" where you build your matchups. Games show green when complete (all slots filled).',
    highlight: 'canvas',
    position: 'left',
  },
  {
    id: 'autofill',
    title: '✨ Auto-Fill Magic',
    description: 'Don\'t want to drag manually? Click "Auto-Fill" to generate a full round-robin schedule instantly!',
    highlight: 'autofill',
    position: 'bottom',
    icon: <Wand2 className="w-6 h-6 text-purple-400" />,
  },
  {
    id: 'ready',
    title: '🚀 You\'re Ready!',
    description: 'That\'s it! Start dragging teams, times, and venues to build your perfect schedule. Click "Save" when you\'re done.',
    position: 'center',
    icon: <Play className="w-6 h-6 text-green-400" />,
  },
];

// ============================================================================
// SPOTLIGHT OVERLAY
// ============================================================================

interface SpotlightProps {
  highlight?: OnboardingStep['highlight'];
  theme: string;
}

function Spotlight({ highlight, theme }: SpotlightProps) {
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
  
  useEffect(() => {
    if (!highlight) {
      setSpotlightStyle({});
      return;
    }

    // Map highlight areas to their data attributes
    const selectorMap: Record<string, string> = {
      palette: '[data-onboarding="palette"]',
      canvas: '[data-onboarding="canvas"]',
      header: '[data-onboarding="header"]',
      teams: '[data-onboarding="teams"]',
      times: '[data-onboarding="times"]',
      venues: '[data-onboarding="venues"]',
      autofill: '[data-onboarding="autofill"]',
      save: '[data-onboarding="save"]',
    };

    const selector = selectorMap[highlight];
    const element = document.querySelector(selector);
    
    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 8;
      
      setSpotlightStyle({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: '12px',
      });
    }
  }, [highlight]);

  if (!highlight) return null;

  return (
    <>
      {/* Dark overlay with cutout */}
      <div 
        className="fixed inset-0 z-[70] pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${(spotlightStyle.left as number) + (spotlightStyle.width as number) / 2}px ${(spotlightStyle.top as number) + (spotlightStyle.height as number) / 2}px, transparent ${Math.max(spotlightStyle.width as number, spotlightStyle.height as number) / 2}px, rgba(0,0,0,0.85) ${Math.max(spotlightStyle.width as number, spotlightStyle.height as number)}px)`,
        }}
      />
      
      {/* Animated border around spotlight area */}
      <div 
        className="fixed z-[71] pointer-events-none border-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.5)]"
        style={{
          ...spotlightStyle,
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}
      />

      {/* Pulse animation styles */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.5), 0 0 40px rgba(168, 85, 247, 0.3);
          }
          50% { 
            box-shadow: 0 0 30px rgba(168, 85, 247, 0.8), 0 0 60px rgba(168, 85, 247, 0.5);
          }
        }
        @keyframes bounce-arrow {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(8px); }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </>
  );
}

// ============================================================================
// TOOLTIP CARD
// ============================================================================

interface TooltipCardProps {
  step: OnboardingStep;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
  theme: string;
}

function TooltipCard({ 
  step, 
  currentIndex, 
  totalSteps, 
  onNext, 
  onPrev, 
  onSkip, 
  onComplete,
  theme 
}: TooltipCardProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;
  const isCenter = step.position === 'center';

  // Position calculation
  const [position, setPosition] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });

  useEffect(() => {
    if (isCenter || !step.highlight) {
      setPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      return;
    }

    const selectorMap: Record<string, string> = {
      palette: '[data-onboarding="palette"]',
      canvas: '[data-onboarding="canvas"]',
      header: '[data-onboarding="header"]',
      teams: '[data-onboarding="teams"]',
      times: '[data-onboarding="times"]',
      venues: '[data-onboarding="venues"]',
      autofill: '[data-onboarding="autofill"]',
      save: '[data-onboarding="save"]',
    };

    const selector = selectorMap[step.highlight];
    const element = document.querySelector(selector);

    if (element) {
      const rect = element.getBoundingClientRect();
      const cardWidth = 360;
      const cardHeight = 280; // Increased to account for content
      const margin = 24;

      let newPos: any = {};

      // Calculate best position, with fallbacks if off-screen
      const fitsRight = rect.right + margin + cardWidth < window.innerWidth;
      const fitsLeft = rect.left - margin - cardWidth > 0;
      const fitsBottom = rect.bottom + margin + cardHeight < window.innerHeight;
      
      // For 'left' position (canvas), check if it fits, otherwise center or use right
      if (step.position === 'left') {
        if (fitsLeft) {
          newPos = {
            top: `${Math.max(margin, Math.min(rect.top + rect.height / 2 - cardHeight / 2, window.innerHeight - cardHeight - margin))}px`,
            left: `${rect.left - cardWidth - margin}px`,
            transform: 'none',
          };
        } else {
          // Fallback to center if left doesn't fit
          newPos = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
        }
      } else if (step.position === 'right') {
        if (fitsRight) {
          newPos = {
            top: `${Math.max(margin, Math.min(rect.top + rect.height / 2 - cardHeight / 2, window.innerHeight - cardHeight - margin))}px`,
            left: `${Math.min(rect.right + margin, window.innerWidth - cardWidth - margin)}px`,
            transform: 'none',
          };
        } else {
          // Fallback to center
          newPos = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
        }
      } else if (step.position === 'bottom') {
        newPos = {
          top: `${Math.min(rect.bottom + margin, window.innerHeight - cardHeight - margin)}px`,
          left: `${Math.max(margin, Math.min(rect.left + rect.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - margin))}px`,
          transform: 'none',
        };
      } else if (step.position === 'top') {
        newPos = {
          top: `${Math.max(margin, rect.top - cardHeight - margin)}px`,
          left: `${Math.max(margin, Math.min(rect.left + rect.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - margin))}px`,
          transform: 'none',
        };
      } else {
        newPos = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      }

      setPosition(newPos);
    }
  }, [step, isCenter]);

  return (
    <div 
      className={`
        fixed z-[80] w-[360px] rounded-2xl p-6 shadow-2xl
        ${theme === 'dark' 
          ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-purple-500/30' 
          : 'bg-white border border-purple-200'
        }
      `}
      style={{
        ...position,
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      {/* Decorative gradient orb */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      
      {/* Skip button */}
      <button
        onClick={onSkip}
        className={`
          absolute top-3 right-3 p-1.5 rounded-lg transition-colors
          ${theme === 'dark' 
            ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5' 
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }
        `}
      >
        <X className="w-4 h-4" />
      </button>

      {/* Icon */}
      {step.icon && (
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center mb-4
          ${theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'}
        `}
        style={{ animation: isCenter ? 'float-up 2s ease-in-out infinite' : undefined }}
        >
          {step.icon}
        </div>
      )}

      {/* Content */}
      <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        {step.title}
      </h3>
      <p className={`text-sm leading-relaxed mb-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
        {step.description}
      </p>

      {/* Progress indicator */}
      <div className="flex items-center gap-1 mb-4">
        {ONBOARDING_STEPS.map((_, idx) => (
          <div
            key={idx}
            className={`
              h-1 rounded-full transition-all duration-300
              ${idx === currentIndex 
                ? 'w-6 bg-purple-500' 
                : idx < currentIndex 
                  ? 'w-2 bg-purple-500/50' 
                  : 'w-2 bg-white/10'
              }
            `}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className={`
            flex items-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all
            ${isFirst 
              ? 'opacity-0 pointer-events-none' 
              : theme === 'dark'
                ? 'text-slate-400 hover:text-white hover:bg-white/5'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={isLast ? onComplete : onNext}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all
            bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400
            text-white shadow-lg shadow-purple-500/25
          `}
        >
          {isLast ? (
            <>
              Let's Go!
              <Sparkles className="w-4 h-4" />
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" style={{ animation: 'bounce-arrow 1s ease-in-out infinite' }} />
            </>
          )}
        </button>
      </div>

      {/* Fade in animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: ${position.transform || 'none'} scale(0.95); }
          to { opacity: 1; transform: ${position.transform || 'none'} scale(1); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// MAIN ONBOARDING COMPONENT
// ============================================================================

export default function ScheduleStudioOnboarding({ onComplete, onSkip, theme }: ScheduleStudioOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = ONBOARDING_STEPS[currentStep];

  const handleNext = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onSkip();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onSkip]);

  return (
    <div className="fixed inset-0 z-[65]">
      {/* Base overlay for center steps */}
      {step.position === 'center' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      )}

      {/* Spotlight for highlighted elements */}
      <Spotlight highlight={step.highlight} theme={theme} />

      {/* Tooltip card */}
      <TooltipCard
        step={step}
        currentIndex={currentStep}
        totalSteps={ONBOARDING_STEPS.length}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={onSkip}
        onComplete={onComplete}
        theme={theme}
      />
    </div>
  );
}

// ============================================================================
// HELPER: Check if should show onboarding
// ============================================================================

export function shouldShowOnboarding(userId: string): boolean {
  const key = `schedule-studio-onboarding-completed-${userId}`;
  return localStorage.getItem(key) !== 'true';
}

export function markOnboardingComplete(userId: string): void {
  const key = `schedule-studio-onboarding-completed-${userId}`;
  localStorage.setItem(key, 'true');
}

export function resetOnboarding(userId: string): void {
  const key = `schedule-studio-onboarding-completed-${userId}`;
  localStorage.removeItem(key);
}
