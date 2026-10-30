// Cab Books – Knowledge's shared routing rules (taxi exemptions, road restrictions, banned turns).
// GET /.netlify/functions/routing-rules  with  Authorization: Bearer <signed-in driver's Firebase ID token>
// Supplied by the Knowledge app (Marcin, 29 Oct 2026) and wired to Cab Books' sign-in.
// The feed key stays on Netlify (environment variable KNOWLEDGE_RULES_API_KEY, Functions scope),
// never in the page, this public code or the logs. Only signed-in Cab Books drivers get the rules.
// Cached for up to 60 seconds per warm instance, so edits in Knowledge reach the next calculation
// within a minute. Expired data is never served if a refresh fails.
import { signedInUser } from '../lib/fbauth.mjs';

const FEED = 'https://knowledge.allblacktaxis.co.uk/routing_rules.php';

// Server-side check of the driver's Firebase sign-in (signature, project and expiry).
async function authorizeCabbooksUser(request) {
  return !!(await signedInUser(request));
}

export function createRulesHandler({
  authorize = authorizeCabbooksUser,
  fetchImplementation = globalThis.fetch,
  getKey = () => process.env.KNOWLEDGE_RULES_API_KEY,
  now = Date.now
} = {}) {
  let cached = null;
  let expires = 0;
  let pending = null;
  let cachedKey = null;
  const reply = (body, status) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }
  });
  async function load(key) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetchImplementation(FEED, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: controller.signal, redirect: 'error', cache: 'no-store'
      });
      if (!response.ok) throw new Error('Rules feed unavailable');
      const body = await response.json();
      if (body.schema_version !== 1 || !/^[a-f0-9]{64}$/.test(body.version) ||
          !['taxi_exemptions', 'restrictions', 'turn_restrictions'].every(name => Array.isArray(body[name]))) {
        throw new Error('Invalid rules feed');
      }
      cached = body;
      cachedKey = key;
      expires = now() + 60000;
      return body;
    } finally {
      clearTimeout(timer);
    }
  }
  return async request => {
    if (request.method !== 'GET') {
      const response = reply({ error: 'Method not allowed' }, 405);
      response.headers.set('Allow', 'GET');
      return response;
    }
    try {
      if (!await authorize(request)) return reply({ error: 'Unauthorized' }, 401);
      const key = getKey();
      if (!key || !/^[a-f0-9]{64}$/.test(key)) return reply({ error: 'not_set_up' }, 503);
      if (cachedKey !== key) { cached = null; expires = 0; }
      if (cached && now() < expires) return reply(cached, 200);
      // Coalesce parallel refreshes per warm instance. Never serve expired data on error.
      if (!pending) pending = load(key).finally(() => { pending = null; });
      return reply(await pending, 200);
    } catch {
      return reply({ error: 'Routing rules unavailable. Please try again later.' }, 503);
    }
  };
}

export default createRulesHandler();
