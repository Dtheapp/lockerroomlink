/**
 * Commissioner Announcements Component
 * Push notifications to teams/players and bulletins on team pages
 * Only commissioner can edit/delete, bulletins can auto-expire
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team } from '../../types';
import { 
  Shield, 
  Loader2, 
  Send,
  ChevronDown,
  Trash2,
  Edit2,
  Bell,
  Megaphone,
  Users,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Plus
} from 'lucide-react';

interface Bulletin {
  id: string;
  title: string;
  message: string;
  teamIds: string[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  expiresAt?: Timestamp;
  createdBy: string;
  creatorName: string;
  isPinned?: boolean;
  type: 'bulletin' | 'notification';
  sentToPlayers?: boolean;
}

export const CommissionerAnnouncements: React.FC = () => {
  const { userData, user } = useAuth();
  const { theme } = useTheme();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<Bulletin | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [sendToPlayers, setSendToPlayers] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('never'); // 'never', '1day', '3days', '7days', '30days'
  const [isPinned, setIsPinned] = useState(false);
  const [announcementType, setAnnouncementType] = useState<'bulletin' | 'notification'>('bulletin');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load teams and bulletins
  useEffect(() => {
    if (!userData?.uid) {
      setLoading(false);
      return;
    }

    const loadTeams = async () => {
      try {
        const teamsQuery = query(
          collection(db, 'teams'),
          where('ownerId', '==', userData.uid)
        );
        const teamsSnap = await getDocs(teamsQuery);
        setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      } catch (error) {
        console.error('Error loading teams:', error);
      }
    };

    loadTeams();
  }, [user?.uid]);

  // Listen to bulletins
  useEffect(() => {
    if (!user?.uid) return;

    const bulletinsQuery = query(
      collection(db, 'commissionerBulletins'),
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(bulletinsQuery, (snapshot) => {
      const bulletinsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Bulletin));
      setBulletins(bulletinsData);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to bulletins:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setSelectedTeamIds([]);
    setSendToPlayers(false);
    setExpiresIn('never');
    setIsPinned(false);
    setAnnouncementType('bulletin');
    setEditingBulletin(null);
    setError(null);
  };

  const openEditModal = (bulletin: Bulletin) => {
    setEditingBulletin(bulletin);
    setTitle(bulletin.title);
    setMessage(bulletin.message);
    setSelectedTeamIds(bulletin.teamIds);
    setSendToPlayers(bulletin.sentToPlayers || false);
    setIsPinned(bulletin.isPinned || false);
    setAnnouncementType(bulletin.type);
    setShowCreateModal(true);
  };

  const handleCreateBulletin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim() || selectedTeamIds.length === 0) {
      setError('Please fill in all required fields and select at least one team.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Calculate expiration date
      let expiresAt: Date | null = null;
      if (expiresIn !== 'never') {
        const days = parseInt(expiresIn.replace('days', '').replace('day', ''));
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
      }

      const bulletinData = {
        title: title.trim(),
        message: message.trim(),
        teamIds: selectedTeamIds,
        createdBy: user?.uid,
        creatorName: userData?.name || 'Commissioner',
        isPinned,
        type: announcementType,
        sentToPlayers: sendToPlayers,
        updatedAt: serverTimestamp(),
        ...(expiresAt && { expiresAt: Timestamp.fromDate(expiresAt) })
      };

      if (editingBulletin) {
        // Update existing bulletin
        await updateDoc(doc(db, 'commissionerBulletins', editingBulletin.id), bulletinData);
        
        // Update on team pages
        for (const teamId of selectedTeamIds) {
          const teamBulletinRef = doc(db, 'teams', teamId, 'bulletins', editingBulletin.id);
          await updateDoc(teamBulletinRef, bulletinData).catch(() => {
            // If doesn't exist, create it
            addDoc(collection(db, 'teams', teamId, 'bulletins'), {
              ...bulletinData,
              bulletinId: editingBulletin.id,
              createdAt: serverTimestamp()
            });
          });
        }
        
        setSuccess('Announcement updated successfully!');
      } else {
        // Create new bulletin
        const newBulletin = await addDoc(collection(db, 'commissionerBulletins'), {
          ...bulletinData,
          createdAt: serverTimestamp()
        });

        // Add to each team's bulletins subcollection
        for (const teamId of selectedTeamIds) {
          await addDoc(collection(db, 'teams', teamId, 'bulletins'), {
            ...bulletinData,
            bulletinId: newBulletin.id,
            createdAt: serverTimestamp()
          });
        }

        // If notification type and sendToPlayers, create notifications
        if (announcementType === 'notification' && sendToPlayers) {
          // This would typically trigger a Cloud Function for push notifications
          // For now, we store the notification intent
          console.log('Would send push notification to players of teams:', selectedTeamIds);
        }

        setSuccess('Announcement created and posted to team pages!');
      }

      setTimeout(() => setSuccess(null), 3000);
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      console.error('Error saving bulletin:', err);
      setError(err.message || 'Failed to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBulletin = async (bulletinId: string, teamIds: string[]) => {
    setDeletingId(bulletinId);
    
    try {
      // Delete from main collection
      await deleteDoc(doc(db, 'commissionerBulletins', bulletinId));
      
      // Delete from each team's bulletins subcollection
      for (const teamId of teamIds) {
        const teamBulletinsRef = collection(db, 'teams', teamId, 'bulletins');
        const q = query(teamBulletinsRef, where('bulletinId', '==', bulletinId));
        const snap = await getDocs(q);
        
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, 'teams', teamId, 'bulletins', docSnap.id));
        }
      }
      
      setSuccess('Announcement deleted from all teams.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error deleting bulletin:', error);
      setError('Failed to delete announcement.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeamIds(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const selectAllTeams = () => {
    setSelectedTeamIds(teams.map(t => t.id!));
  };

  const getTeamNames = (teamIds: string[]) => {
    return teamIds
      .map(id => teams.find(t => t.id === id)?.name || 'Unknown')
      .join(', ');
  };

  const isExpired = (bulletin: Bulletin) => {
    if (!bulletin.expiresAt) return false;
    return bulletin.expiresAt.toDate() < new Date();
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/commissioner" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
                <Shield className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Announcements</h1>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Post bulletins to team pages & send notifications
                </p>
              </div>
            </div>
            
            <button
              onClick={() => { resetForm(); setShowCreateModal(true); }}
              disabled={teams.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Announcement</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-500">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-500">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        {teams.length === 0 ? (
          <div className={`rounded-xl p-12 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <Megaphone className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>No Teams Yet</h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Create teams first to start posting announcements.
            </p>
            <Link
              to="/commissioner/teams/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Create Team
            </Link>
          </div>
        ) : bulletins.length === 0 ? (
          <div className={`rounded-xl p-12 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <Megaphone className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>No Announcements Yet</h2>
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Create your first announcement to post to team pages.
            </p>
            <button
              onClick={() => { resetForm(); setShowCreateModal(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Announcement
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {bulletins.map(bulletin => {
              const expired = isExpired(bulletin);
              
              return (
                <div 
                  key={bulletin.id}
                  className={`rounded-xl p-5 ${
                    expired 
                      ? theme === 'dark' ? 'bg-gray-800/50 opacity-60' : 'bg-gray-100 opacity-60'
                      : theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {bulletin.type === 'notification' ? (
                          <Bell className="w-4 h-4 text-purple-500" />
                        ) : (
                          <Megaphone className="w-4 h-4 text-orange-500" />
                        )}
                        <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {bulletin.title}
                        </h3>
                        {bulletin.isPinned && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">
                            Pinned
                          </span>
                        )}
                        {expired && (
                          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-500 rounded">
                            Expired
                          </span>
                        )}
                      </div>
                      
                      <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {bulletin.message}
                      </p>
                      
                      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {getTeamNames(bulletin.teamIds)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {bulletin.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                        </span>
                        {bulletin.expiresAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Expires: {bulletin.expiresAt.toDate().toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(bulletin)}
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBulletin(bulletin.id, bulletin.teamIds)}
                        disabled={deletingId === bulletin.id}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        {deletingId === bulletin.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {editingBulletin ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <form onSubmit={handleCreateBulletin} className="space-y-5">
              {/* Type Selection */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Type
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAnnouncementType('bulletin')}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${
                      announcementType === 'bulletin'
                        ? 'border-purple-500 bg-purple-500/10'
                        : theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Megaphone className={`w-5 h-5 ${announcementType === 'bulletin' ? 'text-purple-500' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={announcementType === 'bulletin' ? 'text-purple-500 font-medium' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      Bulletin
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnouncementType('notification')}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${
                      announcementType === 'notification'
                        ? 'border-purple-500 bg-purple-500/10'
                        : theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Bell className={`w-5 h-5 ${announcementType === 'notification' ? 'text-purple-500' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={announcementType === 'notification' ? 'text-purple-500 font-medium' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      Notification
                    </span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title..."
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your announcement..."
                  rows={4}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  required
                />
              </div>

              {/* Team Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Select Teams *
                  </label>
                  <button
                    type="button"
                    onClick={selectAllTeams}
                    className="text-xs text-purple-500 hover:text-purple-400"
                  >
                    Select All
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {teams.map(team => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleTeamSelection(team.id!)}
                      className={`p-2 rounded-lg border text-left text-sm transition-all ${
                        selectedTeamIds.includes(team.id!)
                          ? 'border-purple-500 bg-purple-500/10'
                          : theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={selectedTeamIds.includes(team.id!) ? 'text-purple-500 font-medium' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                        {team.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {/* Send to Players */}
                {announcementType === 'notification' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendToPlayers}
                      onChange={(e) => setSendToPlayers(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Send push notification to all players
                    </span>
                  </label>
                )}

                {/* Pin */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Pin to top of bulletin board
                  </span>
                </label>

                {/* Expiration */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Auto-expire after
                  </label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      theme === 'dark' 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="never">Never (stays until deleted)</option>
                    <option value="1day">1 Day</option>
                    <option value="3days">3 Days</option>
                    <option value="7days">7 Days</option>
                    <option value="30days">30 Days</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className={`flex-1 py-3 rounded-lg transition-colors ${
                    theme === 'dark' 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim() || !message.trim() || selectedTeamIds.length === 0}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {editingBulletin ? 'Update' : 'Post'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionerAnnouncements;
