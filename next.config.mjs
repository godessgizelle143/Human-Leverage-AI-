/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // The app does not use next/image. Disabling the optimizer removes the
    // /_next/image endpoint, which carries unpatched advisories on Next 14.x.
    unoptimized: true,
  },
};

export default nextConfig;
