// Cab Books – train alerts on drivers' phones (stage 2).
// Runs every 5 minutes: reads National Rail cancellations at the London terminals, checks each phone
// that turned on alerts (users/<uid>/push/<device>, with that driver's rules) and sends a notification
// when a rule is met. A warning is sent once and again only if it gets 3 cancellations worse;
// once the problem clears it can be sent again next time.
// Needs Netlify environment variables RAIL_API_KEY and FIREBASE_SERVICE_ACCOUNT.
import { getRail, RAIL_NAMES } from './opendata.mjs';
import { serviceAccount, collectionGroup, updateFields, deleteDoc } from '../lib/firestore.mjs';
import { vapidFromSeed, sendPush } from '../lib/webpush.mjs';

export const config = { schedule: '*/5 * * * *' };

const EXPRESS = [['PAD', /heathrow express/i, 'Heathrow Express'], ['VIC', /gatwick express/i, 'Gatwick Express']];

export function alertsFor(rules, rail) {
  const R = Object.assign({ on: true, min: 4, express: true, off: [] }, rules || {});
  const out = [];
  if (!R.on || !rail || !rail.stations) return out;
  for (const crs of Object.keys(RAIL_NAMES)) {
    const x = rail.stations[crs];
    if (!x || !x.available || (R.off || []).includes(crs)) continue;
    if (x.cancellationCount >= (Number(R.min) || 4)) out.push({ k: crs, n: x.cancellationCount, t: `${RAIL_NAMES[crs]}: ${x.cancellationCount} cancelled in the next 2 hours` });
  }
  if (R.express) for (const [crs, re, name] of EXPRESS) {
    const x = rail.stations[crs];
    if (!x || !x.available) continue;
    const n = (x.cancelledServices || []).filter(s => re.test(s.operator || '')).length;
    if (n >= 2) out.push({ k: name, n, t: `${name}: ${n} trains cancelled` });
  }
  return out;
}
// Which alerts are new (or 3+ worse) compared with what this phone was last sent; and the new "sent" record.
export function whatToSend(alerts, sent) {
  const prev = sent || {}, next = {}, fresh = [];
  for (const a of alerts) {
    const p = prev[a.k];
    if (!p || a.n >= (Number(p) || 0) + 3) { fresh.push(a); next[a.k] = a.n; } else next[a.k] = Number(p) || a.n;
  }
  return { fresh, next };
}

export default async () => {
  const sa = serviceAccount();
  if (!sa || !process.env.RAIL_API_KEY) return new Response('not set up', { status: 200 });
  const rail = await getRail();
  const vapid = vapidFromSeed(sa.private_key);
  const phones = await collectionGroup(sa, 'push');
  let sentCount = 0;
  for (const ph of phones) {
    const d = ph.data || {};
    let sub; try { sub = typeof d.sub === 'string' ? JSON.parse(d.sub) : d.sub; } catch (e) { sub = null; }
    if (!sub || !sub.endpoint || !sub.keys) continue;
    const { fresh, next } = whatToSend(alertsFor(d.rules, rail), d.sent);
    if (fresh.length) {
      const body = fresh.slice(0, 3).map(a => a.t).join('\n') + (fresh.length > 3 ? `\n+${fresh.length - 3} more` : '');
      const title = fresh.length === 1 && /Express/.test(fresh[0].k) ? `${fresh[0].k} problems` : 'Train problems' + (fresh.length === 1 ? ` at ${RAIL_NAMES[fresh[0].k] || fresh[0].k}` : '');
      try {
        const st = await sendPush(sub, { title, body, tag: 'cab-books-trains', url: '/?tool=trains' }, vapid);
        if (st === 404 || st === 410) { await deleteDoc(sa, ph.name); continue; }
        if (st >= 200 && st < 300) sentCount++;
      } catch (e) { /* try again next run */ continue; }
    }
    if (JSON.stringify(next) !== JSON.stringify(d.sent || {})) await updateFields(sa, ph.name, { sent: next, checked: Date.now() }).catch(() => {});
  }
  return new Response(`checked ${phones.length} phones, sent ${sentCount}`, { status: 200 });
};
