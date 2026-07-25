import type { Handler } from '@netlify/functions';
import { createSign, createVerify } from 'node:crypto';

// =============================================================================
// SEND PUSH - Deliver a Web Push (FCM) notification to a user's devices.
//
// ZERO npm dependencies on purpose. This function talks to Google over plain
// HTTPS using only Node built-ins:
//   1. Mint an OAuth2 access token by signing a JWT with the service account.
//   2. Verify the caller's Firebase ID token against Google's public certs.
//   3. Read device tokens from Firestore via the REST API.
//   4. Send each message via the FCM HTTP v1 API.
//
// Why: firebase-admin cannot be bundled reliably by Netlify's esbuild (it loads
// .proto/.json assets from disk at runtime -> module crash -> HTTP 502), and it
// cannot be marked `external` either because this project is "type": "module",
// so a CommonJS namespace import lands the real exports under `.default`.
// Dropping the dependency removes both failure modes permanently.
//
// Required env: FIREBASE_SERVICE_ACCOUNT (full JSON, one line).
// Optional env: FIREBASE_PROJECT_ID, PUBLIC_SITE_URL / URL.
// =============================================================================

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

interface SendPushRequest {
  userIds: string[];
  title: string;
  message: string;
  link?: string;
  tag?: string;
  category?: string;
}

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/firebase.messaging',
  'https://www.googleapis.com/auth/datastore',
].join(' ');

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const base64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url');

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');

  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing client_email or private_key');
  }
  // Tolerate keys stored with escaped newlines.
  parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  return parsed;
}

// --- Google OAuth2 (service account JWT grant) -------------------------------

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) return tokenCache.token;

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: OAUTH_SCOPES,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${base64url(signer.sign(sa.private_key))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `OAuth token request failed (${res.status}): ${data.error_description || data.error || 'unknown'}`
    );
  }

  tokenCache = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) };
  return data.access_token;
}

// --- Firebase ID token verification ------------------------------------------

let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) return certCache.certs;

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error(`Could not fetch Google certs (${res.status})`);
  const certs = (await res.json()) as Record<string, string>;

  const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  certCache = { certs, expiresAt: now + (maxAge ? Number(maxAge[1]) : 3600) * 1000 };
  return certs;
}

/** Verifies a Firebase ID token and returns the caller's uid. */
async function verifyIdToken(idToken: string, projectId: string): Promise<string> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed ID token');
  const [rawHeader, rawPayload, rawSignature] = parts;

  const header = JSON.parse(Buffer.from(rawHeader, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(rawPayload, 'base64url').toString('utf8'));

  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm');
  if (payload.aud !== projectId) throw new Error('Token audience mismatch');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Token issuer mismatch');
  }
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Token has no subject');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw new Error('Token expired');
  if (payload.iat > now + 300) throw new Error('Token issued in the future');

  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Token signed with an unknown key');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${rawHeader}.${rawPayload}`);
  if (!verifier.verify(cert, Buffer.from(rawSignature, 'base64url'))) {
    throw new Error('Token signature is invalid');
  }

  return payload.sub;
}

// --- Firestore REST -----------------------------------------------------------

const firestoreBase = (projectId: string) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

/** Unwraps Firestore's typed value format into plain JS. */
function decodeValue(value: any): any {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields);
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeValue);
  return undefined;
}

function decodeFields(fields: Record<string, any> | undefined): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields || {})) out[key] = decodeValue(value);
  return out;
}

async function firestoreGetUser(
  projectId: string,
  accessToken: string,
  uid: string
): Promise<Record<string, any> | null> {
  const res = await fetch(`${firestoreBase(projectId)}/users/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore read users/${uid} failed (${res.status})`);
  const doc: any = await res.json();
  return decodeFields(doc.fields);
}

async function firestoreListTokens(
  projectId: string,
  accessToken: string,
  uid: string
): Promise<string[]> {
  const url = `${firestoreBase(projectId)}/users/${encodeURIComponent(uid)}/pushTokens?pageSize=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Firestore list pushTokens failed (${res.status})`);

  const data: any = await res.json();
  return (data.documents || [])
    .map((doc: any) => {
      const fields = decodeFields(doc.fields);
      // Prefer the stored field, fall back to the document id.
      return fields.token || String(doc.name || '').split('/').pop();
    })
    .filter(Boolean);
}

