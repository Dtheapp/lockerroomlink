import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { db, auth } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile, Team } from '../../types';
import { Trash2, Link, User, Shield, AtSign, Key, AlertTriangle, Search, Edit2, X, Check, UserX, ChevronLeft, ChevronRight, Download, CheckSquare, Square, History, Crown, Plus, Copy, Eye, EyeOff } from 'lucide-react';

const ManageUsers: React.FC = () => {
  const { user, userData } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [superAdmins, setSuperAdmins] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamLookup, setTeamLookup] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  
  // Root Admin check - only Root Admin can manage SuperAdmins
  const isRootAdmin = (userData as any)?.isRootAdmin === true;
  
  // SuperAdmin management modal states
  const [isCreateSuperAdminModalOpen, setIsCreateSuperAdminModalOpen] = useState(false);
  const [isDeleteSuperAdminModalOpen, setIsDeleteSuperAdminModalOpen] = useState(false);
  const [selectedSuperAdmin, setSelectedSuperAdmin] = useState<UserProfile | null>(null);
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState('');
  const [newSuperAdminName, setNewSuperAdminName] = useState('');
  const [newSuperAdminPassword, setNewSuperAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [superAdminError, setSuperAdminError] = useState('');
  const [createdAdminCredentials, setCreatedAdminCredentials] = useState<{email: string, password: string} | null>(null);
  
  // FILTER & SEARCH STATE
  const [filterRole, setFilterRole] = useState<'All' | 'Coach' | 'Parent'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 20;

  // MODAL STATES
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  
  // EDIT FORM STATE
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'Coach' | 'Parent'>('Parent');
  const [editUsername, setEditUsername] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  
  // BULK SELECTION STATE
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
  const [bulkAssignTeamId, setBulkAssignTeamId] = useState('');
  
  // ACTIVITY LOG STATE
  const [activityLog, setActivityLog] = useState<Array<{id: string, action: string, target: string, timestamp: any, admin: string}>>([]);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);

  useEffect(() => {
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => doc.data() as UserProfile);
      // Regular users (Coaches & Parents)
      const regularUsers = allUsers.filter(u => u.role !== 'SuperAdmin');
      setUsers(regularUsers);
      // SuperAdmins (only visible to Root Admin, exclude Root Admin from list)
      const superAdminUsers = allUsers.filter(u => u.role === 'SuperAdmin' && !(u as any).isRootAdmin);
      setSuperAdmins(superAdminUsers);
      setLoading(false);
    });

    const fetchTeams = async () => {
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const teamsData = teamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team));
        setTeams(teamsData);
        
        // Create lookup for team names
        const lookup: {[key: string]: string} = {};
        teamsData.forEach(t => { lookup[t.id] = t.name; });
        setTeamLookup(lookup);
    }
    fetchTeams();
    
    // Fetch activity log
    const activityUnsub = onSnapshot(collection(db, 'adminActivityLog'), (snapshot) => {
        const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any))
            .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
            .slice(0, 50); // Keep last 50 entries
        setActivityLog(logs);
    });

    return () => { usersUnsub(); activityUnsub(); };
  }, []);
  
  // Helper to log admin actions
  const logActivity = async (action: string, target: string) => {
      try {
          await addDoc(collection(db, 'adminActivityLog'), {
              action,
              target,
              admin: user?.email || 'Unknown',
              adminUid: user?.uid,
              timestamp: serverTimestamp()
          });
      } catch (err) {
          console.error('Failed to log activity:', err);
      }
  };

  // COMPUTED FILTER + SEARCH
  const filteredUsers = users.filter(u => {
      const matchesRole = filterRole === 'All' || u.role === filterRole;
      const matchesSearch = searchQuery === '' || 
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRole && matchesSearch;
  });
  
  // PAGINATION
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
      (currentPage - 1) * USERS_PER_PAGE,
      currentPage * USERS_PER_PAGE
  );
  
  // Reset to page 1 when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [filterRole, searchQuery]);
  
  // Clear selection when filters change
  useEffect(() => {
      setSelectedUserIds(new Set());
  }, [filterRole, searchQuery]);
  
  // --- BULK SELECTION HANDLERS ---
  const toggleUserSelection = (uid: string) => {
      setSelectedUserIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(uid)) {
              newSet.delete(uid);
          } else {
              newSet.add(uid);
          }
          return newSet;
      });
  };
  
  const toggleSelectAll = () => {
      if (selectedUserIds.size === paginatedUsers.length) {
          setSelectedUserIds(new Set());
      } else {
          setSelectedUserIds(new Set(paginatedUsers.map(u => u.uid)));
      }
  };
  
  const handleBulkDelete = async () => {
      if (selectedUserIds.size === 0) return;
      setSaving(true);
      
      try {
          const usersToDelete = users.filter(u => selectedUserIds.has(u.uid) && u.uid !== user?.uid);
          
          for (const targetUser of usersToDelete) {
              // If coach, remove from team first
              if (targetUser.role === 'Coach' && targetUser.teamId) {
                  const teamRef = doc(db, 'teams', targetUser.teamId);
                  await updateDoc(teamRef, { coachId: null });
              }
              await deleteDoc(doc(db, 'users', targetUser.uid));
          }
          
          await logActivity('Bulk Delete', `Deleted ${usersToDelete.length} users`);
          setSelectedUserIds(new Set());
          setIsBulkDeleteModalOpen(false);
      } catch (error) {
          console.error("Error in bulk delete:", error);
      } finally {
          setSaving(false);
      }
  };
  
  const handleBulkAssign = async () => {
      if (selectedUserIds.size === 0) return;
      setSaving(true);
      
      try {
          const usersToAssign = users.filter(u => selectedUserIds.has(u.uid));
          
          for (const targetUser of usersToAssign) {
              const userDocRef = doc(db, 'users', targetUser.uid);
              
              if (!bulkAssignTeamId) {
                  // Unassigning
                  if (targetUser.role === 'Coach' && targetUser.teamId) {
                      const oldTeamRef = doc(db, 'teams', targetUser.teamId);
                      await updateDoc(oldTeamRef, { coachId: null });
                  }
                  await updateDoc(userDocRef, { teamId: null });
              } else {
                  // Note: For bulk assign, we don't set coaches as team coach (too complex)
                  // They just get teamId set
                  await updateDoc(userDocRef, { teamId: bulkAssignTeamId });
              }
          }
          
          await logActivity('Bulk Assign', `Assigned ${usersToAssign.length} users to ${bulkAssignTeamId ? teamLookup[bulkAssignTeamId] : 'no team'}`);
          setSelectedUserIds(new Set());
          setIsBulkAssignModalOpen(false);
          setBulkAssignTeamId('');
      } catch (error) {
          console.error("Error in bulk assign:", error);
      } finally {
          setSaving(false);
      }
  };
  
  // --- CSV EXPORT ---
  const exportToCSV = () => {
      const headers = ['Name', 'Email', 'Username', 'Role', 'Team', 'Team ID', 'User ID'];
      const rows = filteredUsers.map(u => [
          u.name || '',
          u.email || '',
          u.username || '',
          u.role || '',
          u.teamId ? (teamLookup[u.teamId] || '') : '',
          u.teamId || '',
          u.uid || ''
      ]);
      
      const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      logActivity('Export CSV', `Exported ${filteredUsers.length} users`);
  };

  // --- MODAL HANDLERS ---
  const openAssignModal = (targetUser: UserProfile) => {
    setSelectedUser(targetUser);
    setSelectedTeamId(targetUser.teamId || '');
    setIsAssignModalOpen(true);
  };
  
  const openEditModal = (targetUser: UserProfile) => {
    setSelectedUser(targetUser);
    setEditName(targetUser.name || '');
    setEditRole(targetUser.role as 'Coach' | 'Parent');
    setEditUsername(targetUser.username || '');
    setEditError('');
    setIsEditModalOpen(true);
  };
  
  const openDeleteModal = (targetUser: UserProfile) => {
    setSelectedUser(targetUser);
    setIsDeleteModalOpen(true);
  };
  
  const openResetModal = (targetUser: UserProfile) => {
    setSelectedUser(targetUser);
    setIsResetModalOpen(true);
  };

  // --- ACTION HANDLERS ---
  const handleAssignTeam = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const userDocRef = doc(db, 'users', selectedUser.uid);
      
      // If unassigning (empty selection)
      if (!selectedTeamId) {
        // If coach, remove from old team
        if (selectedUser.role === 'Coach' && selectedUser.teamId) {
          const oldTeamRef = doc(db, 'teams', selectedUser.teamId);
          await updateDoc(oldTeamRef, { coachId: null });
        }
        await updateDoc(userDocRef, { teamId: null });
      } else {
        // Assigning to a team
        if (selectedUser.role === 'Coach') {
          // Remove from old team if different
          if (selectedUser.teamId && selectedUser.teamId !== selectedTeamId) {
            const oldTeamRef = doc(db, 'teams', selectedUser.teamId);
            await updateDoc(oldTeamRef, { coachId: null });
          }
          // Set as coach for new team
          const newTeamDocRef = doc(db, 'teams', selectedTeamId);
          await updateDoc(newTeamDocRef, { coachId: selectedUser.uid });
        }
        await updateDoc(userDocRef, { teamId: selectedTeamId });
      }

      setIsAssignModalOpen(false);
      setSelectedUser(null);
      setSelectedTeamId('');
      
      await logActivity('Assign Team', `Assigned ${selectedUser.name} to ${selectedTeamId ? teamLookup[selectedTeamId] : 'no team'}`);
    } catch (error) {
      console.error("Error assigning team:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser || !editName.trim()) {
      setEditError('Name is required');
      return;
    }
    setSaving(true);
    setEditError('');
    
    try {
      const userDocRef = doc(db, 'users', selectedUser.uid);
      const updates: any = {
        name: editName.trim(),
        role: editRole,
      };
      
      if (editUsername.trim()) {
        updates.username = editUsername.trim();
      }
      
      // Handle role change for coaches
      if (selectedUser.role === 'Coach' && editRole === 'Parent' && selectedUser.teamId) {
        // Removing coach status - clear from team
        const teamRef = doc(db, 'teams', selectedUser.teamId);
        await updateDoc(teamRef, { coachId: null });
      }
      
      await updateDoc(userDocRef, updates);
      
      await logActivity('Edit User', `Updated ${selectedUser.name}: role=${editRole}`);
      
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
      setEditError('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    // Prevent self-deletion
    if (selectedUser.uid === user?.uid) {
      setIsDeleteModalOpen(false);
      return;
    }
    
    setSaving(true);
    try {
      // If coach, remove from team first
      if (selectedUser.role === 'Coach' && selectedUser.teamId) {
        const teamRef = doc(db, 'teams', selectedUser.teamId);
        await updateDoc(teamRef, { coachId: null });
      }
      
      await deleteDoc(doc(db, 'users', selectedUser.uid));
      
      await logActivity('Delete User', `Deleted ${selectedUser.name} (${selectedUser.email})`);
      
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser?.email) return;
    setSaving(true);
    try {
      await sendPasswordResetEmail(auth, selectedUser.email);
      
      await logActivity('Password Reset', `Sent reset email to ${selectedUser.email}`);
      
      setIsResetModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error sending reset email:", error);
    } finally {
      setSaving(false);
    }
  };

  // --- SUPERADMIN MANAGEMENT (Root Admin Only) ---
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreateSuperAdmin = async () => {
    if (!newSuperAdminEmail.trim() || !newSuperAdminName.trim()) {
      setSuperAdminError('Email and name are required');
      return;
    }
    
    const password = newSuperAdminPassword.trim() || generatePassword();
    
    if (password.length < 6) {
      setSuperAdminError('Password must be at least 6 characters');
      return;
    }
    
    setSaving(true);
    setSuperAdminError('');
    
    try {
      // Create a secondary Firebase app instance to create user without signing out current user
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.VITE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID || import.meta.env.VITE_APP_ID,
      };
      
      const secondaryApp = initializeApp(firebaseConfig, 'secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      // Create the new user account
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newSuperAdminEmail.trim(), password);
      const newUid = userCredential.user.uid;
      
      // Sign out from secondary app immediately
      await secondaryAuth.signOut();
      
      // Create the user document in Firestore
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email: newSuperAdminEmail.trim().toLowerCase(),
        name: newSuperAdminName.trim(),
        role: 'SuperAdmin',
        teamId: null,
        mustChangePassword: true, // Force password change on first login
        createdAt: serverTimestamp(),
        createdBy: user?.email || 'Root Admin'
      });
      
      await logActivity('Create SuperAdmin', `Created new SuperAdmin: ${newSuperAdminEmail}`);
      
      // Show credentials to copy
      setCreatedAdminCredentials({ email: newSuperAdminEmail.trim(), password });
      
      // Reset form but keep modal open to show credentials
      setNewSuperAdminEmail('');
      setNewSuperAdminName('');
      setNewSuperAdminPassword('');
      
    } catch (error: any) {
      console.error("Error creating SuperAdmin:", error);
      if (error.code === 'auth/email-already-in-use') {
        setSuperAdminError('This email is already registered. Use a different email.');
      } else if (error.code === 'auth/invalid-email') {
        setSuperAdminError('Invalid email address format.');
      } else if (error.code === 'auth/weak-password') {
        setSuperAdminError('Password is too weak. Use at least 6 characters.');
      } else {
        setSuperAdminError('Failed to create SuperAdmin: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const closeCreateSuperAdminModal = () => {
    setIsCreateSuperAdminModalOpen(false);
    setSuperAdminError('');
    setCreatedAdminCredentials(null);
    setNewSuperAdminEmail('');
    setNewSuperAdminName('');
    setNewSuperAdminPassword('');
    setShowPassword(false);
  };

  const handleDeleteSuperAdmin = async () => {
    if (!selectedSuperAdmin) return;
    
    // Safety check - cannot delete Root Admin
    if ((selectedSuperAdmin as any).isRootAdmin) {
      setIsDeleteSuperAdminModalOpen(false);
      return;
    }
    
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'users', selectedSuperAdmin.uid));
      await logActivity('Delete SuperAdmin', `Deleted SuperAdmin ${selectedSuperAdmin.name} (${selectedSuperAdmin.email})`);
      
      setIsDeleteSuperAdminModalOpen(false);
      setSelectedSuperAdmin(null);
    } catch (error) {
      console.error("Error deleting SuperAdmin:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDemoteSuperAdmin = async (targetUser: UserProfile) => {
    // Safety check - cannot demote Root Admin
    if ((targetUser as any).isRootAdmin) return;
    
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: 'Coach' // Demote to Coach
      });
      await logActivity('Demote SuperAdmin', `Demoted ${targetUser.name} from SuperAdmin to Coach`);
    } catch (error) {
      console.error("Error demoting SuperAdmin:", error);
    } finally {
      setSaving(false);
    }
  };

  // --- HELPER: RENDER ACTIONS ---
  const renderActions = (targetUser: UserProfile, isMobile = false) => (
      <div className={`flex items-center gap-2 ${isMobile ? 'mt-4 pt-4 border-t border-slate-300 dark:border-zinc-800 w-full flex-wrap' : 'justify-end'}`}>
          <button 
            onClick={() => openEditModal(targetUser)}
            className={`flex items-center justify-center gap-1 rounded-md bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors font-medium border border-slate-300 dark:border-zinc-700 ${isMobile ? 'flex-1 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
            title="Edit User"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          
          <button 
            onClick={() => openAssignModal(targetUser)} 
            className={`flex items-center justify-center gap-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors font-medium border border-orange-300 dark:border-orange-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
            title={targetUser.teamId ? "Reassign Team" : "Assign Team"}
          >
            <Link className="w-3 h-3" /> {targetUser.teamId ? 'Reassign' : 'Assign'}
          </button>
          
          <button 
            onClick={() => openResetModal(targetUser)}
            className={`flex items-center justify-center gap-1 rounded-md bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors font-medium border border-sky-300 dark:border-sky-800/50 ${isMobile ? 'flex-1 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
            title="Send Password Reset Email"
          >
             <Key className="w-3 h-3" /> Reset
          </button>

          <button 
            onClick={() => openDeleteModal(targetUser)} 
            className={`flex items-center justify-center gap-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium border border-red-300 dark:border-red-800/50 ${isMobile ? 'w-full py-2 text-sm mt-2' : 'px-3 py-1.5 text-xs'}`}
            title="Delete User"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
      </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Manage Users</h1>
          
          {/* FILTER CONTROLS */}
          <div className="flex flex-wrap bg-slate-50 dark:bg-black p-1 rounded-lg border border-slate-200 dark:border-zinc-700">
              {(['All', 'Coach', 'Parent'] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setFilterRole(role)}
                    className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all ${
                        filterRole === role 
                        ? 'bg-orange-600 text-white shadow-lg' 
                        : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                      {role === 'All' ? 'All' : role + 's'}
                      <span className="ml-2 text-xs opacity-60 bg-black/20 px-1.5 py-0.5 rounded-full">
                          {role === 'All' ? users.length : users.filter(u => u.role === role).length}
                      </span>
                  </button>
              ))}
          </div>
      </div>

      {/* ROOT ADMIN ONLY: SuperAdmin Management Section */}
      {isRootAdmin && (
        <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/10 border border-purple-500/30 rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-purple-400">Super Admin Management</h2>
                <p className="text-sm text-purple-300/70">Root Admin Only - Manage platform administrators</p>
              </div>
            </div>
            <button
              onClick={() => setIsCreateSuperAdminModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Add SuperAdmin
            </button>
          </div>
          
          {superAdmins.length === 0 ? (
            <p className="text-purple-300/60 text-sm text-center py-4">No other SuperAdmins. You are the only administrator.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {superAdmins.map(admin => (
                <div key={admin.uid} className="bg-black/30 border border-purple-500/20 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-700 rounded-full flex items-center justify-center text-white font-bold">
                      {admin.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div>
                      <p className="font-medium text-white">{admin.name}</p>
                      <p className="text-xs text-purple-300/70">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDemoteSuperAdmin(admin)}
                      className="p-2 text-yellow-400 hover:bg-yellow-900/30 rounded transition-colors"
                      title="Demote to Coach"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setSelectedSuperAdmin(admin); setIsDeleteSuperAdminModalOpen(true); }}
                      className="p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      title="Delete SuperAdmin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email, or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* TOOLBAR: Bulk Actions + Export + Activity Log */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-3">
          <div className="flex items-center gap-3">
              {/* Selection info */}
              {selectedUserIds.size > 0 && (
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-orange-600 dark:text-orange-400">{selectedUserIds.size}</span> selected
                  </span>
              )}
              
              {/* Bulk Actions */}
              {selectedUserIds.size > 0 && (
                  <>
                      <button
                          onClick={() => setIsBulkAssignModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-md hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors border border-orange-300 dark:border-orange-800/50"
                      >
                          <Link className="w-3.5 h-3.5" /> Bulk Assign
                      </button>
                      <button
                          onClick={() => setIsBulkDeleteModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors border border-red-300 dark:border-red-800/50"
                      >
                          <Trash2 className="w-3.5 h-3.5" /> Bulk Delete
                      </button>
                  </>
              )}
          </div>
          
          <div className="flex items-center gap-2">
              {/* Export CSV */}
              <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors border border-emerald-300 dark:border-emerald-800/50"
              >
                  <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              
              {/* Activity Log */}
              <button
                  onClick={() => setIsActivityLogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors border border-slate-300 dark:border-zinc-700"
              >
                  <History className="w-3.5 h-3.5" /> Activity Log
              </button>
          </div>
      </div>

      {/* --- MOBILE VIEW: CARDS --- */}
      <div className="md:hidden space-y-4">
          {loading ? <p className="text-center text-slate-500 dark:text-slate-400">Loading users...</p> : 
           filteredUsers.length === 0 ? <p className="text-center text-slate-500 dark:text-slate-400 py-8">{searchQuery ? 'No users match your search.' : 'No users found.'}</p> :
           paginatedUsers.map(u => (
              <div key={u.uid} className={`bg-slate-50 dark:bg-zinc-950 rounded-xl border p-5 shadow-lg transition-colors ${selectedUserIds.has(u.uid) ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-200 dark:border-zinc-800'}`}>
                  <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <button
                              onClick={() => toggleUserSelection(u.uid)}
                              className="mt-1 text-slate-400 hover:text-orange-500 transition-colors"
                          >
                              {selectedUserIds.has(u.uid) ? (
                                  <CheckSquare className="w-5 h-5 text-orange-500" />
                              ) : (
                                  <Square className="w-5 h-5" />
                              )}
                          </button>
                          <div>
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  {u.name}
                              </h3>
                              <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-mono mt-1">
                              <AtSign className="w-3 h-3" /> {u.username || 'No Username'}
                          </div>
                      </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${u.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-800' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'}`}>
                          {u.role}
                      </span>
                  </div>

                  <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-2">
                      <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500 dark:text-slate-600" />
                          <span className="truncate">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-slate-500 dark:text-slate-600" />
                          <span className={u.teamId ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-500 italic'}>
                              Team: {u.teamId ? <span className="font-medium">{teamLookup[u.teamId] || u.teamId}</span> : 'Unassigned'}
                          </span>
                      </div>
                  </div>

                  {renderActions(u, true)}
              </div>
           ))
          }
      </div>

      {/* --- DESKTOP VIEW: TABLE --- */}
      <div className="hidden md:block bg-slate-50 dark:bg-zinc-950 rounded-lg shadow overflow-hidden border border-slate-200 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
            <thead className="text-xs text-slate-600 dark:text-slate-400 uppercase bg-white dark:bg-black">
              <tr>
                <th scope="col" className="px-4 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-orange-500 transition-colors">
                        {selectedUserIds.size === paginatedUsers.length && paginatedUsers.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-orange-500" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                    </button>
                </th>
                <th scope="col" className="px-6 py-3">Name</th>
                <th scope="col" className="px-6 py-3 text-orange-600 dark:text-orange-400">Username</th>
                <th scope="col" className="px-6 py-3">Role</th>
                <th scope="col" className="px-6 py-3">Team</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {loading ? (
                <tr><td colSpan={6} className="text-center p-4">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-8 text-slate-500 dark:text-slate-500">{searchQuery ? 'No users match your search.' : `No ${filterRole === 'All' ? 'users' : filterRole.toLowerCase() + 's'} found.`}</td></tr>
              ) : (
                paginatedUsers.map(u => (
                  <tr key={u.uid} className={`hover:bg-slate-100 dark:hover:bg-black transition-colors ${selectedUserIds.has(u.uid) ? 'bg-orange-50 dark:bg-orange-900/10' : 'bg-slate-50 dark:bg-zinc-950'}`}>
                    <td className="px-4 py-4">
                        <button onClick={() => toggleUserSelection(u.uid)} className="text-slate-400 hover:text-orange-500 transition-colors">
                            {selectedUserIds.has(u.uid) ? (
                                <CheckSquare className="w-4 h-4 text-orange-500" />
                            ) : (
                                <Square className="w-4 h-4" />
                            )}
                        </button>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {u.name}
                        <span className="block text-xs text-slate-500 font-normal">{u.email}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-orange-600 dark:text-orange-400">{u.username || '---'}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'Coach' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'}`}>
                            {u.role}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.teamId ? (
                        <span className="font-medium text-slate-900 dark:text-white">{teamLookup[u.teamId] || u.teamId}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {renderActions(u, false)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION CONTROLS */}
      {filteredUsers.length > USERS_PER_PAGE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                  Showing {((currentPage - 1) * USERS_PER_PAGE) + 1} - {Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
              </p>
              <div className="flex items-center gap-2">
                  <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                      <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  
                  <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                              pageNum = i + 1;
                          } else if (currentPage <= 3) {
                              pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                          } else {
                              pageNum = currentPage - 2 + i;
                          }
                          return (
                              <button
                                  key={pageNum}
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={`w-9 h-9 rounded-lg font-medium text-sm transition-colors ${
                                      currentPage === pageNum
                                          ? 'bg-orange-600 text-white'
                                          : 'bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                  }`}
                              >
                                  {pageNum}
                              </button>
                          );
                      })}
                  </div>
                  
                  <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                      Next <ChevronRight className="w-4 h-4" />
                  </button>
              </div>
          </div>
      )}

      {/* MODAL: Assign/Reassign Team */}
      {isAssignModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setIsAssignModalOpen(false)}>
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-slate-200 dark:border-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              {selectedUser.teamId ? 'Reassign' : 'Assign'} Team
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">User: <span className="font-bold text-slate-900 dark:text-white">{selectedUser.name}</span></p>
            
            {selectedUser.role === 'Coach' && selectedUser.teamId && (
                <div className="mb-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg text-sm flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0"/>
                    <p>This coach will be removed from their current team ({teamLookup[selectedUser.teamId] || selectedUser.teamId}).</p>
                </div>
            )}

            <div className="space-y-4">
               <label htmlFor="team" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Select a Team</label>
               <select 
                 id="team" 
                 value={selectedTeamId} 
                 onChange={(e) => setSelectedTeamId(e.target.value)} 
                 className="w-full bg-slate-50 dark:bg-black p-3 rounded-lg border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
               >
                  <option value="">-- Unassign from team --</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
               </select>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">Cancel</button>
              <button onClick={handleAssignTeam} disabled={saving} className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold disabled:opacity-50 shadow-lg shadow-orange-900/20 flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {selectedTeamId ? 'Assign' : 'Unassign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit User */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}>
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-slate-200 dark:border-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Edit User</h2>
            
            {editError && (
              <div className="mb-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-black p-3 rounded-lg border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                <input 
                  value={editUsername} 
                  onChange={(e) => setEditUsername(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-black p-3 rounded-lg border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter username"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                <select 
                  value={editRole} 
                  onChange={(e) => setEditRole(e.target.value as 'Coach' | 'Parent')}
                  className="w-full bg-slate-50 dark:bg-black p-3 rounded-lg border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Parent">Parent</option>
                  <option value="Coach">Coach</option>
                </select>
                {selectedUser.role === 'Coach' && editRole === 'Parent' && selectedUser.teamId && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">⚠️ Changing to Parent will remove coach status from their team.</p>
                )}
              </div>
              
              <div className="bg-slate-100 dark:bg-zinc-900 p-3 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium">Email:</span> {selectedUser.email}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-medium">UID:</span> {selectedUser.uid}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">Cancel</button>
              <button onClick={handleEditUser} disabled={saving} className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold disabled:opacity-50 shadow-lg shadow-orange-900/20 flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-slate-200 dark:border-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Delete User</h2>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to permanently delete <span className="font-bold text-slate-900 dark:text-white">{selectedUser.name}</span>?
            </p>
            
            {selectedUser.role === 'Coach' && selectedUser.teamId && (
              <div className="mb-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg text-sm flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0"/>
                <p>This will also remove them as coach from {teamLookup[selectedUser.teamId] || selectedUser.teamId}.</p>
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">Cancel</button>
              <button onClick={handleDeleteUser} disabled={saving} className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50 shadow-lg shadow-red-900/20 flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Password Reset Confirmation */}
      {isResetModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setIsResetModalOpen(false)}>
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-slate-200 dark:border-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center">
                <Key className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Reset Password</h2>
                <p className="text-sm text-slate-500">Send password reset email</p>
              </div>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Send a password reset link to <span className="font-bold text-slate-900 dark:text-white">{selectedUser.email}</span>?
            </p>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button type="button" onClick={() => setIsResetModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">Cancel</button>
              <button onClick={handleResetPassword} disabled={saving} className="px-6 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold disabled:opacity-50 shadow-lg shadow-sky-900/20 flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Key className="w-4 h-4" />}
                Send Reset Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Delete Confirmation */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setIsBulkDeleteModalOpen(false)}>
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-red-200 dark:border-red-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Bulk Delete</h2>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to delete <span className="font-bold text-red-600 dark:text-red-400">{selectedUserIds.size}</span> selected users?
            </p>
            
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 dark:text-red-400">⚠️ Any coaches will be removed from their teams.</p>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button type="button" onClick={() => setIsBulkDeleteModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">Cancel</button>
              <button onClick={handleBulkDelete} disabled={saving} className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50 shadow-lg shadow-red-900/20 flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete {selectedUserIds.size} Users
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Assign Team */}
      {isBulkAssignModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setIsBulkAssignModalOpen(false)}>
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-slate-200 dark:border-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Link className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bulk Assign Team</h2>
                <p className="text-sm text-slate-500">Assign {selectedUserIds.size} users to a team</p>
              </div>
            </div>
            
            <div className="space-y-4">
               <label htmlFor="bulkTeam" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Select a Team</label>
               <select 
                 id="bulkTeam" 
                 value={bulkAssignTeamId} 
                 onChange={(e) => setBulkAssignTeamId(e.target.value)} 
                 className="w-full bg-slate-50 dark:bg-black p-3 rounded-lg border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
               >
                  <option value="">-- Unassign from team --</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
               </select>
               
               <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-400">
                   <p>⚠️ Note: Coaches will have their teamId updated but won't be set as the team's coach (use individual assign for that).</p>
               </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button type="button" onClick={() => setIsBulkAssignModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">Cancel</button>
              <button onClick={handleBulkAssign} disabled={saving} className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold disabled:opacity-50 shadow-lg shadow-orange-900/20 flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {bulkAssignTeamId ? 'Assign' : 'Unassign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Activity Log */}
      {isActivityLogOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setIsActivityLogOpen(false)}>
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                  <History className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Activity Log</h2>
                  <p className="text-sm text-slate-500">Recent admin actions</p>
                </div>
              </div>
              <button onClick={() => setIsActivityLogOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {activityLog.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No activity recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {activityLog.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800">
                      <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center shrink-0">
                        <History className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{log.action}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{log.target}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <span>by {log.admin}</span>
                          <span>•</span>
                          <span>{log.timestamp?.toDate?.().toLocaleString() || 'Just now'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button onClick={() => setIsActivityLogOpen(false)} className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add SuperAdmin (Root Admin Only) */}
      {isCreateSuperAdminModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={closeCreateSuperAdminModal}>
          <div className="bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-purple-500/30 shadow-2xl" onClick={e => e.stopPropagation()}>
            {createdAdminCredentials ? (
              // SUCCESS: Show credentials to copy
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">SuperAdmin Created!</h2>
                    <p className="text-sm text-green-400">Save these credentials now</p>
                  </div>
                </div>
                
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-300 mb-3">⚠️ Copy these credentials - the password won't be shown again!</p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-green-400 mb-1">Email</label>
                      <div className="flex items-center gap-2">
                        <input 
                          readOnly 
                          value={createdAdminCredentials.email} 
                          className="flex-1 bg-black p-2 rounded border border-green-500/30 text-white text-sm"
                        />
                        <button 
                          onClick={() => copyToClipboard(createdAdminCredentials.email)}
                          className="p-2 bg-green-600 hover:bg-green-700 rounded text-white"
                          title="Copy email"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-green-400 mb-1">Password</label>
                      <div className="flex items-center gap-2">
                        <input 
                          readOnly 
                          value={createdAdminCredentials.password} 
                          className="flex-1 bg-black p-2 rounded border border-green-500/30 text-white text-sm font-mono"
                        />
                        <button 
                          onClick={() => copyToClipboard(createdAdminCredentials.password)}
                          className="p-2 bg-green-600 hover:bg-green-700 rounded text-white"
                          title="Copy password"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => copyToClipboard(`Email: ${createdAdminCredentials.email}\nPassword: ${createdAdminCredentials.password}`)}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" /> Copy Both
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button onClick={closeCreateSuperAdminModal} className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold">
                    Done
                  </button>
                </div>
              </>
            ) : (
              // FORM: Create new SuperAdmin
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Create SuperAdmin</h2>
                    <p className="text-sm text-purple-300/70">Create a new admin account</p>
                  </div>
                </div>
                
                {superAdminError && (
                  <div className="mb-4 bg-red-900/30 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {superAdminError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-1">Email Address *</label>
                    <input 
                      type="email"
                      value={newSuperAdminEmail} 
                      onChange={(e) => setNewSuperAdminEmail(e.target.value)} 
                      className="w-full bg-black p-3 rounded-lg border border-purple-500/30 text-white outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="admin@example.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-1">Display Name *</label>
                    <input 
                      value={newSuperAdminName} 
                      onChange={(e) => setNewSuperAdminName(e.target.value)} 
                      className="w-full bg-black p-3 rounded-lg border border-purple-500/30 text-white outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Admin Name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-300 mb-1">Password (optional)</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        value={newSuperAdminPassword} 
                        onChange={(e) => setNewSuperAdminPassword(e.target.value)} 
                        className="w-full bg-black p-3 pr-10 rounded-lg border border-purple-500/30 text-white outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Leave blank to auto-generate"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-purple-300/50 mt-1">Min 6 characters. Leave blank to auto-generate a secure password.</p>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-purple-500/20">
                  <button type="button" onClick={closeCreateSuperAdminModal} className="px-4 py-2 rounded-lg text-purple-300 hover:bg-purple-900/30 transition-colors">Cancel</button>
                  <button onClick={handleCreateSuperAdmin} disabled={saving} className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50 flex items-center gap-2">
                    {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Account
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Delete SuperAdmin Confirmation (Root Admin Only) */}
      {isDeleteSuperAdminModalOpen && selectedSuperAdmin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setIsDeleteSuperAdminModalOpen(false)}>
          <div className="bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-red-500/30 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-900/50 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-400">Delete SuperAdmin</h2>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-slate-300 mb-4">
              Are you sure you want to permanently delete <span className="font-bold text-white">{selectedSuperAdmin.name}</span>?
            </p>
            
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-400">⚠️ This will remove all admin privileges and delete their account.</p>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-red-500/20">
              <button type="button" onClick={() => setIsDeleteSuperAdminModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={handleDeleteSuperAdmin} disabled={saving} className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50 flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;