# Greek God Coach

A production-quality MVP for a 12-week hybrid physique, strength, conditioning, and half-marathon transformation plan.

The app acts like a coach, not just a tracker. It stores check-ins, body metrics, nutrition logs, workout logs, progress photos, and plan adjustments; compares planned vs actual; and uses deterministic recommendation rules for readiness, macros, workout modifications, progression, injury risk, deloads, and weekly reviews.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Local zero-config persistence via `localStorage`, with Supabase auth/database sync when env vars are configured
- Supabase/Postgres-ready schema under `supabase/migrations`
- Deterministic coaching engine under `src/lib/coach-engine.ts`
- Full 12-week seed program under `src/lib/seed-data.ts`
- Node built-in test runner for engine tests, no extra test dependency required

## Local development

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Verification

```bash
pnpm test
pnpm lint
pnpm build
```

If your local certificate chain blocks package installation, fix your Node/pnpm CA configuration rather than disabling SSL permanently.

## MVP features included

- Onboarding/setup wizard
- Dashboard with current week/phase, workout, macro targets, readiness, trends, adherence, recommendation, and transformation score
- Daily check-in form with sleep, soreness, energy, stress, hunger, motivation, alcohol, steps, RHR, HRV, pain, workout/macros adherence, notes
- Readiness engine: Green / Yellow / Red with action recommendations
- Workout tracker with all 12 weeks seeded, deload weeks, long-run progression, core work, finishers, and exercise logging
- Progression recommendation per exercise using sets/reps/weight/RPE/pain
- Nutrition and macro tracking with adherence percentage
- Weight and waist trend charts with 7-day average logic
- Progress photo records for front/side/back URLs
- Weekly review: average weight, weight change, waist change, training/nutrition adherence, sleep, steps, fatigue, strength/running trend, transformation score, recommendation
- Plan adjustment acceptance/audit log
- Settings and future Apple Health fields

## Coaching engine rules

Important functions:

- `calculateReadiness()`
- `calculateWeightTrend()`
- `calculateAdherence()`
- `recommendMacroAdjustment()`
- `recommendWorkoutAdjustment()`
- `recommendProgression()`
- `generateWeeklyReview()`
- `detectOvertrainingRisk()` can be added later; current weekly fatigue/injury risk covers MVP safety signals
- `detectInjuryRisk()`

The app intentionally does not rely on LLM calls for core safety or training decisions.

## Database and auth persistence

Phase 12 adds Supabase-backed persistence without removing the zero-config `localStorage` path.

Run migrations:

```bash
supabase db push
```

Schema files:

```text
supabase/migrations/001_greek_god_coach.sql
supabase/migrations/002_phase12_persistence.sql
```

Seed file:

```text
supabase/seed.sql
```

Required env vars for Supabase sync:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Optional scan provider env vars from Phase 11:

```bash
GREEK_GOD_SCAN_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_SCAN_MODEL=gpt-4o-mini
```

Fallback behavior:

- If either Supabase public env var is missing, the app stays in `localStorage` mode.
- If Supabase env vars are present but no authenticated user/profile row is available, the app still saves locally.
- If Supabase sync errors, the app catches the failure and preserves the current state in `localStorage`.
- When a signed-in Supabase user has a matching `public.users.auth_user_id`, the app upserts premium records to Supabase and still keeps localStorage as a browser cache.

Storage bucket strategy:

- `progress-photos` for physique progress photos.
- `food-scan-images` for food photo scans.
- `nutrition-label-images` for nutrition label scans.

Private storage paths should start with the Supabase auth user id, e.g. `auth-user-id/yyyy-mm-dd/file.jpg`, so the included storage RLS policy can isolate each user's media.

Phase 12 schema coverage includes:

- workout sessions
- set logs
- meals
- meal items
- hydration logs
- run logs
- food scan history
- daily prescriptions
- coach decision/audit logs
- macro target history
- storage buckets for progress photos, food scans, and nutrition labels

## Safety stance

The coach does not recommend crash dieting, extreme dehydration, ignoring pain, or aggressive load increases under poor recovery. Wearable calorie estimates should be used as trend data, not exact truth. Persistent or severe pain should be evaluated by a qualified professional.
