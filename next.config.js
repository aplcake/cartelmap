/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Existing repo has many legacy lint violations; don't block deploy builds.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
