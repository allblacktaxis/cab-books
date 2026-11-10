// Cab Books – West End and other long-running shows: their regular weekly times and running times,
// so Tonight can say when each one lets out (Matt, 10 Nov 2026).
// This is a list we keep ourselves. Shows open and close, and holiday weeks (Christmas, New Year) run
// different times, so check it about once a month. CHECKED is shown to drivers.
// perf: start times by day (London time). mins: running time including the interval.
// varies: the programme changes (opera, dance): the time is the usual evening one and shows with a "?".
export const CHECKED = '';
export const SHOWS = [];

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function londonToUtc(day, hm) {
  const [h, m] = hm.split(':').map(Number);
  const guess = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h, m);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const off = ((+p.hour % 24) * 60 + +p.minute) - (h * 60 + m);
  return new Date(guess - off * 60000).toISOString();
}
export function westEndEvents(day, shows = SHOWS) {
  const dow = DAYS[new Date(day + 'T12:00:00Z').getUTCDay()], out = [];
  for (const s of shows) {
    if ((s.from && day < s.from) || (s.until && day > s.until)) continue;
    for (const t of (s.perf && s.perf[dow]) || []) {
      const start = londonToUtc(day, t);
      out.push({
        kind: 'show', title: s.show, venue: s.theatre, area: s.area || '', start,
        finish: new Date(Date.parse(start) + s.mins * 60000).toISOString(),
        note: (+t.slice(0, 2) < 17 ? 'matinee' : '') , guess: !!s.varies, src: 'westend',
      });
    }
  }
  return out;
}
