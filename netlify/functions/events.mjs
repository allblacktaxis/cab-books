// Cab Books – Tonight: big London events and when they should finish (Matt, 10 Nov 2026).
// GET /.netlify/functions/events?day=YYYY-MM-DD   (today to 6 days ahead, London dates; default today)
// Football: football-data.org (free tier), London clubs' home matches. Netlify variable FOOTBALL_DATA_KEY.
// Concerts and shows: Ticketmaster Discovery API, at the big venues below. Netlify variable TICKETMASTER_KEY.
// The keys stay here on the server. Answers are cached by Netlify for 30 minutes for every driver,
// so the free limits (football-data 10 calls a minute, Ticketmaster 5,000 a day) are never near.
// Finish times are our own estimate: kick-off or start time plus a usual length for that kind of event.
// West End and other long-running shows come from our own list (lib/westend.mjs): regular weekly times + running time.
import { westEndEvents, CHECKED } from './lib/westend.mjs';

const LONDON_CLUBS = [
  [/^arsenal/i, 'Emirates Stadium', 'Holloway'],
  [/^chelsea/i, 'Stamford Bridge', 'Fulham Broadway'],
  [/^tottenham/i, 'Tottenham Hotspur Stadium', 'Tottenham'],
  [/^west ham/i, 'London Stadium', 'Stratford'],
  [/^crystal palace/i, 'Selhurst Park', 'South Norwood'],
  [/^fulham/i, 'Craven Cottage', 'Fulham'],
  [/^brentford/i, 'Gtech Community Stadium', 'Brentford'],
  [/^queens park rangers|^qpr/i, 'Loftus Road', "Shepherd's Bush"],
  [/^millwall/i, 'The Den', 'Bermondsey'],
  [/^charlton/i, 'The Valley', 'Charlton'],
];
const FOOTBALL_MINUTES = 115; // 90 + half time + stoppages

// Venues to show, with how long an evening there usually runs from the advertised start.
const VENUES = [
  [/indigo at the o2/i, 'indigo at The O2', 'North Greenwich', 150],
  [/^(the )?o2( arena)?$|^the o2 arena/i, 'The O2', 'North Greenwich', 180],
  [/wembley stadium/i, 'Wembley Stadium', 'Wembley', 210],
  [/ovo arena wembley|wembley arena/i, 'OVO Arena Wembley', 'Wembley', 180],
  [/royal albert hall/i, 'Royal Albert Hall', 'Kensington', 150],
  [/eventim apollo|hammersmith apollo/i, 'Eventim Apollo', 'Hammersmith', 165],
  [/alexandra palace/i, 'Alexandra Palace', 'Wood Green', 180],
  [/o2 academy brixton/i, 'O2 Academy Brixton', 'Brixton', 180],
  [/london stadium/i, 'London Stadium', 'Stratford', 210],
  [/tottenham hotspur stadium/i, 'Tottenham Hotspur Stadium', 'Tottenham', 210],
];
// Ticketmaster also lists add-ons for the same night: not events in their own right.
const NOT_AN_EVENT = /parking|car park|upgrade|vip|package|hospitality|lounge|merch|locker|cloakroom|tour of|experience|fast lane|premium seat/i;

