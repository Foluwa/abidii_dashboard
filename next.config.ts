import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Allow external images from OAuth providers
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'platform-lookaside.fbsbx.com',
        pathname: '/**',
      },
    ],
  },

  async redirects() {
    return [
      // Legacy overview routes → Dashboard
      { source: '/overview', destination: '/dashboard', permanent: true },

      // Legacy reports routes → Analytics
      { source: '/reports/game-analytics', destination: '/analytics', permanent: true },
      { source: '/reports/player-analytics', destination: '/analytics/players', permanent: true },
      { source: '/reports/curriculum-ops', destination: '/analytics/curriculum-ops', permanent: true },

      // Legacy content/library routes → canonical /content/*
      { source: '/content/library/words', destination: '/content/words', permanent: true },
      { source: '/content/library/phrases', destination: '/content/phrases', permanent: true },
      { source: '/content/library/time-phrases', destination: '/content/time-phrases', permanent: true },
      { source: '/content/library/sentences', destination: '/content/sentences', permanent: true },
      { source: '/content/library/proverbs', destination: '/content/proverbs', permanent: true },
      { source: '/content/library/letters', destination: '/content/letters', permanent: true },
      { source: '/content/library/numbers', destination: '/content/numbers', permanent: true },
      { source: '/content/library/games', destination: '/content/learning-items', permanent: true },
      // NOTE: /content/library itself is now a real page (tabbed Content
      // Library) — do not redirect it away.

      // Legacy games → Learning Items
      { source: '/games', destination: '/content/learning-items', permanent: true },

      // Legacy curriculum aliases → canonical
      { source: '/content/curriculum/courses', destination: '/curriculum/courses', permanent: true },
      { source: '/content/curriculum/courses/:path*', destination: '/curriculum/courses/:path*', permanent: true },
      { source: '/content/curriculum/editor', destination: '/curriculum/editor', permanent: true },
      { source: '/content/curriculum/lesson-blueprints', destination: '/curriculum/lesson-blueprints', permanent: true },
      { source: '/content/curriculum/lesson-blueprints/:path*', destination: '/curriculum/lesson-blueprints/:path*', permanent: true },
      { source: '/content/curriculum/readiness', destination: '/curriculum/publishing', permanent: true },
      { source: '/content/curriculum/assets', destination: '/curriculum/assets', permanent: true },

      // Legacy media routes → canonical
      { source: '/media/library', destination: '/media', permanent: true },
      { source: '/media/audio/voices', destination: '/audio/voices', permanent: true },
      { source: '/media/audio/jobs', destination: '/audio/jobs', permanent: true },
      { source: '/media/audio/generate', destination: '/audio/generate', permanent: true },
      { source: '/media/voices', destination: '/audio/voices', permanent: true },
      { source: '/media/audio-jobs', destination: '/audio/jobs', permanent: true },
      { source: '/media/audio-generate', destination: '/audio/generate', permanent: true },

      // Legacy community/users routes → canonical /users/*
      { source: '/community/users', destination: '/users', permanent: true },
      { source: '/community/users/admins', destination: '/users/admins', permanent: true },
      { source: '/community/users/:path*', destination: '/users/:path*', permanent: true },

      // Legacy community billing routes → canonical /subscriptions/*
      { source: '/community/billing', destination: '/subscriptions', permanent: true },
      { source: '/community/billing/events', destination: '/subscriptions/events', permanent: true },
      { source: '/community/billing/verification-attempts', destination: '/subscriptions/attempts', permanent: true },

      // Legacy system/ml-training routes → canonical /operations/ml-training/*
      { source: '/system/ml-training', destination: '/operations/ml-training', permanent: true },
      { source: '/system/ml-training/jobs', destination: '/operations/ml-training/jobs', permanent: true },
      { source: '/system/ml-training/jobs/:path*', destination: '/operations/ml-training/jobs/:path*', permanent: true },
      { source: '/system/ml-training/manifests', destination: '/operations/ml-training/manifests', permanent: true },
      { source: '/system/ml-training/manifests/:path*', destination: '/operations/ml-training/manifests/:path*', permanent: true },
      { source: '/system/ml-training/models', destination: '/operations/ml-training/models', permanent: true },
      { source: '/system/ml-training/vision-jobs', destination: '/operations/ml-training/vision-jobs', permanent: true },
      { source: '/system/ml-training/vision-jobs/:path*', destination: '/operations/ml-training/vision-jobs/:path*', permanent: true },

      // Legacy system/jobs/admin → canonical /admin/jobs
      { source: '/system/jobs/admin', destination: '/admin/jobs', permanent: true },

      // Legacy system/audit-log → canonical /content/audit-log
      { source: '/system/audit-log', destination: '/content/audit-log', permanent: true },
      { source: '/operations/audit-log', destination: '/content/audit-log', permanent: true },

      // Legacy system/observability/* → canonical /system/*
      { source: '/system/observability/status', destination: '/system/status', permanent: true },
      { source: '/system/observability/metrics', destination: '/system/metrics', permanent: true },
      { source: '/system/observability/alerts', destination: '/system/alerts', permanent: true },
      { source: '/system/observability/cron-jobs', destination: '/system/cron', permanent: true },

      // Legacy system/configuration/* → unified /system/configuration
      { source: '/system/configuration/platform', destination: '/system/configuration', permanent: true },
      { source: '/system/configuration/application', destination: '/system/configuration', permanent: true },
      { source: '/system/configuration/language', destination: '/system/configuration', permanent: true },
      { source: '/system/config', destination: '/system/configuration', permanent: true },
      { source: '/operations/configuration', destination: '/system/configuration', permanent: true },
      { source: '/operations/configuration/platform', destination: '/system/configuration', permanent: true },
      { source: '/operations/configuration/application', destination: '/system/configuration', permanent: true },
      { source: '/operations/configuration/language', destination: '/system/configuration', permanent: true },

      // Legacy testing routes
      { source: '/testing', destination: '/system/testing', permanent: true },
      { source: '/operations/testing', destination: '/system/testing', permanent: true },

      // Legacy operations catch-alls → system
      { source: '/operations/status', destination: '/system/status', permanent: true },
      { source: '/operations/metrics', destination: '/system/metrics', permanent: true },
      { source: '/operations/alerts', destination: '/system/alerts', permanent: true },
      { source: '/operations/cron-jobs', destination: '/system/cron', permanent: true },
      { source: '/operations/idempotency', destination: '/system/status', permanent: true },
    ];
  },
  
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
    
  turbopack: {
    // Explicitly set root to this directory to prevent workspace root confusion
    root: __dirname,
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
};

export default nextConfig;
