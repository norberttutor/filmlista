import { connection } from 'next/server';

// A futó kiadás azonosítója (terv-3 63): a böngészőben régóta nyitott app ezzel veti össze a saját
// (build idején beégetett) azonosítóját – ha eltér, „Frissült az app – Újratöltés” sáv. Belépés nem kell
// (nincs benne felhasználói adat); kérésenként fut, és sehol nem tárolódik.
export async function GET() {
  await connection();
  const version = process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev';
  return Response.json({ version }, { headers: { 'Cache-Control': 'no-store' } });
}
