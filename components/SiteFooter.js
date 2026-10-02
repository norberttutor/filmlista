export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        Film- és sorozatadatok forrása:{' '}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          TMDB
        </a>
        . Ez az alkalmazás a TMDB API-t használja, de a TMDB nem támogatja és nem tanúsítja.
      </p>
    </footer>
  );
}
