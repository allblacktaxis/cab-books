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

// RMT 24-hour strikes (Matt, 12 Nov 2026): every phone with alerts on gets one heads-up at 6pm London time the evening
// before. Same dates as RMT_STRIKES in the app (src/source_index.html); keep the two lists in step. Sent once (strikeSent).
export const RMT_STRIKES = ['2026-11-26', '2026-12-17', '2026-12-19', '2027-01-04', '2027-01-06', '2027-02-17', '2027-02-23', '2027-02-25'];
const STRIKE_HOUR = 18;
function addDays(iso, n) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
function dayName(iso) { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getUTCDay()] + ' ' + d + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]; }
export function strikeFor(now) {
  if (now.hour !== STRIKE_HOUR) return null;
  const s = RMT_STRIKES.find(x => addDays(x, -1) === now.date);
  if (!s) return null;
  return { title: 'RMT strike tomorrow \u2013 expect busy roads', body: `24 hours from 12:00 noon ${dayName(s)} to 12:00 noon ${dayName(addDays(s, 1))}. Tap to see the day.`,
    tag: 'cab-books-rmt-' + s, url: '/?tab=today' };
}

export default async () => {
  const sa = serviceAccount();
  if (!sa) return new Response('not set up', { status: 200 });
  const now = londonNow(), vapid = vapidFromSeed(sa.private_key);
  const phones = await collectionGroup(sa, 'push');
  let sent = 0;
  const strike = strikeFor(now);
  for (const ph of phones) {
    const d = ph.data || {};
    if (strike && d.strikeSent !== now.date && !(d.rules && d.rules.on === false)) {
      let sub; try { sub = typeof d.sub === 'string' ? JSON.parse(d.sub) : d.sub; } catch (e) { sub = null; }
      if (sub && sub.endpoint && sub.keys) {
        try {
          const st = await sendPush(sub, strike, vapid);
          if (st === 404 || st === 410) { await deleteDoc(sa, ph.name); continue; }
          if (st >= 200 && st < 300) { sent++; await updateFields(sa, ph.name, { strikeSent: now.date }).catch(() => {}); }
        } catch (e) { /* try again next hour */ }
      }
    }
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
