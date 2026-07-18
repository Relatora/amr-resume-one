import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Writes only work on a local dev machine. In production (Vercel) the
// filesystem is read-only, so the client falls back to localStorage.
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "File writes are only available when running locally." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const valid =
    body &&
    typeof body === "object" &&
    body.personal &&
    Array.isArray(body.experience) &&
    Array.isArray(body.skills) &&
    Array.isArray(body.education);
  if (!valid) {
    return NextResponse.json({ error: "Invalid content payload." }, { status: 400 });
  }

  const file = path.join(process.cwd(), "data", "content.json");
  await fs.writeFile(file, JSON.stringify(body, null, 2) + "\n", "utf8");
  return NextResponse.json({ ok: true });
}
