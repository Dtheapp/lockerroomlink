/**
 * OSYS Referee Rating Modal
 * Allows league owners/coaches to rate referee performance
 */

import React, { useState } from 'react';
import { rateReferee } from '../../services/refereeService';
import { notifyRefereeRating } from '../../services/notificationService';
import { Star, X, Send, User, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  refereeId: string;
  refereeName: string;
  assignmentId: string;
  gameDate: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: 'league_owner' | 'coach';
  onComplete?: () => void;
}

const ratingCategories = [
  { key: 'overall', label: 'Overall Performance', description: 'General rating of officiating quality' },
  { key: 'professionalism', label: 'Professionalism', description: 'Communication, appearance, punctuality' },
  { key: 'knowledge', label: 'Rule Knowledge', description: 'Understanding and application of rules' },
  { key: 'fairness', label: 'Fairness', description: 'Consistency and impartiality in calls' },
  { key: 'communication', label: 'Communication', description: 'Clear explanations of calls to players/coaches' },
];

export const RefereeRatingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  refereeId,
  refereeName,
  assignmentId,
  gameDate,
  reviewerId,
  reviewerName,
  reviewerRole,
  onComplete,
}) => {
  const [ratings, setRatings] = useState<Record<string, number>>({
    overall: 0,
    professionalism: 0,
    knowledge: 0,
    fairness: 0,
    communication: 0,
  });
  const [hoverRatings, setHoverRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSetRating = (category: string, value: number) => {
    setRatings((prev) => ({ ...prev, [category]: value }));
  };

  const handleHover = (category: string, value: number) => {
    setHoverRatings((prev) => ({ ...prev, [category]: value }));
  };

  const handleHoverEnd = (category: string) => {
    setHoverRatings((prev) => ({ ...prev, [category]: 0 }));
  };

  const handleSubmit = async () => {
    // Validate at least overall rating
    if (ratings.overall === 0) {
      setError('Please provide at least an overall rating');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Map reviewer role to expected format
      const ratedByRole = reviewerRole === 'league_owner' ? 'LeagueOwner' : 'Coach';
      
      await rateReferee({
        refereeId,
        assignmentId,
        ratedBy: reviewerId,
        ratedByName: reviewerName,
        ratedByRole,
        overallRating: ratings.overall,
        fairnessRating: ratings.fairness || undefined,
        communicationRating: ratings.communication || undefined,
        punctualityRating: ratings.professionalism || undefined,
        comment: comment.trim() || undefined,
      });

      // Send notification
      await notifyRefereeRating(refereeId, ratings.overall, reviewerName);

      setSuccess(true);
      setTimeout(() => {
        onComplete?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Rate Referee</h2>
            <p className="text-sm text-slate-400">{gameDate}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Rating Submitted!</h3>
            <p className="text-slate-400">Thank you for your feedback</p>
          </div>
        ) : (
          <>
            {/* Referee Info */}
            <div className="px-6 py-4 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-500 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium text-white">{refereeName}</p>
                  <p className="text-sm text-slate-400">Referee</p>
                </div>
              </div>
            </div>

            {/* Rating Categories */}
            <div className="px-6 py-4 space-y-6">
              {ratingCategories.map((category) => (
                <div key={category.key}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-white">{category.label}</p>
                      <p className="text-xs text-slate-500">{category.description}</p>
                    </div>
                    <span className="text-sm text-purple-400">
                      {ratings[category.key] > 0 && `${ratings[category.key]}/5`}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => {
                      const isActive =
                        value <= (hoverRatings[category.key] || ratings[category.key]);
                      return (
                        <button
                          key={value}
                          onClick={() => handleSetRating(category.key, value)}
                          onMouseEnter={() => handleHover(category.key, value)}
                          onMouseLeave={() => handleHoverEnd(category.key)}
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-8 h-8 transition-colors ${
                              isActive
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-slate-600'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Would Recommend */}
              <div>
                <p className="font-medium text-white mb-3">
                  Would you recommend this referee?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWouldRecommend(true)}
                    className={`flex-1 py-3 rounded-lg border transition-all ${
                      wouldRecommend === true
                        ? 'bg-green-500/20 border-green-500 text-green-400'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setWouldRecommend(false)}
                    className={`flex-1 py-3 rounded-lg border transition-all ${
                      wouldRecommend === false
                        ? 'bg-red-500/20 border-red-500 text-red-400'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block font-medium text-white mb-2">
                  Additional Comments (Optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share any additional feedback..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 bg-zinc-900 px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || ratings.overall === 0}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Rating
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RefereeRatingModal;
