/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  // Environment variables configured in Vercel Dashboard
  images: {
    // Interim mitigation for GHSA-2xp9-vwfh-vxw4 (critical, unauthenticated
    // RCE in the Image Optimization API's AVIF handling via libheif/sharp,
    // August 2026 Next.js security release) — this app is on 14.2.35, and
    // the real fix only shipped for 15.5.24+/16.3.3+; there's no 14.x patch.
    // Explicitly excluding AVIF here removes it from the optimization
    // pipeline regardless of what this version's format defaults actually
    // are, closing the vulnerable code path without the major-version
    // upgrade. Not a substitute for upgrading — remove this once next is on
    // a patched release. See Nate Howard's review.
    formats: ["image/webp"],
  },
};

export default nextConfig;
