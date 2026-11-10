// Cab Books – Tonight: concert halls and venues that sell their own tickets (Matt, 10 Nov 2026).
// Reads each venue's own "What's on" page and picks up the event listings the page carries for search
// engines (schema.org Event in JSON-LD). Where a page gives an end time, that is used; otherwise the
// venue's usual length. Each venue is read at most once per 30 minutes for all drivers (the events
// function is cached), and a short report per venue goes to the function log so it can be checked.
export const VENUE_PAGES = [
  { key: 'rah', venue: 'Royal Albert Hall', area: 'Kensington', mins: 150, url: 'https://www.royalalberthall.com/tickets/' },
  { key: 'barbican', venue: 'Barbican', area: 'Barbican', mins: 135, url: 'https://www.barbican.org.uk/whats-on' },
  { key: 'roh', venue: 'Royal Opera House', area: 'Covent Garden', mins: 180, url: 'https://www.rbo.org.uk/tickets-and-events' },
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

export function parseVenuePage(html, v, day) {
  const blocks = [...String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const out = [], seen = new Set(); let found = 0, bad = 0;
  for (const b of blocks) {
    let j; try { j = JSON.parse(b.trim()); } catch (e) { bad++; continue; }
    for (const o of walk(j)) {
      if (!isEvent(o) || !o.startDate) continue; found++;
      const start = toIso(o.startDate); if (!start || londonDate(start) !== day) continue;
      if (o.eventStatus && /Cancelled|Postponed/i.test(String(o.eventStatus))) continue;
      const end = toIso(o.endDate);
      const finish = end && londonDate(end) === day && Date.parse(end) > Date.parse(start) && Date.parse(end) - Date.parse(start) < 8 * 3600e3 ? end : new Date(Date.parse(start) + v.mins * 60000).toISOString();
      const title = clean(o.name) || v.venue, k = title + '|' + start; if (seen.has(k)) continue; seen.add(k);
      out.push({ kind: 'concert', title, venue: v.venue, area: v.area, start, finish, note: '', guess: !(end && finish === end), src: 'venue:' + v.key });
    }
  }
  return { events: out, report: { blocks: blocks.length, badJson: bad, eventsOnPage: found, today: out.length, startDates: (String(html).match(/startDate/g) || []).length } };
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
