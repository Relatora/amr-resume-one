# Deploying

The site is a Next.js app hosted on Vercel at
[amr-resume-one.vercel.app](https://amr-resume-one.vercel.app/), built from the `main`
branch of [Relatora/amr-resume-one](https://github.com/Relatora/amr-resume-one).

## Normal deploy: push to `main`

Vercel's GitHub integration watches `main`, so a push is the deploy. There is no separate
command to run.

```bash
npm run build
```

Build locally first - Vercel runs the same `next build`, so anything that fails here fails
there. Then commit and push:

```bash
git add -A && git commit -m "Describe the change" && git push origin main
```

Vercel picks up the push within a few seconds and promotes the build to production once it
succeeds. Watch it at [vercel.com/dashboard](https://vercel.com/dashboard); a failed build
leaves the previous deployment serving traffic.

Pushing any other branch produces a preview deployment on its own URL instead of touching
production.

## Manual deploy from the CLI

Useful when the GitHub integration is unavailable or you want to ship without a commit. The
CLI is already a transitive dependency, so `npx` needs no install:

```bash
npx vercel login
```

```bash
npx vercel link
```

`link` connects this folder to the existing `amr-resume-one` project and writes `.vercel/`
(gitignored). Both commands are one-time setup per machine. Then, to build on Vercel and
promote straight to production:

```bash
npx vercel --prod
```

Drop `--prod` for a preview deployment on a throwaway URL - worth doing first when the
change is risky.

## Environment variables

One variable, `NEXT_PUBLIC_EDIT_PASSWORD`, unlocks the in-page editor's "Owner access"
prompt. `.env.example` documents it; `.env` holds the real value locally and is gitignored.

```bash
cp .env.example .env
```

For the deployed site, set the same variable under **Settings > Environment Variables** in
the Vercel project, then redeploy - `NEXT_PUBLIC_` values are inlined at build time, so
changing it does not take effect until the next build. If the variable is missing the gate
simply stays locked and no one can enter edit mode.

Note that `NEXT_PUBLIC_` ships the value to the browser. This is a friction gate to keep
casual visitors out of edit mode, not a secret: anyone can read it in devtools. Real
protection would need the check moved to the server.

## Checks worth running before a push

```bash
npx tsc --noEmit
```

```bash
npx eslint .
```

```bash
npm run dev
```

The dev server runs at http://localhost:3000. Confirm the hero and contact **Download
resume (PDF)** buttons return the PDF, since that route touches the filesystem and is the
one piece that behaves differently in production.

## Deployment-specific things to know

- **The resume PDF is served by a route, not from `public/`.** `app/resume/route.ts` reads
  the file from `docs/` at request time, so `/resume` is a dynamic serverless function
  rather than a static asset. `next.config.ts` carries an `outputFileTracingIncludes` entry
  for `/resume` that tells Vercel's file tracer to bundle `docs/*.pdf` with the function.
  Without it the route deploys fine and then 404s in production. Anything that moves the
  PDF or renames that route needs the config updated to match.
- **Swapping in a new resume PDF** means dropping the file in `docs/`, pointing
  `personal.resume` in `data/content.json` at its filename, and pushing. Both are committed
  files, so the deploy carries them.
- **Content edits made on the live site do not persist to the repo.** Vercel's filesystem is
  read-only, so `app/api/content/route.ts` refuses writes outside development and the
  in-page editor falls back to `localStorage` for that browser only. To make an edit
  permanent, use the editor's JSON export (or edit `data/content.json` directly), commit the
  file, and push.
- **Node version** is whatever the Vercel project has configured; the app has no other
  runtime requirements.
