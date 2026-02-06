/**
 * Team Manager Service
 * =====================
 * CRUD operations for team manager sub-accounts
 * 
 * Managers are created by commissioners to help manage teams.
 * They have their own login credentials but share the commissioner's dashboard.
 * 
 * Collections:
 * - /teamManagers/{managerId} - Manager documents
 * 
 * Security:
 * - Only commissioners can create/edit/delete managers for their teams
 * - Managers can only edit their own password and name
 * - All actions are attributed to the specific manager
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  updateEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { db, auth } from './firebase';
import type { 
  TeamManager, 
  NewTeamManager, 
  TeamManagerPermissions,
  TeamManagerStatus 
} from '../types';

const COLLECTION = 'teamManagers';

// Default permissions for new managers (Phase 1: full access)
const DEFAULT_PERMISSIONS: TeamManagerPermissions = {
  roster: true,
  schedule: true,
  chat: true,
  announcements: true,
  notifications: true,
  registrations: true,
  stats: true,
  designStudio: true,
  filmRoom: true,
};

/**
 * Create a new team manager
 * Creates both Firebase Auth user and Firestore document
 * 
 * IMPORTANT: This creates a new Firebase Auth account which temporarily signs in as the new user.
 * The Firestore document is created while signed in as the new manager.
 * After creation, we sign out to allow the commissioner to continue.
 */
export const createTeamManager = async (
  managerData: NewTeamManager
): Promise<{ managerId: string; authUid: string }> => {
  // Store reference to current auth state
  const currentUserEmail = auth.currentUser?.email;
  
  try {
    // Create the auth account (this signs in as the new user)
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      managerData.email,
      managerData.password
    );
    
    const authUid = userCredential.user.uid;
    
    // Create Firestore document - now signed in as the new manager
    // Rules allow this because request.auth.uid == managerId
    const managerDoc: Omit<TeamManager, 'id'> = {
      name: managerData.name,
      email: managerData.email.toLowerCase(),
      teamId: managerData.teamId,
      teamName: managerData.teamName || '',
      commissionerId: managerData.commissionerId,
      commissionerName: managerData.commissionerName || '',
      status: 'active',
      permissions: managerData.permissions 
        ? { ...DEFAULT_PERMISSIONS, ...managerData.permissions }
        : DEFAULT_PERMISSIONS,
      loginCount: 0,
      createdAt: serverTimestamp() as Timestamp,
      createdBy: managerData.commissionerId,
    };
    
    // Use the auth UID as the document ID for easy lookup during login
    await setDoc(doc(db, COLLECTION, authUid), managerDoc);
    
    // Sign out the newly created manager so the page can reload with commissioner
    // The commissioner will need to sign back in
    await auth.signOut();
    
    return { managerId: authUid, authUid };
  } catch (error: any) {
    console.error('Error creating team manager:', error);
    // If we're signed in as the new manager but failed, sign out
    if (auth.currentUser?.email === managerData.email) {
      await auth.signOut();
    }
    throw new Error(error.message || 'Failed to create manager');
  }
};

// Helper to set doc with custom ID
import { setDoc } from 'firebase/firestore';

/**
 * Get a team manager by ID
 */
export const getTeamManager = async (managerId: string): Promise<TeamManager | null> => {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION, managerId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as TeamManager;
    }
    return null;
  } catch (error) {
    console.error('Error getting team manager:', error);
    return null;
  }
};

/**
 * Get a team manager by email (for login)
 */
export const getTeamManagerByEmail = async (email: string): Promise<TeamManager | null> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('email', '==', email.toLowerCase())
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as TeamManager;
  } catch (error) {
    console.error('Error getting team manager by email:', error);
    return null;
  }
};

/**
 * Get all managers for a team
 */
export const getTeamManagers = async (teamId: string): Promise<TeamManager[]> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TeamManager[];
  } catch (error) {
    console.error('Error getting team managers:', error);
    return [];
  }
};

/**
 * Get all managers created by a commissioner (excludes deleted)
 */
export const getManagersByCommissioner = async (commissionerId: string): Promise<TeamManager[]> => {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('commissionerId', '==', commissionerId),
      where('status', '!=', 'deleted')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TeamManager[];
  } catch (error) {
    console.error('Error getting managers by commissioner:', error);
    return [];
  }
};

/**
 * Update a team manager
 */
