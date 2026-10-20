import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbErrorResponse, cachedResponse, DAY_S } from '@/lib/server/tmdb';
import { loadCredits } from '@/lib/server/credits';

const MAX_SEEDS = 40; // ennyi kiinduló cím (a kliens SUGGEST_SEEDS-e)
const PARALLEL = 8; // egyszerre ennyi cím stábja
const TOP_CAST = 5; // a stáblista első ennyi helye számít (a mellékszereplők nem)
const MIN_TITLES = 2; // legalább ennyi kiinduló címben szerepel
const MAX_PEOPLE = 24;

// GET /api/people/suggest?ids=movie:603,tv:1396
// „Kit érdemes követned?” (terv-3 111): a megadott (a kliensen a 8+ saját értékelésű) címek stábjában a
// leggyakoribb színészek (a stáblista első 5 helye) és rendezők (filmnél), legalább 2 címmel. A
// követetteket és az elrejtetteket a kliens szűri ki (a válasz így csak a címektől függ, egy napig
// tárolható). Egy cím, amelynek a stábja most nem tölthető le, kimarad (a válasz ilyenkor nem tárolható).
// Válasz: { people: [{ id, role: 'actor' | 'director', name, profile_path, keys: [titleKey] }] } – a
// gyakoriság szerint, egyenlőségnél a jobb stáblista-hely szerint.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const seeds = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.split(':'))
    .filter(([type, id]) => (type === 'movie' || type === 'tv') && /^[1-9]\d*$/.test(id ?? ''))
    .slice(0, MAX_SEEDS);
  if (seeds.length === 0) return Response.json({ people: [] });

  const found = new Map(); // role:id → { …, keys, rank }
  let failed = 0;
  let firstError = null;
  const queue = [...seeds];
  async function worker() {
    while (queue.length) {
      const [type, id] = queue.shift();
      let credits;
      try {
        credits = await loadCredits(type, Number(id));
      } catch (err) {
        failed++;
        firstError ??= err;
        continue;
      }
      const key = `${type}:${id}`;
      const note = (role, p, rank) => {
        const k = `${role}:${p.id}`;
        const entry = found.get(k) ?? { id: p.id, role, name: p.name, profile_path: p.profile_path, keys: [], rank: 0 };
        if (!entry.keys.includes(key)) {
          entry.keys.push(key);
          entry.rank += rank;
        }
        entry.profile_path ??= p.profile_path;
        found.set(k, entry);
      };
      credits.cast.slice(0, TOP_CAST).forEach((p, i) => note('actor', p, i));
      credits.directors.forEach((p) => note('director', p, 0));
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  // ha egyetlen cím stábja sem jött le, az hiba (nem „nincs javaslat”)
  if (failed === seeds.length) return tmdbErrorResponse(firstError);

  // (a seeds sorrendje a kliens rangsora: a keys a kiinduló címek sorrendjében)
  const order = new Map(seeds.map(([type, id], i) => [`${type}:${id}`, i]));
  const people = [...found.values()]
    .filter((p) => p.keys.length >= MIN_TITLES)
    .sort((a, b) => b.keys.length - a.keys.length || a.rank / a.keys.length - b.rank / b.keys.length)
    .slice(0, MAX_PEOPLE)
    .map(({ rank, ...p }) => ({ ...p, keys: p.keys.sort((x, y) => order.get(x) - order.get(y)) }));

  const body = { people };
  return failed ? Response.json(body) : cachedResponse(body, DAY_S);
}
