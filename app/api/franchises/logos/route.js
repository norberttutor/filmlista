import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, pickLogo } from '@/lib/server/tmdb';

const RETRY_DAYS = 7; // ha nem volt logó, ennyi nap múlva próbáljuk újra
const LIMIT = 40;
const PARALLEL = 6;

// POST /api/franchises/logos
// A belépett felhasználó logó nélküli franchise-ainál lekéri a franchise első (legkorábbi)
// filmjének címlogóját a TMDB-ről, és elmenti. Válasz: { updated: [{ id, logo_path }] }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  const cutoff = new Date(Date.now() - RETRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // csak a TMDB-azonosítós címmel bíró franchise-ok (az üres franchise-t nem jelöljük ellenőrzöttnek, így
  // különben örökre esedékes maradna, és elfoglalhatná a 40 helyet), a még sosem nézettek előbb (kódaudit #28)
  const { data: missing, error } = await db
    .from('franchises')
    .select('id, titles!titles_franchise_id_fkey!inner(id)') // a franchise_order is összeköti őket
    .is('logo_path', null)
    .or(`logo_checked_at.is.null,logo_checked_at.lt."${cutoff}"`)
    .not('titles.tmdb_id', 'is', null)
    .order('logo_checked_at', { ascending: true, nullsFirst: true })
    .order('id')
    .limit(1, { referencedTable: 'titles' })
    .limit(LIMIT);
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a franchise-okat.' }, { status: 500 });
  }

  const updated = [];
  for (let i = 0; i < missing.length; i += PARALLEL) {
    await Promise.all(
      missing.slice(i, i + PARALLEL).map(async ({ id }) => {
        const { data: first, error: firstError } = await db
          .from('titles')
          .select('media_type, tmdb_id')
          .eq('franchise_id', id)
          .not('tmdb_id', 'is', null)
          .order('release_year', { ascending: true, nullsFirst: false })
          .order('imdb_votes', { ascending: false, nullsFirst: false })
          .limit(1);
        if (firstError) {
          console.error(firstError); // átmeneti hiba: a következő betöltéskor újra
          return;
        }
        if (!first?.length) return; // még nincs filmje: majd ha lesz

        let logo;
        try {
          const images = await tmdbFetch(`/${first[0].media_type}/${first[0].tmdb_id}/images`, {
            include_image_language: 'en,null',
          });
          logo = pickLogo(images.logos ?? []);
        } catch (err) {
          console.error(err); // átmeneti TMDB-hiba: a következő betöltéskor újra
          return;
        }
        const { error: updateError } = await db
          .from('franchises')
          .update({ logo_path: logo, logo_checked_at: new Date().toISOString() })
          .eq('id', id);
        if (updateError) console.error(updateError);
        else updated.push({ id, logo_path: logo });
      })
    );
  }
  return Response.json({ updated });
}
