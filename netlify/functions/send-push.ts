import { Handler } from '@netlify/functions';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

// =============================================================================
// SEND PUSH - Deliver a Web Push (FCM) notification to a user's devices.
//
// Called (fire-and-forget) by the client after an in-app notification is
// created. The caller must include a valid Firebase ID token so only
// authenticated app users can trigger pushes.
//
// Requires env var FIREBASE_SERVICE_ACCOUNT (JSON, same as other functions).
// =============================================================================

// Initialize the Admin SDK lazily (modular API) so any config/credential
// problem returns a readable error instead of crashing the function (502).
function initAdmin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    let serviceAccount: any = undefined;
    if (raw) {
      try {
        serviceAccount = JSON.parse(raw);
      } catch {
        throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
      }
    }
    initializeApp({
      credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'gridironhub-3131',
    });
  }
  return { db: getFirestore(), messaging: getMessaging(), auth: getAuth() };
}

interface SendPushRequest {
  userIds: string[];
  title: string;
  message: string;
  link?: string;
  tag?: string;
  category?: string;
}

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Initialize Admin SDK (surfaces the real error instead of a 502).
  let db: Firestore;
  let messaging: Messaging;
  let auth: Auth;
  try {
    const a = initAdmin();
    db = a.db;
    messaging = a.messaging;
    auth = a.auth;
  } catch (e: any) {
    console.error('[send-push] init failed:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: `Init failed: ${e?.message || e}` }) };
  }

  // Require a valid Firebase ID token (any authenticated user).
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing auth token' }) };
  }

  try {
    await auth.verifyIdToken(idToken);
  } catch (e: any) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: `Auth verify failed: ${e?.message || 'invalid'}` }) };
  }

  let body: SendPushRequest;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { userIds, title, message, link, tag, category } = body;
  if (!Array.isArray(userIds) || userIds.length === 0 || !title) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'userIds and title required' }) };
  }

  // Cap recipients to keep the function within limits.
  const targets = userIds.slice(0, 500);
  console.log(`[send-push] recipients=${targets.length} category=${category || 'none'} title="${title}"`);

  try {
    // Collect every device token across the target users, respecting the
    // per-user pushEnabled flag and category preference.
    const tokenToUser = new Map<string, string>();

    await Promise.all(
      targets.map(async (uid) => {
        const userSnap = await db.collection('users').doc(uid).get();
        const userData = userSnap.exists ? userSnap.data() : null;
        // Global opt-out
        if (userData?.pushEnabled === false) return;
        // Category-level opt-out (default on unless explicitly disabled)
        if (category && userData?.pushPrefs && userData.pushPrefs[category] === false) return;

        const tokensSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
        tokensSnap.forEach((d) => {
          const t = d.data()?.token || d.id;
          if (t) tokenToUser.set(t, uid);
        });
      })
    );

    const tokens = Array.from(tokenToUser.keys());
    console.log(`[send-push] tokens found=${tokens.length}`);
    if (tokens.length === 0) {
      console.log('[send-push] No device tokens for recipients (not registered or push disabled).');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, sent: 0 }) };
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body: message || '' },
      data: {
        title,
        message: message || '',
        link: link || '/',
        ...(tag ? { tag } : {}),
      },
      webpush: {
        fcmOptions: { link: link || '/' },
        notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
      },
    });
    console.log(`[send-push] FCM result: success=${response.successCount} failure=${response.failureCount}`);
    response.responses.forEach((r, i) => {
      if (!r.success) console.log(`[send-push] token#${i} error: ${r.error?.code} ${r.error?.message}`);
    });

    // Prune tokens that are no longer valid.
    const invalidCodes = new Set([
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ]);
    const deletions: Promise<unknown>[] = [];
    response.responses.forEach((res, i) => {
      if (!res.success && res.error && invalidCodes.has(res.error.code)) {
        const badToken = tokens[i];
        const uid = tokenToUser.get(badToken);
        if (uid) {
          deletions.push(
            db.collection('users').doc(uid).collection('pushTokens').doc(badToken).delete().catch(() => {})
          );
        }
      }
    });
    await Promise.all(deletions);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sent: response.successCount, failed: response.failureCount }),
    };
  } catch (error: any) {
    console.error('[send-push] error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send push' }) };
  }
};

export { handler };
