// Cab Books – check a Firebase sign-in token on the server (signature, project, expiry).
// Used by the admin panel and by routing-rules. No service account is needed:
// Google's public signing certificates are fetched and cached.
import crypto from 'node:crypto';

export const FIREBASE_PROJECT_ID = 'cab-books-ba427';
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

let certs = null;
async function googleCerts() {
  if (certs && certs.exp > Date.now()) return certs.keys;
  const r = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  const keys = await r.json();
  const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  certs = { keys, exp: Date.now() + (m ? Number(m[1]) * 1000 : 3600000) };
  return keys;
}
// Check a Firebase sign-in token properly (signature, project, expiry) and return its claims.
export async function verifyIdToken(idToken, projectId, keysOverride, nowSec) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('bad_token');
  const head = JSON.parse(unb64u(parts[0])), claims = JSON.parse(unb64u(parts[1]));
  const keys = keysOverride || await googleCerts();
  if (head.alg !== 'RS256' || !keys[head.kid]) throw new Error('bad_token');
  const ok = crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey(keys[head.kid]), unb64u(parts[2]));
  const now = nowSec || Math.floor(Date.now() / 1000);
  if (!ok || claims.aud !== projectId || claims.iss !== 'https://securetoken.google.com/' + projectId || !(claims.exp > now) || !claims.sub) throw new Error('bad_token');
  return claims;
}

// Returns the signed-in driver's claims, or null if the request has no valid Cab Books sign-in.
export async function signedInUser(request, projectId = process.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID) {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '');
  if (!m) return null;
  try { return await verifyIdToken(m[1], projectId); } catch { return null; }
}
