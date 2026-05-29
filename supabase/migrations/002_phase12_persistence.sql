-- Phase 12: Supabase-backed persistence for premium coach data.
-- Keeps the original localStorage app IDs as text primary keys on new tables
-- while linking rows to authenticated Supabase users through public.users.

create extension if not exists "pgcrypto";

-- Phase 9 audit-log fields on the existing adjustment table.
alter table public.plan_adjustments add column if not exists local_id text unique;
alter table public.plan_adjustments add column if not exists category text;
alter table public.plan_adjustments add column if not exists original_prescription text;
alter table public.plan_adjustments add column if not exists adjusted_prescription text;
alter table public.plan_adjustments add column if not exists trigger_data jsonb;
alter table public.plan_adjustments add column if not exists confidence text;
alter table public.plan_adjustments add column if not exists mode text;
alter table public.plan_adjustments add column if not exists explanation jsonb;
alter table public.plan_adjustments add column if not exists created_at timestamptz not null default now();

-- Macro target history separates seeded/current targets from user-visible changes over time.
create table if not exists public.macro_target_history (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  week integer,
  calories integer not null,
  protein integer not null,
  protein_max integer,
  carbs integer not null,
  fat integer not null,
  fiber integer,
  water integer,
  source text not null default 'app_state',
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  workout_id text not null,
  workout_title text not null,
  mode text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null,
  current_exercise_index integer not null default 0,
  current_set_number integer not null default 1,
  coach_decisions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.set_logs (
  id text primary key,
  session_id text references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  workout_id text not null,
  exercise_id text not null,
  exercise_name text not null,
  set_number integer not null,
  target_reps text not null,
  target_rpe numeric,
  weight_used numeric,
  reps_completed integer,
  rpe numeric,
  pain boolean default false,
  form_quality text,
  completed_at timestamptz not null,
  coach_decision jsonb,
  notes text
);

create table if not exists public.meals (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  category text not null,
  name text,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  fiber numeric default 0,
  sodium numeric default 0,
  water numeric default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_items (
  id text primary key,
  meal_id text not null references public.meals(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  fiber numeric default 0,
  sodium numeric default 0,
  water numeric default 0,
  notes text
);

-- First-class hydration events can complement daily nutrition_logs.water totals.
create table if not exists public.hydration_logs (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  amount_oz numeric not null,
  source text default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.run_logs (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  planned_distance numeric,
  actual_distance numeric,
  duration_minutes numeric,
  average_pace numeric,
  average_hr numeric,
  max_hr numeric,
  rpe numeric,
  zone2_compliance numeric,
  completed boolean default false,
  pain boolean default false,
  pain_location text,
  notes text
);

create table if not exists public.food_scan_logs (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  date timestamptz not null,
  mode text not null,
  image_name text,
  image_path text,
  image_preview_url text,
  selected_meal_id text references public.meals(id) on delete set null,
  result jsonb not null,
  status text not null,
  provider text not null,
  is_mock boolean default false,
  notes text
);

create table if not exists public.daily_prescriptions (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  readiness_status text not null,
  readiness_score integer not null,
  training_decision text not null,
  exact_workout_recommendation text,
  workout_modifications jsonb,
  cardio_recommendation text,
  nutrition_target text,
  water_target text,
  steps_target text,
  recovery_tasks jsonb,
  warnings jsonb,
  explanation jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

create table if not exists public.coach_decision_logs (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  date timestamptz not null,
  category text not null,
  original_prescription text,
  adjusted_prescription text,
  reason text,
  trigger_data jsonb,
  confidence text,
  mode text,
  explanation jsonb,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.macro_target_history enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.hydration_logs enable row level security;
alter table public.run_logs enable row level security;
alter table public.food_scan_logs enable row level security;
alter table public.daily_prescriptions enable row level security;
alter table public.coach_decision_logs enable row level security;

-- Storage buckets. Public=false keeps private user media gated by signed URLs/policies.
insert into storage.buckets (id, name, public)
values
  ('progress-photos', 'progress-photos', false),
  ('food-scan-images', 'food-scan-images', false),
  ('nutrition-label-images', 'nutrition-label-images', false)
on conflict (id) do nothing;

-- Owner RLS policies. public.users.auth_user_id maps auth.uid() to the app profile row.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'macro_target_history','workout_sessions','set_logs','meals','meal_items','hydration_logs','run_logs','food_scan_logs','daily_prescriptions','coach_decision_logs'
  ] loop
    execute format('drop policy if exists own_rows on public.%I', table_name);
    execute format($policy$
      create policy own_rows on public.%I
      for all
      using (exists (select 1 from public.users u where u.id = user_id and u.auth_user_id = auth.uid()))
      with check (exists (select 1 from public.users u where u.id = user_id and u.auth_user_id = auth.uid()))
    $policy$, table_name);
  end loop;
end $$;

drop policy if exists own_user_row on public.users;
create policy own_user_row on public.users
for all
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists own_progress_photo_objects on storage.objects;
create policy own_progress_photo_objects on storage.objects
for all
using (bucket_id in ('progress-photos','food-scan-images','nutrition-label-images') and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id in ('progress-photos','food-scan-images','nutrition-label-images') and auth.uid()::text = (storage.foldername(name))[1]);
