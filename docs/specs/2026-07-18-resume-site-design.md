# Personal Resume Website - Design Spec

**Date:** 2026-07-18
**Owner:** Amr Abdallah (GitHub: relatora)
**Status:** Approved

## Overview

A professional, animated, colorful personal resume website. Next.js (App Router, TypeScript) + Framer Motion + Tailwind CSS. Single scrolling page with a client-side login gate and an in-page content editor. Deploys to Vercel with zero extra config.

## Design direction

- Bold, modern, creative - not a generic template.
- Palette: deep navy/charcoal base (`#0a0f1e` family) with a teal → violet → amber accent gradient.
- Expressive typography, generous whitespace.
- Scroll animations: staggered reveals for experience entries, skill tags animating in, hero with animated gradient + floating shapes.
- Hover micro-interactions on cards and buttons.
- Fully responsive, mobile-first.

## Sections

1. **Hero / Summary** - name, title, summary, contact links, animated background.
2. **Experience** - reverse-chronological, expandable entries (title, org, dates, employment type, bullets).
3. **Skills** - grouped by category, animated tag cloud.
4. **Education** - chronological entries.
5. **Contact** - email, website links.

## Data

All content lives in `data/content.json` - nothing hardcoded in components. Typed via `lib/types.ts`. Shape:

```
{
  personal: { name, title, email, website, summary },
  experience: [{ id, title, org, start, end, type, summary?, bullets[] }],
  skills: [{ id, category, items[] }],
  education: [{ id, credential, institution, start, end, details[] }]
}
```

Content source: Amr's resume PDF, plus new AlumaPower-era bullets merged into the existing AlumaPower entry:
- Azure architecture: MQTT brokers, web services, app services, **Kusto DB (Azure Data Explorer)**
- AI-assisted ("vibe coding") development workflow
- Testing team solutions built for AlumaPower
- Monolith AI integration work
- Leading a software team

## Access control

- Client-side gate before the site renders: static password `canu`, no username, no backend.
- Auth flag in `sessionStorage`. This is friction, not security (password ships in the bundle) - acceptable for this phase, to be upgraded later.
- After login: full site + **Edit mode** toggle.

## Editing (post-login)

- Edit mode toggle in the header. When on, every entry (experience, skill group, education) shows edit affordances.
- Clicking an entry opens a clean side panel/modal form - all fields editable, bullets add/remove/reorder, entries add/remove/reorder. No raw JSON editing.
- **Hybrid persistence:**
  - **Local dev:** saves POST to `/api/content`, which writes `data/content.json` to disk. Commit + push to publish.
  - **Production (Vercel):** the API route refuses writes (read-only filesystem); saves fall back to that browser's `localStorage`, layered over the shipped JSON at load. A "Download content.json" button exports the merged content so phone/production edits can be committed to the repo later.

## Components

- `AuthProvider` / `LoginGate` - gate + session flag.
- `ContentProvider` - loads shipped JSON, overlays localStorage, exposes CRUD + save.
- `EditModeProvider` - edit toggle state.
- `Hero`, `ExperienceSection` → `ExperienceCard`, `SkillsSection`, `EducationSection`, `ContactSection`.
- `EditPanel` - shared modal/side-panel form for all entry types.
- `api/content/route.ts` - POST handler; dev-only file write, 403 in production.

## Deployment

- Local path: `C:\AWrk\Personal\Code`.
- GitHub: private repo under `relatora` (public later). Vercel via GitHub integration.
- Zero extra config: no env vars, plain `next build`.
- Repo creation / push / Vercel hookup are confirmed with the user before executing.
