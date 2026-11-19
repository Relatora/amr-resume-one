# Amr Abdallah - Personal Resume Website

The interactive resume of **Amr Abdallah**, Senior Software Engineering Lead at AlumaPower - [live](https://amr-resume-one.vercel.app/).

I'm a solutions architect and full-stack engineer with 10+ years of hands-on engineering: real-time IoT telemetry on Azure, company-wide web applications behind a single authentication gateway, and a Copilot Studio agent over enterprise quality and supply-chain data. I lead a team of engineers and teach front-end development at Lambton College.

This site is both my resume and a small showcase of how I like to build: content-driven, animated with intent, and editable in place.

## Highlights

- **Two worlds, one page** - dark mode is a canvas galaxy with a ray-traced black hole; light mode is a paper-craft sky built in SVG: a cut-paper sun that sets into a layered paper ocean as you scroll, drifting three-sheet clouds, folded-paper birds, and live-weather paper rain. All scroll motion runs on sprung values over GPU layers so it glides.
- **Projects deck** - big cards that pin and stack as you scroll, tilting toward the cursor, fed from `content.json`.
- **Interactive skills board** - every skill on one board; pick an area and its skills glide to the front in that area's colour.
- **Sky keywords** - focus areas written faintly across the sky, behind the clouds in light mode and under the stars and black hole in dark mode, shown only from Projects to Contact.
- **Project intro spot** - on a visitor's first load each session, a 7-second ad-style cut flashes four GitHub projects (flash frames, glitch, wipe and iris cuts, slam-in type), then the cards fly into a replay button in the header. Skippable with Esc; reduced motion swaps the flashes for crossfades. Projects come from `content.json` and the in-page editor, with screenshots in `public/projects/`.
- **Role-based resume downloads** - visitors pick the version that fits the role they're hiring for (Solutions Architect, Senior Full-Stack Engineer, Applied AI Engineer, Software Engineering Manager). Each option in `content.json` maps to a PDF in `docs/resumes/`, served by `app/resume/[role]/route.ts` through an allowlist; the old `/resume` link redirects to the default.
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
components/Galaxy.tsx    # dark theme: animated starfield and black hole
components/paper/        # light theme: the paper-craft sky, sea and sky keywords
components/intro/        # the project intro spot and its replay button
```

## Updating the resume PDFs

The PDFs are generated from the LaTeX master CVs kept in a separate, private job-search workspace. Its `tools/build_public_resumes.py` compiles each master without the phone number, checks it is exactly two pages, and copies it into `docs/resumes/`. Commit the new PDFs and push to publish.

---

Reach me at [relatora@gmail.com](mailto:relatora@gmail.com).
