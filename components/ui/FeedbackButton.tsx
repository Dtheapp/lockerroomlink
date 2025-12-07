import React, { useState } from 'react';
import { MessageSquare, X, Send, Bug, Lightbulb, HelpCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { trackEvent } from '../../services/analytics';

// =============================================================================
// FEEDBACK BUTTON
// Floating button for users to report bugs and submit feedback
// =============================================================================

type FeedbackType = 'bug' | 'feature' | 'question' | 'other';

interface FeedbackData {
  type: FeedbackType;
  message: string;
  email?: string;
  userId?: string;
  userName?: string;
  teamId?: string;
  teamName?: string;
  url: string;
  userAgent: string;
  timestamp: any;
  status: 'new' | 'reviewed' | 'resolved';
}

const feedbackTypes: { value: FeedbackType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'bug', label: 'Bug Report', icon: <Bug className="w-5 h-5" />, description: 'Something isn\'t working' },
  { value: 'feature', label: 'Feature Request', icon: <Lightbulb className="w-5 h-5" />, description: 'I have an idea' },
  { value: 'question', label: 'Question', icon: <HelpCircle className="w-5 h-5" />, description: 'I need help' },
  { value: 'other', label: 'Other', icon: <MessageSquare className="w-5 h-5" />, description: 'General feedback' },
];

const FeedbackButton: React.FC = () => {
  const { user, userData, teamData } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !message.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const feedbackData: Omit<FeedbackData, 'timestamp'> = {
        type,
        message: message.trim(),
        email: email || undefined,
        userId: user?.uid,
        userName: userData?.name,
        teamId: teamData?.id,
        teamName: teamData?.name,
        url: window.location.href,
        userAgent: navigator.userAgent,
        status: 'new',
      };

      await addDoc(collection(db, 'feedback'), {
        ...feedbackData,
        timestamp: serverTimestamp(),
      });

      // Track analytics
      trackEvent('feedback_submitted' as any, { type, has_message: true });

      setSubmitted(true);
      
      // Reset after delay
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setType(null);
        setMessage('');
      }, 2000);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setType(null);
    setMessage('');
    setError(null);
    setSubmitted(false);
  };

  // Don't show if user not logged in
  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-lg transition-all hover:scale-110 ${
          isDark 
            ? 'bg-orange-600 hover:bg-orange-500 text-white' 
            : 'bg-orange-500 hover:bg-orange-600 text-white'
        }`}
        title="Send Feedback"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={handleClose}
        >
          <div 
            className={`w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${
              isDark ? 'bg-zinc-900' : 'bg-white'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {submitted ? 'Thank You!' : type ? feedbackTypes.find(t => t.value === type)?.label : 'Send Feedback'}
              </h2>
              <button 
                onClick={handleClose}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
              >
                <X className={`w-5 h-5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    Feedback Received!
                  </p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    We'll review your feedback soon.
                  </p>
                </div>
              ) : !type ? (
                // Type Selection
                <div className="grid grid-cols-2 gap-3">
                  {feedbackTypes.map((feedbackType) => (
                    <button
                      key={feedbackType.value}
                      onClick={() => setType(feedbackType.value)}
                      className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                        isDark 
                          ? 'border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800/50' 
                          : 'border-zinc-200 hover:border-orange-500/50 hover:bg-orange-50'
                      }`}
                    >
                      <div className={`mb-2 ${isDark ? 'text-orange-400' : 'text-orange-500'}`}>
                        {feedbackType.icon}
                      </div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {feedbackType.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        {feedbackType.description}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                // Feedback Form
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Back button */}
                  <button
                    type="button"
                    onClick={() => setType(null)}
                    className={`text-sm ${isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700'}`}
                  >
                    ← Change type
                  </button>

                  {/* Message */}
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      {type === 'bug' ? 'What went wrong?' : type === 'feature' ? 'Describe your idea' : 'Your message'}
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        type === 'bug' 
                          ? 'Please describe what happened and what you expected...' 
                          : type === 'feature'
                          ? 'I would love if the app could...'
                          : 'Type your message here...'
                      }
                      rows={4}
                      required
                      className={`w-full px-3 py-2 rounded-lg border resize-none ${
                        isDark 
                          ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-orange-500' 
                          : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-orange-500'
                      } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                    />
                  </div>

                  {/* Email (optional if not logged in with email) */}
                  {!user?.email && (
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        Email (optional)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className={`w-full px-3 py-2 rounded-lg border ${
                          isDark 
                            ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-orange-500' 
                            : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-orange-500'
                        } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                      />
                      <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        So we can follow up if needed
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
                      submitting || !message.trim()
                        ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                        : 'bg-orange-500 hover:bg-orange-600 text-white hover:scale-[1.02]'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Feedback
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
