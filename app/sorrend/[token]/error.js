'use client';

import ErrorScreen from '@/components/ErrorScreen';
import SiteFooter from '@/components/SiteFooter';

// futás közbeni hiba a megosztott nézési sorrend oldalán
export default function SharedOrderError({ error, retry }) {
  return (
    <>
      <ErrorScreen error={error} retry={retry} className="share-page" />
      <SiteFooter />
    </>
  );
}
