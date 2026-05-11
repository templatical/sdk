/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Suppress lint/type-check noise so the test focuses on bundler behavior.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
