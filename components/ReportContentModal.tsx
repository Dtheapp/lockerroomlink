import React, { useState } from 'react';
import { X, Flag, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { reportContent, REPORT_REASONS, type ContentReport } from '../services/moderation';
import { trackModeration } from '../services/analytics';

interface ReportContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentType: 'message' | 'post' | 'profile' | 'video' | 'comment';
  contentText?: string;
  contentAuthor?: string;
  contentAuthorId?: string;
  teamId: string;
}

const ReportContentModal: React.FC<ReportContentModalProps> = ({
  isOpen,
  onClose,
  contentId,
  contentType,
  contentText,
  contentAuthor,
  contentAuthorId,
  teamId,
}) => {
  const { user, userData } = useAuth();
  const { theme } = useTheme();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !user) return;

    setSubmitting(true);
    setError(null);

    try {
      await reportContent({
        contentId,
        contentType,
        teamId,
        reportedBy: user.uid,
        reporterName: userData?.name || user.email || 'Unknown',
        reason,
        details: details.trim() || undefined,
        contentText: contentText?.substring(0, 500), // Limit stored text
        contentAuthor,
        contentAuthorId,
      });
      
      // Track analytics
      trackModeration.contentReported(contentType, reason);
      
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit report:', err);
      setError('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setDetails('');
    setSubmitted(false);
    setError(null);
    onClose();
  };

  const getContentTypeLabel = () => {
    switch (contentType) {
      case 'message': return 'message';
      case 'post': return 'post';
      case 'profile': return 'profile';
      case 'video': return 'video';
      case 'comment': return 'comment';
      default: return 'content';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div 
        className={`w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 ${
          theme === 'dark' 
            ? 'bg-zinc-900 border border-zinc-800' 
            : 'bg-white border border-zinc-200'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
            }`}>
              <Flag className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 dark:text-white">Report {getContentTypeLabel()}</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Help keep our community safe</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {submitted ? (
            // Success state
            <div className="text-center py-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
              }`}>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                Report Submitted
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">
                Thank you for helping keep our community safe. Our team will review this report.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            // Form
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Preview of reported content */}
              {contentText && (
                <div className={`p-3 rounded-lg text-sm ${
                  theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'
                }`}>
                  <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">Reported content:</p>
                  <p className="text-zinc-700 dark:text-zinc-300 line-clamp-3">
                    "{contentText}"
                  </p>
                  {contentAuthor && (
                    <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">
                      By {contentAuthor}
                    </p>
                  )}
                </div>
              )}

              {/* Reason selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                  Why are you reporting this?
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className={`w-full px-3 py-2.5 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-zinc-800 border-zinc-700 text-white'
                      : 'bg-white border-zinc-300 text-zinc-900'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500`}
                >
                  <option value="">Select a reason...</option>
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional details */}
              <div>
                <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                  Additional details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide any additional context..."
                  rows={3}
                  maxLength={500}
                  className={`w-full px-3 py-2.5 rounded-lg border transition-colors resize-none ${
                    theme === 'dark'
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500`}
                />
                <p className="text-xs text-zinc-400 mt-1 text-right">
                  {details.length}/500
                </p>
              </div>

              {/* Warning */}
              <div className={`flex items-start gap-3 p-3 rounded-lg ${
                theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
              }`}>
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  False reports may result in restrictions to your account. Please only report genuine violations.
                </p>
              </div>

              {/* Error message */}
              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!reason || submitting}
                className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                  !reason || submitting
                    ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Flag className="w-4 h-4" />
                    Submit Report
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportContentModal;
