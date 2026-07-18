# Amr Abdallah — Personal Resume Website

The interactive resume of **Amr Abdallah**, Software & Database Engineer and Software Team Lead at AlumaPower — live at [relatora.me](https://relatora.me).

I'm a full-stack engineer with 20+ years across the stack: from SMS banking solutions in the early 2000s to today's Azure cloud architecture (MQTT brokers, web services, app services, Kusto DB), AI-assisted development workflows, and Monolith AI platform integration. I lead a software team, teach front-end development at Lambton College, and have shipped products across web, mobile, desktop, embedded, and IoT.

This site is both my resume and a small showcase of how I like to build: content-driven, animated with intent, and editable in place.

## Highlights

- **Animated, theme-aware UI** — dark/light modes, an animated galaxy starfield, gradient typography, wavy section separators, and scroll-staggered reveals built with Framer Motion.
- **Content as data** — the entire resume lives in [`data/content.json`](data/content.json). No copy is hardcoded in components.
- **In-page editing** — an owner mode (password-gated) edits every section through inline forms: add, remove, reorder, and rewrite without touching JSON.
- **Demo mode** — visitors can try the editor safely; nothing persists, and a Reset button restores the original at any time.
- **Hybrid persistence** — running locally, edits write straight back to `content.json`; on the deployed site they layer into `localStorage` with a one-click JSON export for committing later.

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

Open http://localhost:3000. In local dev, saves from the in-page editor write directly to `data/content.json` — commit and push to publish.

## Project layout

```
data/content.json        # all resume content
app/                     # layout, page, /api/content (dev-only file writes)
components/sections/     # Hero, Experience, Skills, Education, Contact
components/editor/       # slide-in edit panel + form primitives
components/providers/    # auth, content (persistence), editor state
components/Galaxy.tsx    # animated starfield background
```

---

Built by Amr Abdallah with an AI-assisted workflow. Reach me at [relatora@gmail.com](mailto:relatora@gmail.com).
