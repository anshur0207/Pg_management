# PG Manager

A multi-tenant PG and hostel management platform built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Phase 1 status

- Responsive public landing page and owner authentication screens.
- Supabase browser/server client setup for secure cookie-based sessions.
- Supabase authentication is enabled only when the project URL and anonymous key are configured.
- No production dashboard data or integrations are fabricated.

## Getting started

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project.
2. In Supabase Auth, configure the site URL and redirect URLs for your local and deployed app.
3. Run `npm install` and `npm run dev`.

Without Supabase credentials, the application clearly explains how to configure authentication; it does not simulate successful sign-in.

## Scripts

- `npm run dev` — local development server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript checks

## Security notes

The Supabase service-role key is server-only and must never be exposed to the browser. Multi-tenant authorization, database migrations, and RLS policies are part of the upcoming backend phase; do not treat client-side authentication alone as an authorization boundary.
