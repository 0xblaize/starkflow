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
  // Exclude optional starkzap peer deps that aren't installed
  serverExternalPackages: [
    "@fatsolutions/tongo-sdk",
    "@cartridge/controller",
    "@solana/web3.js",
    "@hyperlane-xyz/sdk",
    "@hyperlane-xyz/registry",
    "@hyperlane-xyz/utils",
    "ethers",
    "starkzap",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || {};
      config.externals = {
        ...config.externals,
        "@solana/web3.js": "@solana/web3.js",
      };
    }
    return config;
  },
};

export default nextConfig;
