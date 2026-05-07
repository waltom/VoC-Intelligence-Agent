/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@voc/shared"],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
