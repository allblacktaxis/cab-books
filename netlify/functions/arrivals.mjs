// Cab Books – flight arrivals for Heathrow and London City, from AeroDataBox.
// GET /.netlify/functions/arrivals?airport=LHR|LCY
// The API key stays here on the server (Netlify environment variable AERODATABOX_KEY),
// never in the page. Answers are cached by Netlify for 10 minutes, so however many
// drivers look, the paid API is called at most about 6 times an hour per airport.
const AIRPORTS = { LHR: 'Heathrow', LCY: 'London City' };
const HOST = process.env.AERODATABOX_HOST || 'aerodatabox.p.rapidapi.com';
const WIDE = /A3[3-5]\d|A380|A340|A350|A330|74[0-9]|76[0-9]|77[0-9]|78[0-9]|747|767|777|787/i;

function londonLocal(d) {
  // YYYY-MM-DDTHH:mm in Europe/London
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
function iso(t) {
  if (!t) return null;
  const s = typeof t === 'string' ? t : (t.utc || t.local);
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? null : d.toISOString();
}
export function normalise(data) {
  const list = (data && (data.arrivals || data.Arrivals)) || [];
  return list.map(f => {
    const here = f.arrival || f.movement || {};
    const there = (f.departure && f.departure.airport) || (f.movement && f.movement.airport) || {};
    const model = (f.aircraft && f.aircraft.model) || '';
    return {
      n: f.number || f.callSign || '',
      airline: (f.airline && f.airline.name) || '',
      from: there.municipalityName || there.shortName || there.name || '',
      fromCode: there.iata || there.icao || '',
      sched: iso(here.scheduledTime),
      est: iso(here.revisedTime) || iso(here.predictedTime) || iso(here.runwayTime) || null,
      term: here.terminal ? String(here.terminal).replace(/^T/i, '') : '',
      status: f.status || '',
      model,
      wide: WIDE.test(model),
      cargo: !!f.isCargo
    };
  }).filter(f => f.sched && !f.cargo && f.codeshareStatus !== 'IsCodeshared');
}
export default async (req) => {
  const url = new URL(req.url);
  const code = String(url.searchParams.get('airport') || '').toUpperCase();
  const extra = [...url.searchParams.keys()].filter(k => k !== 'airport');
  if (!AIRPORTS[code] || extra.length) return new Response(JSON.stringify({ error: 'Use ?airport=LHR or ?airport=LCY' }), { status: 400, headers: { 'content-type': 'application/json' } });
  const key = process.env.AERODATABOX_KEY;
  if (!key) return new Response(JSON.stringify({ error: 'not_set_up' }), { status: 503, headers: { 'content-type': 'application/json' } });
  const now = Date.now();
  const from = londonLocal(new Date(now - 60 * 60 * 1000)), to = londonLocal(new Date(now + 11 * 60 * 60 * 1000));
  const api = `https://${HOST}/flights/airports/iata/${code}/${from}/${to}?withLeg=true&direction=Arrival&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false`;
  try {
    const r = await fetch(api, { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST, 'x-magicapi-key': key } });
    if (!r.ok) return new Response(JSON.stringify({ error: 'source_' + r.status }), { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    const flights = normalise(await r.json());
    return new Response(JSON.stringify({ airport: code, name: AIRPORTS[code], updated: new Date(now).toISOString(), flights }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=120', 'netlify-cdn-cache-control': 'public, durable, s-maxage=600, stale-while-revalidate=120' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'source_unreachable' }), { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
};
