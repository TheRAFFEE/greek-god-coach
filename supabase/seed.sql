-- Minimal demo seed. Full 12-week program is generated in src/lib/seed-data.ts and can be inserted via a Supabase script later.
insert into public.users (id, name, age, sex, height, starting_weight, goal_weight, activity_level, goal, training_experience, equipment, injury_history, preferred_units)
values ('00000000-0000-0000-0000-000000000001', 'Walter', 39, 'male', '5''11"', 212, 196, 'Hybrid strength + running', 'Greek-god athletic recomposition with half-marathon endurance', 'Experienced natural lifter', 'Full gym, treadmill, bike/rower, kettlebells', 'Modify around pain immediately', 'imperial')
on conflict (id) do nothing;

insert into public.macro_targets (user_id, week, calories, protein, protein_max, carbs, fat, fiber, water)
select '00000000-0000-0000-0000-000000000001', week, calories, protein, protein_max, carbs, fat, 30, 120
from (values
  (1,2550,220,230,210,70),(2,2550,220,230,210,70),(3,2550,220,230,210,70),(4,2550,220,230,210,70),
  (5,2450,220,230,180,70),(6,2450,220,230,180,70),(7,2450,220,230,180,70),(8,2450,220,230,180,70),
  (9,2350,215,230,160,65),(10,2350,215,230,160,65),(11,2350,215,230,160,65),(12,2400,215,230,170,65)
) as t(week, calories, protein, protein_max, carbs, fat)
on conflict (user_id, week) do nothing;
