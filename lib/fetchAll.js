// A Supabase (PostgREST) egy kérésre legfeljebb 1000 sort ad vissza (a projekt „Max rows”
// beállítása – 2026-10-06-án mérve; Norbi listája ekkor 897 cím): ami ennél több is lehet, azt
// ezres adagokban kérjük le, amíg el nem fogy. build(): az adagonként újra felépített lekérdezés,
// egyértelmű rendezéssel. Ugyanazt adja, mint egy lekérdezés: { data, error }. A böngészőben és a route-okban is.
//
// after(lekérdezés, utolsó sor): a következő adag szűrője – „a rendezésben az előző adag utolsó sora után”
// (kulcs szerinti lapozás). Eltolásos lapozással (range) ha két adag között sor kerül fel / törlődik, egy sor
// kétszer jönne vagy kimaradna (átnézés 3, R1) – a teljes listát betöltőknél add meg (afterId / afterCreated).
// Nélküle eltolással lapoz (kis, ritkán változó tábláknál elég).
const PAGE_ROWS = 1000;

export async function fetchAll(build, after) {
  const rows = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const last = rows.at(-1);
    const query =
      after && last ? after(build(), last).limit(PAGE_ROWS) : build().range(from, from + PAGE_ROWS - 1);
    const { data, error } = await query;
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < PAGE_ROWS) return { data: rows, error: null };
  }
}

// .order('id') mellé: a következő adag az utolsó id után
export const afterId = (q, last) => q.gt('id', last.id);

// .order('created_at', { ascending: false }).order('id', { ascending: false }) mellé
export const afterCreated = (q, last) =>
  q.or(`created_at.lt."${last.created_at}",and(created_at.eq."${last.created_at}",id.lt.${last.id})`);
