# Amr Abdallah - Personal Resume Website

The interactive resume of **Amr Abdallah**, Senior Software Engineering Lead at AlumaPower - [live](https://amr-resume-one.vercel.app/).

I'm a solutions architect and full-stack engineer with 10+ years of hands-on engineering: real-time IoT telemetry on Azure, company-wide web applications behind a single authentication gateway, and a Copilot Studio agent over enterprise quality and supply-chain data. I lead a team of engineers and teach front-end development at Lambton College.

This site is both my resume and a small showcase of how I like to build: content-driven, animated with intent, and editable in place.

## Highlights

- **Animated, theme-aware UI** - dark/light modes, an animated galaxy starfield, gradient typography, wavy section separators, and scroll-staggered reveals built with Framer Motion.
- **Role-based resume downloads** - visitors pick the version that fits the role they're hiring for (Solutions Architect, Senior Full-Stack Engineer, Applied AI Engineer). Each option in `content.json` maps to a PDF in `docs/resumes/`, served by `app/resume/[role]/route.ts` through an allowlist; the old `/resume` link redirects to the default.
- **Content as data** - the entire resume lives in [`data/content.json`](data/content.json). No copy is hardcoded in components.
- **In-page editing** - an owner mode (password-gated) edits every section through inline forms: add, remove, reorder, and rewrite without touching JSON.
- **Demo mode** - visitors can try the editor safely; nothing persists, and a Reset button restores the original at any time.
- **Hybrid persistence** - running locally, edits write straight back to `content.json`; on the deployed site they layer into `localStorage` with a one-click JSON export for committing later.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion + a hand-rolled canvas starfield |
| Content | Single typed `content.json` |
| Hosting | Vercel (zero-config) |

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. In local dev, saves from the in-page editor write directly to `data/content.json` - commit and push to publish.

## Project layout

```
data/content.json        # all resume content
app/                     # layout, page, /api/content (dev-only file writes)
app/resume/[role]/       # streams the role-based resume PDFs
docs/resumes/            # the published PDFs (generated, see below)
components/sections/     # Hero, Experience, Skills, Education, Contact
components/editor/       # slide-in edit panel + form primitives
components/providers/    # auth, content (persistence), editor state
components/Galaxy.tsx    # animated starfield background
```

## Updating the resume PDFs

The PDFs are generated from the LaTeX master CVs kept in a separate, private job-search workspace. Its `tools/build_public_resumes.py` compiles each master without the phone number, checks it is exactly two pages, and copies it into `docs/resumes/`. Commit the new PDFs and push to publish.

---

Reach me at [relatora@gmail.com](mailto:relatora@gmail.com).
