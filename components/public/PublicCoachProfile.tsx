import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile, Team, CoachKudos, CoachFeedback } from '../../types';
import { User, Crown, Users, Mail, Trophy, Calendar, MapPin, Home, X, Award, Shield, ThumbsUp, Heart, MessageSquare, Send, CheckCircle, AlertTriangle } from 'lucide-react';

interface CoachData {
  coach: UserProfile;
  teams: Team[];
  isHeadCoach: boolean[];
  kudosCount: number;
  hasGivenKudos: boolean;
}

const PublicCoachProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user, userData } = useAuth();
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [kudosMessage, setKudosMessage] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'communication' | 'conduct' | 'fairness' | 'safety' | 'other'>('other');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<'kudos' | 'feedback' | null>(null);

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

        setData({ coach, teams, isHeadCoach, kudosCount, hasGivenKudos });
      } catch (err) {
        console.error('Error fetching coach data:', err);
        setError('Failed to load coach profile');
      } finally {
        setLoading(false);
      }
    };

    fetchCoachData();
  }, [username, user]);

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

  // Handle submitting private feedback
  const handleSubmitFeedback = async () => {
    if (!user || !userData || !data || !feedbackMessage.trim()) return;
    
    setSubmitting(true);
    try {
      const parentTeamId = userData.teamId || '';
      const teamMatch = data.teams.find(t => t.id === parentTeamId);
      
      await addDoc(collection(db, 'coachFeedback'), {
        coachId: data.coach.uid,
        coachName: data.coach.name,
        parentId: user.uid,
        parentName: userData.name,
        teamId: parentTeamId,
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
      
      setTimeout(() => setSubmitSuccess(null), 3000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-800/50 rounded-2xl p-8 text-center max-w-md border border-zinc-700">
          <User className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Coach Not Found</h1>
          <p className="text-zinc-400 mb-6">
            The coach profile you're looking for doesn't exist or has been removed.
          </p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            <Home className="w-5 h-5" />
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const { coach, teams, isHeadCoach, kudosCount, hasGivenKudos } = data;
  const isParent = userData?.role === 'Parent';

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* Success Toast */}
      {submitSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-5 h-5" />
          {submitSuccess === 'kudos' ? 'Kudos sent! Thank you!' : 'Feedback submitted privately to admins'}
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-black tracking-tighter">
            <span className="text-orange-500">LOCKER</span>
            <span className="text-white">ROOM</span>
          </Link>
          <span className="text-xs text-zinc-500">Coach Profile</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 rounded-2xl p-6 md:p-8 border border-zinc-700/50 mb-8">
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
                {isHeadCoach.some(Boolean) ? (
                  <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Crown className="w-4 h-4" /> Head Coach
                  </span>
                ) : (
                  <span className="bg-zinc-700 text-zinc-300 px-3 py-1 rounded-full text-sm font-medium">
                    Coach
                  </span>
                )}
              </div>

              {/* Teams */}
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {teams.map((team, index) => (
                  <Link 
                    key={team.id}
                    to={`/team/${team.id}`}
                    className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors bg-sky-500/10 px-3 py-1 rounded-full"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="font-medium text-sm">{team.name}</span>
                    {isHeadCoach[index] && <Crown className="w-3 h-3 text-amber-400" />}
                  </Link>
                ))}
              </div>

              {/* Kudos Counter */}
              {kudosCount > 0 && (
                <div className="mt-4 flex justify-center md:justify-start">
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500/20 to-red-500/20 border border-pink-500/30 px-4 py-2 rounded-full">
                    <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                    <span className="text-white font-bold">{kudosCount}</span>
                    <span className="text-pink-300 text-sm">Kudos from Parents</span>
                  </div>
                </div>
              )}

              {/* Parent Action Buttons */}
              {isParent && user && (
                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
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
                    className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    File Grievance
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-orange-500" />
            About Coach {coach.name.split(' ')[0]}
          </h2>
          
          {coach.bio ? (
            <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{coach.bio}</p>
          ) : (
            <p className="text-zinc-500 italic">
              This coach hasn't added a bio yet.
            </p>
          )}
        </div>

        {/* Contact Info (if available and public) */}
        {coach.email && (
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-500" />
              Contact
            </h2>
            <p className="text-zinc-400">
              <span className="text-zinc-500">Email:</span>{' '}
              <a href={`mailto:${coach.email}`} className="text-sky-400 hover:text-sky-300 transition-colors">
                {coach.email}
              </a>
            </p>
          </div>
        )}

        {/* Teams Overview */}
        {teams.length > 0 && (
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Teams
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teams.map((team, index) => (
                <Link
                  key={team.id}
                  to={`/team/${team.id}`}
                  className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      isHeadCoach[index] ? 'bg-amber-500' : 'bg-zinc-700'
                    }`}>
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{team.name}</p>
                      <p className="text-xs text-zinc-500">
                        {isHeadCoach[index] ? 'Head Coach' : 'Coach'}
                      </p>
                      {team.record && (
                        <p className="text-xs text-zinc-400 mt-1">
                          Record: {team.record.wins}-{team.record.losses}-{team.record.ties}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-zinc-600 text-sm">
          <p>Powered by <span className="text-orange-500 font-bold">LockerRoom</span></p>
        </footer>
      </main>

      {/* Photo Modal */}
      {showPhotoModal && coach.photoUrl && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative max-w-2xl max-h-[80vh]">
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-zinc-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={coach.photoUrl} 
              alt={coach.name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <p className="text-center text-white font-bold mt-4">{coach.name}</p>
          </div>
        </div>
      )}

      {/* Kudos Modal */}
      {showKudosModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Heart className="w-6 h-6 text-pink-500" />
                Give Kudos
              </h3>
              <button onClick={() => setShowKudosModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-zinc-400 mb-4">
              Show your appreciation for Coach {coach.name.split(' ')[0]}! Your kudos will be displayed publicly.
            </p>
            
            <textarea
              value={kudosMessage}
              onChange={(e) => setKudosMessage(e.target.value)}
              placeholder="Add a short thank you message (optional)"
              maxLength={200}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 resize-none"
              rows={3}
            />
            <p className="text-xs text-zinc-500 mt-1 mb-4">{kudosMessage.length}/200 characters</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowKudosModal(false)}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGiveKudos}
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-500 hover:to-red-500 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-sky-500" />
                File Grievance
              </h3>
              <button onClick={() => setShowFeedbackModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 mb-4">
              <p className="text-sky-300 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                This feedback is private and will only be seen by organization administrators. It will not be shown to the coach.
              </p>
            </div>
            
            <label className="block text-sm font-medium text-zinc-300 mb-2">Category</label>
            <select
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value as any)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white mb-4 focus:outline-none focus:border-sky-500"
            >
              <option value="communication">Communication</option>
              <option value="conduct">Conduct/Behavior</option>
              <option value="fairness">Fairness/Playing Time</option>
              <option value="safety">Safety Concern</option>
              <option value="other">Other</option>
            </select>
            
            <label className="block text-sm font-medium text-zinc-300 mb-2">Your Feedback</label>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="Please describe your concern..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 resize-none"
              rows={4}
            />
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                disabled={submitting || !feedbackMessage.trim()}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
