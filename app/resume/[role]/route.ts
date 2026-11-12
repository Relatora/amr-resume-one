import { promises as fs } from "fs";
import path from "path";
import content from "@/data/content.json";

// Role-based resume downloads: /resume/solutions-architect, /resume/full-stack, ...
//
// The role segment is only used as a lookup key into content.json's
// `personal.resumes`, so a request can never name a file on disk; anything
// not in that allowlist is a 404. basename() is a second guard in case the
// content itself ever holds a path. The PDFs sit in docs/resumes, which
// Next.js does not serve statically, so next.config.ts traces them into the
// deployment for this route.
const RESUMES_DIR = path.join(process.cwd(), "docs", "resumes");

export async function GET(_req: Request, ctx: RouteContext<"/resume/[role]">) {
  const { role } = await ctx.params;
  const option = content.personal.resumes.find((r) => r.id === role);
  if (!option) {
    return new Response("Unknown resume.", { status: 404 });
  }

  const fileName = path.basename(option.file);
  try {
    const file = await fs.readFile(path.join(RESUMES_DIR, fileName));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(file.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Resume not found.", { status: 404 });
  }
}
