import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const rootDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: rootDir,
  },
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
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["@farcaster/mini-app-solana"] = resolve(
      rootDir,
      "src/lib/shims/farcaster-mini-app-solana.ts",
    );

    return config;
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
