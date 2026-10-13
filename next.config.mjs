/** @type {import('next').NextConfig} */
// a kiadás azonosítója (terv-3 63): a böngészőbe a build idején kerül be, az /api/version a futót adja –
// ha eltér, a régóta nyitott app „Frissült az app” sávot mutat. A Vercelen a commit, helyben 'dev'
// (az APP_VERSION felülírja – a teszt így próbálja ki).
const APP_VERSION = process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev';

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  // a service worker (offline indulás, terv-3 44) mindig friss legyen: a böngésző minden
  // indításkor megnézi, változott-e
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
