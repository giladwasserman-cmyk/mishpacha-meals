-- ============================================================
-- Food Log — בנק רכיבים
--
-- רכיב הוא אבן בניין: "ביצה", "חלבון ביצה", "פרוסת לחם".
-- הערכים נשמרים ליחידה אחת, וההרכבה היא כפל וחיבור בצד הלקוח —
-- כלומר אחרי שרכיב הוערך פעם אחת, השימוש בו לא עולה קריאת API
-- ולא משתנה בין פעם לפעם.
--
-- משלים את food_favourites ולא מחליף אותו: מועדף הוא רשומה
-- שלמה בלחיצה אחת, רכיב הוא חלק שמרכיבים ממנו.
--
-- בטוח להרצה: create table if not exists, לא נוגע בטבלאות קיימות.
-- ============================================================

create table if not exists public.food_components (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  unit       text,                          -- "יחידה" | "פרוסה" | "100 גרם" | "כף"
  -- כל הערכים הם ליחידה אחת
  calories   numeric not null default 0,
  protein_g  numeric not null default 0,
  carbs_g    numeric not null default 0,
  fat_g      numeric not null default 0,
  fiber_g    numeric not null default 0,
  sodium_mg  numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists food_components_user_idx
  on public.food_components (user_id, sort_order, name);

alter table public.food_components enable row level security;

drop policy if exists "own components select" on public.food_components;
create policy "own components select" on public.food_components
  for select using (auth.uid() = user_id);
drop policy if exists "own components insert" on public.food_components;
create policy "own components insert" on public.food_components
  for insert with check (auth.uid() = user_id);
drop policy if exists "own components update" on public.food_components;
create policy "own components update" on public.food_components
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own components delete" on public.food_components;
create policy "own components delete" on public.food_components
  for delete using (auth.uid() = user_id);
