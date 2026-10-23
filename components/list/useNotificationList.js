'use client';

// A harang értesítései a fő listán (components/Watchlist.js): az állapot, az olvasottnak jelölés, a törlés
// visszavonással és az app ikonjának száma. A betöltésük a lista betöltésével együtt fut (useListData.js).
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { dismissNotifications, markNotificationsRead, restoreNotifications } from '@/lib/notifications';

export function useNotificationList() {
  const [notifications, setNotifications] = useState([]); // új évadokról, legutóbbi 30
  // itt már olvasottnak jelöltek: egy közben beérkező (korábban indult) lekérdezés se írja vissza
  // őket olvasatlannak
  const readIds = useRef(new Set());
  // itt törölt értesítések: a közben beérkező lekérdezés se hozza vissza őket
  const dismissedIds = useRef(new Set());

  // egy friss lekérdezés eredménye a helyben már olvasottnak jelöltekkel / töröltekkel
  const fresh = (ns) =>
    ns
      .filter((n) => !dismissedIds.current.has(n.id))
      .map((n) => (!n.read_at && readIds.current.has(n.id) ? { ...n, read_at: new Date().toISOString() } : n));

  // visszaállítás (Mentések) után: a visszaállítás előtt olvasottnak jelölt / törölt értesítések már nem
  // érvényesek – a visszaállított állapot számít, egy késő lekérdezés se rejtse el őket (kódaudit #50)
  function forgetLocal() {
    readIds.current.clear();
    dismissedIds.current.clear();
  }

  // a harang kinyitásakor a betöltött olvasatlanok olvasottak (az adatbázisban is – csak ezek, a
  // közben keletkezett, még nem látott értesítés olvasatlan marad)
  function readNotifications() {
    const now = new Date().toISOString();
    const ids = notifications.filter((n) => !n.read_at).map((n) => n.id);
    for (const id of ids) readIds.current.add(id);
    const read = new Set(ids);
    setNotifications((ns) => ns.map((n) => (read.has(n.id) && !n.read_at ? { ...n, read_at: now } : n)));
    markNotificationsRead(ids);
  }

  // törlés a harangból (egy vagy mind): azonnal eltűnik, az értesítősávban „Visszavonás”
  async function removeNotifications(list) {
    const ids = list.map((n) => n.id);
    const putBack = () => {
      for (const id of ids) dismissedIds.current.delete(id);
      setNotifications((ns) =>
        [...ns.filter((n) => !ids.includes(n.id)), ...list].sort(
          (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id
        )
      );
    };
    for (const id of ids) dismissedIds.current.add(id);
    setNotifications((ns) => ns.filter((n) => !ids.includes(n.id)));
    try {
      await dismissNotifications(ids);
    } catch (err) {
      putBack();
      toast({ text: err.message });
      return;
    }
    toast({
      kind: 'delete',
      text: ids.length === 1 ? 'Értesítés törölve.' : `${ids.length} értesítés törölve.`,
      action: {
        label: 'Visszavonás',
        onClick: async () => {
          try {
            await restoreNotifications(ids);
            putBack();
          } catch (err) {
            toast({ text: err.message });
          }
        },
      },
      needsNet: 'action', // net nélkül a visszavonás nem menthető (B9)
    });
  }

  return { notifications, setNotifications, fresh, forgetLocal, readNotifications, removeNotifications };
}

// a telepített app ikonján (pl. a tálcán) is látszik az olvasatlan értesítések száma,
// ahol a böngésző tudja (Chrome / Edge) – ugyanannyi, amennyit a harang mutat (kódaudit #20)
export function useAppBadge(unreadCount) {
  useEffect(() => {
    try {
      const badge = unreadCount ? navigator.setAppBadge?.(unreadCount) : navigator.clearAppBadge?.();
      badge?.catch(() => {});
    } catch {
      // nincs ilyen lehetőség: semmi baj
    }
  }, [unreadCount]);
}
