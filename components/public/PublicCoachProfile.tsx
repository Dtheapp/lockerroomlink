import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp, updateDoc, setDoc, runTransaction, deleteDoc, increment, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile, Team, CoachKudos, CoachFeedback, CoachFollower } from '../../types';
import { User, Crown, Users, Mail, Trophy, Calendar, MapPin, Home, X, Award, Shield, ThumbsUp, Heart, MessageSquare, Send, CheckCircle, AlertTriangle, Sword, Zap, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import CoachPublicChat from './CoachPublicChat';
import CoachAnnouncements from './CoachAnnouncements';

interface CoachData {
  coach: UserProfile;
  teams: Team[];
  isHeadCoach: boolean[];
  isOC: boolean[]; // Offensive Coordinator for each team
  isDC: boolean[]; // Defensive Coordinator for each team
  isSTC: boolean[]; // Special Teams Coordinator for each team
  kudosCount: number;
  hasGivenKudos: boolean;
}

const PublicCoachProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user, userData, players } = useAuth();
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [kudosMessage, setKudosMessage] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'communication' | 'conduct' | 'fairness' | 'safety' | 'other'>('other');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<'kudos' | 'feedback' | null>(null);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Get unique teams the parent's kids are on (that this coach also coaches)
  const parentTeams = React.useMemo(() => {
    if (!players || !data) return [];
    const teamIds = [...new Set(players.map(p => p.teamId).filter(Boolean))];
    return data.teams.filter(t => teamIds.includes(t.id));
  }, [players, data]);

  useEffect(() => {
    const fetchCoachData = async () => {
      if (!username) {
        setError('No coach username provided');
        setLoading(false);
        return;
      }

      try {
        // Query coach by username
        const coachQuery = query(
          collection(db, 'users'),
          where('username', '==', username),
          where('role', '==', 'Coach')
        );
        const coachSnapshot = await getDocs(coachQuery);
        
        if (coachSnapshot.empty) {
          setError('Coach not found');
          setLoading(false);
          return;
        }

        const coachDoc = coachSnapshot.docs[0];
        const coach = { uid: coachDoc.id, ...coachDoc.data() } as UserProfile;
        const coachId = coachDoc.id;

        // Get teams this coach belongs to - check both teamIds and query all teams
        const processedTeamIds = new Set<string>();
        const teams: Team[] = [];
        const isHeadCoach: boolean[] = [];
        const isOC: boolean[] = [];
        const isDC: boolean[] = [];
        const isSTC: boolean[] = [];
        
        // Method 1: Get teams from coach's teamIds array
        const teamIds = coach.teamIds || [];
        if (coach.teamId && !teamIds.includes(coach.teamId)) {
          teamIds.push(coach.teamId);
        }

        for (const teamId of teamIds) {
          if (processedTeamIds.has(teamId)) continue;
          processedTeamIds.add(teamId);
          
          const teamDoc = await getDoc(doc(db, 'teams', teamId));
          if (teamDoc.exists()) {
            const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
            teams.push(team);
            isHeadCoach.push(team.headCoachId === coachId || team.coachId === coachId);
            isOC.push(team.offensiveCoordinatorId === coachId);
            isDC.push(team.defensiveCoordinatorId === coachId);
            isSTC.push(team.specialTeamsCoordinatorId === coachId);
          }
        }
        
        // Method 2: Query all teams to find any where this coach is in coachIds array, headCoachId, or coachId
        const allTeamsSnapshot = await getDocs(collection(db, 'teams'));
        allTeamsSnapshot.docs.forEach(teamDocSnap => {
          const teamId = teamDocSnap.id;
          if (processedTeamIds.has(teamId)) return;
          
          const teamData = teamDocSnap.data();
          const isInCoachIds = teamData.coachIds && teamData.coachIds.includes(coachId);
          const isHeadOrMain = teamData.headCoachId === coachId || teamData.coachId === coachId;
          
          if (isInCoachIds || isHeadOrMain) {
            processedTeamIds.add(teamId);
            const team = { id: teamId, ...teamData } as Team;
            teams.push(team);
            isHeadCoach.push(isHeadOrMain);
            isOC.push(teamData.offensiveCoordinatorId === coachId);
            isDC.push(teamData.defensiveCoordinatorId === coachId);
            isSTC.push(teamData.specialTeamsCoordinatorId === coachId);
          }
        });

        // Get kudos count
        const kudosQuery = query(collection(db, 'coachKudos'), where('coachId', '==', coachId));
        const kudosSnapshot = await getDocs(kudosQuery);
        const kudosCount = kudosSnapshot.size;
        
        // Check if current user has already given kudos
        let hasGivenKudos = false;
        if (user) {
          kudosSnapshot.forEach(doc => {
            if (doc.data().parentId === user.uid) {
              hasGivenKudos = true;
            }
          });
        }

        setData({ coach, teams, isHeadCoach, isOC, isDC, isSTC, kudosCount, hasGivenKudos });
        setFollowerCount(coach.followerCount || 0);
      } catch (err) {
        console.error('Error fetching coach data:', err);
        setError('Failed to load coach profile');
      } finally {
        setLoading(false);
      }
    };

    fetchCoachData();
  }, [username, user]);

  // Check if current user is following this coach
  useEffect(() => {
    if (data && userData?.followedCoaches) {
      setIsFollowing(userData.followedCoaches.includes(data.coach.uid));
    }
  }, [data, userData]);

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!user || !userData || !data) return;
    
    setFollowLoading(true);
    const coachId = data.coach.uid;
    
    try {
      if (isFollowing) {
        // Unfollow
        await updateDoc(doc(db, 'users', user.uid), {
          followedCoaches: arrayRemove(coachId)
        });
        
        // Remove from coach's followers subcollection
        await deleteDoc(doc(db, 'users', coachId, 'followers', user.uid));
        
        // Decrement follower count
        await updateDoc(doc(db, 'users', coachId), {
          followerCount: increment(-1)
        });
        
        setFollowerCount(prev => Math.max(0, prev - 1));
        setIsFollowing(false);
      } else {
        // Follow
        await updateDoc(doc(db, 'users', user.uid), {
          followedCoaches: arrayUnion(coachId)
        });
        
        // Add to coach's followers subcollection
        const followerData: CoachFollower = {
          oddsId: user.uid,
          followerName: userData.name || 'User',
          followerUsername: userData.username || '',
          followerRole: userData.role as 'Fan' | 'Parent' | 'Coach',
          followedAt: Timestamp.now()
        };
        await setDoc(doc(db, 'users', coachId, 'followers', user.uid), followerData);
        
        // Increment follower count
        await updateDoc(doc(db, 'users', coachId), {
          followerCount: increment(1)
        });
        
        setFollowerCount(prev => prev + 1);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle giving kudos
  const handleGiveKudos = async () => {
    if (!user || !userData || !data || data.hasGivenKudos) return;
    
    setSubmitting(true);
    try {
      // Find the team connection between parent and coach
      const parentTeamId = userData.teamId || '';
      const teamMatch = data.teams.find(t => t.id === parentTeamId);
      const noteText = kudosMessage.trim();
      
      await addDoc(collection(db, 'coachKudos'), {
        coachId: data.coach.uid,
        parentId: user.uid,
        parentName: userData.name,
        teamId: parentTeamId,
        teamName: teamMatch?.name || 'Unknown Team',
        message: noteText || null,
        createdAt: serverTimestamp()
      });
      
      // Send a private message to the coach notifying them of the kudos
      try {
        console.log('Attempting to send kudos notification to coach:', data.coach.uid);
        console.log('From parent:', user.uid);
        
        // Check if a chat already exists between parent and coach
        const chatsQuery = query(
          collection(db, 'private_chats'),
          where('participants', 'array-contains', user.uid)
        );
        const chatsSnapshot = await getDocs(chatsQuery);
        let existingChatId: string | null = null;
        
        chatsSnapshot.forEach(chatDoc => {
          const chatData = chatDoc.data();
          if (chatData.participants.includes(data.coach.uid)) {
            existingChatId = chatDoc.id;
          }
        });
        
        console.log('Existing chat found:', existingChatId);
        
        // Build the kudos notification message
        let kudosNotificationMessage = `🎉 Congratulations! ${userData.name} just sent you kudos!`;
        if (noteText) {
          kudosNotificationMessage += `\n\n💬 "${noteText}"`;
        }
        kudosNotificationMessage += `\n\nKeep up the great work, Coach! 💪`;
        
        if (existingChatId) {
          // Add message to existing chat
          console.log('Adding message to existing chat:', existingChatId);
          await addDoc(collection(db, 'private_chats', existingChatId, 'messages'), {
            text: kudosNotificationMessage,
            senderId: user.uid,
            timestamp: serverTimestamp(),
            isKudosNotification: true
          });
          await updateDoc(doc(db, 'private_chats', existingChatId), {
            lastMessage: kudosNotificationMessage.split('\n')[0],
            updatedAt: serverTimestamp(),
            lastMessageTime: serverTimestamp(),
            lastSenderId: user.uid
          });
          console.log('Message sent to existing chat successfully');
        } else {
          // Create a new chat and send the message
          console.log('Creating new chat between parent and coach');
          const participantData = {
            [user.uid]: { username: userData.username || userData.name, role: userData.role },
            [data.coach.uid]: { username: data.coach.username || data.coach.name, role: data.coach.role }
          };
          console.log('Participant data:', participantData);
          
          const newChatRef = await addDoc(collection(db, 'private_chats'), {
            participants: [user.uid, data.coach.uid],
            participantData,
            lastMessage: kudosNotificationMessage.split('\n')[0],
            updatedAt: serverTimestamp(),
            lastMessageTime: serverTimestamp(),
            lastSenderId: user.uid
          });
          console.log('New chat created with ID:', newChatRef.id);
          
          await addDoc(collection(db, 'private_chats', newChatRef.id, 'messages'), {
            text: kudosNotificationMessage,
            senderId: user.uid,
            timestamp: serverTimestamp(),
            isKudosNotification: true
          });
          console.log('Message added to new chat successfully');
        }
      } catch (msgError) {
        console.error('Error sending kudos notification message:', msgError);
        // Kudos was saved, just the notification failed - don't show error to user
      }
      
      // Update local state
      setData(prev => prev ? { ...prev, kudosCount: prev.kudosCount + 1, hasGivenKudos: true } : null);
      setSubmitSuccess('kudos');
      setShowKudosModal(false);
      setKudosMessage('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(null), 3000);
    } catch (err) {
      console.error('Error giving kudos:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle submitting private feedback (grievance)
  const handleSubmitFeedback = async () => {
    if (!user || !userData || !data || !feedbackMessage.trim() || !selectedTeamId) return;
    
    setSubmitting(true);
    try {
      const teamMatch = data.teams.find(t => t.id === selectedTeamId);
      
      // Get next grievance number using transaction for atomic increment
      const counterRef = doc(db, 'grievance_meta', 'counter');
      let nextGrievanceNumber = 1;
      
      try {
        await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (counterDoc.exists()) {
            nextGrievanceNumber = (counterDoc.data().lastNumber || 0) + 1;
            transaction.update(counterRef, { lastNumber: nextGrievanceNumber });
          } else {
            nextGrievanceNumber = 1;
            transaction.set(counterRef, { lastNumber: 1 });
          }
        });
      } catch (err) {
        console.error('Transaction failed, using fallback:', err);
        // Fallback: just count existing grievances
        const grievancesSnapshot = await getDocs(collection(db, 'coachFeedback'));
        nextGrievanceNumber = grievancesSnapshot.size + 1;
      }
      
      // Create a dedicated grievance chat in grievance_chats collection
      const grievanceChatRef = await addDoc(collection(db, 'grievance_chats'), {
        parentId: user.uid,
        parentName: userData.name || 'Parent',
        grievanceNumber: nextGrievanceNumber,
        coachId: data.coach.uid,
        coachName: data.coach.name,
        teamId: selectedTeamId,
        teamName: teamMatch?.name || 'Unknown Team',
        category: feedbackCategory,
        lastMessage: '📋 Grievance Filed',
        lastSenderId: 'grievance-system',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      // Send the initial acknowledgment message
      const acknowledgmentMessage = `📋 Grievance #${nextGrievanceNumber} Filed

Thank you for submitting your grievance regarding Coach ${data.coach.name}.

Category: ${feedbackCategory.charAt(0).toUpperCase() + feedbackCategory.slice(1)}
Team: ${teamMatch?.name || 'Unknown Team'}

Your concern:
"${feedbackMessage.trim()}"

We have received your report and our administration team will review it promptly. We take all concerns seriously and will work to address this matter in a timely manner.

You will receive updates in this chat as your grievance is reviewed.

— OSYS Administration`;
      
      await addDoc(collection(db, 'grievance_chats', grievanceChatRef.id, 'messages'), {
        text: acknowledgmentMessage,
        senderId: 'grievance-system',
        timestamp: serverTimestamp(),
        isSystemMessage: true
      });
      
      // Save the grievance with the chat ID and grievance number
      await addDoc(collection(db, 'coachFeedback'), {
        grievanceNumber: nextGrievanceNumber,
        chatId: grievanceChatRef.id, // Link to the dedicated grievance chat
        coachId: data.coach.uid,
        coachName: data.coach.name,
        parentId: user.uid,
        parentName: userData.name,
        teamId: selectedTeamId,
        teamName: teamMatch?.name || 'Unknown Team',
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        status: 'new',
        createdAt: serverTimestamp()
      });
      
      setSubmitSuccess('feedback');
      setShowFeedbackModal(false);
      setFeedbackMessage('');
      setFeedbackCategory('other');
      setSelectedTeamId('');
      
      setTimeout(() => setSubmitSuccess(null), 3000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
        {/* Premium Animated Background */}
        <div className="osys-bg">
          <div className="osys-bg-gradient"></div>
          <div className="osys-bg-mesh"></div>
          <div className="osys-orb osys-orb-1"></div>
          <div className="osys-orb osys-orb-2"></div>
          <div className="osys-orb osys-orb-3"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400 animate-pulse">Loading coach profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Premium Animated Background */}
        <div className="osys-bg">
          <div className="osys-bg-gradient"></div>
          <div className="osys-bg-mesh"></div>
          <div className="osys-orb osys-orb-1"></div>
          <div className="osys-orb osys-orb-2"></div>
          <div className="osys-orb osys-orb-3"></div>
        </div>
        <div className="relative z-10 osys-glass bg-slate-900/60 backdrop-blur-xl rounded-2xl p-8 text-center max-w-md border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 mx-auto mb-4 flex items-center justify-center">
            <User className="w-8 h-8 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Coach Not Found</h1>
          <p className="text-slate-400 mb-6">
            The coach profile you're looking for doesn't exist or has been removed.
          </p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-indigo-500/30"
          >
            <Home className="w-5 h-5" />
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const { coach, teams, isHeadCoach, isOC, isDC, isSTC, kudosCount, hasGivenKudos } = data;
  const isParent = userData?.role === 'Parent';

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Premium Animated Background */}
      <div className="osys-bg">
        <div className="osys-bg-gradient"></div>
        <div className="osys-bg-mesh"></div>
        <div className="osys-orb osys-orb-1"></div>
        <div className="osys-orb osys-orb-2"></div>
        <div className="osys-orb osys-orb-3"></div>
      </div>
      
      {/* Success Toast */}
      {submitSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-xl shadow-lg shadow-emerald-500/30 flex items-center gap-2 animate-fade-in border border-emerald-400/30">
          <CheckCircle className="w-5 h-5" />
          {submitSuccess === 'kudos' ? 'Kudos sent! Thank you!' : 'Feedback submitted privately to admins'}
        </div>
      )}

      {/* Header Bar */}
      <header className="relative z-20 bg-slate-900/60 backdrop-blur-xl border-b border-white/10 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-black tracking-tighter">
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">OSYS</span>
          </Link>
          <span className="text-xs text-slate-500 px-3 py-1 rounded-full bg-slate-800/50 border border-white/10">Coach Profile</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        {/* Hero Section */}
        <div className="osys-glass bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-white/10 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Coach Photo */}
            <div className="relative">
              {coach.photoUrl ? (
                <img 
                  src={coach.photoUrl} 
                  alt={coach.name} 
                  onClick={() => setShowPhotoModal(true)}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] cursor-pointer hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center border-4 border-amber-500">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
              {/* Head Coach Badge */}
              {isHeadCoach.some(Boolean) && (
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                  <Crown className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            {/* Coach Info */}
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{coach.name}</h1>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                {isHeadCoach.some(Boolean) && (
                  <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Crown className="w-4 h-4" /> Head Coach
                  </span>
                )}
                {isOC.some(Boolean) && (
                  <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Sword className="w-4 h-4" /> Offensive Coordinator
                  </span>
                )}
                {isDC.some(Boolean) && (
                  <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Defensive Coordinator
                  </span>
                )}
                {!isHeadCoach.some(Boolean) && !isOC.some(Boolean) && !isDC.some(Boolean) && (
                  <span className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-lg text-sm font-medium border border-white/10">
                    Coach
                  </span>
                )}
              </div>

              {/* Teams */}
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {teams.map((team, index) => (
                  <a 
                    key={team.id}
                    href={`#/team/${team.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors bg-sky-500/10 px-3 py-1 rounded-full"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="font-medium text-sm">{team.name}</span>
                    {isHeadCoach[index] && <span title="Head Coach"><Crown className="w-3 h-3 text-amber-400" /></span>}
                    {isOC[index] && <span title="Offensive Coordinator"><Sword className="w-3 h-3 text-red-400" /></span>}
                    {isDC[index] && <span title="Defensive Coordinator"><Shield className="w-3 h-3 text-blue-400" /></span>}
                    {isSTC[index] && <span title="Special Teams Coordinator"><Zap className="w-3 h-3 text-yellow-400" /></span>}
                  </a>
                ))}
              </div>

              {/* Stats Row - Followers & Kudos */}
              <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                {/* Follower Count */}
                <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 px-4 py-2 rounded-full">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-white font-bold">{followerCount}</span>
                  <span className="text-blue-300 text-sm">{followerCount === 1 ? 'Follower' : 'Followers'}</span>
                </div>

                {/* Kudos Counter */}
                {kudosCount > 0 && (
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500/20 to-red-500/20 border border-pink-500/30 px-4 py-2 rounded-full">
                    <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                    <span className="text-white font-bold">{kudosCount}</span>
                    <span className="text-pink-300 text-sm">Kudos</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                {/* Follow Button - for any logged in user */}
                {user && user.uid !== coach.uid && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                      isFollowing 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {followLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Follow
                      </>
                    )}
                  </button>
                )}

                {/* Parent-only actions */}
                {isParent && user && (
                  <>
                    {!hasGivenKudos ? (
                      <button
                        onClick={() => setShowKudosModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-500 hover:to-red-500 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-lg hover:shadow-pink-500/25"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        Give Kudos
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 bg-pink-500/20 text-pink-300 px-4 py-2 rounded-lg font-semibold">
                        <Heart className="w-4 h-4 fill-pink-400" />
                        You gave kudos!
                      </span>
                    )}
                    <button
                      onClick={() => setShowFeedbackModal(true)}
                      className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-4 py-2 rounded-xl font-semibold transition-all border border-white/10"
                    >
                      <MessageSquare className="w-4 h-4" />
                      File Grievance
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="osys-glass bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-8 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            About Coach {coach.name.split(' ')[0]}
          </h2>
          
          {coach.bio ? (
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{coach.bio}</p>
          ) : (
            <p className="text-slate-500 italic">
              This coach hasn't added a bio yet.
            </p>
          )}
        </div>

        {/* Contact Info (if available and public) */}
        {coach.email && (
          <div className="osys-glass bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-8 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              Contact
            </h2>
            <p className="text-slate-400">
              <span className="text-slate-500">Email:</span>{' '}
              <a href={`mailto:${coach.email}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                {coach.email}
              </a>
            </p>
          </div>
        )}

        {/* Teams Overview */}
        {teams.length > 0 && (
          <div className="osys-glass bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Teams
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teams.map((team, index) => {
                // Build role display
                const roles: string[] = [];
                if (isHeadCoach[index]) roles.push('HC');
                if (isOC[index]) roles.push('OC');
                if (isDC[index]) roles.push('DC');
                if (isSTC[index]) roles.push('STC');
                const roleText = roles.length > 0 ? roles.join(' / ') : 'Coach';
                
                return (
                <a
                  key={team.id}
                  href={`#/team/${team.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-800/50 rounded-xl p-4 border border-white/10 hover:border-white/20 hover:bg-slate-800/70 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isHeadCoach[index] ? 'bg-gradient-to-br from-amber-500 to-orange-600' : (isOC[index] || isDC[index] || isSTC[index]) ? 'bg-gradient-to-br from-purple-600 to-indigo-600' : 'bg-slate-700/50'
                    }`}>
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{team.name}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {isHeadCoach[index] && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">HC</span>
                        )}
                        {isOC[index] && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">OC</span>
                        )}
                        {isDC[index] && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">DC</span>
                        )}
                        {isSTC[index] && (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">STC</span>
                        )}
                        {!isHeadCoach[index] && !isOC[index] && !isDC[index] && !isSTC[index] && (
                          <span className="text-[10px] text-slate-500">Coach</span>
                        )}
                      </div>
                      {team.record && (
                        <p className="text-xs text-slate-400 mt-1">
                          Record: {team.record.wins}-{team.record.losses}-{team.record.ties}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Coach Public Chat */}
        <div className="mb-8">
          <CoachPublicChat
            coachId={coach.uid}
            coachName={coach.name}
          />
        </div>

        {/* Coach Announcements */}
        <div className="mb-8">
          <CoachAnnouncements
            coachId={coach.uid}
            coachName={coach.name}
          />
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center py-8 border-t border-white/10">
          <p className="text-slate-500 text-sm">
            Powered by <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent font-bold">OSYS</span>
          </p>
          <p className="text-slate-600 text-xs mt-1">The Operating System for Youth Sports</p>
        </footer>
      </main>

      {/* Photo Modal */}
      {showPhotoModal && coach.photoUrl && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative max-w-2xl max-h-[80vh]">
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={coach.photoUrl} 
              alt={coach.name}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl border border-white/10"
            />
            <p className="text-center text-white font-bold mt-4">{coach.name}</p>
          </div>
        </div>
      )}

      {/* Kudos Modal */}
      {showKudosModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="osys-glass bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Heart className="w-6 h-6 text-pink-500" />
                Give Kudos
              </h3>
              <button onClick={() => setShowKudosModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-slate-400 mb-4">
              Show your appreciation for Coach {coach.name.split(' ')[0]}! Your kudos will be displayed publicly.
            </p>
            
            <textarea
              value={kudosMessage}
              onChange={(e) => setKudosMessage(e.target.value)}
              placeholder="Add a short thank you message (optional)"
              maxLength={200}
              className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 resize-none transition-all"
              rows={3}
            />
            <p className="text-xs text-slate-500 mt-1 mb-4">{kudosMessage.length}/200 characters</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowKudosModal(false)}
                className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-white py-3 rounded-xl font-semibold transition-all border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleGiveKudos}
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-500 hover:to-red-500 text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] shadow-lg shadow-pink-500/20"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ThumbsUp className="w-4 h-4" />
                    Send Kudos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="osys-glass bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-sky-500" />
                File Grievance
              </h3>
              <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3 mb-4">
              <p className="text-sky-300 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                This grievance is private and will only be seen by organization administrators. It will not be shown to the coach.
              </p>
            </div>

            <label className="block text-sm font-medium text-slate-300 mb-2">Select Team <span className="text-red-400">*</span></label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-white mb-4 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            >
              <option value="">-- Select the team --</option>
              {parentTeams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            
            <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
            <select
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value as any)}
              className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-white mb-4 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            >
              <option value="communication">Communication</option>
              <option value="conduct">Conduct/Behavior</option>
              <option value="fairness">Fairness/Playing Time</option>
              <option value="safety">Safety Concern</option>
              <option value="other">Other</option>
            </select>
            
            <label className="block text-sm font-medium text-slate-300 mb-2">Describe Your Concern <span className="text-red-400">*</span></label>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="Please describe your concern in detail..."
              className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none transition-all"
              rows={4}
            />
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-white py-3 rounded-xl font-semibold transition-all border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                disabled={submitting || !feedbackMessage.trim() || !selectedTeamId}
                className="flex-1 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] shadow-lg shadow-sky-500/20"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicCoachProfile;
