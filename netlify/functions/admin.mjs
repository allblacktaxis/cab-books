// Cab Books – admin panel data (who has signed up and how they use Cab Books).
// GET /.netlify/functions/admin  with  Authorization: Bearer <the signed-in admin's Firebase ID token>
//   ?check=1  → { admin: true|false }   (quick check, used to show the Admin button)
//   otherwise → totals and one row per driver account.
// Admins: the emails in the Netlify variable ADMIN_EMAILS (comma separated), or the two below.
// PRIVACY: account details only – never jobs, money, expenses or anything else in a driver's books.
// Needs FIREBASE_SERVICE_ACCOUNT.
import crypto from 'node:crypto';
import { serviceAccount, token, getDocs, collectionGroup } from '../lib/firestore.mjs';

const DEFAULT_ADMINS = ['mpinnock@hotmail.co.uk', 'marcin@allblacktaxis.co.uk'];
const admins = () => (process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : DEFAULT_ADMINS).map(e => e.trim().toLowerCase()).filter(Boolean);
const json = (b, s) => new Response(JSON.stringify(b), { status: s || 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
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

async function listAccounts(sa) {
  const out = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:query`, {
      method: 'POST', headers: { authorization: 'Bearer ' + await token(sa, 'https://www.googleapis.com/auth/cloud-platform'), 'content-type': 'application/json' },
      body: JSON.stringify({ returnUserInfo: true, limit: '500', offset: String(offset) })
    });
    const j = await r.json();
    if (!r.ok) throw new Error('accounts_' + r.status);
    const list = j.userInfo || [];
    out.push(...list);
    if (list.length < 500) break;
    offset += list.length;
  }
  return out;
}

export function summarise(accounts, docs, phones, now) {
  const day = 864e5, t = now || Date.now();
  const rows = accounts.map(a => {
    const uid = a.localId;
    const seen = docs[`users/${uid}/meta/seen`] || {};
    const mode = (docs[`users/${uid}/settings/mode`] || {}).mode || '';
    const names = (docs[`users/${uid}/settings/drivers`] || {}).names;
    const lastSeen = Number(seen.at) || 0;
    return {
      email: a.email || '', name: Array.isArray(names) && names.length ? names[0] : (a.displayName || ''),
      created: Number(a.createdAt) || 0, lastSignIn: a.lastRefreshAt ? Date.parse(a.lastRefreshAt) : Number(a.lastLoginAt) || 0,
      lastSeen, mode: mode === 'track' ? 'Just tracking' : mode === 'full' ? 'Full books' : 'Not set up yet',
      phoneAlerts: phones[uid] || 0, device: seen.device || '', disabled: !!a.disabled, subscription: 'Free'
    };
  }).sort((x, y) => (y.lastSeen || y.lastSignIn) - (x.lastSeen || x.lastSignIn));
  const active = d => rows.filter(r => (r.lastSeen || r.lastSignIn) > t - d * day).length;
  const monthStart = new Date(new Date(t).getFullYear(), new Date(t).getMonth(), 1).getTime();
  return {
    totals: { signedUp: rows.length, activeToday: active(1), activeWeek: active(7), activeMonth: active(30), newThisMonth: rows.filter(r => r.created >= monthStart).length, phoneAlerts: rows.filter(r => r.phoneAlerts > 0).length, paying: 0 },
    users: rows
  };
}

export default async (req) => {
  const sa = serviceAccount();
  if (!sa) return json({ error: 'not_set_up' }, 503);
  let claims;
  try { claims = await verifyIdToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''), sa.project_id); }
  catch (e) { return json({ error: 'not_signed_in' }, 401); }
  const isAdmin = admins().includes(String(claims.email || '').toLowerCase());
  if (new URL(req.url).searchParams.get('check')) return json({ admin: isAdmin });
  if (!isAdmin) return json({ error: 'not_admin' }, 403);
  try {
    const accounts = await listAccounts(sa);
    const paths = accounts.flatMap(a => [`users/${a.localId}/meta/seen`, `users/${a.localId}/settings/mode`, `users/${a.localId}/settings/drivers`]);
    const docs = await getDocs(sa, paths);
    const phones = {};
    for (const p of await collectionGroup(sa, 'push')) { const m = /\/users\/([^/]+)\/push\//.exec(p.name); if (m) phones[m[1]] = (phones[m[1]] || 0) + 1; }
    return json(Object.assign({ checkedAt: new Date().toISOString() }, summarise(accounts, docs, phones)));
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
