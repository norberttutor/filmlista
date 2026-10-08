import SiteFooter from '@/components/SiteFooter';

// visszavont vagy hibás megosztott link (terv-3 41)
export const metadata = { title: 'A link nem érvényes', robots: { index: false, follow: false } };

export default function SharedOrderNotFound() {
  return (
    <>
      <main className="share-page">
        <div className="share-gone">
          <h1>Ez a link már nem érvényes</h1>
          <p className="muted">
            A megosztó visszavonta, vagy elírás került a címbe. Kérj tőle új linket.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
