import { releaseLabel } from '@/lib/titles';

// A még meg nem jelent film jelvénye (state: releaseState()): „Hamarosan · okt. 15.” vagy
// „Moziban · digitálisan: nov. 20.”. A kártyán a második rész külön sorba kerül, telefonon
// rejtve, és ott a dátum mellől a „Hamarosan” szó is elmarad (CSS); a teljes szöveg a súgóban.
// A színe a fajtájától függ (data-kind, terv-3 51.4): „Hamarosan” indigó, „Moziban” korall.
// A sorozat bejelentett évada (state: nextSeason(), terv-3 84; csak a kártyán – a táblázatban a
// SeasonCell alatt sima szöveg): „3. évad · dec. 8.”, tévé-ikonnal, indigó; telefonon csak a rövid
// dátum („dec. 8.”, más évben „2027”).
// (A második rész elválasztója nem törő szóközzel kezdődik: flex-elem elején a sima szóköz elveszne.)
export default function ReleaseBadge({ state }) {
  const label = releaseLabel(state);
  if (!label) return null;
  const full = [label.word, label.when, label.sub].filter(Boolean).join(' · ');
  return (
    <span className={label.when ? 'release-badge has-when' : 'release-badge'} data-kind={state.kind} title={full}>
      {state.kind === 'season' ? <SeasonIcon /> : <CalendarIcon />}
      <span className="release-main">
        <span className="release-word">{label.word}</span>
        {label.when && (
          <span className="release-when">
            <span className="release-sep"> · </span>
            {label.short && label.short !== label.when ? (
              <>
                <span className="release-full">{label.when}</span>
                <span className="release-short">{label.short}</span>
              </>
            ) : (
              label.when
            )}
          </span>
        )}
      </span>
      {label.sub && <span className="release-sub"><span className="release-sep">{' · '}</span>{label.sub}</span>}
    </span>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M16 2.5v4M8 2.5v4M3 10h18" />
    </svg>
  );
}

// tévé: a bejelentett évad jelölése (a kártyán és a táblázat Állapot cellájában)
export function SeasonIcon({ size = 12 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6.5" width="19" height="13" rx="2.5" />
      <path d="M8 2.5l4 4 4-4" />
    </svg>
  );
}
