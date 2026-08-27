import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /docs is outside the build graph, so tell the tracer to ship the PDF
  // that the /resume route handler reads at runtime.
  outputFileTracingIncludes: {
    "/resume": ["./docs/*.pdf"],
  },
};

export default nextConfig;
