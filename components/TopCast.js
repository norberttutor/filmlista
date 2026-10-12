const PHOTO_BASE = 'https://image.tmdb.org/t/p/w185';

// Szereplők az adatlapon (terv-3 38, Norbi választása, 2026-10-06): a top cast első 3 tagja
// (/api/tmdb/credits). „side”: asztalon a bal oszlopban a „Hol nézhető?” alatt – kerek fotó, név,
// szerep egymás alatt (az „A” látványterv); „inline”: keskenyebben (< 900 px) egy szöveges sor a
// leírás alatt. A névre (asztalon a fotóra is) kattintva a színész lapja nyílik az ablakon belül
// (onPerson – terv-3 61; korábban a TMDB-oldalára vitt). Ha nincs adat, semmi nem látszik.
export default function TopCast({ cast, variant, onPerson }) {
  if (!cast?.length) return null;

  if (variant === 'inline') {
    return (
      <p className="cast-line">
        <b>Szereplők:</b>{' '}
        {cast.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ', '}
            <button type="button" className="cast-name" onClick={() => onPerson(p)}>
              {p.name}
            </button>
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="cast side">
      <span className="watch-title" aria-hidden="true">
        Szereplők
      </span>
      <ul aria-label="Szereplők">
        {cast.map((p) => (
          <li key={p.id}>
            <button type="button" className="cast-person" onClick={() => onPerson(p)}>
              <span className="cast-photo">{p.profile_path && <img src={PHOTO_BASE + p.profile_path} alt="" loading="lazy" />}</span>
              <span className="cast-text">
                <span className="cast-name">{p.name}</span>
                {p.character && <small>{p.character}</small>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
