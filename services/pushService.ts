/**
 * pushService
 * Web Push (Firebase Cloud Messaging) helpers for the installed PWA.
 *
 * Flow:
 *  - enablePush(userId): ask permission, get an FCM token, store it under
 *    users/{uid}/pushTokens/{token}, and flag the profile as push-enabled.
 *  - disablePush(userId): delete the current token and clear stored tokens.
 *  - initForegroundPush(): show an in-app notification when a push arrives
 *    while the app is focused.
 *
 * Requires env var VITE_FIREBASE_VAPID_KEY (Firebase Console → Project Settings
 * → Cloud Messaging → Web Push certificates → Key pair).
 */

import { getToken, deleteToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, updateDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth, getMessagingIfSupported } from './firebase';
import { toastInfo } from './toast';

/**
 * Send a test push to the CURRENT user's own devices (bypasses the usual
 * "don't notify the sender" rule) so they can verify delivery. Returns a
 * result describing what happened for easy diagnosis.
 */
export const sendTestPush = async (
  userId: string
): Promise<{ ok: boolean; sent?: number; error?: string }> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return { ok: false, error: 'Not signed in' };
    const idToken = await currentUser.getIdToken();
    const res = await fetch('/.netlify/functions/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        userIds: [userId],
        title: 'OSYS Test 🔔',
        message: 'Your push notifications are working!',
        link: '/notifications',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}` };
    return { ok: true, sent: data?.sent ?? 0 };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Request failed' };
  }
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

// True if this browser can support web push at all.
export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'Notification' in window &&
  'PushManager' in window;

// Current OS/browser permission state.
export const getPushPermission = (): NotificationPermission | 'unsupported' => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

// iOS/iPadOS (including iPadOS reporting itself as MacIntel).
const isIOS = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// True when running as an installed PWA rather than a browser tab.
export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true);

/**
 * Why push can't be enabled on this device, or null if it can. Used so the UI
 * can explain the real reason instead of failing silently.
 */
export const getPushBlocker = (): string | null => {
  // Safari only delivers web push to a Home Screen PWA (iOS 16.4+), never to a tab.
  if (isIOS() && !isStandalone()) {
    return 'On iPhone/iPad, tap Share → "Add to Home Screen" first, then open OSYS from that icon and turn push on there.';
  }
  if (!isPushSupported()) return 'This browser does not support push notifications.';
  if (getPushPermission() === 'denied') {
    return 'Notifications are blocked. Turn them on for OSYS in your browser/device settings.';
  }
  if (!VAPID_KEY) return 'Push is not configured on the server (missing VAPID key).';
  return null;
};

// Register (or reuse) the app service worker. /sw.js now handles push itself —
// registering a second worker here would fight it for scope "/" (a scope holds
// only one registration), and push events would land in whichever one won.
const getMessagingServiceWorker = async (): Promise<ServiceWorkerRegistration | undefined> => {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.warn('[FCM] Failed to register service worker:', error);
    return undefined;
  }
};

/**
 * Request permission and register this device for push. Returns the FCM token
 * on success, or null if unsupported/denied/failed.
 */
export const enablePush = async (userId: string): Promise<string | null> => {
  if (!isPushSupported()) return null;

  if (!VAPID_KEY) {
    console.error('[FCM] Missing VITE_FIREBASE_VAPID_KEY — cannot enable push.');
    return null;
  }

  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  // Ask the user (no-op if already granted).
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const swRegistration = await getMessagingServiceWorker();

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (!token) return null;

    // Store the token so the backend can target this device.
    await setDoc(doc(db, 'users', userId, 'pushTokens', token), {
      token,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Flag the profile so we remember the user's choice across sessions.
    await updateDoc(doc(db, 'users', userId), { pushEnabled: true }).catch(() => {});

    return token;
  } catch (error) {
    console.error('[FCM] enablePush failed:', error);
    return null;
  }
};

/**
 * Turn off push for this user: delete the active token and clear stored tokens.
 */
export const disablePush = async (userId: string): Promise<void> => {
  try {
    const messaging = await getMessagingIfSupported();
    if (messaging) {
      await deleteToken(messaging).catch(() => {});
    }

    // Remove all stored tokens for this user.
    const snap = await getDocs(collection(db, 'users', userId, 'pushTokens'));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));

    await updateDoc(doc(db, 'users', userId), { pushEnabled: false }).catch(() => {});
  } catch (error) {
    console.error('[FCM] disablePush failed:', error);
  }
};

/**
 * Show an in-app notification when a push arrives while the app is focused.
 * Call once after login. Returns an unsubscribe function.
 */
export const initForegroundPush = async (): Promise<(() => void) | void> => {
  if (!isPushSupported() || getPushPermission() !== 'granted') return;
  const messaging = await getMessagingIfSupported();
  if (!messaging) return;

  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title;
    const body = payload.notification?.body || payload.data?.message;
    if (title || body) {
      toastInfo(body ? `${title ? title + ': ' : ''}${body}` : (title as string));
    }
  });
};
