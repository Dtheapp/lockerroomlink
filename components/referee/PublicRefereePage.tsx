/**
 * OSYS Public Referee Page
 * Public profile for referees
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getRefereeProfile, getRefereeStats, getRefereeRatings } from '../../services/refereeService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  Shield,
  Star,
  Calendar,
  Award,
  MapPin,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import type { RefereeProfile, RefereeStats, RefereeRating } from '../../types/referee';
import type { UserProfile } from '../../types';

export const PublicRefereePage: React.FC = () => {
  const { refereeId } = useParams<{ refereeId: string }>();
  const [profile, setProfile] = useState<RefereeProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<RefereeStats | null>(null);
  const [ratings, setRatings] = useState<RefereeRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (refereeId) {
      loadProfile();
    }
  }, [refereeId]);

  const loadProfile = async () => {
    if (!refereeId) return;
    setLoading(true);
    try {
      const [refereeData, userData, statsData, ratingsData] = await Promise.all([
        getRefereeProfile(refereeId),
        getDoc(doc(db, 'users', refereeId)).then(snap => snap.exists() ? snap.data() as UserProfile : null),
        getRefereeStats(refereeId),
        getRefereeRatings(refereeId),
      ]);

      if (!refereeData) {
        setNotFound(true);
      } else {
        setProfile(refereeData);
        setUserProfile(userData);
        setStats(statsData);
        setRatings(ratingsData);
      }
    } catch (error) {
      console.error('Error loading referee profile:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-20 h-20 text-slate-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Referee Not Found</h1>
          <p className="text-slate-400">This referee profile doesn't exist or is private.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center">
              {profile.profilePhotoUrl ? (
                <img
                  src={profile.profilePhotoUrl}
                  alt={userProfile?.name || 'Referee'}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <Shield className="w-12 h-12 text-white" />
              )}
            </div>

            <div className="text-center md:text-left flex-1">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">
                  {userProfile?.name || 'Referee'}
                </h1>
                {profile.verificationStatus === 'verified' && (
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Verified
                  </div>
                )}
              </div>
              
              <p className="text-slate-400 mb-4">
                {profile.yearsExperience} years of officiating experience
              </p>

              {profile.homeLocation && (
                <p className="text-slate-500 flex items-center justify-center md:justify-start gap-1">
                  <MapPin className="w-4 h-4" />
                  {profile.homeLocation.city}, {profile.homeLocation.state}
                </p>
              )}
            </div>

            {/* Rating */}
            {profile.averageRating && (
              <div className="text-center">
                <div className="flex items-center gap-1 justify-center">
                  <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  <span className="text-3xl font-bold text-white">
                    {profile.averageRating.toFixed(1)}
                  </span>
                </div>
                <p className="text-sm text-slate-400">{profile.totalRatings || 0} ratings</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.totalGamesAllTime || 0}</p>
            <p className="text-sm text-slate-400">Total Games</p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.gamesThisSeason || 0}</p>
            <p className="text-sm text-slate-400">This Season</p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">
              {profile.certifications?.length || 0}
            </p>
            <p className="text-sm text-slate-400">Certifications</p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats?.completionRate?.toFixed(0) || 100}%
            </p>
            <p className="text-sm text-slate-400">Completion Rate</p>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-3">About</h2>
            <p className="text-slate-300 whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {/* Sports */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Sports</h2>
          <div className="flex flex-wrap gap-2">
            {profile.sports.map((sport) => (
              <div
                key={sport}
                className="px-4 py-2 bg-slate-700 rounded-lg text-white capitalize flex items-center gap-2"
              >
                {sport}
                {stats?.sportBreakdown[sport] && (
                  <span className="text-xs bg-slate-600 px-2 py-0.5 rounded-full">
                    {stats.sportBreakdown[sport]} games
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Certifications */}
        {profile.certifications && profile.certifications.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              Certifications
            </h2>
            <div className="space-y-3">
              {profile.certifications.map((cert, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium text-white">{cert.name}</p>
                    <p className="text-sm text-slate-400">
                      {cert.organization || cert.issuingBody}
                      <span className="capitalize"> • {cert.sport}</span>
                    </p>
                  </div>
                  {cert.verified && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Availability */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Availability</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className={`p-3 rounded-lg text-center ${
              profile.availability?.weekdays 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-slate-700 text-slate-500'
            }`}>
              <p className="font-medium">Weekdays</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${
              profile.availability?.weekends 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-slate-700 text-slate-500'
            }`}>
              <p className="font-medium">Weekends</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${
              profile.availability?.evenings 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-slate-700 text-slate-500'
            }`}>
              <p className="font-medium">Evenings</p>
            </div>
          </div>
          {profile.travelRadius && (
            <p className="text-slate-400 mt-4">
              Willing to travel up to <span className="text-white font-medium">{profile.travelRadius} miles</span>
            </p>
          )}
        </div>

        {/* Recent Reviews */}
        {ratings.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Reviews</h2>
            <div className="space-y-4">
              {ratings.slice(0, 5).map((rating) => (
                <div key={rating.id} className="border-b border-slate-700 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= rating.overallRating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-slate-400">
                      {rating.ratedByName || rating.raterName}
                    </span>
                  </div>
                  {(rating.publicComment || rating.comment) && (
                    <p className="text-slate-300 text-sm">{rating.publicComment || rating.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Notice */}
        {profile.isAvailable && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
            <p className="text-blue-400">
              This referee is currently available for games.
              <br />
              <span className="text-sm text-blue-400/70">
                League owners can send assignment requests through the OSYS platform.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicRefereePage;
