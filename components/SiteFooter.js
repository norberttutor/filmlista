export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        Film- és sorozatadatok forrása:{' '}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          TMDB
        </a>
        . Ez az alkalmazás a TMDB API-t használja, de a TMDB nem támogatja és nem tanúsítja.
        IMDb-értékelések:{' '}
        <a href="https://www.omdbapi.com/" target="_blank" rel="noopener noreferrer">
          OMDb API
        </a>
        .
      </p>
      {/* jobbra lent (Norbi kérése, 2026-10-05) */}
      <span className="sponsor">
        sponsored by{' '}
        <a href="https://www.adertis.hu" target="_blank" rel="noopener noreferrer">
          ADERTIS
        </a>
      </span>
    </footer>
  );
}
