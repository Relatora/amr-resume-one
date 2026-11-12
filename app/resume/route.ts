import content from "@/data/content.json";

// The original single-resume link. Older shares of /resume still work: they
// are sent to the default (first) role-based resume.
export function GET(request: Request) {
  const fallback = content.personal.resumes[0];
  return Response.redirect(new URL(`/resume/${fallback.id}`, request.url), 307);
}
