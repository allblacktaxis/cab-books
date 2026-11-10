// Cab Books – carry out account deletions after the 7-day grace period (Matt, 10 Nov 2026; UK GDPR).
// A driver who taps "Delete my account" records users/<uid>/meta/deletion {requested:true, deleteAfter:<ms>}.
// Signing in before then shows a warning with "Keep my account", which removes that record.
// Once deleteAfter has passed, this job (daily) deletes everything under users/<uid> – every collection and
// document, including meta/deletion itself, which goes last – and then the driver's sign-in account.
// If anything fails it stops for that driver and tries again the next day. Shared areas (the suggestions box)
// are not touched. Needs FIREBASE_SERVICE_ACCOUNT.
import { serviceAccount, token, collectionGroup } from '../lib/firestore.mjs';

export const config = { schedule: '17 3 * * *' };

const DOCS = sa => `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

// Driver id from a document path, only for users/<uid>/meta/deletion.
export function dueUid(doc, now) {
  const m = /\/documents\/users\/([^/]+)\/meta\/deletion$/.exec(doc.name || '');
  const d = doc.data || {};
  if (!m || d.requested !== true) return null;
  const at = Number(d.deleteAfter);
  if (!Number.isFinite(at) || at > now) return null;
  return m[1];
}

async function listCollections(sa, path, f) {
  const out = []; let pageToken = '';
  do {
    const r = await f(`${DOCS(sa)}/${path}:listCollectionIds`, { method: 'POST', headers: { authorization: 'Bearer ' + await token(sa), 'content-type': 'application/json' }, body: JSON.stringify({ pageSize: 100, pageToken }) });
    const j = await r.json(); if (!r.ok) throw new Error('list_collections_' + r.status);
    out.push(...(j.collectionIds || [])); pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}
async function listDocs(sa, path, f) {
  const out = []; let pageToken = '';
  do {
    const r = await f(`${DOCS(sa)}/${path}?pageSize=300&mask.fieldPaths=__name__&showMissing=true${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`, { headers: { authorization: 'Bearer ' + await token(sa) } });
    const j = await r.json(); if (!r.ok) throw new Error('list_docs_' + r.status);
    out.push(...(j.documents || []).map(d => d.name)); pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}
async function del(sa, name, f) {
  const r = await f('https://firestore.googleapis.com/v1/' + name, { method: 'DELETE', headers: { authorization: 'Bearer ' + await token(sa) } });
  if (!r.ok && r.status !== 404) throw new Error('delete_' + r.status);
}
// Everything below users/<uid>, two levels deep (collection/doc/collection/doc), then the users/<uid> document.
export async function deleteUserData(sa, uid, f = fetch) {
  const root = `users/${uid}`, pre = `projects/${sa.project_id}/databases/(default)/documents/`;
  let n = 0, last = null;
  for (const c of await listCollections(sa, root, f)) {
    for (const name of await listDocs(sa, `${root}/${c}`, f)) {
      const rel = name.slice(pre.length);
      for (const c2 of await listCollections(sa, rel, f)) for (const n2 of await listDocs(sa, `${rel}/${c2}`, f)) { await del(sa, n2, f); n++; }
      if (rel === `${root}/meta/deletion`) { last = name; continue; }
      await del(sa, name, f); n++;
    }
  }
  await del(sa, pre + root, f);
  return { count: n, last };
}
export async function deleteAccount(sa, uid, f = fetch) {
  const r = await f(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:delete`, {
    method: 'POST', headers: { authorization: 'Bearer ' + await token(sa, 'https://www.googleapis.com/auth/cloud-platform'), 'content-type': 'application/json' },
    body: JSON.stringify({ localId: uid })
  });
  if (!r.ok) { const t = await r.text(); if (!/USER_NOT_FOUND/.test(t)) throw new Error('auth_delete_' + r.status); }
}

export default async () => {
  const sa = serviceAccount();
  if (!sa) return new Response('not set up', { status: 200 });
  const now = Date.now();
  const due = (await collectionGroup(sa, 'meta')).map(d => dueUid(d, now)).filter(Boolean);
  const done = [], failed = [];
  for (const uid of due) {
    try {
      const r = await deleteUserData(sa, uid);
      await deleteAccount(sa, uid);
      if (r.last) await del(sa, r.last, fetch); // the request record goes last, so a failure above is retried tomorrow
      done.push(uid.slice(0, 6) + '… ' + r.count + ' records');
    } catch (e) { failed.push(uid.slice(0, 6) + '… ' + String(e && e.message || e)); }
  }
  return new Response(`deletions due ${due.length}; done: ${done.join(', ') || 'none'}; failed: ${failed.join(', ') || 'none'}`, { status: 200 });
};
