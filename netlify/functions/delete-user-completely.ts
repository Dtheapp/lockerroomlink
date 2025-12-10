import { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';

// =============================================================================
// DELETE USER COMPLETELY - Remove user from Firebase Auth AND Firestore
// This is for admin use only - deletes user from both systems
// =============================================================================

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;
    
  admin.initializeApp({
    credential: serviceAccount 
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'gridironhub-3131',
  });
}

const db = admin.firestore();
const auth = admin.auth();

interface DeleteUserRequest {
  targetUserId: string;      // The user to delete
  adminUserId: string;       // The admin making the request
  deleteAuth?: boolean;      // Whether to delete from Firebase Auth (default: true)
  deleteFirestore?: boolean; // Whether to delete from Firestore (default: true)
}

interface DeleteUserResponse {
  success: boolean;
  message: string;
  deletedAuth?: boolean;
  deletedFirestore?: boolean;
  errors?: string[];
}

const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body: DeleteUserRequest = JSON.parse(event.body || '{}');
    
    if (!body.targetUserId || !body.adminUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing targetUserId or adminUserId' }),
      };
    }

    const { targetUserId, adminUserId, deleteAuth = true, deleteFirestore = true } = body;

    // Verify the requesting user is an admin
    const adminDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminDoc.exists) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Admin user not found' }),
      };
    }

    const adminData = adminDoc.data();
    if (adminData?.role !== 'SuperAdmin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Unauthorized - SuperAdmin access required' }),
      };
    }

    // Prevent self-deletion
    if (targetUserId === adminUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cannot delete yourself' }),
      };
    }

    // Get target user info for logging
    const targetDoc = await db.collection('users').doc(targetUserId).get();
    const targetData = targetDoc.exists ? targetDoc.data() : null;
    const targetEmail = targetData?.email || 'unknown';
    const targetName = targetData?.name || 'unknown';

    const errors: string[] = [];
    let deletedAuth = false;
    let deletedFirestore = false;

    // If target is a coach, remove from team first
    if (targetData?.role === 'Coach' && targetData?.teamId) {
      try {
        await db.collection('teams').doc(targetData.teamId).update({ coachId: null });
      } catch (err) {
        console.warn('Could not remove coach from team:', err);
      }
    }

    // Delete from Firebase Auth
    if (deleteAuth) {
      try {
        await auth.deleteUser(targetUserId);
        deletedAuth = true;
        console.log(`Deleted user ${targetUserId} from Firebase Auth`);
      } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
          // User doesn't exist in Auth, that's okay
          deletedAuth = true;
          console.log(`User ${targetUserId} not found in Firebase Auth (already deleted)`);
        } else {
          console.error('Error deleting from Auth:', authError);
          errors.push(`Auth deletion failed: ${authError.message}`);
        }
      }
    }

    // Delete from Firestore
    if (deleteFirestore) {
      try {
        await db.collection('users').doc(targetUserId).delete();
        deletedFirestore = true;
        console.log(`Deleted user ${targetUserId} from Firestore`);
      } catch (firestoreError: any) {
        console.error('Error deleting from Firestore:', firestoreError);
        errors.push(`Firestore deletion failed: ${firestoreError.message}`);
      }
    }

    // Log the activity
    try {
      await db.collection('adminActivityLog').add({
        action: 'Delete User Completely',
        details: `Deleted ${targetName} (${targetEmail}) - Auth: ${deletedAuth}, Firestore: ${deletedFirestore}`,
        performedBy: adminUserId,
        performedByEmail: adminData?.email || 'unknown',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        targetUserId,
        targetEmail,
        targetName,
      });
    } catch (logError) {
      console.warn('Could not log activity:', logError);
    }

    const response: DeleteUserResponse = {
      success: errors.length === 0,
      message: errors.length === 0 
        ? `Successfully deleted user ${targetEmail} completely` 
        : `Partial deletion - some errors occurred`,
      deletedAuth,
      deletedFirestore,
      errors: errors.length > 0 ? errors : undefined,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error: any) {
    console.error('Delete user error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to delete user', 
        details: error.message 
      }),
    };
  }
};

export { handler };
