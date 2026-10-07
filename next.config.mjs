/** @type {import('next').NextConfig} */
const nextConfig = {
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
