import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, limit, where, doc, updateDoc, increment, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Star, Trophy, Users, Zap, Heart, TrendingUp, Award, Send, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { AthleteKudos as AthleteKudosType, KudosCategory, KudosCategoryInfo } from '../../types';

interface AthleteKudosProps {
  teamId: string;
  playerId: string;
  playerName: string;
}

const KUDOS_CATEGORIES: KudosCategoryInfo[] = [
  { id: 'great_play', label: 'Great Play', emoji: '🌟', description: 'Amazing play or performance' },
  { id: 'teamwork', label: 'Teamwork', emoji: '🤝', description: 'Great team collaboration' },
  { id: 'sportsmanship', label: 'Sportsmanship', emoji: '🏆', description: 'Excellent sportsmanship' },
  { id: 'improvement', label: 'Improvement', emoji: '📈', description: 'Noticeable improvement' },
  { id: 'leadership', label: 'Leadership', emoji: '👑', description: 'Strong leadership' },
  { id: 'hustle', label: 'Hustle', emoji: '⚡', description: 'Great effort and hustle' },
];

const AthleteKudos: React.FC<AthleteKudosProps> = ({ teamId, playerId, playerName }) => {
  const { user, userData } = useAuth();
  
  const [kudosList, setKudosList] = useState<AthleteKudosType[]>([]);
  const [kudosCounts, setKudosCounts] = useState<{ [key in KudosCategory]?: number }>({});
  const [totalKudos, setTotalKudos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showGiveKudos, setShowGiveKudos] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<KudosCategory | null>(null);
  const [kudosMessage, setKudosMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasGivenKudos, setHasGivenKudos] = useState(false);
  const [showAllKudos, setShowAllKudos] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load kudos
  useEffect(() => {
    const loadKudos = async () => {
      setLoading(true);
      try {
        const kudosRef = collection(db, 'teams', teamId, 'players', playerId, 'kudos');
        const kudosSnap = await getDocs(query(kudosRef, orderBy('createdAt', 'desc'), limit(50)));
        
        const kudos: AthleteKudosType[] = [];
        const counts: { [key in KudosCategory]?: number } = {};
        let total = 0;
        
        kudosSnap.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as AthleteKudosType;
          kudos.push(data);
          
          // Count by category
          if (data.category) {
            counts[data.category] = (counts[data.category] || 0) + (data.amount || 1);
          }
          total += data.amount || 1;
          
          // Check if current user has given kudos
          if (user && data.fanId === user.uid) {
            setHasGivenKudos(true);
          }
        });
        
        setKudosList(kudos);
        setKudosCounts(counts);
        setTotalKudos(total);
      } catch (err) {
        console.error('Error loading kudos:', err);
      } finally {
        setLoading(false);
      }
    };

    loadKudos();
  }, [teamId, playerId, user]);

  const handleGiveKudos = async () => {
    if (!user || !userData || !selectedCategory) return;
    
    // Only fans can give kudos
    if (userData.role !== 'Fan') {
      alert('Only fans can give kudos to athletes.');
      return;
    }
    
    setSubmitting(true);
    try {
      // Add kudos document
      const kudosData = {
        fanId: user.uid,
        fanName: userData.name || 'Anonymous Fan',
        fanUsername: userData.username || '',
        category: selectedCategory,
        amount: 1,
        message: kudosMessage.trim() || null,
        createdAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'teams', teamId, 'players', playerId, 'kudos'), kudosData);
      
      // Update player's kudos count
      const playerRef = doc(db, 'teams', teamId, 'players', playerId);
      await updateDoc(playerRef, {
        kudosCount: increment(1)
      });
      
      // Update user's kudosGiven
      const userRef = doc(db, 'users', user.uid);
      const athleteKey = `${teamId}_${playerId}`;
      await updateDoc(userRef, {
        [`kudosGiven.${athleteKey}`]: increment(1)
      });
      
      // Update local state
      const newKudos: AthleteKudosType = {
        id: Date.now().toString(),
        ...kudosData,
        createdAt: Timestamp.now(),
      };
      
      setKudosList([newKudos, ...kudosList]);
      setKudosCounts({
        ...kudosCounts,
        [selectedCategory]: (kudosCounts[selectedCategory] || 0) + 1
      });
      setTotalKudos(totalKudos + 1);
      setHasGivenKudos(true);
      setSubmitSuccess(true);
      
      // Reset form
      setSelectedCategory(null);
      setKudosMessage('');
      
      setTimeout(() => {
        setShowGiveKudos(false);
        setSubmitSuccess(false);
      }, 2000);
      
    } catch (err) {
      console.error('Error giving kudos:', err);
      alert('Failed to give kudos. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryIcon = (category: KudosCategory) => {
    switch (category) {
      case 'great_play': return <Star className="text-yellow-400" size={16} />;
      case 'teamwork': return <Users className="text-blue-400" size={16} />;
      case 'sportsmanship': return <Trophy className="text-purple-400" size={16} />;
      case 'improvement': return <TrendingUp className="text-green-400" size={16} />;
      case 'leadership': return <Award className="text-orange-400" size={16} />;
      case 'hustle': return <Zap className="text-red-400" size={16} />;
      default: return <Heart className="text-pink-400" size={16} />;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Recently';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Get top 3 categories
  const topCategories = Object.entries(kudosCounts)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 3);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Star className="text-yellow-400" size={20} />
          Kudos
          {totalKudos > 0 && (
            <span className="bg-yellow-500/20 text-yellow-400 text-sm px-2 py-0.5 rounded-full">
              {totalKudos}
            </span>
          )}
        </h3>
        
        {user && userData?.role === 'Fan' && !hasGivenKudos && (
          <button
            onClick={() => setShowGiveKudos(true)}
            className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
          >
            <Star size={14} />
            Give Kudos
          </button>
        )}
        
        {hasGivenKudos && (
          <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
            <Star size={12} fill="currentColor" />
            You gave kudos!
          </span>
        )}
      </div>

      {/* Kudos Summary */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalKudos === 0 ? (
        <div className="text-center py-6">
          <Star className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">No kudos yet</p>
          <p className="text-zinc-500 text-xs mt-1">Be the first to give {playerName} kudos!</p>
        </div>
      ) : (
        <>
          {/* Category breakdown */}
          {topCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {topCategories.map(([category, count]) => {
                const catInfo = KUDOS_CATEGORIES.find(c => c.id === category);
                return (
                  <div
                    key={category}
                    className="flex items-center gap-1.5 bg-zinc-800/50 px-3 py-1.5 rounded-full"
                  >
                    <span>{catInfo?.emoji}</span>
                    <span className="text-sm text-zinc-300">{catInfo?.label}</span>
                    <span className="text-xs bg-zinc-700 px-1.5 py-0.5 rounded-full text-zinc-400">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent kudos with messages */}
          {kudosList.filter(k => k.message).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Recent Messages</p>
              {kudosList
                .filter(k => k.message)
                .slice(0, showAllKudos ? 10 : 3)
                .map((kudos) => (
                  <div key={kudos.id} className="bg-zinc-800/30 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      {getCategoryIcon(kudos.category)}
                      <div className="flex-1">
                        <p className="text-sm text-zinc-300">{kudos.message}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          — {kudos.fanName} • {formatDate(kudos.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              
              {kudosList.filter(k => k.message).length > 3 && (
                <button
                  onClick={() => setShowAllKudos(!showAllKudos)}
                  className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                >
                  {showAllKudos ? (
                    <>Show Less <ChevronUp size={14} /></>
                  ) : (
                    <>Show More ({kudosList.filter(k => k.message).length - 3} more) <ChevronDown size={14} /></>
                  )}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Give Kudos Modal */}
      {showGiveKudos && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Give Kudos to {playerName}</h3>
              <button
                onClick={() => {
                  setShowGiveKudos(false);
                  setSelectedCategory(null);
                  setKudosMessage('');
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {submitSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="text-green-400" size={32} fill="currentColor" />
                </div>
                <p className="text-white font-medium">Kudos sent!</p>
                <p className="text-zinc-400 text-sm mt-1">Thank you for supporting {playerName}!</p>
              </div>
            ) : (
              <>
                {/* Category Selection */}
                <div className="mb-4">
                  <label className="text-sm text-zinc-400 block mb-2">Choose a category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {KUDOS_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedCategory === cat.id
                            ? 'border-yellow-500 bg-yellow-500/10'
                            : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{cat.emoji}</span>
                          <span className="text-sm font-medium text-white">{cat.label}</span>
                        </div>
                        <p className="text-xs text-zinc-500">{cat.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Message */}
                <div className="mb-4">
                  <label className="text-sm text-zinc-400 block mb-2">
                    Add a message (optional)
                  </label>
                  <textarea
                    value={kudosMessage}
                    onChange={(e) => setKudosMessage(e.target.value.slice(0, 200))}
                    placeholder={`Say something nice to ${playerName}...`}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-zinc-500 text-right mt-1">{kudosMessage.length}/200</p>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleGiveKudos}
                  disabled={!selectedCategory || submitting}
                  className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send Kudos
                    </>
                  )}
                </button>

                <p className="text-xs text-zinc-500 text-center mt-3">
                  You can give kudos once per athlete
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AthleteKudos;
