/**
 * TeamManagersPanel
 * =================
 * UI for commissioners to manage their team managers (sub-accounts)
 * 
 * Features:
 * - View all managers for the team
 * - Add new manager (name, email, password)
 * - Edit manager details
 * - Pause/unpause manager login
 * - Delete manager
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  getManagersByCommissioner,
  createTeamManager,
  updateTeamManager,
  updateManagerStatus,
  deleteTeamManager,
} from '../../services/teamManagerService';
import type { TeamManager, NewTeamManager, TeamManagerStatus } from '../../types';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Pause,
  Play,
  X,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  User,
  Lock,
  Clock,
  Shield,
} from 'lucide-react';

interface TeamManagersPanelProps {
  // No longer requires teamId - managers have access to ALL commissioner's teams
}

const TeamManagersPanel: React.FC<TeamManagersPanelProps> = () => {
  const { theme } = useTheme();
  const { userData } = useAuth();
  
  // State
  const [managers, setManagers] = useState<TeamManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<TeamManager | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state for new manager
  const [newManager, setNewManager] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);
  
  // Load managers for this commissioner
  useEffect(() => {
    const loadManagers = async () => {
      if (!userData?.uid) return;
      
      setLoading(true);
      try {
        const data = await getManagersByCommissioner(userData.uid);
        setManagers(data);
      } catch (err) {
        console.error('Error loading managers:', err);
        setError('Failed to load managers');
      } finally {
        setLoading(false);
      }
    };
    
    loadManagers();
  }, [userData?.uid]);
  
  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  // Create new manager
  const handleCreateManager = async () => {
    setError(null);
    
    // Validate
    if (!newManager.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!newManager.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!newManager.password) {
      setError('Password is required');
      return;
    }
    if (newManager.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newManager.password !== newManager.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setCreating(true);
    try {
      const managerData: NewTeamManager = {
        name: newManager.name.trim(),
        email: newManager.email.trim().toLowerCase(),
        password: newManager.password,
        teamId: '', // No longer tied to a specific team - has access to all
        teamName: 'All Teams',
        commissionerId: userData?.uid || '',
        commissionerName: userData?.name || '',
      };
      
      await createTeamManager(managerData);
      
      // After creating a manager, the commissioner gets signed out
      // Show success message - they'll need to log back in
      alert(`Manager "${newManager.name}" created successfully!\n\nYou will now be signed out. Please log back in with your commissioner account.`);
      
      // The signOut in createTeamManager will trigger AuthContext to redirect to login
      window.location.reload();
      return;
    } catch (err: any) {
      setError(err.message || 'Failed to create manager');
    } finally {
      setCreating(false);
    }
  };
  
  // Update manager status (pause/unpause)
  const handleToggleStatus = async (manager: TeamManager) => {
    const newStatus: TeamManagerStatus = manager.status === 'active' ? 'paused' : 'active';
    
    try {
      await updateManagerStatus(manager.id, newStatus);
      
      // Update local state
      setManagers(prev => prev.map(m => 
        m.id === manager.id ? { ...m, status: newStatus } : m
      ));
      
      setSuccess(`Manager ${newStatus === 'active' ? 'activated' : 'paused'}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };
  
  // Open edit modal
  const handleEditClick = (manager: TeamManager) => {
    setSelectedManager(manager);
    setEditForm({
      name: manager.name,
      email: manager.email,
    });
    setShowEditModal(true);
  };
  
  // Save edit
  const handleSaveEdit = async () => {
    if (!selectedManager) return;
    
    setError(null);
    if (!editForm.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!editForm.email.trim()) {
      setError('Email is required');
      return;
    }
    
    setSaving(true);
    try {
      await updateTeamManager(selectedManager.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
      });
      
      // Update local state
      setManagers(prev => prev.map(m => 
        m.id === selectedManager.id 
          ? { ...m, name: editForm.name.trim(), email: editForm.email.trim().toLowerCase() }
          : m
      ));
      
      setShowEditModal(false);
      setSelectedManager(null);
      setSuccess('Manager updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to update manager');
    } finally {
      setSaving(false);
    }
  };
  
  // Delete manager
  const handleDelete = async (managerId: string) => {
    try {
      await deleteTeamManager(managerId);
      
      // Update local state
      setManagers(prev => prev.filter(m => m.id !== managerId));
      setShowDeleteConfirm(null);
      setSuccess('Manager deleted');
    } catch (err: any) {
      setError(err.message || 'Failed to delete manager');
    }
  };
  
  // Status badge component
  const StatusBadge: React.FC<{ status: TeamManagerStatus }> = ({ status }) => {
    const styles = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      invited: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
          }`}>
            <Users className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              Account Managers
            </h3>
            <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {managers.length} manager{managers.length !== 1 ? 's' : ''} • Full access to ALL your teams
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Manager
        </button>
      </div>
      
      {/* Success/Error Messages */}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      
      {/* Managers List */}
      {managers.length === 0 ? (
        <div className={`p-8 text-center rounded-xl border-2 border-dashed ${
          theme === 'dark' ? 'border-white/10 bg-black/20' : 'border-zinc-200 bg-zinc-50'
        }`}>
          <Shield className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`} />
          <h4 className={`font-medium mb-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
            No Managers Yet
          </h4>
          <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
            Add managers to help run ALL your teams. They'll have full access using their own login.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Manager
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {managers.map(manager => (
            <div
              key={manager.id}
              className={`p-4 rounded-xl border transition-all ${
                manager.status === 'paused'
                  ? theme === 'dark' 
                    ? 'bg-yellow-500/5 border-yellow-500/20 opacity-75'
                    : 'bg-yellow-50 border-yellow-200 opacity-75'
                  : theme === 'dark'
                    ? 'bg-black/30 border-white/10 hover:border-white/20'
                    : 'bg-white border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
                  }`}>
                    <User className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                        {manager.name}
                      </span>
                      <StatusBadge status={manager.status} />
                    </div>
                    <div className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {manager.email}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Last Login */}
                  {manager.lastLogin && (
                    <span className={`text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      <Clock className="w-3 h-3 inline mr-1" />
                      Last login: {(manager.lastLogin as any).toDate ? (manager.lastLogin as any).toDate().toLocaleDateString() : new Date(manager.lastLogin as any).toLocaleDateString()}
                    </span>
                  )}
                  
                  {/* Pause/Unpause */}
                  <button
                    onClick={() => handleToggleStatus(manager)}
                    className={`p-2 rounded-lg transition-colors ${
                      manager.status === 'active'
                        ? 'hover:bg-yellow-500/20 text-yellow-500'
                        : 'hover:bg-green-500/20 text-green-500'
                    }`}
                    title={manager.status === 'active' ? 'Pause login' : 'Activate login'}
                  >
                    {manager.status === 'active' ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  
                  {/* Edit */}
                  <button
                    onClick={() => handleEditClick(manager)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                    }`}
                    title="Edit manager"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  
                  {/* Delete */}
                  <button
                    onClick={() => setShowDeleteConfirm(manager.id)}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                    title="Delete manager"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Delete Confirmation */}
              {showDeleteConfirm === manager.id && (
                <div className={`mt-3 p-3 rounded-lg border ${
                  theme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                    Are you sure you want to delete <strong>{manager.name}</strong>? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(manager.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className={`px-3 py-1.5 rounded text-sm font-medium ${
                        theme === 'dark' ? 'bg-white/10 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Add Manager Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  Add Team Manager
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Create a sub-account for someone to help manage your team
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  <User className="w-4 h-4 inline mr-2" />
                  Manager Name
                </label>
                <input
                  type="text"
                  value={newManager.name}
                  onChange={(e) => setNewManager(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith"
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-purple-500'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500'
                  }`}
                />
              </div>
              
              {/* Email */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={newManager.email}
                  onChange={(e) => setNewManager(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@example.com"
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-purple-500'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500'
                  }`}
                />
              </div>
              
              {/* Password */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  <Lock className="w-4 h-4 inline mr-2" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newManager.password}
                    onChange={(e) => setNewManager(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="At least 6 characters"
                    className={`w-full px-4 py-3 pr-12 rounded-lg border transition-colors ${
                      theme === 'dark'
                        ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-purple-500'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {/* Confirm Password */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  <Lock className="w-4 h-4 inline mr-2" />
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newManager.confirmPassword}
                  onChange={(e) => setNewManager(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Re-enter password"
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-black/30 border-white/10 text-white placeholder:text-zinc-500 focus:border-purple-500'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500'
                  }`}
                />
              </div>
              
              {/* Error */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              {/* Info Box */}
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                <p className={`text-xs ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                  💡 The manager will use the regular login page with these credentials. They'll have access to your team dashboard and actions will show their name.
                </p>
              </div>
            </div>
            
            <div className={`p-6 border-t flex gap-3 ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
              <button
                onClick={() => setShowAddModal(false)}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/10 text-zinc-300 hover:bg-white/20'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateManager}
                disabled={creating}
                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {creating ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Manager
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Manager Modal */}
      {showEditModal && selectedManager && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'
          }`}>
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                  Edit Manager
                </h3>
                <button
                  onClick={() => { setShowEditModal(false); setSelectedManager(null); }}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-black/30 border-white/10 text-white focus:border-purple-500'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-purple-500'
                  }`}
                />
              </div>
              
              {/* Email */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                    theme === 'dark'
                      ? 'bg-black/30 border-white/10 text-white focus:border-purple-500'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-purple-500'
                  }`}
                />
              </div>
              
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
            
            <div className={`p-6 border-t flex gap-3 ${theme === 'dark' ? 'border-white/10' : 'border-zinc-200'}`}>
              <button
                onClick={() => { setShowEditModal(false); setSelectedManager(null); }}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/10 text-zinc-300 hover:bg-white/20'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes
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

export default TeamManagersPanel;
