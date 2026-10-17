// A szűrősor ikonjai (M3): állapot, letöltés, típus, rendezés, franchise, Mama. Egyvonalas ikonok a felirat
// színében (a natív lenyílók --opt-icon ikonjainak párjai), felolvasónak rejtve.

function Svg({ children, width = 1.8 }) {
  return (
    <svg
      className="filter-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// állapot: könyvjelző / lejátszás / pipa / szünet
export const STATUS_ICONS = {
  to_watch: (
    <Svg>
      <path d="M7 4h10v16l-5-3.6L7 20z" />
    </Svg>
  ),
  watching: (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.3 8.9l4.8 3.1-4.8 3.1z" fill="currentColor" />
    </Svg>
  ),
  watched: (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.4 12.3l2.5 2.5 4.8-5" />
    </Svg>
  ),
  dropped: (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9v6M14 9v6" />
    </Svg>
  ),
};

export const DOWNLOAD_ICONS = {
  all: (
    <Svg>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </Svg>
  ),
  yes: (
    <Svg>
      <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
    </Svg>
  ),
  no: (
    <Svg>
      <circle cx="12" cy="12" r="8" />
      <path d="M6.5 6.5l11 11" />
    </Svg>
  ),
};

export const TYPE_ICONS = {
  movie: (
    <Svg width={1.7}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </Svg>
  ),
  tv: (
    <Svg width={1.7}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M8 3l4 3 4-3" />
    </Svg>
  ),
  all: (
    <Svg width={1.7}>
      <rect x="3" y="4" width="8" height="7" rx="1.5" />
      <rect x="13" y="4" width="8" height="7" rx="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" />
      <rect x="13" y="13" width="8" height="7" rx="1.5" />
    </Svg>
  ),
};

const CLOCK = (
  <Svg>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </Svg>
);
const STAR = (
  <Svg width={1.7}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />
  </Svg>
);
const CALENDAR = (
  <Svg>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Svg>
);
export const SORT_ICONS = {
  added_desc: CLOCK,
  added_asc: CLOCK,
  rating: STAR,
  imdb: STAR,
  year_desc: CALENDAR,
  year_asc: CALENDAR,
  watch_order: (
    <Svg>
      <path d="M10 6h10M10 12h10M10 18h10M4 5.5h1.5v3M4 8.5h3M4 15.5c0-1 2.5-1.5 2.5 0 0 1-2.5 1.8-2.5 3h2.8" />
    </Svg>
  ),
};

// a franchise-szűrő gombja, ha a kiválasztottnak nincs logója (Összes / Franchise nélkül)
export const FRANCHISE_ICON = (
  <Svg width={1.7}>
    <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
    <path d="M3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" />
  </Svg>
);

export const ALL_GENRES_ICON = (
  <Svg width={1.7}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Svg>
);

export const MAMA_ICON = (
  <Svg width={1.7}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" />
  </Svg>
);

// Mama-jelölés: a megszokott színes pötty (Érdekli borostyán, Megkapta zsályazöld, Nem érdekli üres kör)
export function MamaDot({ code }) {
  return <span className="mama-dot" data-mama={code} aria-hidden="true" />;
}
