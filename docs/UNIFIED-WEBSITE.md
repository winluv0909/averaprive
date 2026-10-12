# Unified Avera Privé website

This project combines the original Avera Privé public website with the secure Next.js and Supabase platform.

## Authentication portals

The website uses two purpose-specific sign-in pages backed by the same secure authentication system. `/agency/login` serves agency/company owners and invited employees. `/owner` redirects to `/owners/login`, which is reserved for Avera Privé platform owners. The internal `/owners/dashboard` independently enforces the `super_admin` database role; knowing the URL never grants access.

## Public website

- `/` serves the original homepage without redesigning it.
- The original public pages, styles, scripts, images, and SEO files live in `public/`.
- Existing `.html` navigation continues to work.
- `login.html`, `register.html`, and `dashboard.html` redirect to the real secure routes.
- The public directory and agency profile load published records from `/api/public-agencies`, backed by the Supabase `ap_public_agencies` view.

## Secure platform

- `/agency/login`, `/agency/register`, and `/agency/dashboard` contain the agency/company experience.
- `/owners/login` and `/owners/dashboard` contain platform-owner moderation, publication, verification, review, response, report, dispute, fraud, editorial, subscription, placement, and analytics operations.
- Legacy `/dashboard` and `/admin` paths redirect permanently to the appropriate canonical portal.
- `proxy.ts` protects dashboard routes and refreshes authentication cookies.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the existing Supabase project URL and public key.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

Do not commit `.env.local` or service-role credentials.

## Deployment

Deploy this folder as one Next.js project in Vercel. Configure the environment variables from `.env.example`, set `NEXT_PUBLIC_SITE_URL` to the production domain, and keep the same Supabase project used during workflow testing.
