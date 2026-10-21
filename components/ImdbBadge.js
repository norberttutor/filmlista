import { formatImdb, formatCritics } from '@/lib/titles';

// "IMDb 8,0" jelvény; rámutatáskor a szavazatok számával. Ha nincs értékelés, semmi. A szám a skála színével
// (terv-3 127, „A”): --score 0–100, a színt a 12-boritofal.css számolja.
export default function ImdbBadge({ title }) {
  const imdb = formatImdb(title);
  if (!imdb) return null;
  return (
    <span className="imdb" title={imdb.tooltip} data-score="" style={{ '--score': imdb.score }}>
      IMDb <b>{imdb.rating}</b>
    </span>
  );
}

// "RT 92%" és "MC 79" – az IMDb-jelvény mellé, csak az adatlapon és az asztali listán (a kártyán kevés a hely,
// Mama nem látja – Norbi döntése). Ami hiányzik (sorozatnál gyakori), az elmarad.
export function CriticBadges({ title }) {
  return formatCritics(title).map((c) => (
    <span key={c.label} className="imdb" title={c.tooltip} data-score="" style={{ '--score': c.score }}>
      {c.label} <b>{c.text}</b>
    </span>
  ));
}
