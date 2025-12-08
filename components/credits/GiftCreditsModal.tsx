// =============================================================================
// GIFT CREDITS MODAL - Allow users to gift credits to other users
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Gift, Search, Check, Loader2, AlertTriangle, User, Coins } from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { giftCredits, getUserCreditBalance } from '../../services/creditService';

interface GiftCreditsModalProps {
  onClose: () => void;
  onGiftComplete?: () => void;
}

interface SearchResult {
  uid: string;
  name: string;
  email: string;
  role: string;
  photoURL?: string;
}

const GiftCreditsModal: React.FC<GiftCreditsModalProps> = ({ onClose, onGiftComplete }) => {
  const { user, userData } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState('');
  const [myBalance, setMyBalance] = useState(0);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (user?.uid) {
      getUserCreditBalance(user.uid).then(setMyBalance);
    }
  }, [user?.uid]);
  
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    
    setSearching(true);
    setError('');
    
    try {
      const usersRef = collection(db, 'users');
      const results: SearchResult[] = [];
      
      // Search by email (exact match)
      const emailQuery = query(usersRef, where('email', '==', searchQuery.toLowerCase()), limit(5));
      const emailSnap = await getDocs(emailQuery);
      emailSnap.forEach(doc => {
        if (doc.id !== user?.uid) {
          results.push({ uid: doc.id, ...doc.data() } as SearchResult);
        }
      });
      
      // Search by name (starts with) - only if no email results
      if (results.length === 0) {
        const nameQuery = query(
          usersRef, 
          where('name', '>=', searchQuery),
          where('name', '<=', searchQuery + '\uf8ff'),
          limit(10)
        );
        const nameSnap = await getDocs(nameQuery);
        nameSnap.forEach(doc => {
          if (doc.id !== user?.uid && !results.find(r => r.uid === doc.id)) {
            results.push({ uid: doc.id, ...doc.data() } as SearchResult);
          }
        });
      }
      
      setSearchResults(results);
      if (results.length === 0) {
        setError('No users found. Try searching by exact email.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };
  
  const handleGift = async () => {
    if (!selectedUser || !user?.uid || !userData?.name || amount <= 0) return;
    
    if (amount > myBalance) {
      setError('Insufficient credits');
      return;
    }
    
    // Additional validation
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      setError('Invalid amount');
      return;
    }
    
    setSending(true);
    setError('');
    
    try {
      // Pass all required parameters including authenticated user ID for security validation
      const result = await giftCredits(
        user.uid,           // senderId
        userData.name,      // senderName  
        selectedUser.uid,   // recipientId
        selectedUser.name,  // recipientName
        amount,             // amount
        message || undefined, // message
        user.uid            // authenticatedUserId for security validation
      );
      
      if (!result.success) {
        setError(result.error || 'Failed to send gift');
        return;
      }
      
      setSuccess(true);
      setTimeout(() => {
        onGiftComplete?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Gift error:', err);
      setError(err.message || 'Failed to send gift. Please try again.');
    } finally {
      setSending(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full">
        {/* Header */}
        <div className="border-b border-zinc-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Gift Credits</h2>
              <p className="text-sm text-slate-400">Send credits to another user</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        {success ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Gift Sent!</h3>
            <p className="text-slate-400">
              {amount} credits sent to {selectedUser?.name}
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* My Balance */}
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <span className="text-slate-400">Your Balance</span>
              <span className="flex items-center gap-2 text-amber-400 font-medium">
                <Coins size={16} />
                {myBalance.toLocaleString()} credits
              </span>
            </div>
            
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400" />
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            )}
            
            {/* Search User */}
            {!selectedUser ? (
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Find User</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by name or email"
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-slate-500"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || searchQuery.length < 2}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  </button>
                </div>
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                    {searchResults.map(result => (
                      <button
                        key={result.uid}
                        onClick={() => { setSelectedUser(result); setSearchResults([]); }}
                        className="w-full flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-left transition-colors"
                      >
                        {result.photoURL ? (
                          <img src={result.photoURL} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
                            <User size={20} className="text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{result.name}</p>
                          <p className="text-sm text-slate-400 truncate">{result.email}</p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-zinc-700 rounded text-slate-300">
                          {result.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Selected User */
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Sending to</label>
                <div className="flex items-center justify-between p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {selectedUser.photoURL ? (
                      <img src={selectedUser.photoURL} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <User size={20} className="text-purple-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{selectedUser.name}</p>
                      <p className="text-sm text-slate-400">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}
            
            {/* Amount */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Amount to Gift</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                  min="1"
                  max={myBalance}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center text-lg font-medium"
                />
                <span className="text-slate-400">credits</span>
              </div>
              {/* Quick amounts */}
              <div className="flex gap-2 mt-2">
                {[5, 10, 25, 50].filter(n => n <= myBalance).map(n => (
                  <button
                    key={n}
                    onClick={() => setAmount(n)}
                    className={`px-3 py-1 rounded text-sm ${
                      amount === n ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Message */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Message (optional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal message..."
                rows={2}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-slate-500 resize-none"
              />
            </div>
            
            {/* Send Button */}
            <button
              onClick={handleGift}
              disabled={!selectedUser || amount <= 0 || amount > myBalance || sending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Gift size={18} />
                  Send {amount} Credits
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GiftCreditsModal;
