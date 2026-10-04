const LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

// „Hol nézhető?” az adatlapon: a magyarországi előfizetéses és ingyenes streamingszolgáltatók
// logója (/api/tmdb/providers). Norbi döntései (2026-10-04): csak az adatlapon – asztalon a nagy
// borító alatt, keskenyebben az „Előzetes megnézése” fölött –; kölcsönzés / vásárlás nélkül; ha
// nincs ilyen, semmi nem látszik; a logók nem kattinthatók (a név a súgóban). A JustWatch-forrás-
// megjelölés a TMDB feltétele.
export default function WatchProviders({ providers, className }) {
  if (!providers?.length) return null;
  return (
    <div className={className ? `watch-providers ${className}` : 'watch-providers'}>
      <span className="watch-title" aria-hidden="true">
        Hol nézhető?
      </span>
      <ul aria-label="Hol nézhető?">
        {providers.map((p) => {
          const label = p.free ? `${p.name} (ingyenes)` : p.name;
          return (
            <li key={p.id} title={label}>
              <img src={LOGO_BASE + p.logo} alt={label} width="40" height="40" loading="lazy" />
            </li>
          );
        })}
      </ul>
      <span className="watch-source">Forrás: JustWatch</span>
    </div>
  );
}
