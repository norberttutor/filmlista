'use client';

import { useEffect, useState } from 'react';
import { justAdded } from '@/lib/titles';

// „✓ A listán” (vagy „✓ Megnézve”) címke a felvehető címek helyén. A most felvett címnél (terv-3 134) a pipa
// balról jobbra megrajzolódik, a címke beúszik (data-new, 36-mozgas.css) – betöltéskor nem; a jelző 1 s után lekerül.
export default function OnList({ item, as: Tag = 'span', children = 'A listán' }) {
  const [fresh, setFresh] = useState(() => justAdded(item));
  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setFresh(false), 1000);
    return () => clearTimeout(timer);
  }, [fresh]);
  return (
    <Tag className="on-list" data-new={fresh ? '' : undefined}>
      <span className="tick">✓</span> {children}
    </Tag>
  );
}
