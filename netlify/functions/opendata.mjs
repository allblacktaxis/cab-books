// Cab Books – London taxi ranks and toilets for the Tools maps (same sources as TaxiTracker).
// GET /.netlify/functions/opendata?d=ranks|toilets|tube|rail
//  ranks   : TfL's live taxi-rank layer (ArcGIS open data), tidied into simple records.
//  toilets : TaxiTracker's combined London toilets file (Toilet Map, OpenStreetMap, councils, TfL).
//  tube    : TfL line status for Underground, DLR, Overground lines and the Elizabeth line
//            (free TfL feed, cached for 60 seconds), as TaxiTracker's tfl_line_status.php.
//  rail    : cancellations in the next 2 hours at the 11 London terminals, from National Rail's
//            live departure boards (Rail Data Marketplace), as TaxiTracker's rail_departures.php.
//            Needs the Netlify environment variable RAIL_API_KEY; cached for 60 seconds.
// Fetched here on the server so the page never depends on another site allowing it,
// and cached by Netlify for 6 hours, so the sources are asked only a few times a day.
const RANKS_URL = 'https://services1.arcgis.com/YswvgzOodUvqkoCN/arcgis/rest/services/Taxi_Ranks/FeatureServer/37/query';
const RANK_FIELDS = ['OBJECTID', 'LOCATION', 'BOROUGH', 'NB_SPACES', 'DAYS_OP', 'TIMES_OP', 'STATION_NAME',
  'RANK_TYPE', 'RANK_REFERENCE', 'LOCATION_DETAILS', 'TAXI_STATUS', 'RANK_NAME', 'FEATURE_TYPE_NAME',
  'HIGHWAY_AUTHORITY', 'DATASET_LAST_UPDATED'];
const TOILETS_URL = 'https://taxitracker.allblacktaxis.co.uk/offline-data/toilets.geojson';
// TfL publishes a few ranks with wrong coordinates; TaxiTracker reviewed and corrected this one.
const CORRECTIONS = { TR6141: [-0.187259, 51.516488] };
const MIN_RANKS = 600, MIN_TOILETS = 500;

const TUBE_URL = 'https://api.tfl.gov.uk/Line/Mode/tube,dlr,overground,elizabeth-line/Status';
const json = (body, status, cache, short) => new Response(JSON.stringify(body), {
  status,
  headers: Object.assign({ 'content-type': 'application/json' }, cache ? (short ? {
    'cache-control': 'public, max-age=30',
    'netlify-cdn-cache-control': 'public, durable, s-maxage=60, stale-while-revalidate=60'
  } : {
    'cache-control': 'public, max-age=900',
    'netlify-cdn-cache-control': 'public, durable, s-maxage=21600, stale-while-revalidate=86400'
  }) : { 'cache-control': 'no-store' })
});

const txt = v => (v == null ? '' : String(v).trim());
export function insideLondon(c) {
  return Array.isArray(c) && c[0] > -0.65 && c[0] < 0.45 && c[1] > 51.25 && c[1] < 51.75;
}
export function rankCategory(p) {
  const s = `${txt(p.RANK_TYPE)} ${txt(p.FEATURE_TYPE_NAME)}`.toLowerCase();
  if (/refresh/.test(s)) return 'refreshment';
  if (/\brest\b/.test(s)) return 'rest';
  if (/feeder/.test(s)) return 'feeder';
  if (/temp/.test(s)) return 'temporary';
  if (/private/.test(s)) return 'private';
  if (/city of london|\bcity\b/.test(s)) return 'city';
  return 'standard';
}
export function rankStatus(v) {
  const s = txt(v).toUpperCase();
  if (s === 'A' || s.startsWith('ACT')) return 'active';
  if (s.startsWith('S')) return 'suspended';
  return 'active';
}
export function normaliseRanks(gj) {
  const out = [], rejected = [];
  let updated = 0;
  for (const f of (gj && gj.features) || []) {
    const p = f.properties || {};
    const ref = txt(p.RANK_REFERENCE);
    let c = f.geometry && f.geometry.coordinates;
    if (CORRECTIONS[ref]) c = CORRECTIONS[ref];
    if (!insideLondon(c)) { rejected.push(ref || String(p.OBJECTID)); continue; }
    const up = Number(p.DATASET_LAST_UPDATED) || 0; if (up > updated) updated = up;
    out.push({
      type: 'Feature', id: Number(p.OBJECTID) || out.length + 1,
      geometry: { type: 'Point', coordinates: [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6] },
      properties: {
        id: Number(p.OBJECTID) || out.length + 1, reference: ref,
        name: txt(p.RANK_NAME) || txt(p.LOCATION) || 'Taxi rank', location: txt(p.LOCATION), borough: txt(p.BOROUGH),
        spaces: txt(p.NB_SPACES), days: txt(p.DAYS_OP), times: txt(p.TIMES_OP), station: txt(p.STATION_NAME),
        featureType: txt(p.FEATURE_TYPE_NAME), locationDetails: txt(p.LOCATION_DETAILS), highwayAuthority: txt(p.HIGHWAY_AUTHORITY),
        category: rankCategory(p), status: rankStatus(p.TAXI_STATUS), corrected: !!CORRECTIONS[ref]
      }
    });
  }
  return { type: 'FeatureCollection', features: out, metadata: { source: 'Transport for London', sourceUpdatedAt: updated || null, rejected } };
}

