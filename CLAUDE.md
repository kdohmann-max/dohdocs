# DohDocs — Claude Context

## Project overview

DohDocs is a personal Markdown note-taking SPA. Rich text editing via TipTap, notes stored in Supabase (Postgres), deployed to Netlify via GitHub auto-deploy.

## Tech stack

- React 19 + TypeScript 6 + Vite 8
- TipTap 3 (rich text editor) with tiptap-markdown for serialization
- `@supabase/supabase-js` for storage
- Netlify (static hosting, GitHub integration)

## Key architecture

- **All persistence is isolated in `src/storage/db.ts`** — the only file that talks to Supabase. Never add API calls elsewhere.
- Notes are stored as Markdown in Supabase (`notes` table: `id text, title text, markdown text, updated_at bigint`)
- Images are embedded as base64 data URLs directly in the markdown (no separate file storage)
- Custom TipTap marks (P1/P2/P3/comment) serialize as inline HTML `<span data-fmt="...">` tags — this is intentional and how they survive the markdown round-trip
- `notesApiPlugin.ts` is still wired into `vite.config.ts` but the app no longer calls `/api/notes` — it's unused legacy from the dev-only file storage era

## Dev workflow

- Requires `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to run
- `npm run dev` — dev server at localhost:5173 (or 5174 if port taken)
- `npm run build` — TypeScript check + Vite build to `dist/`

## Deploy workflow

**NEVER run `git commit` or `git push` without explicit user approval for that specific deploy.** Always stop and ask first — a push triggers a Netlify auto-deploy and goes live immediately without further confirmation.

- Netlify env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in the Netlify dashboard for production builds to connect to the database
- Repo: `https://github.com/kdohmann-max/dohdocs`

## Supabase

- Project URL: `https://wqbouosruykioizrtlqd.supabase.co`
- RLS is disabled on the `notes` table (personal app, no auth yet)
