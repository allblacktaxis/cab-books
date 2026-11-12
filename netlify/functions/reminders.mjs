// Cab Books – weekly statement reminder on drivers' phones (to-do item 10, Matt 10 Nov 2026).
// One reminder a week, on the day and hour each driver picks (default Wednesday 10am, London time): "Time to bring in
// this week's statements", naming only the apps that driver uses, plus, on the first of that weekday in a month, last
// month's bank CSV (Full books) and last month's Curb report. Tapping it opens the Import tab.
// Uses the same phone sign-up as train alerts (users/<uid>/push/<device>); the reminder settings are in its "remind"
// field ({on, dow 0-6 Sun-Sat, hour 0-23, apps:[names], bank}). Sent at most once a day per phone (remindSent).
// Runs every hour. Needs FIREBASE_SERVICE_ACCOUNT (already set).
import { serviceAccount, collectionGroup, updateFields, deleteDoc } from '../lib/firestore.mjs';
import { vapidFromSeed, sendPush } from '../lib/webpush.mjs';

export const config = { schedule: '3 * * * *' };

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function londonNow(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, dom: +p.day, dow: DOW[p.weekday], hour: +p.hour % 24 };
}
function list(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

export function reminderFor(r, now) {
  if (!r || r.on === false) return null;
  const dow = Number.isInteger(r.dow) ? r.dow : 3, hour = Number.isInteger(r.hour) ? r.hour : 10;
  if (now.dow !== dow || now.hour !== hour) return null;
  const apps = Array.isArray(r.apps) ? r.apps.filter(a => typeof a === 'string').slice(0, 8) : [];
  const weekly = apps.filter(a => !/^curb$/i.test(a)), curb = apps.some(a => /^curb$/i.test(a)) && now.dom <= 7;
  const parts = [];
  if (weekly.length) parts.push(`this week's ${list(weekly)} statement${weekly.length > 1 ? 's' : ''}`);
  if (r.bank !== false && now.dom <= 7) parts.push("last month's bank statement (CSV)"); /* once a month (Matt, 12 Nov 2026) */
  if (!parts.length && !curb) parts.push("this week's statements");
  let body = parts.length ? `Bring in ${list(parts)}.` : '';
  if (curb) body += (body ? ' ' : '') + "Also last month's Curb report.";
  return { title: 'Time for your statements', body: body + ' Tap to open Import.', tag: 'cab-books-statements', url: '/?tab=import' };
}

export default async () => {
  const sa = serviceAccount();
  if (!sa) return new Response('not set up', { status: 200 });
  const now = londonNow(), vapid = vapidFromSeed(sa.private_key);
  const phones = await collectionGroup(sa, 'push');
  let sent = 0;
  for (const ph of phones) {
    const d = ph.data || {};
    const msg = reminderFor(d.remind, now);
    if (!msg || d.remindSent === now.date) continue;
    let sub; try { sub = typeof d.sub === 'string' ? JSON.parse(d.sub) : d.sub; } catch (e) { sub = null; }
    if (!sub || !sub.endpoint || !sub.keys) continue;
    try {
      const st = await sendPush(sub, msg, vapid);
      if (st === 404 || st === 410) { await deleteDoc(sa, ph.name); continue; }
      if (st >= 200 && st < 300) { sent++; await updateFields(sa, ph.name, { remindSent: now.date }).catch(() => {}); }
    } catch (e) { /* try again next hour */ }
  }
  return new Response(`checked ${phones.length} phones, sent ${sent} reminders`, { status: 200 });
};
