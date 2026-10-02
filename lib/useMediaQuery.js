import { useCallback, useSyncExternalStore } from 'react';

// Igaz, ha a CSS media query (pl. '(min-width: 960px)') éppen teljesül;
// ablakméretezéskor magától frissül.
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false // szerveren nincs ablak
  );
}
