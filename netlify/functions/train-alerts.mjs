// Cab Books – train and tube alerts on drivers' phones (stage 2).
// Runs every 5 minutes: reads National Rail cancellations at the London terminals and TfL line status,
// checks each phone that turned on alerts (users/<uid>/push/<device>, with that driver's rules) and
// sends a notification when a rule is met. A rail warning is sent once and again only if it gets
// 3 cancellations worse; a tube warning again only if the line gets worse (severe delays → part
// suspended → suspended). Once a problem clears it can be sent again next time.
// Needs FIREBASE_SERVICE_ACCOUNT. Rail alerts also need RAIL_API_KEY; tube alerts work without it.
import { getRail, getTube, RAIL_NAMES } from './opendata.mjs';
import { serviceAccount, collectionGroup, updateFields, deleteDoc } from '../lib/firestore.mjs';
import { vapidFromSeed, sendPush } from '../lib/webpush.mjs';

export const config = { schedule: '*/5 * * * *' };

// [station, operator, name, destination (backup match)]
export const EXPRESS = [
  ['PAD', /heathrow express/i, 'Heathrow Express'],
  ['VIC', /gatwick express/i, 'Gatwick Express'],
  ['LST', /stansted express/i, 'Stansted Express', /stansted airport/i]
];
export const TUBE_DEFAULT = ['elizabeth', 'district', 'piccadilly'];

// 0 = fine, 1 = severe delays, 2 = part suspended, 3 = suspended / closed. Minor delays and planned closures don't alert.
export function tubeLevel(l) {
  let lv = 0;
  for (const st of (l.statuses && l.statuses.length ? l.statuses : [l.status])) {
    const s = String(st || '').toLowerCase().trim();
    const v = /^part suspended/.test(s) ? 2 : /^suspended|^closed$|not running/.test(s) ? 3 : /severe/.test(s) ? 1 : 0;
    if (v > lv) lv = v;
  }
  return lv;
}
const LV = ['', 'severe delays', 'part suspended', 'suspended'];
const lineName = n => n + (/line$|^dlr$/i.test(n) ? '' : ' line');

export function alertsFor(rules, rail, tube) {
  const R = Object.assign({ on: true, min: 4, express: true, off: [], tube: true, tlines: TUBE_DEFAULT }, rules || {});
  const out = [];
  if (!R.on) return out;
  if (rail && rail.stations) {
    for (const crs of Object.keys(RAIL_NAMES)) {
      const x = rail.stations[crs];
      if (!x || !x.available || (R.off || []).includes(crs)) continue;
      if (x.cancellationCount >= (Number(R.min) || 4)) out.push({ k: crs, n: x.cancellationCount, t: `${RAIL_NAMES[crs]}: ${x.cancellationCount} cancelled in the next 2 hours` });
    }
    if (R.express) for (const [crs, re, name, dest] of EXPRESS) {
      const x = rail.stations[crs];
      if (!x || !x.available) continue;
      const n = (x.cancelledServices || []).filter(s => re.test(s.operator || '') || (dest && dest.test(s.destination || ''))).length;
      if (n >= 2) out.push({ k: name, n, t: `${name}: ${n} trains cancelled` });
    }
  }
  if (R.tube !== false && tube && Array.isArray(tube.lines)) {
    const want = Array.isArray(R.tlines) ? R.tlines : TUBE_DEFAULT;
    for (const l of tube.lines) {
      if (!want.includes(l.id)) continue;
      const lv = tubeLevel(l);
      if (lv) out.push({ k: 'tl:' + l.id, n: lv, tube: true, t: `${lineName(l.name)}: ${LV[lv]}` });
    }
  }
  return out;
}
// Which alerts are new (or worse) compared with what this phone was last sent; and the new "sent" record.
export function whatToSend(alerts, sent) {
  const prev = sent || {}, next = {}, fresh = [];
  for (const a of alerts) {
    const p = prev[a.k], step = a.tube ? 1 : 3;
    if (!p || a.n >= (Number(p) || 0) + step) { fresh.push(a); next[a.k] = a.n; } else next[a.k] = Number(p) || a.n;
  }
  return { fresh, next };
}
export function message(fresh) {
  const body = fresh.slice(0, 3).map(a => a.t).join('\n') + (fresh.length > 3 ? `\n+${fresh.length - 3} more` : '');
  const allTube = fresh.every(a => a.tube), one = fresh.length === 1 ? fresh[0] : null;
  const title = allTube ? (one ? one.t.replace(/:.*/, '') + ' problems' : 'Tube problems')
    : one && /Express/.test(one.k) ? `${one.k} problems`
    : 'Train problems' + (one && RAIL_NAMES[one.k] ? ` at ${RAIL_NAMES[one.k]}` : '');
  return { title, body, tag: allTube ? 'cab-books-tube' : 'cab-books-trains', url: allTube ? '/?tool=tube' : '/?tool=trains' };
}

export default async () => {
  const sa = serviceAccount();
  if (!sa) return new Response('not set up', { status: 200 });
  const [rail, tube] = await Promise.all([
    process.env.RAIL_API_KEY ? getRail().catch(() => null) : null,
    getTube().catch(() => null)
  ]);
  const vapid = vapidFromSeed(sa.private_key);
  const phones = await collectionGroup(sa, 'push');
  let sentCount = 0;
  for (const ph of phones) {
    const d = ph.data || {};
    let sub; try { sub = typeof d.sub === 'string' ? JSON.parse(d.sub) : d.sub; } catch (e) { sub = null; }
    if (!sub || !sub.endpoint || !sub.keys) continue;
    let { fresh, next } = whatToSend(alertsFor(d.rules, rail, tube), d.sent);
    // Keep earlier records for a feed that couldn't be read this run, so it doesn't re-send next time.
    for (const [k, v] of Object.entries(d.sent || {})) if (!(k in next) && ((k.startsWith('tl:') && !tube) || (!k.startsWith('tl:') && !rail))) next[k] = v;
    if (fresh.length) {
      try {
        const st = await sendPush(sub, message(fresh), vapid);
        if (st === 404 || st === 410) { await deleteDoc(sa, ph.name); continue; }
        if (st >= 200 && st < 300) sentCount++;
      } catch (e) { /* try again next run */ continue; }
    }
    if (JSON.stringify(next) !== JSON.stringify(d.sent || {})) await updateFields(sa, ph.name, { sent: next, checked: Date.now() }).catch(() => {});
  }
  return new Response(`checked ${phones.length} phones, sent ${sentCount}${rail ? '' : ' (no rail data)'}${tube ? '' : ' (no tube data)'}`, { status: 200 });
};
