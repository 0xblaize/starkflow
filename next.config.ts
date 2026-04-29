import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Externalize packages that have external dependencies
  serverExternalPackages: [
    "starkzap",
    "@fatsolutions/tongo-sdk",
    "@cartridge/controller",
    "@solana/web3.js",
    "@hyperlane-xyz/sdk",
    "@hyperlane-xyz/registry",
    "@hyperlane-xyz/utils",
    "ethers",
  ],
};

export default nextConfig;