const JSON_HEAD = { 'content-type': 'application/json' };
function londonDate(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function addDays(day, n) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function plus(iso, min) { return new Date(Date.parse(iso) + min * 60000).toISOString(); }

export function footballEvents(data, day) {
  const out = [];
  for (const m of (data && data.matches) || []) {
    if (!m.utcDate || londonDate(new Date(m.utcDate)) !== day) continue;
    if (/POSTPONED|CANCELLED|SUSPENDED/.test(m.status || '')) continue;
    const home = (m.homeTeam && (m.homeTeam.name || m.homeTeam.shortName)) || '';
    const club = LONDON_CLUBS.find(c => c[0].test(home));
    if (!club) continue;
    const away = (m.awayTeam && (m.awayTeam.shortName || m.awayTeam.name)) || '';
    out.push({
      kind: 'football', title: `${(m.homeTeam.shortName || home).replace(/ FC$/, '')} v ${away.replace(/ FC$/, '')}`,
      venue: club[1], area: club[2], start: m.utcDate, finish: plus(m.utcDate, FOOTBALL_MINUTES),
      note: (m.competition && m.competition.name) || '', live: /IN_PLAY|PAUSED/.test(m.status || ''), done: m.status === 'FINISHED', src: 'football',
    });
  }
  return out;
}
export function ticketmasterEvents(data, day) {
  const out = [], seen = new Set();
  for (const e of (data && data._embedded && data._embedded.events) || []) {
    const st = e.dates && e.dates.start; if (!st || st.localDate !== day || !st.dateTime || st.timeTBA || st.noSpecificTime) continue;
    if (e.dates.status && /cancel|postpone/i.test(e.dates.status.code || '')) continue;
    if (NOT_AN_EVENT.test(e.name || '')) continue;
    const v = e._embedded && e._embedded.venues && e._embedded.venues[0]; if (!v) continue;
    const venue = VENUES.find(x => x[0].test(v.name || '')); if (!venue) continue;
    const key = venue[1] + '|' + st.dateTime; if (seen.has(key)) continue; seen.add(key);
    const seg = (e.classifications && e.classifications[0] && e.classifications[0].segment && e.classifications[0].segment.name) || '';
    out.push({
      kind: /sport/i.test(seg) ? 'sport' : /arts|theatre/i.test(seg) ? 'show' : 'concert', title: e.name,
      venue: venue[1], area: venue[2], start: st.dateTime, finish: plus(st.dateTime, venue[3]), note: '', src: 'ticketmaster',
    });
  }
  return out;
}

export default async (req) => {
  const url = new URL(req.url), today = londonDate(new Date());
  const day = url.searchParams.get('day') || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today || day > addDays(today, 6)) return new Response(JSON.stringify({ error: 'Use ?day=YYYY-MM-DD, today to 6 days ahead' }), { status: 400, headers: JSON_HEAD });
  const fk = process.env.FOOTBALL_DATA_KEY, tk = process.env.TICKETMASTER_KEY;
  const sources = { football: fk ? 'ok' : 'not_set_up', ticketmaster: tk ? 'ok' : 'not_set_up', westend: 'ok' };
  let events = westEndEvents(day);
  const jobs = [];
  if (fk) jobs.push(fetch(`https://api.football-data.org/v4/matches?dateFrom=${addDays(day, -1)}&dateTo=${addDays(day, 1)}`, { headers: { 'X-Auth-Token': fk } })
    .then(r => r.ok ? r.json() : Promise.reject(r.status)).then(j => { events = events.concat(footballEvents(j, day)); })
    .catch(e => { sources.football = 'error_' + e; }));
  if (tk) {
    const q = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(tk)}&countryCode=GB&city=London&startDateTime=${addDays(day, -1)}T12:00:00Z&endDateTime=${addDays(day, 1)}T12:00:00Z&size=200&sort=date,asc`;
    jobs.push(Promise.all([0, 1, 2].map(p => fetch(q + '&page=' + p).then(r => r.ok ? r.json() : (p ? {} : Promise.reject(r.status)))))
      .then(pages => { pages.forEach(j => { events = events.concat(ticketmasterEvents(j, day)); }); })
      .catch(e => { sources.ticketmaster = 'error_' + e; }));
  }
  await Promise.all(jobs);
  const seen = new Set();
  events = events.filter(e => { const k = e.venue + '|' + e.start; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.finish < b.finish ? -1 : 1);
  const bad = !events.length && sources.football !== 'ok' && sources.ticketmaster !== 'ok';
  return new Response(JSON.stringify({ day, updated: new Date().toISOString(), sources, checked: CHECKED, events }), {
    status: bad ? 502 : 200,
    headers: { ...JSON_HEAD, 'cache-control': bad ? 'no-store' : 'public, max-age=60', ...(bad ? {} : { 'netlify-cdn-cache-control': 'public, durable, s-maxage=1800, stale-while-revalidate=300' }) },
  });
};
