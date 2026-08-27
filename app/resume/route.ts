import { promises as fs } from "fs";
import path from "path";
import content from "@/data/content.json";

// The resume PDF lives in /docs, which Next.js does not serve statically the
// way it serves /public. This handler streams the file named by
// `personal.resume` in content.json; basename() keeps the lookup inside /docs.
const DOCS_DIR = path.join(process.cwd(), "docs");

export async function GET() {
  const fileName = path.basename(content.personal.resume);
  try {
    const file = await fs.readFile(path.join(DOCS_DIR, fileName));
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
