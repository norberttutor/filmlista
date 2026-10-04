// Üres lista / találat nélküli szűrés vagy keresés: kis rajz, cím, magyarázat és a teendők
// gombjai (a hívó adja őket).
export default function EmptyState({ title, text, children }) {
  return (
    <div className="empty-state">
      <svg
        className="empty-art"
        viewBox="0 0 150 120"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* filmkocka, előtte nagyító */}
        <g opacity=".38">
          <rect x="14" y="22" width="84" height="64" rx="10" />
          <path d="M14 38h84M14 70h84M34 22v16M56 22v16M78 22v16M34 70v16M56 70v16M78 70v16" />
        </g>
        <circle cx="98" cy="72" r="24" className="empty-art-lens" />
        <path d="m116 90 18 18" />
        <path d="M90 66l16 12M106 66 90 78" opacity=".7" />
      </svg>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}
