// Cab Books – driving routes for the fare calculator, from Geoapify.
// GET /.netlify/functions/route?w=lat,lon|lat,lon[|...]&type=short|balanced
// The Geoapify key stays here on the server (Netlify environment variable GEOAPIFY_API_KEY),
// never in the page or the public code. Same request TaxiTracker makes: drive, free-flow
// traffic, GeoJSON with route details. Identical routes are cached for a day.
const TYPES = new Set(['short', 'balanced', 'less_maneuvers']);

function json(body, status = 200, cache = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cache ? 'public, max-age=86400' : 'no-store',
      ...(cache ? { 'Netlify-CDN-Cache-Control': 'public, max-age=86400' } : {})
    }
  });
}

export function parseWaypoints(w) {
  const pts = String(w || '').split('|');
  if (pts.length < 2 || pts.length > 10) return null;
  const out = [];
  for (const p of pts) {
    const m = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(p.trim());
    if (!m) return null;
    const lat = Number(m[1]), lon = Number(m[2]);
    // Great Britain and a little around it
    if (!(lat > 49 && lat < 61 && lon > -9 && lon < 3)) return null;
    out.push(`${lat},${lon}`);
  }
  return out;
}

export default async (req) => {
  const u = new URL(req.url);
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return json({ error: 'not_set_up' }, 503);
  const wps = parseWaypoints(u.searchParams.get('w'));
  const type = u.searchParams.get('type') || 'balanced';
  if (!wps || !TYPES.has(type)) return json({ error: 'bad_request' }, 400);
  const url = 'https://api.geoapify.com/v1/routing?waypoints=' + encodeURIComponent(wps.join('|')) +
    '&mode=drive&type=' + type + '&traffic=free_flow&format=geojson&units=metric&details=route_details&apiKey=' + encodeURIComponent(key);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/geo+json, application/json' } });
    const j = await r.json().catch(() => null);
    if (!r.ok) return json({ error: r.status === 429 ? 'quota' : r.status === 401 || r.status === 403 ? 'key' : 'route' }, r.status === 429 ? 429 : 502);
    return json(j, 200, true);
  } catch (e) {
    return json({ error: 'unreachable' }, 502);
  }
};