async function firestoreDeleteToken(
  projectId: string,
  accessToken: string,
  uid: string,
  token: string
): Promise<void> {
  const url = `${firestoreBase(projectId)}/users/${encodeURIComponent(uid)}/pushTokens/${encodeURIComponent(token)}`;
  await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

// --- FCM HTTP v1 ---------------------------------------------------------------

interface SendResult {
  ok: boolean;
  unregistered: boolean;
  error?: string;
}

async function sendToToken(
  projectId: string,
  accessToken: string,
  token: string,
  payload: { title: string; message: string; link: string; tag?: string }
): Promise<SendResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        // Data-only on purpose. If a `notification` block is present the browser
        // may display it itself AND skip onBackgroundMessage, which makes the
        // result differ per browser/SDK version. Data-only guarantees our
        // service worker gets the message and renders exactly one notification.
        // FCM v1 requires every data value to be a string.
        data: {
          title: payload.title,
          message: payload.message,
          link: payload.link,
          ...(payload.tag ? { tag: payload.tag } : {}),
        },
        webpush: {
          headers: { Urgency: 'high', TTL: '86400' },
        },
      },
    }),
  });

  if (res.ok) return { ok: true, unregistered: false };

  const body: any = await res.json().catch(() => ({}));
  const status = body?.error?.status;
  const detailCode = body?.error?.details?.find((d: any) => String(d['@type'] || '').includes('FcmError'))
    ?.errorCode;

  return {
    ok: false,
    unregistered: status === 'NOT_FOUND' || detailCode === 'UNREGISTERED',
    error: `${status || res.status}: ${body?.error?.message || 'send failed'}`,
  };
}

// --- Handler --------------------------------------------------------------------

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Everything below returns readable JSON instead of crashing the runtime, so
  // a misconfiguration can never surface as a bare 502 again.
  try {
    const sa = loadServiceAccount();
    const projectId = process.env.FIREBASE_PROJECT_ID || sa.project_id || 'gridironhub-3131';
    const siteUrl = (process.env.PUBLIC_SITE_URL || process.env.URL || 'https://osys.team').replace(/\/+$/, '');

    const authHeader = event.headers.authorization || event.headers.Authorization;
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing auth token' }) };
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(sa);
    } catch (e: any) {
      console.error('[send-push] OAuth failed:', e);
      return { statusCode: 500, headers, body: JSON.stringify({ error: e?.message || 'OAuth failed' }) };
    }

    try {
      await verifyIdToken(idToken, projectId);
    } catch (e: any) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: `Auth verify failed: ${e?.message || 'invalid'}` }),
      };
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

    const targets = userIds.slice(0, 500);
    console.log(`[send-push] recipients=${targets.length} category=${category || 'none'} title="${title}"`);

    // Collect device tokens, honouring the global and per-category opt-outs.
    const tokenToUser = new Map<string, string>();
    await Promise.all(
      targets.map(async (uid) => {
        const user = await firestoreGetUser(projectId, accessToken, uid);
        if (user?.pushEnabled === false) return;
        if (category && user?.pushPrefs && user.pushPrefs[category] === false) return;

        const tokens = await firestoreListTokens(projectId, accessToken, uid);
        tokens.forEach((t) => tokenToUser.set(t, uid));
      })
    );

    const tokens = Array.from(tokenToUser.keys());
    console.log(`[send-push] tokens found=${tokens.length}`);
    if (tokens.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, sent: 0, failed: 0 }) };
    }

    // Relative links must be absolutised for FCM's webpush fcm_options.
    const absoluteLink = link
      ? link.startsWith('http')
        ? link
        : `${siteUrl}${link.startsWith('/') ? '' : '/'}${link}`
      : `${siteUrl}/`;

    const results = await Promise.all(
      tokens.map((token) =>
        sendToToken(projectId, accessToken, token, {
          title,
          message: message || '',
          link: absoluteLink,
          tag,
        })
      )
    );

    const errors: string[] = [];
    const deletions: Promise<void>[] = [];

    results.forEach((result, i) => {
      if (result.ok) return;
      console.log(`[send-push] token#${i} failed: ${result.error}`);
      if (errors.length < 5 && result.error) errors.push(result.error);
      if (result.unregistered) {
        const uid = tokenToUser.get(tokens[i]);
        if (uid) deletions.push(firestoreDeleteToken(projectId, accessToken, uid, tokens[i]));
      }
    });
    await Promise.all(deletions);

    const sent = results.filter((r) => r.ok).length;
    console.log(`[send-push] result: success=${sent} failure=${results.length - sent}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sent,
        failed: results.length - sent,
        ...(errors.length ? { errors } : {}),
      }),
    };
  } catch (error: any) {
    console.error('[send-push] unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error?.message || 'Failed to send push' }),
    };
  }
};

export { handler };