export const updateTeamManager = async (
  managerId: string,
  updates: Partial<TeamManager>
): Promise<void> => {
  try {
    // Don't allow updating sensitive fields directly
    const { id, createdAt, createdBy, ...safeUpdates } = updates as any;
    
    await updateDoc(doc(db, COLLECTION, managerId), {
      ...safeUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating team manager:', error);
    throw new Error(error.message || 'Failed to update manager');
  }
};

/**
 * Update manager status (active, paused, suspended)
 */
export const updateManagerStatus = async (
  managerId: string,
  status: TeamManagerStatus
): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION, managerId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating manager status:', error);
    throw new Error(error.message || 'Failed to update manager status');
  }
};

/**
 * Update manager permissions
 */
export const updateManagerPermissions = async (
  managerId: string,
  permissions: Partial<TeamManagerPermissions>
): Promise<void> => {
  try {
    const manager = await getTeamManager(managerId);
    if (!manager) throw new Error('Manager not found');
    
    const updatedPermissions = {
      ...manager.permissions,
      ...permissions,
    };
    
    await updateDoc(doc(db, COLLECTION, managerId), {
      permissions: updatedPermissions,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating manager permissions:', error);
    throw new Error(error.message || 'Failed to update permissions');
  }
};

/**
 * Update manager's own password (manager self-service)
 */
export const updateManagerPassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('Not authenticated');
    
    // Re-authenticate first
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPassword);
  } catch (error: any) {
    console.error('Error updating manager password:', error);
    throw new Error(error.message || 'Failed to update password');
  }
};

/**
 * Update manager's email (commissioner only)
 */
export const updateManagerEmail = async (
  managerId: string,
  newEmail: string,
  currentPassword: string
): Promise<void> => {
  try {
    // This needs to be done by re-authenticating as the manager
    // For now, we'll just update the Firestore document
    // Full implementation would require admin SDK
    await updateDoc(doc(db, COLLECTION, managerId), {
      email: newEmail.toLowerCase(),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating manager email:', error);
    throw new Error(error.message || 'Failed to update email');
  }
};

/**
 * Delete a team manager
 * Soft-deletes by setting status to 'deleted' (Auth account remains but is blocked at login)
 * Full auth deletion requires Admin SDK Cloud Function
 */
export const deleteTeamManager = async (managerId: string): Promise<void> => {
  try {
    // Soft delete - set status to 'deleted' so login is blocked
    // This is safer than hard delete and allows recovery if needed
    await updateDoc(doc(db, COLLECTION, managerId), {
      status: 'deleted',
      deletedAt: serverTimestamp(),
    });
    
    console.log('Manager soft-deleted:', managerId);
    
    // Note: To fully delete the Firebase Auth user, you need a Cloud Function
    // with Admin SDK. For now, soft-delete blocks all access.
  } catch (error: any) {
    console.error('Error deleting team manager:', error);
    throw new Error(error.message || 'Failed to delete manager');
  }
};

/**
 * Record manager login
 */
export const recordManagerLogin = async (managerId: string): Promise<void> => {
  try {
    const manager = await getTeamManager(managerId);
    if (!manager) return;
    
    await updateDoc(doc(db, COLLECTION, managerId), {
      lastLogin: serverTimestamp(),
      loginCount: (manager.loginCount || 0) + 1,
    });
  } catch (error) {
    console.error('Error recording manager login:', error);
    // Don't throw - this is not critical
  }
};

/**
 * Record manager activity
 */
export const recordManagerActivity = async (managerId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION, managerId), {
      lastActivity: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error recording manager activity:', error);
    // Don't throw - this is not critical
  }
};

/**
 * Check if a user is a team manager (for login flow)
 * Returns the manager if found, null otherwise
 */
export const checkIsTeamManager = async (authUid: string): Promise<TeamManager | null> => {
  try {
    // First check by document ID (auth UID)
    const manager = await getTeamManager(authUid);
    if (manager) return manager;
    
    return null;
  } catch (error) {
    console.error('Error checking if team manager:', error);
    return null;
  }
};

/**
 * Validate manager can perform action based on status
 */
export const canManagerAct = (manager: TeamManager): boolean => {
  return manager.status === 'active';
};

/**
 * Check if manager has specific permission
 */
export const hasPermission = (
  manager: TeamManager,
  permission: keyof TeamManagerPermissions
): boolean => {
  if (!canManagerAct(manager)) return false;
  return manager.permissions?.[permission] ?? false;
};
