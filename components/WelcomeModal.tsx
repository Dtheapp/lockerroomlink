import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle2, Users, ClipboardList, MessageCircle, Video, BarChart3, Calendar, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSportConfig } from '../hooks/useSportConfig';
import { trackOnboarding } from '../services/analytics';

interface WelcomeModalProps {
  onClose: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose }) => {
  const { userData, teamData } = useAuth();
  const { theme } = useTheme();
  const { config: sportConfig, hasPlaybook, getLabel } = useSportConfig();
  const [currentStep, setCurrentStep] = useState(0);

  const isCoach = userData?.role === 'Coach';
  const isParent = userData?.role === 'Parent';

  // Define slides based on role and sport
  const getSlides = () => {
    const baseSlides = [
      {
        icon: <Sparkles className="w-16 h-16 text-orange-500" />,
        title: `Welcome to OSYS${userData?.name ? `, ${userData.name.split(' ')[0]}` : ''}!`,
        subtitle: 'The Operating System for Youth Sports',
        content: (
          <div className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              OSYS is your all-in-one platform for managing your {isCoach ? 'team' : "athlete's team"}.
            </p>
            <div className="flex items-center gap-3 text-left bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-900/50">
              <div className="text-3xl">{sportConfig.emoji}</div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">{teamData?.name || 'Your Team'}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{sportConfig.name}</p>
              </div>
            </div>
          </div>
        ),
      },
    ];

    // Coach-specific slides
    if (isCoach) {
      baseSlides.push(
        {
          icon: <Users className="w-16 h-16 text-blue-500" />,
          title: 'Manage Your Roster',
          subtitle: 'Add players and track their information',
          content: (
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Add players with photos, positions, and jersey numbers</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Track medical info and emergency contacts</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Parents can link to their athletes</span>
              </div>
            </div>
          ),
        },
        {
          icon: <Calendar className="w-16 h-16 text-green-500" />,
          title: 'Schedule & Events',
          subtitle: `Plan ${getLabel('practice')}s, ${getLabel('game')}s, and events`,
          content: (
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Create events with registration and payments</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Digital waivers and promo codes</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Track attendance and manage registrations</span>
              </div>
            </div>
          ),
        }
      );

      // Add playbook slide only if sport supports it
      if (hasPlaybook) {
        baseSlides.push({
          icon: <ClipboardList className="w-16 h-16 text-purple-500" />,
          title: getLabel('playbook'),
          subtitle: `Design and share ${getLabel('play')}s`,
          content: (
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Canvas-based {getLabel('play').toLowerCase()} designer</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Drag-and-drop players and routes</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Share {getLabel('play').toLowerCase()}s with your team</span>
              </div>
            </div>
          ),
        });
      }

      baseSlides.push(
        {
          icon: <MessageCircle className="w-16 h-16 text-indigo-500" />,
          title: 'Team Communication',
          subtitle: 'Stay connected with your team',
          content: (
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Team chat for announcements and discussions</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Private messenger for parent conversations</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Strategy chat for coaches only</span>
              </div>
            </div>
          ),
        },
        {
          icon: <Video className="w-16 h-16 text-red-500" />,
          title: 'Film Room',
          subtitle: 'Upload and organize game film',
          content: (
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Add YouTube videos to your library</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Tag players in clips</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Categorize by {getLabel('game').toLowerCase()} or {getLabel('practice').toLowerCase()}</span>
              </div>
            </div>
          ),
        },
        {
          icon: <BarChart3 className="w-16 h-16 text-cyan-500" />,
          title: 'Stats Tracking',
          subtitle: 'Track player and team statistics',
          content: (
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Per-{getLabel('game').toLowerCase()} stat entry</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Season totals and averages</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Export and share stats</span>
              </div>
            </div>
          ),
        }
      );
    }

    // Parent-specific slides
    if (isParent) {
      baseSlides.push(
        {
          icon: <Users className="w-16 h-16 text-blue-500" />,
          title: 'Link Your Athlete',
          subtitle: 'Connect to your child\'s team',
          content: (
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Go to your Profile page</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Click "Add Athlete" in the My Athletes section</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Select their team and enter their info</span>
              </div>
            </div>
          ),
        },
        {
          icon: <MessageCircle className="w-16 h-16 text-indigo-500" />,
          title: 'Stay Connected',
          subtitle: 'Chat with coaches and view updates',
          content: (
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">View team announcements in Team Chat</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Private message coaches via Messenger</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Get notified about important updates</span>
              </div>
            </div>
          ),
        },
        {
          icon: <Calendar className="w-16 h-16 text-green-500" />,
          title: 'Events & Schedule',
          subtitle: `Know when ${getLabel('game')}s and ${getLabel('practice')}s are`,
          content: (
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">View team schedule and events</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Register for camps and special events</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-400">Sign digital waivers online</span>
              </div>
            </div>
          ),
        }
      );
    }

    // Final slide
    baseSlides.push({
      icon: <Sparkles className="w-16 h-16 text-orange-500" />,
      title: "You're All Set!",
      subtitle: 'Start exploring OSYS',
      content: (
        <div className="space-y-4">
          <p className="text-zinc-600 dark:text-zinc-400">
            {isCoach 
              ? "Head to your Dashboard to start building your team's digital home."
              : "Link your athlete on your Profile page to get started."}
          </p>
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 rounded-lg">
            <p className="font-semibold">💡 Pro Tip</p>
            <p className="text-sm opacity-90">
              {isCoach 
                ? "Start by adding players to your roster, then invite parents to join!"
                : "Ask your coach for the team join link to easily connect."}
            </p>
          </div>
        </div>
      ),
    });

    return baseSlides;
  };

  const slides = getSlides();
  const totalSteps = slides.length;
  const isLastStep = currentStep === totalSteps - 1;

  // Track when welcome modal is shown
  useEffect(() => {
    trackOnboarding.welcomeShown();
  }, []);

  const handleNext = () => {
    if (isLastStep) {
      // Track completion and save that user has seen welcome
      trackOnboarding.welcomeDismissed();
      localStorage.setItem(`osys_welcome_seen_${userData?.uid}`, 'true');
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    trackOnboarding.welcomeDismissed();
    localStorage.setItem(`osys_welcome_seen_${userData?.uid}`, 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div 
        className={`w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 ${
          theme === 'dark' 
            ? 'bg-zinc-900 border border-zinc-800' 
            : 'bg-white border border-zinc-200'
        }`}
      >
        {/* Header with progress */}
        <div className="relative">
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-700">
            <div 
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
          
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors text-sm"
          >
            Skip
          </button>
        </div>

        {/* Content */}
        <div className="p-8 pt-10 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`p-4 rounded-2xl ${
              theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'
            }`}>
              {slides[currentStep].icon}
            </div>
          </div>

          {/* Title & Subtitle */}
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            {slides[currentStep].title}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">
            {slides[currentStep].subtitle}
          </p>

          {/* Content */}
          <div className="min-h-[160px] flex flex-col justify-center">
            {slides[currentStep].content}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-8 py-4 flex items-center justify-between border-t ${
          theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'
        }`}>
          {/* Step indicator */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep 
                    ? 'w-6 bg-orange-500' 
                    : idx < currentStep
                      ? 'bg-orange-300 dark:bg-orange-700'
                      : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'hover:bg-zinc-800 text-zinc-400'
                    : 'hover:bg-zinc-100 text-zinc-600'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              {isLastStep ? "Let's Go!" : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
