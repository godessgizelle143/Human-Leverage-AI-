// Local demo preview (see lib/demo/mode.ts). The dashboard is reached at
// /demo/dashboard because the sign-in check on /dashboard is left untouched:
// the redirect runs before that check and the rewrite after it. Never active
// in a production build, where NODE_ENV is "production".
const demoMode = process.env.NODE_ENV !== 'production' && process.env.HKE_DEMO_MODE === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // The app does not use next/image. Disabling the optimizer removes the
    // /_next/image endpoint, which carries unpatched advisories on Next 14.x.
    unoptimized: true,
  },
  ...(demoMode && {
    redirects: async () => [{ source: '/dashboard', destination: '/demo/dashboard', permanent: false }],
    rewrites: async () => ({ beforeFiles: [{ source: '/demo/dashboard', destination: '/dashboard' }] }),
  }),
};

export default nextConfig;
