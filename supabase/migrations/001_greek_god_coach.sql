-- Greek God Coach production schema for Supabase/Postgres.
-- The MVP UI currently persists to localStorage for zero-config local use; these tables match the app domain model for Supabase wiring.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  name text not null,
  age integer not null,
  sex text not null,
  height text,
  starting_weight numeric,
  goal_weight numeric,
  activity_level text,
  goal text,
  training_experience text,
  strength_numbers text,
  equipment text,
  injury_history text,
  preferred_units text default 'imperial',
  created_at timestamptz not null default now()
);

create table if not exists public.daily_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  weight numeric,
  sleep_hours numeric,
  sleep_quality integer check (sleep_quality between 1 and 10),
  soreness integer check (soreness between 1 and 10),
  energy integer check (energy between 1 and 10),
  stress integer check (stress between 1 and 10),
  hunger integer check (hunger between 1 and 10),
  motivation integer check (motivation between 1 and 10),
  alcohol boolean default false,
  steps integer,
  resting_hr integer,
  hrv numeric,
  active_calories integer,
  sleep_stages jsonb,
  vo2_max numeric,
  workout_hr_zones jsonb,
  running_pace text,
  recovery_hr integer,
  cardio_fitness_trend text,
  pain boolean default false,
  pain_location text,
  pain_severity integer check (pain_severity between 0 and 10),
  workout_completed boolean default false,
  macros_hit boolean default false,
  notes text,
  unique(user_id, date)
);

create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  weight numeric,
  waist numeric,
  chest numeric,
  arms numeric,
  thighs numeric,
  hips numeric,
  notes text,
  unique(user_id, date)
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  front_photo_url text,
  side_photo_url text,
  back_photo_url text,
  notes text
);

create table if not exists public.macro_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  week integer not null check (week between 1 and 12),
  calories integer not null,
  protein integer not null,
  protein_max integer,
  carbs integer not null,
  fat integer not null,
  fiber integer,
  water integer,
  unique(user_id, week)
);

create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  calories integer,
  protein integer,
  carbs integer,
  fat integer,
  fiber integer,
  sodium integer,
  water integer,
  alcohol numeric default 0,
  notes text,
  unique(user_id, date)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  week integer not null check (week between 1 and 12),
  phase text not null,
  day text not null,
  day_index integer not null,
  title text not null,
  type text not null,
  notes text,
  finisher text,
  deload boolean default false,
  long_run_miles numeric
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  name text not null,
  prescribed_sets integer,
  prescribed_reps text,
  prescribed_weight numeric,
  prescribed_rpe numeric,
  category text,
  "order" integer
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  date date not null,
  sets_completed integer,
  reps_completed integer,
  weight_used numeric,
  rpe numeric,
  rest_time integer,
  pain boolean default false,
  notes text
);

create table if not exists public.readiness_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  score integer not null,
  status text not null check (status in ('Green','Yellow','Red')),
  reason text,
  recommendation text,
  unique(user_id, date)
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  week integer not null,
  avg_weight numeric,
  weight_change numeric,
  waist_change numeric,
  training_adherence numeric,
  nutrition_adherence numeric,
  avg_sleep numeric,
  avg_steps numeric,
  resting_hr_trend text,
  hrv_trend text,
  fatigue_score numeric,
  strength_trend text,
  running_trend text,
  transformation_score integer,
  recommendation text,
  unique(user_id, week)
);

create table if not exists public.plan_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  adjustment_type text not null,
  reason text,
  previous_value text,
  new_value text,
  notes text
);

alter table public.users enable row level security;
alter table public.daily_check_ins enable row level security;
alter table public.body_metrics enable row level security;
alter table public.progress_photos enable row level security;
alter table public.macro_targets enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.readiness_scores enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.plan_adjustments enable row level security;

-- Suggested RLS when auth is wired:
-- create policy "own user row" on public.users for all using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);
-- Repeat owner policies for child tables through user_id.
