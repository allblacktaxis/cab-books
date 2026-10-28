// Cab Books – minimal Web Push sender (no outside packages).
// Encrypts with RFC 8291 (aes128gcm) and signs with VAPID (RFC 8292, ES256).
// The VAPID key pair is derived from a server secret, so no extra key has to be stored.
import crypto from 'node:crypto';

export const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// VAPID keys: P-256 private key = SHA-256 of a server secret (stable across runs).
export function vapidFromSeed(seed) {
  const d = crypto.createHash('sha256').update('cab-books-vapid:' + seed).digest();
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(d);
  return { d, pub: ecdh.getPublicKey() };
}
function ecPrivateKey(d, pub) {
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(d), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
}
export function vapidJwt(audience, subject, vapid, nowSec) {
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: audience, exp: (nowSec || Math.floor(Date.now() / 1000)) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: ecPrivateKey(vapid.d, vapid.pub), dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}

// RFC 8291 message encryption. `test` lets the RFC's worked example supply fixed salt and keys.
export function encrypt(payload, p256dh, authSecret, test) {
  const uaPublic = unb64u(p256dh), auth = unb64u(authSecret);
  const as = crypto.createECDH('prime256v1');
  if (test && test.asPrivate) as.setPrivateKey(unb64u(test.asPrivate)); else as.generateKeys();
  const asPublic = as.getPublicKey();
  const secret = as.computeSecret(uaPublic);
  const prkKey = hmac(auth, secret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const salt = test && test.salt ? unb64u(test.salt) : crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = asPublic.length;
  return Buffer.concat([head, asPublic, ct]);
}

// Send one notification. Returns the push service's HTTP status (201 = sent; 404/410 = subscription gone).
export async function sendPush(sub, data, vapid, subject) {
  const endpoint = new URL(sub.endpoint);
  const jwt = vapidJwt(endpoint.origin, subject || 'mailto:marcin@allblacktaxis.co.uk', vapid);
  const body = encrypt(JSON.stringify(data), sub.keys.p256dh, sub.keys.auth);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { TTL: '3600', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: `vapid t=${jwt}, k=${b64u(vapid.pub)}` },
    body
  });
  return r.status;
}
