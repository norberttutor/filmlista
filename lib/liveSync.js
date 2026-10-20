'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Élő szinkron a gépek között (terv-3 86, 2026-10-14): a Supabase Realtime (postgres_changes,
// 25_realtime.sql) jelzi, ha egy másik eszközön (vagy Mama oldalán) változott valami – a telefonon tett
// jelölés pár másodpercen belül látszik a nyitott gépen, Mama „Érdekel”-je azonnal a harangban.
// A jelzések 0,4 mp-ig gyűlnek, aztán egyben mennek a hívóhoz:
//   onTitles(ids, deletedIds) – a változott címek (a sorukat a hívó a nézetből tölti újra; az évadok
//     változása is a cím újratöltése), a törölt címek;
//   onNotifications() – az értesítések újratöltése; onFranchises() – a franchise-ok újratöltése;
//   onResync() – a kapcsolat megszakadt, majd helyreállt: közben jelzés veszhetett el, teljes újratöltés.
// A beszúrás / módosítás szűrhető (user_id – az RLS is csak a sajátot engedi); a törlésről csak a kulcs jön
// (az nem szűrhető: másokéról is jöhet – a hívó csak a nála lévőt veszi le). Csak net mellett, a friss
// listával (enabled).

const FLUSH_MS = 400;
// feliratkozásonként új csatornanév (S1): a supabase.channel() azonos névre a még záruló régi csatornát
// adná vissza (pl. ha a net 10 mp-en belül visszajön), és az új feliratkozás hatástalan lenne
let channelSeq = 0;

export function useLiveSync(enabled, userId, handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const pending = { titles: new Set(), deleted: new Set(), notifications: false, franchises: false };
    let timer = 0;
    const flush = () => {
      timer = 0;
      const { titles, deleted, notifications, franchises } = pending;
      pending.titles = new Set();
      pending.deleted = new Set();
      pending.notifications = pending.franchises = false;
      if (titles.size || deleted.size) ref.current.onTitles([...titles], [...deleted]);
      if (notifications) ref.current.onNotifications();
      if (franchises) ref.current.onFranchises();
    };
    const later = () => {
      if (!timer) timer = setTimeout(flush, FLUSH_MS);
    };
    const own = `user_id=eq.${userId}`;
    let subscribed = false;
    let broken = false;

    const channel = supabase
      .channel(`elo-szinkron-${userId}-${++channelSeq}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'titles', filter: own }, (p) => {
        pending.titles.add(p.new.id);
        pending.deleted.delete(p.new.id); // törlés után újra felvéve (pl. mentés visszaállítása): mégis van
        later();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'titles', filter: own }, (p) => {
        pending.titles.add(p.new.id);
        pending.deleted.delete(p.new.id); // törlés után újra felvéve (pl. mentés visszaállítása): mégis van
        later();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'titles' }, (p) => {
        if (p.old?.id == null) return;
        pending.deleted.add(p.old.id);
        pending.titles.delete(p.old.id);
        later();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'title_seasons', filter: own }, (p) => {
        pending.titles.add(p.new.title_id);
        later();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'title_seasons', filter: own }, (p) => {
        pending.titles.add(p.new.title_id);
        later();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'title_seasons' }, (p) => {
        if (p.old?.title_id == null) return;
        pending.titles.add(p.old.title_id); // a hívó csak a nála lévő címet tölti újra
        later();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: own }, () => {
        pending.notifications = true;
        later();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'franchises', filter: own }, () => {
        pending.franchises = true;
        later();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'franchises' }, () => {
        pending.franchises = true;
        later();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // újrakapcsolódás után: ami közben történt, azt egy teljes (csendes) újratöltés hozza
          if (subscribed && broken) ref.current.onResync();
          subscribed = true;
          broken = false;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          broken = true;
        }
      });

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, userId]);
}
