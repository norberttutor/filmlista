import { cache } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { itemMeta, orderedItems } from '@/lib/watchOrder';
import SiteFooter from '@/components/SiteFooter';

// Megosztott nézési sorrend (terv-3 41): csak olvasható, belépés nélkül nyíló oldal
// (/sorrend/<token>; a link a gyűjtemény-ablak „Nézési sorrend” fülén, „Megosztás”). Az adat a
// shared_watch_order() függvényből jön (20_franchise_share.sql): a franchise neve, logója,
// háttérképe, címei évadokkal és a tárolt sorrend – állapot, értékelés, letöltve, Mama nélkül. A
// sorba rendezés ugyanaz, mint az appban (lib/watchOrder.js). Visszavont / hibás linknél 404
// (not-found.js). Kérésenként fut (connection()): a visszavonás és a sorrend változása azonnal
// látszik. A keresők nem indexelik.

const IMG = 'https://image.tmdb.org/t/p/';
const FRANCHISE_ID = 1; // a shared_watch_order csak egy franchise címeit adja: helyi azonosító

const loadShared = cache(async (token) => {
  await connection();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('shared_watch_order', { p_token: token });
  if (error) throw new Error(`A megosztott sorrend betöltése nem sikerült: ${error.message}`);
  if (!data) return null;
  // a sorba rendezés a lista soraira számít (franchise_id, állapot nélkül – senki nem „megnézte”)
  const titles = data.titles.map((t) => ({ ...t, franchise_id: FRANCHISE_ID, status: null }));
  const rows = data.order.map((o) => ({ ...o, franchise_id: FRANCHISE_ID }));
  return { ...data, ...orderedItems(FRANCHISE_ID, titles, rows) };
});

export async function generateMetadata({ params }) {
  const { token } = await params;
  const data = await loadShared(token);
  if (!data) return { title: 'A link nem érvényes', robots: { index: false, follow: false } };
  const title = `${data.name} – nézési sorrend`;
  const description = `${data.items.length} tétel, ${data.stored ? 'saját sorrendben' : 'megjelenés szerint'}.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      ...(data.backdrop_path && { images: [`${IMG}w780${data.backdrop_path}`] }),
    },
  };
}

// a TMDB-adatlap (évadnál az évadé)
const tmdbUrl = (i) =>
  `https://www.themoviedb.org/${i.title.media_type}/${i.title.tmdb_id}${i.season ? `/season/${i.season}` : ''}`;

export default async function SharedOrderPage({ params }) {
  const { token } = await params;
  const data = await loadShared(token);
  if (!data) notFound();
  const { name, logo_path, backdrop_path, items, stored } = data;

  return (
    <>
      <main className="share-page">
        <header
          className="share-hero"
          data-backdrop={backdrop_path ? '' : undefined}
          style={backdrop_path ? { '--banner-img': `url(${IMG}w1280${backdrop_path})` } : undefined}
        >
          <p className="share-kicker">Nézési sorrend</p>
          <h1>{logo_path ? <img className="share-logo" src={`${IMG}w500${logo_path}`} alt={name} /> : name}</h1>
          <p className="share-sub">
            {items.length} tétel · {stored ? 'saját sorrend' : 'megjelenés szerint'}
          </p>
        </header>

        {items.length === 0 ? (
          <p className="share-empty muted">Ebben a sorrendben most nincs cím.</p>
        ) : (
          <ol className="share-list">
            {items.map((i, index) => (
              <li key={i.key} data-upcoming={!i.aired || undefined}>
                <span className="share-num">{index + 1}.</span>
                <span className="thumb share-thumb">
                  {i.title.poster_path && (
                    <img src={`${IMG}w154${i.title.poster_path}`} alt="" loading={index < 8 ? 'eager' : 'lazy'} />
                  )}
                </span>
                <span className="share-text">
                  <a className="share-title" href={tmdbUrl(i)} target="_blank" rel="noopener noreferrer">
                    {i.title.title}
                    {i.season > 0 && <span className="share-season"> – {i.season}. évad</span>}
                    <span className="sr-only"> (TMDB-adatlap, új lapon)</span>
                  </a>
                  <span className="share-meta">{itemMeta(i)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <p className="share-note">
          Megosztva a „Megnézendő filmek és sorozatok” alkalmazásból. A sorrend a megosztó saját listájából jön, és
          követi a változásait.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
