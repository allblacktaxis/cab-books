// Cab Books – Tonight: concert halls and venues that sell their own tickets (Matt, 10 Nov 2026).
// Reads each venue's own "What's on" page and picks up the event listings the page carries for search
// engines (schema.org Event in JSON-LD). Where a page gives an end time, that is used; otherwise the
// venue's usual length. Each venue is read at most once per 30 minutes for all drivers (the events
// function is cached), and a short report per venue goes to the function log so it can be checked.
// Tried 10 Nov 2026: the Royal Albert Hall refuses automated visits (403), so it is left alone; the Royal Opera
// House and Barbican listing pages carry no nightly times (they are in the show list with usual times instead).
export const VENUE_PAGES = [
  { key: 'o2', venue: 'The O2', area: 'North Greenwich', mins: 180, url: 'https://www.theo2.co.uk/events' },
];
const UA = 'CabBooks/1.0 (London taxi drivers\' event times; +https://cabbooks.allblacktaxis.co.uk)';

function londonDate(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
// A schema.org date with no time zone ("2026-11-10T19:30") is London time.
function toIso(s) {
  if (!s) return null; s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; // a date with no time is no use for a let-out time
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) { const d = new Date(s); return isNaN(d) ? null : d.toISOString(); }
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(s); if (!m) return null;
  const guess = Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const off = ((+p.hour % 24) * 60 + +p.minute) - (+m[2] * 60 + +m[3]);
  return new Date(guess - off * 60000).toISOString();
}
function* walk(x) {
  if (Array.isArray(x)) { for (const y of x) yield* walk(y); return; }
  if (!x || typeof x !== 'object') return;
  yield x;
  for (const k of Object.keys(x)) if (k !== '@context') yield* walk(x[k]);
}
function isEvent(o) { const t = o['@type']; return (Array.isArray(t) ? t : [t]).some(v => /Event$/i.test(String(v || ''))); }
function clean(s) { return String(s || '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

// Besides schema.org JSON-LD, many sites keep their listings as JSON inside the page for their own
// scripts (e.g. Next.js __NEXT_DATA__). Any object there with a start date/time and a name or title counts.
const START_KEYS = ['startDate', 'start_date', 'startDateTime', 'start', 'startTime', 'performanceDate', 'dateTime', 'date'];
function startOf(o) { for (const k of START_KEYS) { const v = o[k]; if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) return v; } return null; }
function nameOf(o) { for (const k of ['name', 'title', 'eventName', 'productionTitle', 'displayName']) { const v = o[k]; if (typeof v === 'string' && v.trim()) return v; if (v && typeof v === 'object' && typeof v.value === 'string') return v.value; } return ''; }
export function parseVenuePage(html, v, day) {
  html = String(html);
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const jsonScripts = [...html.matchAll(/<script[^>]*(?:type=["']application\/json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const out = [], seen = new Set(); let found = 0, bad = 0, other = 0; const keys = {};
  const docs = [];
  for (const b of blocks) { try { docs.push({ ld: true, j: JSON.parse(b.trim()) }); } catch (e) { bad++; } }
  for (const b of jsonScripts) { try { docs.push({ ld: false, j: JSON.parse(b.trim()) }); } catch (e) { bad++; } }
  for (const d of docs) {
    for (const o of walk(d.j)) {
      if (!d.ld) for (const k of Object.keys(o)) if (/date|time|start/i.test(k)) keys[k] = (keys[k] || 0) + 1;
      const sd = d.ld ? (isEvent(o) && o.startDate) : startOf(o);
      if (!sd || (!d.ld && !nameOf(o))) continue; found++; if (!d.ld) other++;
      if (d.ld) o.name = o.name; else { o.name = nameOf(o); o.endDate = o.endDate || o.end_date || o.endDateTime || o.end || null; }
      const start = toIso(sd); if (!start || londonDate(start) !== day) continue;
      if (o.eventStatus && /Cancelled|Postponed/i.test(String(o.eventStatus))) continue;
      const end = toIso(o.endDate);
      const finish = end && londonDate(end) === day && Date.parse(end) > Date.parse(start) && Date.parse(end) - Date.parse(start) < 8 * 3600e3 ? end : new Date(Date.parse(start) + v.mins * 60000).toISOString();
      const title = clean(o.name) || v.venue, k = title + '|' + start; if (seen.has(k)) continue; seen.add(k);
      out.push({ kind: 'concert', title, venue: v.venue, area: v.area, start, finish, note: '', guess: !(end && finish === end), src: 'venue:' + v.key });
    }
  }
  // Last resort: listings inside the page's own scripts as escaped text (e.g. Next.js "self.__next_f.push"):
  // a title/name and a startDate close together in the same object.
  let loose = 0;
  if (!out.length) {
    const flat = html.replace(/\\\\"/g, '"').replace(/\\"/g, '"');
    const re = /"(?:title|name)"\s*:\s*"([^"]{2,140})"[^{}]{0,600}?"start(?:Date|DateTime|_date)?"\s*:\s*"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}[^"]*)"|"start(?:Date|DateTime|_date)?"\s*:\s*"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}[^"]*)"[^{}]{0,600}?"(?:title|name)"\s*:\s*"([^"]{2,140})"/g;
    for (const m of flat.matchAll(re)) {
      const name = m[1] || m[4], sd = m[2] || m[3]; loose++;
      const start = toIso(sd); if (!start || londonDate(start) !== day) continue;
      const title = clean(name), k = title + '|' + start; if (seen.has(k)) continue; seen.add(k);
      out.push({ kind: 'concert', title, venue: v.venue, area: v.area, start, finish: new Date(Date.parse(start) + v.mins * 60000).toISOString(), note: '', guess: true, src: 'venue:' + v.key });
    }
  }
  // While a venue gives nothing, a short extract of the page around its first start date (or first date)
  // goes into the report, so the reader can be fitted to that site. Tags removed; nothing personal is on these pages.
  let sample = '';
  if (!out.length) {
    const i = html.search(/startDate|start_date|startTime|performanceDate/i), j = i >= 0 ? i : html.search(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? \d{1,2} (Nov|November)\b|\b\d{1,2} Nov(ember)? 2026\b|2026-11-1\d/);
    if (j >= 0) sample = html.slice(Math.max(0, j - 120), j + 220).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 300);
  }
  const topKeys = Object.entries(keys).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
  return { events: out, report: { blocks: blocks.length, jsonScripts: jsonScripts.length, badJson: bad, eventsOnPage: found + loose, fromPageData: other, loose, today: out.length,
    startDates: (html.match(/startDate/g) || []).length, times: (html.match(/\b(1[2-9]|2[0-3])[:.][0-5]\d\b/g) || []).length, keys: topKeys, sample } };
}

export async function venueEvents(day) {
  const all = [], report = {};
  await Promise.all(VENUE_PAGES.map(async v => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(v.url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: ctl.signal, redirect: 'follow' });
      const html = await r.text();
      const p = r.ok ? parseVenuePage(html, v, day) : { events: [], report: {} };
      report[v.key] = { status: r.status, bytes: html.length, ...p.report };
      all.push(...p.events);
    } catch (e) { report[v.key] = { error: String((e && e.name) || e) }; }
    finally { clearTimeout(t); }
  }));
  console.log('venue-report ' + day + ' ' + JSON.stringify(report));
  return { events: all, report };
}
