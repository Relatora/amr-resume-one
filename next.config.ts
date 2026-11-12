import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // docs/resumes is outside the build graph: the /resume/[role] handler reads
  // the PDFs at runtime, so tell the tracer to ship them with that route.
  // Route keys are globs, so "/resume/**" covers the dynamic [role] segment.
  outputFileTracingIncludes: {
    "/resume/**": ["./docs/resumes/*.pdf"],
  },
};

export default nextConfig;
