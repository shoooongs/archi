import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow mobile devices on the local network to access the dev server
  allowedDevOrigins: ['192.168.219.104'],

  // Hide the bottom-left dev indicator (static/dynamic route badge).
  // NOTE: appIsrStatus / buildActivity were removed in Next.js 16 —
  //       false is the only supported value and disables the overlay entirely.
  devIndicators: false,
};

export default nextConfig;
