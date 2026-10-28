// Cab Books – London taxi ranks and toilets for the Tools maps (same sources as TaxiTracker).
// GET /.netlify/functions/opendata?d=ranks|toilets
//  ranks   : TfL's live taxi-rank layer (ArcGIS open data), tidied into simple records.
//  toilets : TaxiTracker's combined London toilets file (Toilet Map, OpenStreetMap, councils, TfL).
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

const json = (body, status, cache) => new Response(JSON.stringify(body), {
  status,
  headers: Object.assign({ 'content-type': 'application/json' }, cache ? {
    'cache-control': 'public, max-age=900',
    'netlify-cdn-cache-control': 'public, durable, s-maxage=21600, stale-while-revalidate=86400'
  } : { 'cache-control': 'no-store' })
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

export default async (req) => {
  const d = new URL(req.url).searchParams.get('d');
  if (d !== 'ranks' && d !== 'toilets') return json({ error: 'Use ?d=ranks or ?d=toilets' }, 400);
  try {
    return json(d === 'ranks' ? await getRanks() : await getToilets(), 200, true);
  } catch (e) {
    return json({ error: String((e && e.message) || 'source_unreachable') }, 502);
  }
};