async function getRanks() {
  const u = new URL(RANKS_URL);
  u.searchParams.set('where', '1=1'); u.searchParams.set('outFields', RANK_FIELDS.join(','));
  u.searchParams.set('returnGeometry', 'true'); u.searchParams.set('outSR', '4326'); u.searchParams.set('f', 'geojson');
  u.searchParams.set('resultRecordCount', '2000');
  const r = await fetch(u, { headers: { Accept: 'application/geo+json, application/json' } });
  if (!r.ok) throw new Error('source_' + r.status);
  const data = normaliseRanks(await r.json());
  if (data.features.length < MIN_RANKS) throw new Error('incomplete');
  return data;
}
async function getToilets() {
  const r = await fetch(TOILETS_URL, { headers: { Accept: 'application/geo+json, application/json' } });
  if (!r.ok) throw new Error('source_' + r.status);
  const gj = await r.json();
  if (!gj || !Array.isArray(gj.features) || gj.features.length < MIN_TOILETS) throw new Error('incomplete');
  return gj;
}

// Worst status first (10 = good service always last), reasons joined – as TaxiTracker does.
export function summariseTube(lines) {
  const out = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    const id = txt(l && l.id), name = txt(l && l.name);
    if (!id || !name) continue;
    let st = ((l.lineStatuses) || []).map(s => ({
      severity: Number(s && s.statusSeverity) || 0,
      status: txt(s && s.statusSeverityDescription),
      reason: txt(s && (s.reason || (s.disruption && s.disruption.description)))
    })).filter(s => s.status);
    if (!st.length) st = [{ severity: 0, status: 'Status unavailable', reason: '' }];
    st.sort((a, b) => (a.severity === 10) - (b.severity === 10) || a.severity - b.severity);
    const reasons = [...new Set(st.map(s => s.reason).filter(Boolean))];
    const statuses = [...new Set(st.map(s => s.status))];
    out.push({ id, name, mode: txt(l.modeName), severity: st[0].severity, status: st[0].status, statuses, reason: reasons.join('\n\n') });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
async function getTube() {
  const key = process.env.TFL_APP_KEY;
  const r = await fetch(TUBE_URL + (key ? '?app_key=' + encodeURIComponent(key) : ''), { headers: { Accept: 'application/json', 'User-Agent': 'CabBooks-line-status/1.0' } });
  if (!r.ok) throw new Error('source_' + r.status);
  const lines = summariseTube(await r.json());
  if (lines.length < 13) throw new Error('incomplete');
  return { checkedAt: new Date().toISOString(), lines };
}

const RAIL_BASE = 'https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120';
export const RAIL_STATIONS = ['CHX', 'EUS', 'FST', 'KGX', 'LST', 'LBG', 'MYB', 'PAD', 'STP', 'VIC', 'WAT'];
function railCancelled(s) {
  const f = s && s.isCancelled;
  return f === true || f === 1 || f === '1' || f === 'true' || txt(s && s.etd).toLowerCase() === 'cancelled';
}
function railNames(d) {
  if (!d) return [];
  if (!Array.isArray(d) && typeof d === 'object' && d.locationName) return [txt(d.locationName)].filter(Boolean);
  if (Array.isArray(d)) return [...new Set(d.flatMap(railNames))];
  if (typeof d === 'object') return [...new Set(Object.values(d).flatMap(railNames))];
  return [];
}
export function summariseBoard(crs, board) {
  if (!board) return { crs, available: false, cancellationCount: 0, cancelledServices: [] };
  const list = (Array.isArray(board.trainServices) ? board.trainServices : []).filter(railCancelled).map(s => ({
    time: txt(s.std || s.sta) || 'Time unavailable',
    destination: railNames(s.destination).join(' / ') || 'Destination unavailable',
    operator: txt(s.operator) || 'Operator unavailable'
  }));
  return { crs, available: true, cancellationCount: list.length, cancelledServices: list };
}
async function getRail() {
  const key = process.env.RAIL_API_KEY;
  if (!key) { const e = new Error('not_set_up'); e.status = 503; throw e; }
  const stations = {};
  await Promise.all(RAIL_STATIONS.map(async crs => {
    try {
      const r = await fetch(`${RAIL_BASE}/GetDepartureBoard/${crs}?numRows=150&timeOffset=0&timeWindow=120`, { headers: { Accept: 'application/json', 'x-apikey': key } });
      stations[crs] = summariseBoard(crs, r.ok ? await r.json() : null);
    } catch (e) { stations[crs] = summariseBoard(crs, null); }
  }));
  return { checkedAt: new Date().toISOString(), timeWindowMinutes: 120, stations };
}

export default async (req) => {
  const d = new URL(req.url).searchParams.get('d');
  if (!['ranks', 'toilets', 'tube', 'rail'].includes(d)) return json({ error: 'Use ?d=ranks, ?d=toilets, ?d=tube or ?d=rail' }, 400);
  try {
    if (d === 'tube') return json(await getTube(), 200, true, true);
    if (d === 'rail') return json(await getRail(), 200, true, true);
    return json(d === 'ranks' ? await getRanks() : await getToilets(), 200, true);
  } catch (e) {
    return json({ error: String((e && e.message) || 'source_unreachable') }, (e && e.status) || 502);
  }
};
