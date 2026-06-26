import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables Partial Prerendering (PPR). In Next.js 16 the standalone
  // `experimental.ppr` flag was removed; PPR is now the default App Router
  // behavior under the unified `cacheComponents` flag (also covers
  // `use cache` and dynamicIO). See docs/.../config/cacheComponents.
  cacheComponents: true,
};

export default nextConfig;
