# Portfolio — images & video gallery

A public, Pinterest/Behance-style gallery for your photos and videos, with a private **Studio** admin to upload and manage posts. SvelteKit 3 + Svelte 5 + Supabase, set in DM Sans.

## Setup (one time)

1. **Database:** open Supabase → **SQL Editor** → New query, paste [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
   It only *adds* `gallery_*` tables, functions, policies and a `gallery` storage bucket. Tables from your other app aren't touched.
2. **Admin account:**
   ```bash
   npm run admin:create -- you@example.com "a-strong-password"
   ```
   (Or create a user in Authentication → Users and run the `insert into public.gallery_admins …` snippet at the bottom of `schema.sql`.)
3. **Run:**
   ```bash
   npm run dev
   ```
   Site: `/` · Admin: `/admin` (sign in at `/login`).

## What's inside

**Public site**
- Masonry grid (2–5 columns, responsive) with filters for Photos / Videos, categories, tags, search and sort (latest, most viewed, most appreciated)
- Infinite scroll
- Desktop: clicking a card opens it in an overlay with its own URL. Mobile and direct links get a full post page.
- Post page: full-width media stack, an image lightbox (arrow keys), video player, views, an "Appreciate" button, share, tags and related work
- Hovering a video card plays a muted preview
- About page with bio, links and contact
- Light and dark mode follow the visitor's system setting

**Studio (admin)**
- Drag-and-drop or paste uploads with progress. Files go straight from the browser to Supabase Storage.
- Thumbnails (900px WebP) and video poster frames are generated in the browser, so the grid stays fast
- Reorder media by dragging; the first item is the cover. Captions/alt text, tags, category, pin to top, draft/published.
- Posts dashboard: stats, filters, quick publish/pin/delete
- Categories and profile (avatar, bio, social links) editors

## Security model

- The browser only ever sees the **anon** key. Row Level Security lets anyone read *published* posts and only users in `gallery_admins` write anything, including storage uploads.
- `SUPABASE_SERVICE_ROLE_KEY` in `.env` is used only by `scripts/create-admin.js` on your machine. It's never imported by the app. `.env` is git-ignored.

## Notes

- Supabase limits uploads to 50 MB per file on the free plan. Videos over that limit are **automatically compressed in your browser** (MP4, resolution and bitrate chosen to fit). Big images are resized to 4096px. If you move to a paid plan and raise the limit under **Storage → Settings**, set `PUBLIC_MAX_UPLOAD_MB` in `.env` to match, and big files will upload untouched.
- The site opens in light mode. Visitors can switch to dark with the moon icon, and their choice is remembered.
- `adapter-auto` works on Vercel, Netlify and Cloudflare. Set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` as environment variables there.
# Content-Portfolio
