-- =====================================================================
--  Gallery — Supabase schema
--  Run once in: Supabase Dashboard → SQL Editor → New query → Run
--
--  SAFE FOR SHARED PROJECTS: everything here is namespaced `gallery_*`
--  and only ADDS objects. It never drops, renames or alters any existing
--  table, policy or bucket that belongs to another app. Re-running it is
--  safe (idempotent).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  Admins (who may manage the gallery)
-- ---------------------------------------------------------------------
create table if not exists public.gallery_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.gallery_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.gallery_admins where user_id = auth.uid());
$$;

grant execute on function public.gallery_is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
--  Profile (single row: the creator)
-- ---------------------------------------------------------------------
create table if not exists public.gallery_profile (
  id          smallint primary key default 1 check (id = 1),
  name        text not null default 'Your Name',
  headline    text not null default 'Visual creator — photography, film & motion.',
  bio         text not null default '',
  location    text not null default '',
  email       text not null default '',
  avatar_path text,
  links       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

insert into public.gallery_profile (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
--  Categories
-- ---------------------------------------------------------------------
create table if not exists public.gallery_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Posts (a project / pin). Cover fields are maintained by trigger.
-- ---------------------------------------------------------------------
create table if not exists public.gallery_posts (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  description       text not null default '',
  category_id       uuid references public.gallery_categories (id) on delete set null,
  tags              text[] not null default '{}',
  status            text not null default 'draft' check (status in ('draft', 'published')),
  pinned            boolean not null default false,
  views             int not null default 0,
  likes             int not null default 0,
  -- denormalised cover (first media item) for fast feeds
  media_count       int not null default 0,
  cover_kind        text check (cover_kind in ('image', 'video')),
  cover_path        text,
  cover_thumb_path  text,
  cover_duration    numeric,
  cover_width       int,
  cover_height      int,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists gallery_posts_feed_idx
  on public.gallery_posts (status, pinned desc, published_at desc);
create index if not exists gallery_posts_category_idx on public.gallery_posts (category_id);
create index if not exists gallery_posts_tags_idx on public.gallery_posts using gin (tags);

-- ---------------------------------------------------------------------
--  Media (images & videos belonging to a post)
-- ---------------------------------------------------------------------
create table if not exists public.gallery_media (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.gallery_posts (id) on delete cascade,
  kind        text not null check (kind in ('image', 'video')),
  path        text not null,
  poster_path text,
  thumb_path  text,
  mime        text,
  size_bytes  bigint,
  width       int,
  height      int,
  duration    numeric,
  alt         text not null default '',
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists gallery_media_post_idx on public.gallery_media (post_id, position);

-- ---------------------------------------------------------------------
--  Triggers
-- ---------------------------------------------------------------------
create or replace function public.gallery_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists gallery_posts_touch on public.gallery_posts;
create trigger gallery_posts_touch
  before insert or update on public.gallery_posts
  for each row execute function public.gallery_touch_updated_at();

create or replace function public.gallery_refresh_cover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if tg_op = 'DELETE' then
    pid := old.post_id;
  else
    pid := new.post_id;
  end if;

  update public.gallery_posts p set
    media_count       = s.cnt,
    cover_kind        = s.kind,
    cover_path        = s.path,
    cover_thumb_path  = s.thumb_path,
    cover_duration    = s.duration,
    cover_width       = s.width,
    cover_height      = s.height
  from (
    select
      (select count(*) from public.gallery_media where post_id = pid)::int as cnt,
      c.kind, c.path, c.thumb_path, c.duration, c.width, c.height
    from (select 1) d
    left join lateral (
      select m.kind, m.path, m.thumb_path, m.duration, m.width, m.height
      from public.gallery_media m
      where m.post_id = pid
      order by m.position, m.created_at
      limit 1
    ) c on true
  ) s
  where p.id = pid;

  return null;
end;
$$;

drop trigger if exists gallery_media_refresh_cover on public.gallery_media;
create trigger gallery_media_refresh_cover
  after insert or update or delete on public.gallery_media
  for each row execute function public.gallery_refresh_cover();

-- ---------------------------------------------------------------------
--  Public counters (views / appreciations)
-- ---------------------------------------------------------------------
create or replace function public.gallery_track_view(p_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.gallery_posts set views = views + 1
  where id = p_post_id and status = 'published';
$$;

create or replace function public.gallery_like(p_post_id uuid, p_delta int default 1)
returns int
language sql
security definer
set search_path = public
as $$
  update public.gallery_posts
     set likes = greatest(0, likes + case when p_delta >= 0 then 1 else -1 end)
   where id = p_post_id and status = 'published'
  returning likes;
$$;

grant execute on function public.gallery_track_view(uuid) to anon, authenticated;
grant execute on function public.gallery_like(uuid, int) to anon, authenticated;

-- ---------------------------------------------------------------------
--  Row Level Security
-- ---------------------------------------------------------------------
alter table public.gallery_admins     enable row level security;
alter table public.gallery_profile    enable row level security;
alter table public.gallery_categories enable row level security;
alter table public.gallery_posts      enable row level security;
alter table public.gallery_media      enable row level security;

-- admins: a user may only see whether they themselves are an admin
drop policy if exists "gallery_admins self read" on public.gallery_admins;
create policy "gallery_admins self read" on public.gallery_admins
  for select to authenticated using (user_id = auth.uid());

-- profile
drop policy if exists "gallery_profile public read" on public.gallery_profile;
create policy "gallery_profile public read" on public.gallery_profile
  for select using (true);
drop policy if exists "gallery_profile admin write" on public.gallery_profile;
create policy "gallery_profile admin write" on public.gallery_profile
  for update to authenticated using (public.gallery_is_admin()) with check (public.gallery_is_admin());

-- categories
drop policy if exists "gallery_categories public read" on public.gallery_categories;
create policy "gallery_categories public read" on public.gallery_categories
  for select using (true);
drop policy if exists "gallery_categories admin write" on public.gallery_categories;
create policy "gallery_categories admin write" on public.gallery_categories
  for all to authenticated using (public.gallery_is_admin()) with check (public.gallery_is_admin());

-- posts
drop policy if exists "gallery_posts public read" on public.gallery_posts;
create policy "gallery_posts public read" on public.gallery_posts
  for select using (status = 'published' or public.gallery_is_admin());
drop policy if exists "gallery_posts admin write" on public.gallery_posts;
create policy "gallery_posts admin write" on public.gallery_posts
  for all to authenticated using (public.gallery_is_admin()) with check (public.gallery_is_admin());

-- media
drop policy if exists "gallery_media public read" on public.gallery_media;
create policy "gallery_media public read" on public.gallery_media
  for select using (
    public.gallery_is_admin()
    or exists (
      select 1 from public.gallery_posts p
      where p.id = gallery_media.post_id and p.status = 'published'
    )
  );
drop policy if exists "gallery_media admin write" on public.gallery_media;
create policy "gallery_media admin write" on public.gallery_media
  for all to authenticated using (public.gallery_is_admin()) with check (public.gallery_is_admin());

-- ---------------------------------------------------------------------
--  Storage bucket `gallery` (public read, admin write)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

drop policy if exists "gallery bucket public read" on storage.objects;
create policy "gallery bucket public read" on storage.objects
  for select using (bucket_id = 'gallery');

drop policy if exists "gallery bucket admin insert" on storage.objects;
create policy "gallery bucket admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'gallery' and public.gallery_is_admin());

drop policy if exists "gallery bucket admin update" on storage.objects;
create policy "gallery bucket admin update" on storage.objects
  for update to authenticated using (bucket_id = 'gallery' and public.gallery_is_admin());

drop policy if exists "gallery bucket admin delete" on storage.objects;
create policy "gallery bucket admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'gallery' and public.gallery_is_admin());

-- ---------------------------------------------------------------------
--  Make yourself an admin (after creating your user in
--  Authentication → Users → Add user). Replace the email and run:
--
--    insert into public.gallery_admins (user_id)
--    select id from auth.users where email = 'you@example.com'
--    on conflict do nothing;
--
--  Or run:  npm run admin:create -- you@example.com "your-password"
-- ---------------------------------------------------------------------
