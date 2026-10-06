// A Supabase (PostgREST) egy kérésre legfeljebb 1000 sort ad vissza (a projekt „Max rows”
// beállítása – 2026-10-06-án mérve; Norbi listája ekkor 897 cím): ami ennél több is lehet, azt
// ezres adagokban kérjük le, amíg el nem fogy. build(): az adagonként újra felépített lekérdezés,
// egyértelmű rendezéssel (különben az adagok határán sor maradhatna ki vagy ismétlődhetne).
// Ugyanazt adja, mint egy lekérdezés: { data, error }. A böngészőben és a route-okban is.
export const PAGE_ROWS = 1000;

export async function fetchAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await build().range(from, from + PAGE_ROWS - 1);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < PAGE_ROWS) return { data: rows, error: null };
  }
}
