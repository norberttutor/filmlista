'use client';

import ErrorScreen from '@/components/ErrorScreen';

// futás közbeni hiba a fő oldalon (a Next angol alapértelmezettje helyett)
export default function Error({ error, retry }) {
  return <ErrorScreen error={error} retry={retry} />;
}
