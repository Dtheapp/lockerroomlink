import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, onSnapshot, deleteDoc, getDoc, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadFile, deleteFile } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { Edit2, Save, X, User, Camera, Heart, Star, Users, UserMinus, Eye, ExternalLink, AlertTriangle, Shield } from 'lucide-react';
import type { Player, Team, AthleteFollower } from '../types';

interface FollowedAthlete {
  player: Player;
  team: Team | null;
  followedAt: Date;
}

const FanProfile: React.FC = () => {
  const { user, userData } = useAuth();
  
  // Profile editing states
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Followed athletes state
  const [followedAthletes, setFollowedAthletes] = useState<FollowedAthlete[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(true);

  // Unfollow confirmation
  const [unfollowConfirm, setUnfollowConfirm] = useState<FollowedAthlete | null>(null);
  const [unfollowing, setUnfollowing] = useState(false);

  // Kudos given stats
  const [totalKudosGiven, setTotalKudosGiven] = useState(0);

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.name || '');
      setBio(userData.bio || '');
      setPhotoURL(userData.photoUrl || null);
      
      // Calculate total kudos given
      if (userData.kudosGiven) {
        const total = Object.values(userData.kudosGiven).reduce((sum: number, count: any) => sum + (count as number), 0);
        setTotalKudosGiven(total);
      }
    }
  }, [userData]);

  // Load followed athletes data
  useEffect(() => {
    const loadFollowedAthletes = async () => {
      if (!userData?.followedAthletes || userData.followedAthletes.length === 0) {
        setFollowedAthletes([]);
        setLoadingFollowed(false);
        return;
      }

      setLoadingFollowed(true);
      try {
        const athleteData: FollowedAthlete[] = [];
        
        // followedAthletes is array of "teamId_playerId" strings
        for (const athleteKey of userData.followedAthletes) {
          const [teamId, playerId] = athleteKey.split('_');
          
          // Get player data
          const playerDoc = await getDoc(doc(db, 'teams', teamId, 'players', playerId));
          if (playerDoc.exists()) {
            const player = { id: playerDoc.id, ...playerDoc.data() } as Player;
            
            // Get team data
            const teamDoc = await getDoc(doc(db, 'teams', teamId));
            const team = teamDoc.exists() ? { id: teamDoc.id, ...teamDoc.data() } as Team : null;
            
            athleteData.push({
              player,
              team,
              followedAt: new Date() // We'd need to store this in the followedAthletes structure for accurate data
            });
          }
        }
        
        setFollowedAthletes(athleteData);
      } catch (err) {
        console.error('Error loading followed athletes:', err);
      } finally {
        setLoadingFollowed(false);
      }
    };

    loadFollowedAthletes();
  }, [userData?.followedAthletes]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: displayName.trim(),
        bio: bio.trim()
      });
      
      setStatusMsg({ type: 'success', text: 'Profile updated!' });
      setIsEditing(false);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      setStatusMsg({ type: 'error', text: 'Image must be under 5MB' });
      return;
    }

    setUploadingPhoto(true);
    try {
      // Delete old photo if exists
      if (userData?.photoUrl) {
        await deleteFile(userData.photoUrl);
      }

      const uploaded = await uploadFile(file, `fan-photos/${user.uid}`);
      const url = typeof uploaded === 'string' ? uploaded : uploaded.url;
      await updateDoc(doc(db, 'users', user.uid), { photoUrl: url });
      setPhotoURL(url);
      setStatusMsg({ type: 'success', text: 'Photo updated!' });
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUnfollow = async (athlete: FollowedAthlete) => {
    if (!user || !userData) return;
    setUnfollowing(true);

    try {
      const athleteKey = `${athlete.team?.id}_${athlete.player.id}`;
      
      // Remove from user's followedAthletes array
      const newFollowed = (userData.followedAthletes || []).filter((k: string) => k !== athleteKey);
      await updateDoc(doc(db, 'users', user.uid), {
        followedAthletes: newFollowed
      });

      // Remove follower document from athlete's followers subcollection
      if (athlete.team?.id) {
        const followerRef = doc(db, 'teams', athlete.team.id, 'players', athlete.player.id, 'followers', user.uid);
        await deleteDoc(followerRef);

        // Decrement follower count
        await updateDoc(doc(db, 'teams', athlete.team.id, 'players', athlete.player.id), {
          followerCount: increment(-1)
        });
      }

      setStatusMsg({ type: 'success', text: `Unfollowed ${athlete.player.name}` });
      setUnfollowConfirm(null);
    } catch (err: any) {
      console.error('Error unfollowing:', err);
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setUnfollowing(false);
    }
  };

  const navigateToProfile = (athlete: FollowedAthlete) => {
    if (athlete.player.username) {
      window.open(`/athlete/${athlete.player.username}`, '_blank');
    }
  };

  if (!user || !userData) {
    return (
      <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
        <p>Loading profile...</p>
      </div>
    );
  }

  // Check if fan is banned
  if (userData.isBanned) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-500/50 rounded-xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Account Suspended</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Your fan account has been suspended due to a violation of community guidelines.
          </p>
          {userData.banReason && (
            <p className="text-sm text-zinc-500 dark:text-zinc-500 italic">Reason: {userData.banReason}</p>
          )}
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-4">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Status Message */}
      {statusMsg && (
        <div className={`p-3 rounded-lg text-sm break-words overflow-hidden ${statusMsg.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-500/30' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/30'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Purple gradient banner for fans */}
        <div className="h-24 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500" />
        
        <div className="p-6 -mt-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
            {/* Profile Photo */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                {photoURL ? (
                  <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                    <User size={40} />
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-purple-600 rounded-full cursor-pointer hover:bg-purple-500 transition-colors">
                <Camera size={14} className="text-white" />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
              </label>
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center sm:text-left">
              {isEditing ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="text-xl font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1 text-zinc-900 dark:text-white w-full max-w-xs"
                  placeholder="Display Name"
                />
              ) : (
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{userData.name}</h1>
              )}
              <p className="text-sm text-zinc-500 dark:text-zinc-400">@{userData.username}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-600/20 text-purple-600 dark:text-purple-400 text-xs font-medium rounded-full flex items-center gap-1">
                  <Star size={10} /> Fan
                </span>
              </div>
            </div>

            {/* Edit Button */}
            <div>
              {isEditing ? (
                <div className="flex gap-2">
                  <button onClick={handleSaveProfile} disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors flex items-center gap-2 disabled:opacity-50">
                    {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                    Save
                  </button>
                  <button onClick={() => { setIsEditing(false); setDisplayName(userData.name || ''); setBio(userData.bio || ''); }} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2">
                  <Edit2 size={16} /> Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Bio Section */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-1">Bio</label>
            {isEditing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-sm resize-none"
                rows={3}
                maxLength={200}
                placeholder="Tell us about yourself as a fan..."
              />
            ) : (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{userData.bio || 'No bio yet'}</p>
            )}
          </div>

          {/* Fan Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
              <Users className="w-5 h-5 text-purple-500 dark:text-purple-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-zinc-900 dark:text-white">{userData.followedAthletes?.length || 0}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Following</div>
            </div>
            <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
              <Heart className="w-5 h-5 text-pink-500 dark:text-pink-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-zinc-900 dark:text-white">{totalKudosGiven}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Kudos Given</div>
            </div>
            <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
              <Shield className="w-5 h-5 text-green-500 dark:text-green-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-zinc-900 dark:text-white">Good</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Standing</div>
            </div>
          </div>
        </div>
      </div>

      {/* Following Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="text-purple-500 dark:text-purple-400" size={20} />
          Athletes You Follow
        </h2>

        {loadingFollowed ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : followedAthletes.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400">You're not following any athletes yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Browse public athlete profiles to start following!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {followedAthletes.map((athlete) => (
              <div key={`${athlete.team?.id}_${athlete.player.id}`} className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-4 flex items-center gap-3 group hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                {/* Athlete Photo */}
                <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden flex-shrink-0">
                  {athlete.player.photoUrl ? (
                    <img src={athlete.player.photoUrl} alt={athlete.player.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                      <User size={20} />
                    </div>
                  )}
                </div>

                {/* Athlete Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-zinc-900 dark:text-white truncate">{athlete.player.name}</h3>
                  {athlete.player.username && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">@{athlete.player.username}</p>
                  )}
                  {athlete.team && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 truncate">{athlete.team.name}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => navigateToProfile(athlete)}
                    className="p-2 bg-purple-500/20 dark:bg-purple-600/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-500/30 dark:hover:bg-purple-600/30 transition-colors"
                    title="View Profile"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => setUnfollowConfirm(athlete)}
                    className="p-2 bg-red-500/20 dark:bg-red-600/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/30 dark:hover:bg-red-600/30 transition-colors"
                    title="Unfollow"
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unfollow Confirmation Modal */}
      {unfollowConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Unfollow {unfollowConfirm.player.name}?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              You'll stop seeing updates from this athlete. You can always follow them again later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleUnfollow(unfollowConfirm)}
                disabled={unfollowing}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {unfollowing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Unfollow
              </button>
              <button
                onClick={() => setUnfollowConfirm(null)}
                disabled={unfollowing}
                className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FanProfile;
