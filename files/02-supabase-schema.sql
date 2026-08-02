-- ============================================================
-- Food Log — Supabase schema
-- Personal per-user journal: every row is owned by auth.uid(),
-- and RLS guarantees each user sees only their own data.
--
-- Safe to run: uses "if not exists" and does not touch existing
-- mishpacha-meals tables. Review before running on live DB.
-- Intended to be applied as a migration, not pasted into the
-- SQL editor of a production project by hand.
-- ============================================================

-- ---------- 1. Food entries (the daily log) ----------
create table if not exists public.food_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  entry_date   date not null,                     -- the day this belongs to (local date)
  entry_time   text,                              -- "HH:MM", used for meal-timing view
  meal         text not null,                     -- canonical key: breakfast|lunch|dinner|snack
  description  text not null,
  source       text,                              -- manual|photo|favourite
  confidence   text,                              -- low|medium|high (from the estimate)
  calories     numeric not null default 0,
  protein_g    numeric not null default 0,
  carbs_g      numeric not null default 0,
  fat_g        numeric not null default 0,
  fiber_g      numeric not null default 0,
  sodium_mg    numeric not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists food_entries_user_date_idx
  on public.food_entries (user_id, entry_date);

-- ---------- 2. Weight measurements ----------
create table if not exists public.weights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  weigh_date date not null,
  kg         numeric not null,
  created_at timestamptz not null default now(),
  -- one weigh-in per day per user (matches the app's "replace same date" logic)
  unique (user_id, weigh_date)
);

create index if not exists weights_user_date_idx
  on public.weights (user_id, weigh_date);

-- ---------- 3. Favourites (quick-add foods) ----------
create table if not exists public.food_favourites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  description text not null,
  meal        text,
  calories    numeric not null default 0,
  protein_g   numeric not null default 0,
  carbs_g     numeric not null default 0,
  fat_g       numeric not null default 0,
  fiber_g     numeric not null default 0,
  sodium_mg   numeric not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists favourites_user_idx
  on public.food_favourites (user_id);

-- ---------- 4. Config (targets + plan rules + language + font) ----------
-- One row per user. Stored as jsonb so it maps 1:1 to the app's
-- combined { settings, plan } object — the single-key design that
-- replaced the rate-limited multi-write approach.
create table if not exists public.food_config (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  config     jsonb not null default '{}'::jsonb,
  lang       text  not null default 'he',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Row-Level Security — the core of "each user sees only their own"
-- ============================================================

alter table public.food_entries    enable row level security;
alter table public.weights         enable row level security;
alter table public.food_favourites enable row level security;
alter table public.food_config     enable row level security;

-- food_entries policies
drop policy if exists "own food_entries select" on public.food_entries;
create policy "own food_entries select" on public.food_entries
  for select using (auth.uid() = user_id);
drop policy if exists "own food_entries insert" on public.food_entries;
create policy "own food_entries insert" on public.food_entries
  for insert with check (auth.uid() = user_id);
drop policy if exists "own food_entries update" on public.food_entries;
create policy "own food_entries update" on public.food_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own food_entries delete" on public.food_entries;
create policy "own food_entries delete" on public.food_entries
  for delete using (auth.uid() = user_id);

-- weights policies
drop policy if exists "own weights select" on public.weights;
create policy "own weights select" on public.weights
  for select using (auth.uid() = user_id);
drop policy if exists "own weights insert" on public.weights;
create policy "own weights insert" on public.weights
  for insert with check (auth.uid() = user_id);
drop policy if exists "own weights update" on public.weights;
create policy "own weights update" on public.weights
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own weights delete" on public.weights;
create policy "own weights delete" on public.weights
  for delete using (auth.uid() = user_id);

-- favourites policies
drop policy if exists "own favourites select" on public.food_favourites;
create policy "own favourites select" on public.food_favourites
  for select using (auth.uid() = user_id);
drop policy if exists "own favourites insert" on public.food_favourites;
create policy "own favourites insert" on public.food_favourites
  for insert with check (auth.uid() = user_id);
drop policy if exists "own favourites delete" on public.food_favourites;
create policy "own favourites delete" on public.food_favourites
  for delete using (auth.uid() = user_id);

-- config policies
drop policy if exists "own config select" on public.food_config;
create policy "own config select" on public.food_config
  for select using (auth.uid() = user_id);
drop policy if exists "own config upsert" on public.food_config;
create policy "own config upsert" on public.food_config
  for insert with check (auth.uid() = user_id);
drop policy if exists "own config update" on public.food_config;
create policy "own config update" on public.food_config
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Mapping note for Claude Code:
--   window.storage 'log:YYYY-MM-DD'  -> food_entries rows where entry_date = that date
--   window.storage 'weights'         -> weights rows
--   window.storage 'favourites'      -> food_favourites rows
--   window.storage 'config'          -> food_config.config (jsonb, single row upsert)
--   window.storage 'lang'            -> food_config.lang
-- The app's dayTotals / weekly aggregation / EWMA logic stays unchanged;
-- it just receives rows from Supabase instead of parsed JSON blobs.
-- ============================================================
