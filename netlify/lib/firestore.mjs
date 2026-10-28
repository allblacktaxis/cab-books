// Cab Books – tiny Firestore REST client for server functions (no outside packages).
// Uses the Firebase service account in the Netlify environment variable FIREBASE_SERVICE_ACCOUNT
// (the JSON file from Firebase console → Project settings → Service accounts → Generate new private key).
import crypto from 'node:crypto';

const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const cachedTok = {};

export function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    return sa && sa.client_email && sa.private_key && sa.project_id ? sa : null;
  } catch (e) { return null; }
}

export async function token(sa, scope) {
  scope = scope || 'https://www.googleapis.com/auth/datastore';
  const cached = cachedTok[scope];
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), sa.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + body + '.' + b64u(sig)
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('firebase_auth_' + r.status);
  cachedTok[scope] = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

export function decode(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return null;
}
export function decodeFields(f) { const o = {}; for (const k of Object.keys(f || {})) o[k] = decode(f[k]); return o; }
export function encode(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(encode) } };
  const fields = {}; for (const k of Object.keys(x)) fields[k] = encode(x[k]);
  return { mapValue: { fields } };
}

const base = sa => `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

// Every document in any collection called `name` (e.g. users/<uid>/push/<device>).
export async function collectionGroup(sa, name) {
  const r = await fetch(base(sa) + ':runQuery', {
    method: 'POST', headers: { authorization: 'Bearer ' + await token(sa), 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: name, allDescendants: true }] } })
  });
  const rows = await r.json();
  if (!r.ok) throw new Error('firestore_query_' + r.status);
  return (Array.isArray(rows) ? rows : []).filter(x => x.document).map(x => ({ name: x.document.name, data: decodeFields(x.document.fields) }));
}
export async function updateFields(sa, name, obj) {
  const mask = Object.keys(obj).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const fields = {}; for (const k of Object.keys(obj)) fields[k] = encode(obj[k]);
  const r = await fetch('https://firestore.googleapis.com/v1/' + name + '?' + mask, {
    method: 'PATCH', headers: { authorization: 'Bearer ' + await token(sa), 'content-type': 'application/json' }, body: JSON.stringify({ fields })
  });
  if (!r.ok) throw new Error('firestore_update_' + r.status);
}
export async function deleteDoc(sa, name) {
  await fetch('https://firestore.googleapis.com/v1/' + name, { method: 'DELETE', headers: { authorization: 'Bearer ' + await token(sa) } });
}

// Read several documents by path (e.g. 'users/<uid>/settings/mode'); missing ones are left out.
export async function getDocs(sa, paths) {
  if (!paths.length) return {};
  const pre = `projects/${sa.project_id}/databases/(default)/documents/`;
  const out = {};
  for (let i = 0; i < paths.length; i += 100) {
    const r = await fetch(base(sa) + ':batchGet', {
      method: 'POST', headers: { authorization: 'Bearer ' + await token(sa), 'content-type': 'application/json' },
      body: JSON.stringify({ documents: paths.slice(i, i + 100).map(p => pre + p) })
    });
    const rows = await r.json();
    if (!r.ok) throw new Error('firestore_get_' + r.status);
    for (const x of rows) if (x.found) out[x.found.name.slice(pre.length)] = decodeFields(x.found.fields);
  }
  return out;
}
