import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler auto-memoizes components and hooks, so the UI carries no
  // hand-written useMemo/useCallback (review follow-up).
  reactCompiler: true,
};

export default nextConfig;
