import { createClient } from '@supabase/supabase-js';

// GET /api/keepalive – a Vercel naponta egyszer meghívja (vercel.json → crons), hogy a
// Supabase ingyenes projektje ne szüneteljen tétlenség miatt. Egy apró lekérdezést futtat a
// nyilvános kulccsal; adatot nem ad vissza. Ha a Vercelen be van állítva CRON_SECRET,
// csak azzal hívható (a Vercel Cron automatikusan elküldi).
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization'); // a fejléc olvasása miatt mindig dinamikus
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Nincs jogosultság.' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { error } = await supabase.from('statuses').select('code', { count: 'exact', head: true });
  if (error) {
    console.error(error);
    return Response.json({ ok: false }, { status: 502 });
  }
  return Response.json({ ok: true, at: new Date().toISOString() });
}
