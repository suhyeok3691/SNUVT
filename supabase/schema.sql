-- SNUVT — Supabase 데이터베이스 구조 (2026-10-25 실제 DB 에서 뽑음)
--
-- 이 파일은 "지금 DB 가 어떻게 생겼는지" 의 기준이에요. 표·제약·함수·정책·트리거·예약 작업을 모두 담았어요.
-- 각 표가 무슨 일을 하는지, 누가 읽고 쓰는지는 README.md 의 '데이터' 를 보세요.
-- 바뀐 기록은 git 기록과 Supabase 마이그레이션 목록에 있어요.
--
-- DB 를 바꾸면: 마이그레이션으로 적용 → 이 파일의 해당 부분도 같이 고치기.
-- 비밀값(알림 키·x-cron)은 vault 에만 있고 여기에는 없어요. 처음 만드는 DB 라면 vault 에 'push_cron' 을 넣고
-- edge function push 를 kind 'init' 으로 한 번 부르면 알림 키가 만들어져요.

create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;
create schema if not exists private;
set check_function_bodies = off;  -- 표가 아직 없어도 함수를 먼저 만들 수 있게
grant usage on schema private to anon, authenticated;
-- ========== 1. 순서상 먼저 필요한 함수 ==========
CREATE OR REPLACE FUNCTION private.my_team()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select team_id from public.profiles where id = auth.uid()
$function$;

-- ========== 2. 표 ==========
create sequence public.jp_matches_id_seq;
create sequence public.jp_results_id_seq;

create table public.teams (
  id text not null,
  name text not null,
  label text not null,
  net_cm integer default 243 not null,
  swap_days boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint teams_pkey PRIMARY KEY (id)
);

create table public.players (
  id uuid default gen_random_uuid() not null,
  name text not null,
  pos text not null,
  year text,
  height numeric,
  weight numeric,
  exp numeric,
  weight_exp text,
  adjust jsonb default '{}'::jsonb not null,
  sort integer default 99 not null,
  created_at timestamp with time zone default now() not null,
  title text,
  titles text[] default '{}'::text[] not null,
  number integer,
  media boolean default false not null,
  alumni boolean default false not null,
  left_on date,
  military boolean default false not null,
  team_id text default private.my_team() not null,
  constraint players_pkey PRIMARY KEY (id),
  constraint players_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint players_number_check CHECK (((number >= 0) AND (number <= 99))),
  constraint players_pos_check CHECK ((pos = ANY (ARRAY['OH'::text, 'MB'::text, 'OP'::text, 'S'::text, 'Li'::text]))),
  constraint players_titles_check CHECK ((titles <@ ARRAY['admin'::text, 'captain'::text, 'vice'::text, 'ops'::text, 'treasurer'::text, 'trainer'::text, 'analyst'::text, 'media'::text])),
  constraint players_title_check CHECK ((title = ANY (ARRAY['admin'::text, 'captain'::text, 'vice'::text, 'ops'::text, 'treasurer'::text, 'trainer'::text, 'analyst'::text]))),
  constraint players_weight_exp_check CHECK ((weight_exp = ANY (ARRAY['none'::text, 'machine'::text, 'free'::text, 'oly'::text])))
);

create table public.profiles (
  id uuid not null,
  email text,
  role text default 'pending'::text not null,
  player_id uuid,
  created_at timestamp with time zone default now() not null,
  team_id text default 'men'::text not null,
  super boolean default false not null,
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint profiles_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
  constraint profiles_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint profiles_role_check CHECK ((role = ANY (ARRAY['pending'::text, 'player'::text, 'coach'::text])))
);

create table public.jp_sources (
  id text not null,
  kind text not null,
  ref text not null,
  label text not null,
  role text default 'match'::text not null,
  cursor text,
  full_done boolean default false not null,
  synced_at timestamp with time zone,
  constraint jp_sources_pkey PRIMARY KEY (id),
  constraint jp_sources_kind_check CHECK ((kind = ANY (ARRAY['channel'::text, 'playlist'::text, 'search'::text]))),
  constraint jp_sources_role_check CHECK ((role = ANY (ARRAY['match'::text, 'visit'::text])))
);

create table public.jp_schools (
  id text not null,
  name_ja text not null,
  name_ko text not null,
  pref text not null,
  gender text default 'm'::text not null,
  aliases text[] default '{}'::text[] not null,
  note text,
  searched_at timestamp with time zone,
  constraint jp_schools_pkey PRIMARY KEY (id),
  constraint jp_schools_gender_check CHECK ((gender = ANY (ARRAY['m'::text, 'w'::text, 'mw'::text])))
);

create table public.absences (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  date date not null,
  reason text not null,
  note text,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  constraint absences_player_id_date_key UNIQUE (player_id, date),
  constraint absences_pkey PRIMARY KEY (id),
  constraint absences_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint absences_note_check CHECK ((char_length(note) <= 100)),
  constraint absences_reason_check CHECK ((reason = ANY (ARRAY['class'::text, 'sick'::text, 'personal'::text, 'etc'::text])))
);

create table public.day_picks (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  date date not null,
  pick text not null,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  constraint day_picks_player_id_date_key UNIQUE (player_id, date),
  constraint day_picks_pkey PRIMARY KEY (id),
  constraint day_picks_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint day_picks_pick_check CHECK ((pick = ANY (ARRAY['lower'::text, 'upper'::text, 'core'::text, 'recover'::text])))
);

create table public.entries (
  id uuid default gen_random_uuid() not null,
  kind text not null,
  ref_id uuid not null,
  player_id uuid not null,
  created_at timestamp with time zone default now() not null,
  starter boolean default false not null,
  constraint entries_kind_ref_id_player_id_key UNIQUE (kind, ref_id, player_id),
  constraint entries_pkey PRIMARY KEY (id),
  constraint entries_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint entries_kind_check CHECK ((kind = ANY (ARRAY['event'::text, 'friendly'::text])))
);

create table public.event_votes (
  kind text not null,
  ref_id uuid not null,
  player_id uuid not null,
  going boolean not null,
  reason text,
  note text,
  updated_at timestamp with time zone default now() not null,
  constraint event_votes_pkey PRIMARY KEY (kind, ref_id, player_id),
  constraint event_votes_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint event_votes_kind_check CHECK ((kind = ANY (ARRAY['event'::text, 'friendly'::text]))),
  constraint event_votes_note_check CHECK (((note IS NULL) OR (length(note) <= 200))),
  constraint event_votes_reason_check CHECK (((reason IS NULL) OR (reason = ANY (ARRAY['class'::text, 'sick'::text, 'personal'::text, 'etc'::text]))))
);

create table public.events (
  id uuid default gen_random_uuid() not null,
  name text not null,
  kind text not null,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamp with time zone default now() not null,
  team_id text default private.my_team() not null,
  format text,
  constraint events_pkey PRIMARY KEY (id),
  constraint events_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint events_check CHECK ((end_date >= start_date)),
  constraint events_format_check CHECK (((format IS NULL) OR (format = ANY (ARRAY['6'::text, '9'::text])))),
  constraint events_kind_check CHECK ((kind = ANY (ARRAY['major'::text, 'minor'::text, 'tryout'::text, 'off'::text, 'termend'::text]))),
  constraint events_name_check CHECK (((length(name) >= 1) AND (length(name) <= 40)))
);

create table public.friendlies (
  id uuid default gen_random_uuid() not null,
  date date not null,
  start_time time without time zone,
  end_time time without time zone,
  opponent text not null,
  format text default '6'::text not null,
  place text,
  note text,
  created_at timestamp with time zone default now() not null,
  team_id text default private.my_team() not null,
  constraint friendlies_pkey PRIMARY KEY (id),
  constraint friendlies_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint friendlies_format_check CHECK ((format = ANY (ARRAY['6'::text, '9'::text]))),
  constraint friendlies_note_check CHECK ((char_length(note) <= 200)),
  constraint friendlies_opponent_check CHECK (((char_length(opponent) >= 1) AND (char_length(opponent) <= 60))),
  constraint friendlies_place_check CHECK ((char_length(place) <= 60))
);

create table public.health (
  player_id uuid not null,
  ankle_l integer default 0 not null,
  ankle_r integer default 0 not null,
  ankle_last text,
  knee_injury boolean default false not null,
  pain jsonb default '{}'::jsonb not null,
  note text,
  consent boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  rehab jsonb default '[]'::jsonb not null,
  injuries jsonb default '[]'::jsonb not null,
  custom jsonb default '{}'::jsonb not null,
  constraint health_pkey PRIMARY KEY (player_id),
  constraint health_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

create table public.jp_matches (
  id bigint default nextval('jp_matches_id_seq'::regclass) not null,
  tourn text not null,
  gender text not null,
  year smallint not null,
  rnd text not null,
  a_name text not null,
  a_pref text,
  b_name text not null,
  b_pref text,
  a_sets smallint,
  b_sets smallint,
  src text,
  constraint jp_matches_pkey PRIMARY KEY (id),
  constraint jp_matches_gender_check CHECK ((gender = ANY (ARRAY['m'::text, 'w'::text]))),
  constraint jp_matches_tourn_check CHECK ((tourn = ANY (ARRAY['haruko'::text, 'ih'::text, 'kokutai'::text, 'sakura'::text])))
);

create table public.lift_sets (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  date date not null,
  name text not null,
  lift text,
  kg numeric not null,
  reps smallint not null,
  rir smallint not null,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  constraint lift_sets_pkey PRIMARY KEY (id),
  constraint lift_sets_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint lift_sets_kg_check CHECK (((kg > (0)::numeric) AND (kg <= (400)::numeric))),
  constraint lift_sets_lift_check CHECK (((lift IS NULL) OR (lift = ANY (ARRAY['squat'::text, 'rdl'::text, 'bench'::text, 'hip'::text, 'clean'::text])))),
  constraint lift_sets_name_check CHECK (((length(name) >= 1) AND (length(name) <= 80))),
  constraint lift_sets_reps_check CHECK (((reps >= 1) AND (reps <= 20))),
  constraint lift_sets_rir_check CHECK (((rir >= 0) AND (rir <= 6)))
);

create table public.lineups (
  team_id text default private.my_team() not null,
  kind text not null,
  ref_id uuid not null,
  set_no smallint default 1 not null,
  data jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  constraint lineups_pkey PRIMARY KEY (team_id, kind, ref_id, set_no),
  constraint lineups_kind_check CHECK ((kind = ANY (ARRAY['event'::text, 'friendly'::text]))),
  constraint lineups_set_no_check CHECK (((set_no >= 1) AND (set_no <= 5)))
);

create table public.logs (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  author uuid default auth.uid(),
  date date not null,
  type text not null,
  minutes integer not null,
  rpe integer not null,
  jumps integer,
  pain_area text,
  pain integer default 0 not null,
  note text,
  created_at timestamp with time zone default now() not null,
  completion text,
  constraint logs_pkey PRIMARY KEY (id),
  constraint logs_author_fkey FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint logs_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint logs_completion_check CHECK (((completion IS NULL) OR (completion = ANY (ARRAY['all'::text, 'most'::text, 'part'::text, 'little'::text, 'none'::text])))),
  constraint logs_jumps_check CHECK (((jumps >= 0) AND (jumps <= 2000))),
  constraint logs_minutes_check CHECK (((minutes >= 1) AND (minutes <= 400))),
  constraint logs_pain_area_check CHECK ((pain_area = ANY (ARRAY['knee'::text, 'shoulder'::text, 'ankle'::text, 'back'::text, 'wrist'::text, 'finger'::text]))),
  constraint logs_pain_check CHECK (((pain >= 0) AND (pain <= 10))),
  constraint logs_rpe_check CHECK (((rpe >= 0) AND (rpe <= 10))),
  constraint logs_type_check CHECK ((type = ANY (ARRAY['A'::text, 'B'::text, 'team'::text, 'act'::text, 'match'::text, 'other'::text])))
);

create table public.notices (
  id uuid default gen_random_uuid() not null,
  title text not null,
  body text,
  pinned boolean default false not null,
  notify boolean default true not null,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  team_id text default private.my_team() not null,
  constraint notices_pkey PRIMARY KEY (id),
  constraint notices_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint notices_body_check CHECK ((char_length(body) <= 2000)),
  constraint notices_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)))
);

create table public.open_sessions (
  id uuid default gen_random_uuid() not null,
  date date not null,
  start_time text,
  end_time text,
  place text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  team_id text default private.my_team() not null,
  constraint open_sessions_pkey PRIMARY KEY (id),
  constraint open_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint open_sessions_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id)
);

create table public.pain_checks (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  date date default CURRENT_DATE not null,
  area text not null,
  during integer,
  morning integer,
  rest boolean default false not null,
  note text,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  constraint pain_checks_pkey PRIMARY KEY (id),
  constraint pain_checks_author_fkey FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint pain_checks_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint pain_checks_area_check CHECK ((area = ANY (ARRAY['knee'::text, 'shoulder'::text, 'ankle'::text, 'back'::text, 'wrist'::text, 'finger'::text]))),
  constraint pain_checks_during_check CHECK (((during >= 0) AND (during <= 10))),
  constraint pain_checks_morning_check CHECK (((morning >= 0) AND (morning <= 10)))
);

create table public.player_contacts (
  player_id uuid not null,
  phone text,
  updated_at timestamp with time zone default now() not null,
  constraint player_contacts_pkey PRIMARY KEY (player_id),
  constraint player_contacts_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint player_contacts_phone_check CHECK ((phone ~ '^[0-9+ -]{7,20}$'::text))
);

create table public.player_private (
  player_id uuid not null,
  height numeric,
  weight numeric,
  updated_at timestamp with time zone default now() not null,
  constraint player_private_pkey PRIMARY KEY (player_id),
  constraint player_private_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED, -- 새 선수 행 BEFORE 트리거가 먼저 씀
  constraint player_private_height_check CHECK (((height >= (140)::numeric) AND (height <= (220)::numeric))),
  constraint player_private_weight_check CHECK (((weight >= (40)::numeric) AND (weight <= (150)::numeric)))
);

create table public.practice_plans (
  date date not null,
  title text,
  goal text,
  blocks jsonb default '[]'::jsonb not null,
  published boolean default true not null,
  author uuid default auth.uid(),
  updated_at timestamp with time zone default now() not null,
  team_id text default private.my_team() not null,
  constraint practice_plans_pkey PRIMARY KEY (team_id, date),
  constraint practice_plans_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint practice_plans_blocks_check CHECK (((jsonb_typeof(blocks) = 'array'::text) AND (length((blocks)::text) < 20000))),
  constraint practice_plans_goal_check CHECK ((char_length(goal) <= 200)),
  constraint practice_plans_title_check CHECK ((char_length(title) <= 60))
);

create table public.practice_times (
  key text not null,
  start_time time without time zone not null,
  end_time time without time zone,
  note text,
  created_at timestamp with time zone default now() not null,
  team_id text default private.my_team() not null,
  constraint practice_times_pkey PRIMARY KEY (team_id, key),
  constraint practice_times_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint practice_times_key_check CHECK (((key = ANY (ARRAY['S1'::text, 'S2'::text])) OR (key ~ '^\d{4}-\d{2}-\d{2}$'::text))),
  constraint practice_times_note_check CHECK ((char_length(note) <= 60))
);

create table public.program_edits (
  id uuid default gen_random_uuid() not null,
  player_id uuid,
  slot text not null,
  block text not null,
  op text not null,
  name text not null,
  rx text,
  cue text,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  team_id text default private.my_team() not null,
  constraint program_edits_pkey PRIMARY KEY (id),
  constraint program_edits_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint program_edits_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint program_edits_block_check CHECK (((char_length(block) >= 1) AND (char_length(block) <= 30))),
  constraint program_edits_cue_check CHECK ((char_length(cue) <= 100)),
  constraint program_edits_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80))),
  constraint program_edits_op_check CHECK ((op = ANY (ARRAY['add'::text, 'remove'::text]))),
  constraint program_edits_rx_check CHECK ((char_length(rx) <= 40)),
  constraint program_edits_slot_check CHECK ((slot = ANY (ARRAY['gymA'::text, 'gymB'::text, 'bwU'::text, 'bwL'::text, 'act'::text, 'team'::text, 'recover'::text, 'prep'::text])))
);

create table public.push_subs (
  endpoint text not null,
  user_id uuid default auth.uid() not null,
  player_id uuid,
  p256dh text not null,
  auth text not null,
  morning boolean default true not null,
  evening boolean default true not null,
  train_days date[] default '{}'::date[] not null,
  updated_at timestamp with time zone default now() not null,
  notice boolean default true not null,
  morning_at smallint default 8 not null,
  evening_at smallint default 22 not null,
  constraint push_subs_pkey PRIMARY KEY (endpoint),
  constraint push_subs_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint push_subs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint push_subs_evening_at_check CHECK (((evening_at >= 0) AND (evening_at <= 23))),
  constraint push_subs_morning_at_check CHECK (((morning_at >= 0) AND (morning_at <= 23)))
);

create table public.scout_matches (
  id uuid default gen_random_uuid() not null,
  team_id text default private.my_team() not null,
  title text not null,
  date date,
  opponent text,
  yt text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  constraint scout_matches_pkey PRIMARY KEY (id),
  constraint scout_matches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint scout_matches_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint scout_matches_note_check CHECK (((note IS NULL) OR (length(note) <= 300))),
  constraint scout_matches_opponent_check CHECK (((opponent IS NULL) OR (length(opponent) <= 60))),
  constraint scout_matches_title_check CHECK (((length(title) >= 1) AND (length(title) <= 80))),
  constraint scout_matches_yt_check CHECK (((yt IS NULL) OR (length(yt) <= 200)))
);

create table public.team_off (
  date date not null,
  note text,
  created_at timestamp with time zone default now() not null,
  team_id text default private.my_team() not null,
  constraint team_off_pkey PRIMARY KEY (team_id, date),
  constraint team_off_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint team_off_note_check CHECK (((note IS NULL) OR (length(note) <= 60)))
);

create table public.tests (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  date date not null,
  reach numeric,
  cmj numeric,
  block numeric,
  approach numeric,
  bal_l boolean,
  bal_r boolean,
  hs_stage integer,
  hs_sec integer,
  squat numeric,
  rdl numeric,
  pull integer,
  created_at timestamp with time zone default now() not null,
  side_l integer,
  side_r integer,
  sorensen integer,
  flexor integer,
  author uuid default auth.uid(),
  plank integer,
  hs_walk numeric,
  vert numeric,
  max_vert numeric,
  rsi numeric,
  ktw_l numeric,
  ktw_r numeric,
  ir_d numeric,
  ir_n numeric,
  er_d numeric,
  er_n numeric,
  hop_l numeric,
  hop_r numeric,
  side_step integer,
  pro_agility numeric,
  constraint tests_pkey PRIMARY KEY (id),
  constraint tests_author_fkey FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint tests_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint tests_er_d_check CHECK (((er_d >= (0)::numeric) AND (er_d <= (160)::numeric))),
  constraint tests_er_n_check CHECK (((er_n >= (0)::numeric) AND (er_n <= (160)::numeric))),
  constraint tests_flexor_check CHECK (((flexor >= 0) AND (flexor <= 900))),
  constraint tests_hop_l_check CHECK (((hop_l >= (0)::numeric) AND (hop_l <= (400)::numeric))),
  constraint tests_hop_r_check CHECK (((hop_r >= (0)::numeric) AND (hop_r <= (400)::numeric))),
  constraint tests_hs_stage_check CHECK (((hs_stage >= 1) AND (hs_stage <= 5))),
  constraint tests_hs_walk_check CHECK (((hs_walk >= (0)::numeric) AND (hs_walk <= (100)::numeric))),
  constraint tests_ir_d_check CHECK (((ir_d >= (0)::numeric) AND (ir_d <= (120)::numeric))),
  constraint tests_ir_n_check CHECK (((ir_n >= (0)::numeric) AND (ir_n <= (120)::numeric))),
  constraint tests_ktw_l_check CHECK (((ktw_l >= (0)::numeric) AND (ktw_l <= (30)::numeric))),
  constraint tests_ktw_r_check CHECK (((ktw_r >= (0)::numeric) AND (ktw_r <= (30)::numeric))),
  constraint tests_max_vert_check CHECK (((max_vert >= (0)::numeric) AND (max_vert <= (150)::numeric))),
  constraint tests_plank_check CHECK (((plank >= 0) AND (plank <= 900))),
  constraint tests_pro_agility_check CHECK (((pro_agility >= (3)::numeric) AND (pro_agility <= (15)::numeric))),
  constraint tests_rsi_check CHECK (((rsi >= (0)::numeric) AND (rsi <= (5)::numeric))),
  constraint tests_side_l_check CHECK (((side_l >= 0) AND (side_l <= 600))),
  constraint tests_side_r_check CHECK (((side_r >= 0) AND (side_r <= 600))),
  constraint tests_side_step_check CHECK (((side_step >= 0) AND (side_step <= 120))),
  constraint tests_sorensen_check CHECK (((sorensen >= 0) AND (sorensen <= 600))),
  constraint tests_vert_check CHECK (((vert >= (0)::numeric) AND (vert <= (150)::numeric)))
);

create table public.training_notes (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  date date not null,
  good text,
  fix text,
  next text,
  body text,
  shared boolean default false not null,
  author uuid default auth.uid(),
  updated_at timestamp with time zone default now() not null,
  constraint training_notes_player_id_date_key UNIQUE (player_id, date),
  constraint training_notes_pkey PRIMARY KEY (id),
  constraint training_notes_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint training_notes_body_check CHECK ((char_length(body) <= 2000)),
  constraint training_notes_fix_check CHECK ((char_length(fix) <= 500)),
  constraint training_notes_good_check CHECK ((char_length(good) <= 500)),
  constraint training_notes_next_check CHECK ((char_length(next) <= 300))
);

create table public.videos (
  id uuid default gen_random_uuid() not null,
  kind text default 'playlist'::text not null,
  category text default 'practice'::text not null,
  title text not null,
  yt text not null,
  date date,
  note text,
  sort integer default 0 not null,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  team_id text default private.my_team() not null,
  constraint videos_pkey PRIMARY KEY (id),
  constraint videos_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id),
  constraint videos_category_check CHECK ((category = ANY (ARRAY['practice'::text, 'friendly'::text, 'camp'::text, 'match'::text, 'etc'::text]))),
  constraint videos_kind_check CHECK ((kind = ANY (ARRAY['playlist'::text, 'video'::text]))),
  constraint videos_note_check CHECK ((char_length(note) <= 200)),
  constraint videos_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80))),
  constraint videos_yt_check CHECK ((yt ~ '^[A-Za-z0-9_-]{6,64}$'::text))
);

create table public.wellness (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  date date not null,
  sleep smallint not null,
  fatigue smallint not null,
  soreness smallint not null,
  stress smallint not null,
  mood smallint not null,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  constraint wellness_player_id_date_key UNIQUE (player_id, date),
  constraint wellness_pkey PRIMARY KEY (id),
  constraint wellness_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint wellness_fatigue_check CHECK (((fatigue >= 1) AND (fatigue <= 5))),
  constraint wellness_mood_check CHECK (((mood >= 1) AND (mood <= 5))),
  constraint wellness_sleep_check CHECK (((sleep >= 1) AND (sleep <= 5))),
  constraint wellness_soreness_check CHECK (((soreness >= 1) AND (soreness <= 5))),
  constraint wellness_stress_check CHECK (((stress >= 1) AND (stress <= 5)))
);

create table public.open_votes (
  session_id uuid not null,
  player_id uuid not null,
  going boolean not null,
  updated_at timestamp with time zone default now() not null,
  constraint open_votes_pkey PRIMARY KEY (session_id, player_id),
  constraint open_votes_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  constraint open_votes_session_id_fkey FOREIGN KEY (session_id) REFERENCES open_sessions(id) ON DELETE CASCADE
);

create table public.scout_events (
  id uuid default gen_random_uuid() not null,
  match_id uuid not null,
  set_no smallint default 1 not null,
  side text not null,
  player_id uuid,
  opp_no smallint,
  skill text not null,
  kind text,
  len text,
  zone smallint,
  grade text not null,
  t numeric,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  src text,
  constraint scout_events_pkey PRIMARY KEY (id),
  constraint scout_events_author_fkey FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint scout_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES scout_matches(id) ON DELETE CASCADE,
  constraint scout_events_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
  constraint scout_events_grade_check CHECK ((grade = ANY (ARRAY['#'::text, '+'::text, '!'::text, '-'::text, '/'::text, '='::text]))),
  constraint scout_events_kind_check CHECK (((kind IS NULL) OR (length(kind) <= 20))),
  constraint scout_events_len_check CHECK (((len IS NULL) OR (len = ANY (ARRAY['short'::text, 'long'::text])))),
  constraint scout_events_opp_no_check CHECK (((opp_no IS NULL) OR ((opp_no >= 0) AND (opp_no <= 99)))),
  constraint scout_events_set_no_check CHECK (((set_no >= 1) AND (set_no <= 5))),
  constraint scout_events_side_check CHECK ((side = ANY (ARRAY['us'::text, 'opp'::text]))),
  constraint scout_events_skill_check CHECK ((skill = ANY (ARRAY['serve'::text, 'receive'::text, 'attack'::text, 'block'::text, 'dig'::text, 'set'::text]))),
  constraint scout_events_src_check CHECK (((src IS NULL) OR (src = ANY (ARRAY['L'::text, 'M'::text, 'R'::text, 'P'::text, 'B'::text])))),
  constraint scout_events_t_check CHECK (((t IS NULL) OR ((t >= (0)::numeric) AND (t < (36000)::numeric)))),
  constraint scout_events_zone_check CHECK (((zone IS NULL) OR ((zone >= 1) AND (zone <= 9))))
);

create table public.scout_points (
  id uuid default gen_random_uuid() not null,
  match_id uuid not null,
  set_no smallint default 1 not null,
  rot smallint not null,
  serve text not null,
  won boolean not null,
  t numeric,
  author uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  constraint scout_points_pkey PRIMARY KEY (id),
  constraint scout_points_author_fkey FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint scout_points_match_id_fkey FOREIGN KEY (match_id) REFERENCES scout_matches(id) ON DELETE CASCADE,
  constraint scout_points_rot_check CHECK (((rot >= 1) AND (rot <= 6))),
  constraint scout_points_serve_check CHECK ((serve = ANY (ARRAY['us'::text, 'opp'::text]))),
  constraint scout_points_set_no_check CHECK (((set_no >= 1) AND (set_no <= 5))),
  constraint scout_points_t_check CHECK (((t IS NULL) OR ((t >= (0)::numeric) AND (t < (36000)::numeric))))
);

create table public.jp_results (
  id bigint default nextval('jp_results_id_seq'::regclass) not null,
  tourn text not null,
  gender text not null,
  year smallint not null,
  place smallint not null,
  school_id text,
  name_ja text not null,
  constraint jp_results_pkey PRIMARY KEY (id),
  constraint jp_results_school_id_fkey FOREIGN KEY (school_id) REFERENCES jp_schools(id) ON DELETE SET NULL,
  constraint jp_results_gender_check CHECK ((gender = ANY (ARRAY['m'::text, 'w'::text]))),
  constraint jp_results_place_check CHECK ((place = ANY (ARRAY[1, 2, 3]))),
  constraint jp_results_tourn_check CHECK ((tourn = ANY (ARRAY['haruko'::text, 'ih'::text, 'kokutai'::text])))
);

create table public.jp_videos (
  id text not null,
  source text not null,
  title text not null,
  published text,
  len text,
  year smallint,
  tourn text,
  gender text,
  rnd text,
  schools text[] default '{}'::text[] not null,
  added_at timestamp with time zone default now() not null,
  constraint jp_videos_pkey PRIMARY KEY (id),
  constraint jp_videos_source_fkey FOREIGN KEY (source) REFERENCES jp_sources(id) ON DELETE CASCADE
);

-- ========== 3. 색인 ==========
CREATE INDEX absences_date ON public.absences USING btree (date);
CREATE INDEX entries_player ON public.entries USING btree (player_id);
CREATE INDEX entries_ref ON public.entries USING btree (kind, ref_id);
CREATE INDEX event_votes_player ON public.event_votes USING btree (player_id);
CREATE INDEX events_team ON public.events USING btree (team_id);
CREATE INDEX friendlies_date ON public.friendlies USING btree (date);
CREATE INDEX friendlies_team ON public.friendlies USING btree (team_id);
CREATE INDEX jp_matches_key ON public.jp_matches USING btree (tourn, year);
CREATE INDEX jp_results_school ON public.jp_results USING btree (school_id);
CREATE INDEX jp_videos_source ON public.jp_videos USING btree (source);
CREATE INDEX jp_videos_schools ON public.jp_videos USING gin (schools);
CREATE INDEX jp_videos_tourn ON public.jp_videos USING btree (tourn, year);
CREATE INDEX lift_sets_player_date ON public.lift_sets USING btree (player_id, date);
CREATE INDEX logs_author_idx ON public.logs USING btree (author);
CREATE INDEX logs_player_idx ON public.logs USING btree (player_id, date);
CREATE INDEX notices_created ON public.notices USING btree (created_at DESC);
CREATE INDEX notices_team ON public.notices USING btree (team_id);
CREATE INDEX open_sessions_created_by ON public.open_sessions USING btree (created_by);
CREATE INDEX open_sessions_date ON public.open_sessions USING btree (date);
CREATE INDEX open_sessions_team ON public.open_sessions USING btree (team_id);
CREATE INDEX open_votes_player ON public.open_votes USING btree (player_id);
CREATE INDEX pain_checks_author ON public.pain_checks USING btree (author);
CREATE INDEX pain_checks_player ON public.pain_checks USING btree (player_id);
CREATE INDEX players_team ON public.players USING btree (team_id);
CREATE INDEX practice_plans_team ON public.practice_plans USING btree (team_id);
CREATE INDEX practice_times_team ON public.practice_times USING btree (team_id);
CREATE INDEX profiles_player_idx ON public.profiles USING btree (player_id);
CREATE INDEX profiles_team ON public.profiles USING btree (team_id);
CREATE INDEX program_edits_player ON public.program_edits USING btree (player_id);
CREATE INDEX program_edits_slot ON public.program_edits USING btree (slot);
CREATE INDEX program_edits_team ON public.program_edits USING btree (team_id);
CREATE INDEX push_subs_player ON public.push_subs USING btree (player_id);
CREATE INDEX push_subs_user ON public.push_subs USING btree (user_id);
CREATE INDEX scout_events_author ON public.scout_events USING btree (author);
CREATE INDEX scout_events_match ON public.scout_events USING btree (match_id);
CREATE INDEX scout_events_player ON public.scout_events USING btree (player_id);
CREATE INDEX scout_matches_by ON public.scout_matches USING btree (created_by);
CREATE INDEX scout_matches_team ON public.scout_matches USING btree (team_id);
CREATE INDEX scout_points_author ON public.scout_points USING btree (author);
CREATE INDEX scout_points_match ON public.scout_points USING btree (match_id);
CREATE INDEX team_off_team ON public.team_off USING btree (team_id);
CREATE INDEX tests_author ON public.tests USING btree (author);
CREATE INDEX tests_player_idx ON public.tests USING btree (player_id, date);
CREATE INDEX videos_team ON public.videos USING btree (team_id);

-- ========== 4. 함수 (private = 권한 확인·내부용, public = 앱이 부르는 RPC) ==========
CREATE OR REPLACE FUNCTION private.can(perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select case
      when p.role = 'coach' then true
      when p.role <> 'player' then false
      when perm = 'schedule' then pl.titles && array['vice']
      when perm = 'notice' then pl.titles && array['vice', 'treasurer']
      when perm = 'roster' then pl.titles && array['vice', 'treasurer']
      when perm = 'training' then pl.titles && array['trainer']
      when perm = 'practice' then pl.titles && array['ops']
      when perm = 'attend' then pl.titles && array['ops', 'vice']
      when perm = 'analysis' then pl.titles && array['analyst']
      when perm = 'video' then pl.titles && array['vice', 'media']
      else false end
    from public.profiles p left join public.players pl on pl.id = p.player_id
    where p.id = auth.uid()), false)
$function$;

CREATE OR REPLACE FUNCTION private.guard_health_custom()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
  if tg_op = 'UPDATE' and new.custom is distinct from old.custom and not (private.is_coach() or private.can('training')) then
    new.custom := old.custom;
  elsif tg_op = 'INSERT' and not (private.is_coach() or private.can('training')) then
    new.custom := '{}'::jsonb;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := coalesce(new.raw_user_meta_data->>'team', 'men');
begin
  if t not in (select id from public.teams) then t := 'men'; end if;
  insert into public.profiles (id, email, team_id) values (new.id, new.email, t);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.is_coach()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role = 'coach' from public.profiles where id = auth.uid()), false)
$function$;

CREATE OR REPLACE FUNCTION private.is_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role in ('player','coach') from public.profiles where id = auth.uid()), false)
$function$;

CREATE OR REPLACE FUNCTION private.jp_nat_call()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select net.http_post(
    url := 'https://juhcaodotxspzzzfzrnt.supabase.co/functions/v1/jp-nat',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron')),
    timeout_milliseconds := 150000)
$function$;

CREATE OR REPLACE FUNCTION private.jp_skip_old()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.year is not null and new.year < 2010 then return null; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.jp_sync_call(mode text DEFAULT 'new'::text)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select net.http_post(
    url := 'https://juhcaodotxspzzzfzrnt.supabase.co/functions/v1/jp-sync',
    body := jsonb_build_object('mode', mode),
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron')),
    timeout_milliseconds := 150000)
$function$;

CREATE OR REPLACE FUNCTION private.move_body_private()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.height is not null or new.weight is not null then
    insert into public.player_private (player_id, height, weight, updated_at) values (new.id, new.height, new.weight, now())
      on conflict (player_id) do update set height = coalesce(excluded.height, public.player_private.height), weight = coalesce(excluded.weight, public.player_private.weight), updated_at = now();
    new.height := null; new.weight := null;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.my_player_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.player_id from public.profiles p join public.players pl on pl.id = p.player_id and pl.team_id = p.team_id where p.id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION private.my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.profiles where id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION private.notice_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.notify then perform private.push_call('notice', jsonb_build_object('title', new.title, 'team', new.team_id)); end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.player_team(pid uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select team_id from public.players where id = pid
$function$;

CREATE OR REPLACE FUNCTION private.push_call(kind text, extra jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select net.http_post(
    url := 'https://juhcaodotxspzzzfzrnt.supabase.co/functions/v1/push',
    body := jsonb_build_object('kind', kind) || extra,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron')),
    timeout_milliseconds := 20000)
$function$;

CREATE OR REPLACE FUNCTION private.scout_team(mid uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select team_id from public.scout_matches where id = mid
$function$;

CREATE OR REPLACE FUNCTION private.wipe_personal(pid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from public.player_contacts where player_id = pid;
  delete from public.player_private where player_id = pid;
  delete from public.health where player_id = pid;
  delete from public.training_notes where player_id = pid;
  delete from public.wellness where player_id = pid;
  delete from public.pain_checks where player_id = pid;
  delete from public.absences where player_id = pid;
  delete from public.program_edits where player_id = pid;
  delete from public.day_picks where player_id = pid;
  delete from public.open_votes where player_id = pid;
  delete from public.event_votes where player_id = pid;
  delete from public.push_subs where player_id = pid or user_id in (select id from public.profiles where player_id = pid);
  update public.players set height = null, weight = null, adjust = '{}'::jsonb where id = pid;
end $function$;

CREATE OR REPLACE FUNCTION public.jp_sync_now()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_coach() then raise exception 'forbidden'; end if;
  perform private.jp_sync_call('new');
end $function$;

CREATE OR REPLACE FUNCTION public.leave_team()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pid uuid := private.my_player_id(); me uuid := auth.uid(); tm text := private.my_team();
begin
  if me is null then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if private.is_coach() and (select count(*) from public.profiles where role = 'coach' and team_id = tm) <= 1 then
    raise exception '마지막 관리자는 탈퇴할 수 없어요. 다른 사람을 관리자·주장으로 정한 뒤 해 주세요' using errcode = '42501';
  end if;
  if pid is not null then
    perform private.wipe_personal(pid);
    if not exists (select 1 from public.profiles where player_id = pid and id <> me) then delete from public.players where id = pid; end if;
  end if;
  delete from auth.users where id = me;
end $function$;

CREATE OR REPLACE FUNCTION public.push_gone(ep text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  delete from public.push_subs where endpoint = ep
$function$;

CREATE OR REPLACE FUNCTION public.push_keys()
 RETURNS TABLE(pub text, priv text, cron text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron')
$function$;

CREATE OR REPLACE FUNCTION public.push_pubkey()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public'
$function$;

CREATE OR REPLACE FUNCTION public.push_set_vapid(pub text, priv text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (select 1 from vault.secrets where name = 'vapid_private') then return; end if;
  perform vault.create_secret(pub, 'vapid_public');
  perform vault.create_secret(priv, 'vapid_private');
end $function$;

CREATE OR REPLACE FUNCTION public.push_targets(kind text)
 RETURNS TABLE(endpoint text, p256dh text, auth text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with t as (select (now() at time zone 'Asia/Seoul')::date as d, extract(hour from now() at time zone 'Asia/Seoul')::int as h)
  select s.endpoint, s.p256dh, s.auth from public.push_subs s, t
  where case kind
    when 'morning' then s.player_id is not null and s.morning and s.morning_at = t.h
      and not exists (select 1 from public.wellness w where w.player_id = s.player_id and w.date = t.d)
    when 'evening' then s.player_id is not null and s.evening and s.evening_at = t.h and t.d = any(s.train_days)
      and not exists (select 1 from public.logs l where l.player_id = s.player_id and l.date = t.d)
    when 'notice' then s.notice
    else false end
$function$;

CREATE OR REPLACE FUNCTION public.push_targets_team(kind text, team text)
 RETURNS TABLE(endpoint text, p256dh text, auth text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select t.endpoint, t.p256dh, t.auth from public.push_targets(kind) t
  join public.push_subs s on s.endpoint = t.endpoint
  join public.profiles p on p.id = s.user_id
  where team is null or p.team_id = team
$function$;

CREATE OR REPLACE FUNCTION public.remove_member(target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t public.profiles%rowtype;
begin
  if not private.is_coach() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception '내 계정은 여기서 없앨 수 없어요' using errcode = '42501'; end if;
  select * into t from public.profiles where id = target;
  if not found then return; end if;
  if t.team_id is distinct from private.my_team() then raise exception '다른 팀 계정이에요' using errcode = '42501'; end if;
  if t.role = 'pending' and t.player_id is not null
     and not exists (select 1 from public.profiles o where o.player_id = t.player_id and o.id <> target) then
    delete from public.players where id = t.player_id;
  end if;
  delete from auth.users where id = target;
end $function$;

CREATE OR REPLACE FUNCTION public.retire_member(target uuid, wipe_all boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uids uuid[];
begin
  if not private.is_coach() then raise exception '관리자·주장만 할 수 있어요' using errcode = '42501'; end if;
  if private.player_team(target) is distinct from private.my_team() then raise exception '다른 팀 선수예요' using errcode = '42501'; end if;
  if target = private.my_player_id() then raise exception '내 계정은 설정 → 탈퇴로 해 주세요' using errcode = '42501'; end if;
  select array_agg(id) into uids from public.profiles where player_id = target;
  perform private.wipe_personal(target);
  if wipe_all then delete from public.players where id = target;
  else update public.players set alumni = true, left_on = (now() at time zone 'Asia/Seoul')::date, title = null, media = false, number = null, military = false where id = target;
  end if;
  if uids is not null then delete from auth.users where id = any(uids); end if;
end $function$;

CREATE OR REPLACE FUNCTION public.set_member_media(target uuid, on_ boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_coach() then raise exception '관리자·주장만 할 수 있어요' using errcode = '42501'; end if;
  if private.player_team(target) is distinct from private.my_team() then raise exception '다른 팀 선수예요' using errcode = '42501'; end if;
  update public.players set media = coalesce(on_, false) where id = target;
end $function$;

CREATE OR REPLACE FUNCTION public.set_member_title(target uuid, new_title text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text;
begin
  if not private.is_coach() then raise exception '관리자·주장만 할 수 있어요' using errcode = '42501'; end if;
  if private.player_team(target) is distinct from private.my_team() then raise exception '다른 팀 선수예요' using errcode = '42501'; end if;
  if new_title is not null and new_title not in ('admin', 'captain', 'vice', 'ops', 'treasurer', 'trainer', 'analyst') then raise exception '직책을 확인해 주세요' using errcode = '23514'; end if;
  v_role := case when new_title in ('admin', 'captain') then 'coach' else 'player' end;
  if target = private.my_player_id() and v_role <> 'coach' then raise exception '내 관리자 권한은 여기서 내려놓을 수 없어요' using errcode = '42501'; end if;
  update public.players set title = new_title where id = target;
  update public.profiles set role = v_role where player_id = target and role in ('player', 'coach');
end $function$;

CREATE OR REPLACE FUNCTION public.submit_my_info(info jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me        public.profiles%rowtype;
  pid       uuid;
  v_name    text := btrim(coalesce(info->>'name', ''));
  v_pos     text := info->>'pos';
  v_wexp    text := info->>'weight_exp';
  v_height  numeric := nullif(info->>'height', '')::numeric;
  v_weight  numeric := nullif(info->>'weight', '')::numeric;
  v_exp     numeric := nullif(info->>'exp', '')::numeric;
  v_number  int := nullif(info->>'number', '')::int;
  a_l int := coalesce(nullif(info->>'ankle_l', '')::int, 0);
  a_r int := coalesce(nullif(info->>'ankle_r', '')::int, 0);
  v_inj jsonb := coalesce(info->'injuries', '[]'::jsonb);
  v_pain jsonb := '{}'::jsonb;
  mx jsonb := '{}'::jsonb;
  a text; v jsonb; d int; m int; r boolean; any_flag boolean := false;
  v_adjust jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if not (me.role = 'pending' or me.player_id is null) then
    raise exception '승인된 계정의 정보는 관리자가 수정해요' using errcode = '42501';
  end if;
  if coalesce((info->>'consent')::boolean, false) is not true then raise exception '정보 사용 동의가 필요해요' using errcode = '23514'; end if;
  if v_name = '' or length(v_name) > 20 then raise exception '이름을 1–20자로 입력해 주세요' using errcode = '23514'; end if;
  if v_pos is null or v_pos not in ('OH','MB','OP','S','Li') then raise exception '포지션을 골라 주세요' using errcode = '23514'; end if;
  if v_wexp is not null and v_wexp not in ('none','machine','free','oly') then raise exception '웨이트 경험을 골라 주세요' using errcode = '23514'; end if;
  if v_height is not null and (v_height < 140 or v_height > 220) then raise exception '키를 확인해 주세요' using errcode = '23514'; end if;
  if v_weight is not null and (v_weight < 40 or v_weight > 150) then raise exception '몸무게를 확인해 주세요' using errcode = '23514'; end if;
  if v_exp is not null and (v_exp < 0 or v_exp > 20) then raise exception '배구 경력을 확인해 주세요' using errcode = '23514'; end if;
  if v_number is not null and (v_number < 0 or v_number > 99) then raise exception '등번호는 0–99로 입력해 주세요' using errcode = '23514'; end if;
  if least(a_l, a_r) < 0 or greatest(a_l, a_r) > 30 then raise exception '발목 다친 횟수를 확인해 주세요' using errcode = '23514'; end if;
  if jsonb_typeof(v_inj) <> 'array' or jsonb_array_length(v_inj) > 20 or length(v_inj::text) > 6000 then
    raise exception '부상 이력을 확인해 주세요' using errcode = '23514';
  end if;

  foreach a in array array['knee','shoulder','ankle','back','wrist','finger'] loop
    v := info->'pain'->a;
    if v is null or jsonb_typeof(v) = 'null' then d := 0; m := 0; r := false;
    elsif jsonb_typeof(v) = 'object' then
      d := coalesce(nullif(v->>'d', '')::int, 0); m := coalesce(nullif(v->>'m', '')::int, 0); r := coalesce((v->>'r')::boolean, false);
    else d := coalesce(nullif(v#>>'{}', '')::int, 0); m := 0; r := false;
    end if;
    if least(d, m) < 0 or greatest(d, m) > 10 then raise exception '통증은 0–10으로 입력해 주세요' using errcode = '23514'; end if;
    v_pain := v_pain || jsonb_build_object(a, jsonb_build_object('d', d, 'm', m, 'r', r));
    mx := mx || jsonb_build_object(a, case when r then 10 else greatest(d, m) end);
    if r or greatest(d, m) >= 3 then any_flag := true; end if;
  end loop;

  v_adjust := jsonb_strip_nulls(jsonb_build_object(
    'plyo',     case when (mx->>'ankle')::int >= 3 then 'hold' when (mx->>'knee')::int >= 3 then 'iso' end,
    'overhead', case when (mx->>'shoulder')::int >= 3 then true end,
    'back',     case when (mx->>'back')::int >= 3 then true end,
    'ankleBal', case when a_l + a_r > 0 or exists (select 1 from jsonb_array_elements(v_inj) e where e->>'part' = 'ankle') then true end,
    'refer',    case when any_flag then true end
  ));

  if me.player_id is null then
    insert into public.players (name, pos, year, height, weight, exp, weight_exp, adjust, number, sort)
    values (v_name, v_pos, nullif(btrim(coalesce(info->>'year', '')), ''), v_height, v_weight, v_exp, v_wexp, v_adjust, v_number,
            (select coalesce(max(sort), 0) + 1 from public.players))
    returning id into pid;
    update public.profiles set player_id = pid where id = me.id;
  else
    pid := me.player_id;
    update public.players
       set name = v_name, pos = v_pos, year = nullif(btrim(coalesce(info->>'year', '')), ''),
           height = v_height, weight = v_weight, exp = v_exp, weight_exp = v_wexp, adjust = v_adjust, number = v_number
     where id = pid;
  end if;

  insert into public.health (player_id, ankle_l, ankle_r, ankle_last, knee_injury, pain, injuries, note, consent, updated_at)
  values (pid, a_l, a_r, nullif(btrim(coalesce(info->>'ankle_last', '')), ''),
          exists (select 1 from jsonb_array_elements(v_inj) e where e->>'part' = 'knee'),
          v_pain, v_inj, nullif(btrim(coalesce(info->>'note', '')), ''), true, now())
  on conflict (player_id) do update
    set ankle_l = excluded.ankle_l, ankle_r = excluded.ankle_r, ankle_last = excluded.ankle_last,
        knee_injury = excluded.knee_injury, pain = excluded.pain, injuries = excluded.injuries, note = excluded.note,
        consent = true, updated_at = now();
  return pid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.switch_team(t text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not coalesce((select super from public.profiles where id = auth.uid()), false) then raise exception '총관리자만 할 수 있어요' using errcode = '42501'; end if;
  if not exists (select 1 from public.teams where id = t) then raise exception '팀을 확인해 주세요' using errcode = '23514'; end if;
  update public.profiles set team_id = t where id = auth.uid();
end $function$;

CREATE OR REPLACE FUNCTION public.update_my_injuries(injuries jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pid uuid := private.my_player_id();
begin
  if pid is null or private.my_role() not in ('player', 'coach') then raise exception '권한이 없어요' using errcode = '42501'; end if;
  if jsonb_typeof(injuries) <> 'array' or jsonb_array_length(injuries) > 20 or length(injuries::text) > 6000 then
    raise exception '부상 이력을 확인해 주세요' using errcode = '23514';
  end if;
  insert into public.health (player_id, injuries, knee_injury, updated_at)
    values (pid, injuries, exists (select 1 from jsonb_array_elements(injuries) e where e->>'part' = 'knee'), now())
  on conflict (player_id) do update set injuries = excluded.injuries, knee_injury = excluded.knee_injury, updated_at = now();
end $function$;

CREATE OR REPLACE FUNCTION public.update_my_profile(info jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  pid uuid := private.my_player_id();
  v_height numeric := nullif(info->>'height', '')::numeric;
  v_weight numeric := nullif(info->>'weight', '')::numeric;
  v_exp numeric := nullif(info->>'exp', '')::numeric;
  v_wexp text := nullif(info->>'weight_exp', '');
  v_year text := nullif(btrim(coalesce(info->>'year', '')), '');
begin
  if pid is null or private.my_role() not in ('player', 'coach') then raise exception '권한이 없어요' using errcode = '42501'; end if;
  if v_height is not null and (v_height < 140 or v_height > 220) then raise exception '키를 확인해 주세요' using errcode = '23514'; end if;
  if v_weight is not null and (v_weight < 40 or v_weight > 150) then raise exception '몸무게를 확인해 주세요' using errcode = '23514'; end if;
  if v_exp is not null and (v_exp < 0 or v_exp > 20) then raise exception '배구 경력을 확인해 주세요' using errcode = '23514'; end if;
  if v_wexp is not null and v_wexp not in ('none', 'machine', 'free', 'oly') then raise exception '웨이트 경험을 골라 주세요' using errcode = '23514'; end if;
  if v_year is not null and length(v_year) > 10 then raise exception '학년을 확인해 주세요' using errcode = '23514'; end if;
  update public.players set year = v_year, exp = v_exp, weight_exp = coalesce(v_wexp, weight_exp), height = null, weight = null where id = pid;
  insert into public.player_private (player_id, height, weight, updated_at) values (pid, v_height, v_weight, now())
    on conflict (player_id) do update set height = excluded.height, weight = excluded.weight, updated_at = now();
end $function$
;

-- 함수 실행 권한: 앱용 RPC 만 로그인 사용자에게, 알림 함수는 service_role 전용
revoke execute on all functions in schema public from public, anon;
grant execute on function public.jp_sync_now() to authenticated;
grant execute on function public.leave_team() to authenticated;
grant execute on function public.push_pubkey() to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.retire_member(uuid, boolean) to authenticated;
grant execute on function public.set_member_media(uuid, boolean) to authenticated;
grant execute on function public.set_member_title(uuid, text) to authenticated;
grant execute on function public.submit_my_info(jsonb) to authenticated;
grant execute on function public.switch_team(text) to authenticated;
grant execute on function public.update_my_injuries(jsonb) to authenticated;
grant execute on function public.update_my_profile(jsonb) to authenticated;
revoke execute on function public.push_gone(text) from authenticated;
revoke execute on function public.push_keys() from authenticated;
revoke execute on function public.push_set_vapid(text, text) from authenticated;
revoke execute on function public.push_targets(text) from authenticated;
revoke execute on function public.push_targets_team(text, text) from authenticated;

-- ========== 5. 트리거 ==========
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
CREATE TRIGGER health_custom_guard BEFORE INSERT OR UPDATE ON public.health FOR EACH ROW EXECUTE FUNCTION private.guard_health_custom();
CREATE TRIGGER notices_push AFTER INSERT ON public.notices FOR EACH ROW EXECUTE FUNCTION private.notice_push();
CREATE TRIGGER players_body_private BEFORE INSERT OR UPDATE OF height, weight ON public.players FOR EACH ROW EXECUTE FUNCTION private.move_body_private();
CREATE TRIGGER jp_skip_old BEFORE INSERT ON public.jp_videos FOR EACH ROW EXECUTE FUNCTION private.jp_skip_old();

-- ========== 6. 행 단위 보안 (RLS) ==========
-- 팀 표는 restrictive "team scope" 로 내 팀 행만. private.can(x) 은 관리자(coach)에게 항상 true, is_member() 는 관리자 포함
-- 개인 기록 읽기 = 본인 + 맡은 직책(can), 쓰기 = 본인 + 관리자. 2026-10-25 에 같은 뜻의 정책을 합쳐 133 → 118개 (직책별 읽기·쓰기 결과는 그대로)
alter table public.absences enable row level security;
alter table public.day_picks enable row level security;
alter table public.entries enable row level security;
alter table public.event_votes enable row level security;
alter table public.events enable row level security;
alter table public.friendlies enable row level security;
alter table public.health enable row level security;
alter table public.jp_matches enable row level security;
alter table public.jp_results enable row level security;
alter table public.jp_schools enable row level security;
alter table public.jp_sources enable row level security;
alter table public.jp_videos enable row level security;
alter table public.lift_sets enable row level security;
alter table public.lineups enable row level security;
alter table public.logs enable row level security;
alter table public.notices enable row level security;
alter table public.open_sessions enable row level security;
alter table public.open_votes enable row level security;
alter table public.pain_checks enable row level security;
alter table public.player_contacts enable row level security;
alter table public.player_private enable row level security;
alter table public.players enable row level security;
alter table public.practice_plans enable row level security;
alter table public.practice_times enable row level security;
alter table public.profiles enable row level security;
alter table public.program_edits enable row level security;
alter table public.push_subs enable row level security;
alter table public.scout_events enable row level security;
alter table public.scout_matches enable row level security;
alter table public.scout_points enable row level security;
alter table public.team_off enable row level security;
alter table public.teams enable row level security;
alter table public.tests enable row level security;
alter table public.training_notes enable row level security;
alter table public.videos enable row level security;
alter table public.wellness enable row level security;

create policy "team scope" on public.absences as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "coach or self deletes absences" on public.absences for delete to authenticated
  using ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))));
create policy "coach or self inserts absences" on public.absences for insert to authenticated
  with check ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()) AND (author = ( SELECT auth.uid() AS uid)))));
create policy "self or attend reads absences" on public.absences for select to authenticated
  using (((private.is_member() AND (player_id = private.my_player_id())) OR private.can('attend'::text)));
create policy "coach or self updates absences" on public.absences for update to authenticated
  using ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))))
  with check ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))));
create policy "team scope" on public.day_picks as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "coach or self deletes day_picks" on public.day_picks for delete
  using ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))));
create policy "coach or self inserts day_picks" on public.day_picks for insert
  with check ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))));
create policy "coach or self reads day_picks" on public.day_picks for select
  using ((private.is_coach() OR (private.is_member() AND (player_id = private.my_player_id()))));
create policy "coach or self updates day_picks" on public.day_picks for update
  using ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))))
  with check ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))));
create policy "schedule writes entries" on public.entries to authenticated
  using (private.can('schedule'::text))
  with check (private.can('schedule'::text));
create policy "team scope" on public.entries as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "members read entries" on public.entries for select to authenticated
  using (private.is_member());
create policy "team scope" on public.event_votes as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "votes mine" on public.event_votes to authenticated
  using ((player_id = private.my_player_id()))
  with check ((player_id = private.my_player_id()));
create policy "votes read" on public.event_votes for select to authenticated
  using (private.is_member());
create policy "schedule writes events" on public.events to authenticated
  using (private.can('schedule'::text))
  with check (private.can('schedule'::text));
create policy "team scope" on public.events as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "members read events" on public.events for select
  using (private.is_member());
create policy "schedule writes friendlies" on public.friendlies to authenticated
  using (private.can('schedule'::text))
  with check (private.can('schedule'::text));
create policy "team scope" on public.friendlies as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "members read friendlies" on public.friendlies for select to authenticated
  using (private.is_member());
create policy "coach writes health" on public.health
  using (private.is_coach())
  with check (private.is_coach());
create policy "team scope" on public.health as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "self or training reads health" on public.health for select to authenticated
  using (((player_id = private.my_player_id()) OR private.can('training'::text)));
create policy "training writes health" on public.health for update to authenticated
  using (private.can('training'::text))
  with check (private.can('training'::text));
create policy "members read" on public.jp_matches for select to authenticated
  using (private.is_member());
create policy "members read" on public.jp_results for select to authenticated
  using (private.is_member());
create policy "members read" on public.jp_schools for select to authenticated
  using (private.is_member());
create policy "coach del" on public.jp_sources for delete to authenticated
  using (private.is_coach());
create policy "coach add" on public.jp_sources for insert to authenticated
  with check (private.is_coach());
create policy "members read" on public.jp_sources for select to authenticated
  using (private.is_member());
create policy "members read" on public.jp_videos for select to authenticated
  using (private.is_member());
create policy "team scope" on public.lift_sets as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "coach or self deletes lift_sets" on public.lift_sets for delete
  using ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()) AND (author = ( SELECT auth.uid() AS uid)))));
create policy "coach or self inserts lift_sets" on public.lift_sets for insert
  with check ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()) AND (author = ( SELECT auth.uid() AS uid)))));
create policy "self or training reads lift_sets" on public.lift_sets for select to authenticated
  using (((private.is_member() AND (player_id = private.my_player_id())) OR private.can('training'::text)));
create policy "schedule writes lineups" on public.lineups to authenticated
  using (private.can('schedule'::text))
  with check (private.can('schedule'::text));
create policy "team scope" on public.lineups as restrictive to authenticated
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "members read lineups" on public.lineups for select to authenticated
  using (private.is_member());
create policy "team scope" on public.logs as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "coach deletes logs" on public.logs for delete
  using (private.is_coach());
create policy "coach or self inserts logs" on public.logs for insert
  with check ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()) AND (author = ( SELECT auth.uid() AS uid)))));
create policy "self or training reads logs" on public.logs for select to authenticated
  using (((private.is_member() AND (player_id = private.my_player_id())) OR private.can('training'::text)));
create policy "notice writes notices" on public.notices to authenticated
  using (private.can('notice'::text))
  with check (private.can('notice'::text));
create policy "team scope" on public.notices as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "members read notices" on public.notices for select to authenticated
  using (private.is_member());
create policy "open write" on public.open_sessions to authenticated
  using (private.can('attend'::text))
  with check (private.can('attend'::text));
create policy "team scope" on public.open_sessions as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "open read" on public.open_sessions for select to authenticated
  using (private.is_member());
create policy "team scope" on public.open_votes as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "votes mine" on public.open_votes to authenticated
  using ((player_id = private.my_player_id()))
  with check ((player_id = private.my_player_id()));
create policy "votes read" on public.open_votes for select to authenticated
  using (private.is_member());
create policy "team scope" on public.pain_checks as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "coach or self removes pain checks" on public.pain_checks for delete
  using ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()) AND (author = ( SELECT auth.uid() AS uid)))));
create policy "coach or self inserts pain checks" on public.pain_checks for insert
  with check ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()) AND (author = ( SELECT auth.uid() AS uid)))));
create policy "self or training reads pain_checks" on public.pain_checks for select to authenticated
  using (((private.is_member() AND (player_id = private.my_player_id())) OR private.can('training'::text)));
create policy "team scope" on public.player_contacts as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "contacts insert" on public.player_contacts for insert to authenticated
  with check (((player_id = private.my_player_id()) OR private.is_coach()));
create policy "contacts read" on public.player_contacts for select to authenticated
  using (((player_id = private.my_player_id()) OR private.can('roster'::text)));
create policy "contacts update" on public.player_contacts for update to authenticated
  using (((player_id = private.my_player_id()) OR private.is_coach()))
  with check (((player_id = private.my_player_id()) OR private.is_coach()));
create policy "private write coach" on public.player_private to authenticated
  using (private.is_coach())
  with check (private.is_coach());
create policy "team scope" on public.player_private as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "private read" on public.player_private for select to authenticated
  using (((player_id = private.my_player_id()) OR private.is_coach() OR private.can('training'::text)));
create policy "coach writes players" on public.players
  using (private.is_coach())
  with check (private.is_coach());
create policy "team scope" on public.players as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "members or self read players" on public.players for select to authenticated
  using ((private.is_member() OR (id = private.my_player_id())));
create policy "practice write" on public.practice_plans to authenticated
  using (private.can('practice'::text))
  with check (private.can('practice'::text));
create policy "team scope" on public.practice_plans as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "practice read" on public.practice_plans for select to authenticated
  using (((published AND private.is_member()) OR private.can('practice'::text)));
create policy "schedule writes practice_times" on public.practice_times to authenticated
  using (private.can('attend'::text))
  with check (private.can('attend'::text));
create policy "team scope" on public.practice_times as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "members read practice_times" on public.practice_times for select to authenticated
  using (private.is_member());
create policy "team scope" on public.profiles as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "self or coach reads profile" on public.profiles for select
  using (((id = ( SELECT auth.uid() AS uid)) OR private.is_coach()));
create policy "coach updates profiles" on public.profiles for update
  using (private.is_coach())
  with check (private.is_coach());
create policy "program_edits write" on public.program_edits to authenticated
  using (private.can('training'::text))
  with check (private.can('training'::text));
create policy "team scope" on public.program_edits as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "program_edits read" on public.program_edits for select to authenticated
  using ((((player_id IS NULL) AND private.is_member()) OR (player_id = private.my_player_id()) OR private.can('training'::text)));
create policy "push_subs_del" on public.push_subs for delete to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "push_subs_ins" on public.push_subs for insert to authenticated
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND ((player_id IS NULL) OR (player_id = ( SELECT private.my_player_id() AS my_player_id)))));
create policy "push_subs_sel" on public.push_subs for select to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "push_subs_upd" on public.push_subs for update to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND ((player_id IS NULL) OR (player_id = ( SELECT private.my_player_id() AS my_player_id)))));
create policy "team scope" on public.scout_events as restrictive
  using ((private.scout_team(match_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.scout_team(match_id) = ( SELECT private.my_team() AS my_team)));
create policy "scout events del" on public.scout_events for delete to authenticated
  using (((author = ( SELECT auth.uid() AS uid)) OR private.can('analysis'::text)));
create policy "scout events add" on public.scout_events for insert to authenticated
  with check ((private.is_member() AND (author = ( SELECT auth.uid() AS uid))));
create policy "scout events read" on public.scout_events for select to authenticated
  using (private.is_member());
create policy "scout events fix" on public.scout_events for update to authenticated
  using (((author = ( SELECT auth.uid() AS uid)) OR private.can('analysis'::text)))
  with check (((author = ( SELECT auth.uid() AS uid)) OR private.can('analysis'::text)));
create policy "scout write" on public.scout_matches to authenticated
  using (private.can('analysis'::text))
  with check (private.can('analysis'::text));
create policy "team scope" on public.scout_matches as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "scout read" on public.scout_matches for select to authenticated
  using (private.is_member());
create policy "team scope" on public.scout_points as restrictive
  using ((private.scout_team(match_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.scout_team(match_id) = ( SELECT private.my_team() AS my_team)));
create policy "points del" on public.scout_points for delete to authenticated
  using (((author = ( SELECT auth.uid() AS uid)) OR private.can('analysis'::text)));
create policy "points add" on public.scout_points for insert to authenticated
  with check ((private.is_member() AND (author = ( SELECT auth.uid() AS uid))));
create policy "points read" on public.scout_points for select to authenticated
  using (private.is_member());
create policy "points fix" on public.scout_points for update to authenticated
  using (((author = ( SELECT auth.uid() AS uid)) OR private.can('analysis'::text)))
  with check (((author = ( SELECT auth.uid() AS uid)) OR private.can('analysis'::text)));
create policy "schedule writes team_off" on public.team_off to authenticated
  using (private.can('attend'::text))
  with check (private.can('attend'::text));
create policy "team scope" on public.team_off as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "members read team_off" on public.team_off for select
  using (private.is_member());
create policy "teams read" on public.teams for select to anon,authenticated
  using (true);
create policy "coach writes tests" on public.tests
  using (private.is_coach())
  with check (private.is_coach());
create policy "team scope" on public.tests as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "player deletes own core tests" on public.tests for delete
  using (((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()) AND (author = ( SELECT auth.uid() AS uid))));
create policy "training deletes tests" on public.tests for delete to authenticated
  using (private.can('training'::text));
create policy "player inserts own tests" on public.tests for insert to authenticated
  with check (((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()) AND (author = ( SELECT auth.uid() AS uid))));
create policy "members read tests" on public.tests for select
  using (private.is_member());
create policy "training edits tests" on public.tests for update to authenticated
  using (private.can('training'::text))
  with check (private.can('training'::text));
create policy "notes self" on public.training_notes to authenticated
  using ((player_id = private.my_player_id()))
  with check ((player_id = private.my_player_id()));
create policy "team scope" on public.training_notes as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "notes shared read" on public.training_notes for select to authenticated
  using ((shared AND private.can('practice'::text)));
create policy "team scope" on public.videos as restrictive
  using ((team_id = ( SELECT private.my_team() AS my_team)))
  with check ((team_id = ( SELECT private.my_team() AS my_team)));
create policy "videos write" on public.videos to authenticated
  using (private.can('video'::text))
  with check (private.can('video'::text));
create policy "videos read" on public.videos for select to authenticated
  using (private.is_member());
create policy "team scope" on public.wellness as restrictive
  using ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)))
  with check ((private.player_team(player_id) = ( SELECT private.my_team() AS my_team)));
create policy "coach or self deletes wellness" on public.wellness for delete to authenticated
  using ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))));
create policy "coach or self inserts wellness" on public.wellness for insert to authenticated
  with check ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()) AND (author = ( SELECT auth.uid() AS uid)))));
create policy "self or training reads wellness" on public.wellness for select to authenticated
  using (((private.is_member() AND (player_id = private.my_player_id())) OR private.can('training'::text)));
create policy "coach or self updates wellness" on public.wellness for update to authenticated
  using ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))))
  with check ((private.is_coach() OR ((private.my_role() = 'player'::text) AND (player_id = private.my_player_id()))));

-- ========== 6b. 현 대회 결과 (jp-pref 가 채움) ==========
create table public.jp_pref_matches (
  id bigserial primary key,
  pref text not null, tourn text not null, year smallint not null,
  gender text not null check (gender in ('m','w')),
  rnd text, head text,
  a_name text not null, b_name text not null, a_sets smallint, b_sets smallint,
  src text not null
);
create index jp_pref_matches_pref on public.jp_pref_matches (pref, gender);
alter table public.jp_pref_matches enable row level security;
create policy "members read" on public.jp_pref_matches for select to authenticated using (private.is_member());

-- 4강 이상: 결승 승 1 · 패 2, 4강·대표결정전 승자·결승 리그 상위 4팀 3 (결승 없이 리그면 1위 = 1)
create view public.jp_pref_top with (security_invoker = true) as
with m as (
  select pref, gender, tourn, year, src, rnd,
    case when a_sets > b_sets then a_name else b_name end w,
    case when a_sets > b_sets then b_name else a_name end l
  from public.jp_pref_matches where a_sets is distinct from b_sets
), fl as (
  select pref, gender, tourn, year, src, name, sum(win) wins from (
    select pref, gender, tourn, year, src, w name, 1 win from m where rnd = 'FL'
    union all select pref, gender, tourn, year, src, l, 0 from m where rnd = 'FL') x
  group by 1,2,3,4,5,6
), flr as (select *, rank() over (partition by src, gender order by wins desc) rk from fl
), t as (
  select pref, gender, tourn, year, src, w name, 1 place from m where rnd = 'F'
  union all select pref, gender, tourn, year, src, l, 2 from m where rnd = 'F'
  union all select pref, gender, tourn, year, src, l, 3 from m where rnd = 'SF'
  union all select pref, gender, tourn, year, src, w, 3 from m where rnd = 'SF'
  union all select pref, gender, tourn, year, src, w, 3 from m where rnd = 'REP'
  union all select pref, gender, tourn, year, src, name,
    case when rk = 1 and not exists (select 1 from m where m.src = flr.src and m.gender = flr.gender and m.rnd = 'F') then 1 else 3 end
  from flr where rk <= 4
)
select pref, gender, tourn, year, src, btrim(regexp_replace(name, '(高等学校|高校|高)$', '')) name, min(place) place
from t group by 1,2,3,4,5,6;

create or replace function private.jp_pref_call(cats jsonb default null) returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := 'https://juhcaodotxspzzzfzrnt.supabase.co/functions/v1/jp-pref',
    body := case when cats is null then '{}'::jsonb else jsonb_build_object('cats', cats) end,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron')),
    timeout_milliseconds := 150000)
$$;

-- ========== 6c. 고교 랭킹 · 직책 여러 개 ==========
create or replace function private.jp_norm(t text) returns text language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(btrim(coalesce(t, '')), '(高等学校|高校|高)$', ''),
    '女$', '女子'), '実$', '実業'), '商$', '商業'), '工$', '工業'), '大附$', '大附属')
$$;
-- 대회 결과의 학교 이름 → jp_schools.id (같은 현 우선, 현을 모르면 이름이 하나뿐일 때만)
create or replace function private.jp_sid(n text, p text, g text) returns text language sql stable set search_path = '' as $$
  with c as (
    select s.id, s.pref from public.jp_schools s
    where s.gender in (g, 'mw') and (p is null or s.pref = p)
      and (private.jp_norm(s.name_ja) = private.jp_norm(n) or n = any(s.aliases)
        or exists (select 1 from unnest(s.aliases) a where a not like 're:%' and private.jp_norm(a) = private.jp_norm(n))
        or exists (select 1 from unnest(s.aliases) a where a like 're:%' and n ~ substr(a, 4))))
  select case when p is not null or (select count(*) from c) = 1 then (select id from c limit 1) end
$$;
-- 일본 고교 랭킹: 전국대회(하루코·인터하이·국민스포츠대회 단독 학교 대표)에서 간 곳 + 현 대회 4강 이상
-- 최근 가중 = 선수 겹침 기준 (2026-10-28): 학년도(4월~3월, 1월 하루코는 지난 학년도) 이번 ×1 · 1년 전 ×2/3 · 2년 전 ×1/3 · 그 전 0
-- 점수: 우승 100 · 준우승 70 · 4강 50 · 8강 32 · 16강 20 · 32강 10 · 출전 5 (국민스포츠대회는 한 학교가 현 대표로 나간 경우만 ×0.8) / 지역대회 15·10·6 · 현 대회 3·2·1
create materialized view public.jp_rank as
with mt as (
  select tourn, year, gender, rnd, a_name n, a_pref p, a_sets > b_sets won from public.jp_matches where a_sets is distinct from b_sets
  union all
  select tourn, year, gender, rnd, b_name, b_pref, b_sets > a_sets from public.jp_matches where a_sets is distinct from b_sets
), mt2 as (
  select tourn, year, gender, rnd, won,
    case when tourn = 'kokutai' then coalesce(substring(n from '\((.+?)\)'), '') else n end n, p,
    case rnd when 'group' then 0 when 'R1' then 1 when 'rep' then 1 when 'R2' then 2 when 'R3' then 3 when 'QF' then 4 when 'SF' then 5 when '3rd' then 5 when 'F' then 6 else 0 end
      + case when tourn = 'kokutai' and rnd in ('R1', 'R2') then 1 else 0 end d
  from mt
), st as (
  select tourn, year, gender, sid, max(d + case when won and rnd <> '3rd' then 1 else 0 end) lvl
  from (select *, private.jp_sid(n, p, gender) sid from mt2 where n <> '') x
  where sid is not null group by 1, 2, 3, 4
), nat as (
  select tourn, year, gender, sid, least(lvl, 7) lvl from st
  union all -- 대진이 없는 해는 역대 4강 표로
  select r.tourn, r.year, r.gender, r.school_id, case r.place when 1 then 7 when 2 then 6 else 5 end
  from public.jp_results r
  where r.school_id is not null and not exists (select 1 from public.jp_matches m where m.tourn = r.tourn and m.year = r.year and m.gender = r.gender)
), cur as (
  select case when extract(month from now()) >= 4 then extract(year from now())::int else extract(year from now())::int - 1 end sy
), pts as (
  select sid, gender, tourn, year, lvl,
    (case lvl when 7 then 100 when 6 then 70 when 5 then 50 when 4 then 32 when 3 then 20 when 2 then 10 else 5 end)
    * case tourn when 'kokutai' then 0.8 else 1 end
    * case cur.sy - case when tourn = 'haruko' then year - 1 else year end when 0 then 1.0 when 1 then 2.0 / 3 when 2 then 1.0 / 3 else 0 end p
  from nat, cur
), pref as (
  select private.jp_sid(name, pref, gender) sid, gender,
    -- 지역대회(여러 현): 우승 15 · 준우승 10 · 4강 6 / 현 대회: 우승 3 · 준우승 2 · 4강 1 (현 예선은 전국대회 출전 점수와 겹치고 현마다 수준 차가 커서 작게)
    (case when tourn = 'block' then case place when 1 then 15 when 2 then 10 else 6 end else case place when 1 then 3 when 2 then 2 else 1 end end)
    * case cur.sy - case when tourn = 'haruko' then year - 1 else year end when 0 then 1.0 when 1 then 2.0 / 3 when 2 then 1.0 / 3 else 0 end p
  from public.jp_pref_top, cur
), allp as (
  select sid, gender, p from pts union all select sid, gender, p from pref where sid is not null
), best as ( -- 대표 성적: 가중을 친 점수가 가장 큰 대회
  select distinct on (sid, gender) sid, gender, tourn, year, lvl from pts
  where lvl >= 3 and p > 0
  order by sid, gender, p desc, year desc
), hist as ( -- 전국대회 기록 전부
  select sid, gender, jsonb_agg(jsonb_build_object('t', tourn, 'y', year, 'l', lvl) order by year desc, lvl desc) h
  from (select distinct sid, gender, tourn, year, max(lvl) over (partition by sid, gender, tourn, year) lvl from nat) x group by 1, 2
), tot as (select sid, gender, sum(p) p from allp group by 1, 2)
select t.sid school_id, t.gender, round(t.p::numeric, 1) pts,
  rank() over (partition by t.gender order by t.p desc)::int rk,
  b.tourn best_tourn, b.year best_year, b.lvl best_lvl, coalesce(h.h, '[]') hist
from tot t left join best b on b.sid = t.sid and b.gender = t.gender left join hist h on h.sid = t.sid and h.gender = t.gender;
create unique index jp_rank_pk on public.jp_rank (school_id, gender);
revoke all on public.jp_rank from public, anon;
grant select on public.jp_rank to authenticated;

create or replace function private.jp_rank_refresh() returns void language sql security definer set search_path = '' as $$
  refresh materialized view concurrently public.jp_rank
$$;

-- 직책 여러 개: titles 가 기준, title(대표 직책)·media 는 따라 만듦
create or replace function private.players_titles_sync() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.titles is not distinct from old.titles
     and (new.title is distinct from old.title or new.media is distinct from old.media) then
    new.titles := array_remove(array[new.title, case when new.media then 'media' end], null);
  end if;
  new.titles := array(select distinct t from unnest(new.titles) t order by t);
  new.title := (select t from unnest(array['admin','captain','vice','treasurer','ops','trainer','analyst']) with ordinality o(t, i) where t = any(new.titles) order by i limit 1);
  new.media := 'media' = any(new.titles);
  return new;
end $$;
create trigger players_titles_sync before insert or update on public.players for each row execute function private.players_titles_sync();
create or replace function public.set_member_titles(target uuid, new_titles text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_role text; t text[] := coalesce(new_titles, '{}');
begin
  if not private.is_coach() then raise exception '관리자·주장만 할 수 있어요' using errcode = '42501'; end if;
  if private.player_team(target) is distinct from private.my_team() then raise exception '다른 팀 선수예요' using errcode = '42501'; end if;
  if not t <@ array['admin','captain','vice','ops','treasurer','trainer','analyst','media'] then raise exception '직책을 확인해 주세요' using errcode = '23514'; end if;
  v_role := case when t && array['admin', 'captain'] then 'coach' else 'player' end;
  if target = private.my_player_id() and v_role <> 'coach' then raise exception '내 관리자 권한은 여기서 내려놓을 수 없어요' using errcode = '42501'; end if;
  update public.players set titles = t where id = target;
  update public.profiles set role = v_role where player_id = target and role in ('player', 'coach');
end $$;
revoke all on function public.set_member_titles(uuid, text[]) from public, anon;
grant execute on function public.set_member_titles(uuid, text[]) to authenticated;

-- 선수: 하루코 출전 명단(jp-roster 가 채움) · 대표·수상 선수(손으로)
create table public.jp_roster (
  id bigserial primary key,
  school_id text references public.jp_schools(id) on delete set null,
  team text not null, gender text not null check (gender in ('m','w')),
  tourn text not null, year smallint not null,
  no smallint, name text not null, grade smallint check (grade between 1 and 3), height smallint, cap boolean not null default false,
  src text not null
);
create index jp_roster_school on public.jp_roster (school_id);
alter table public.jp_roster enable row level security;
create policy "members read" on public.jp_roster for select to authenticated using (private.is_member());
create table public.jp_stars (
  id bigserial primary key,
  school_id text not null references public.jp_schools(id) on delete cascade,
  gender text not null check (gender in ('m','w')),
  name text not null, kana text, pos text, height smallint,
  senior_year smallint, -- 3학년이 되는 학년도
  name_ko text, roman text, -- 한글 이름 · JVA 로마자 표기
  team_pos text, -- 팀 포지션이 대표와 다를 때 (예: 팀 S · 대표 L)
  tags text[] not null default '{}',
  src text,
  unique (school_id, name)
);
alter table public.jp_stars enable row level security;
create policy "members read" on public.jp_stars for select to authenticated using (private.is_member());
create or replace function public.jp_roster_link() returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.jp_roster r set school_id = private.jp_sid(r.team, null, r.gender) where r.school_id is null;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.jp_roster_link() from public, anon, authenticated;
grant execute on function public.jp_roster_link() to service_role;
create or replace function private.jp_roster_call() returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(
    url := 'https://juhcaodotxspzzzfzrnt.supabase.co/functions/v1/jp-roster',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron')),
    timeout_milliseconds := 120000)
$$;

-- 지역 대회 결과 (jp-block 이 채움)
create table public.jp_block_matches (
  id bigserial primary key,
  region text not null, kind text not null, year smallint not null,
  gender text not null check (gender in ('m','w')),
  rnd text, head text,
  a_name text not null, a_pref text, b_name text not null, b_pref text, a_sets smallint, b_sets smallint,
  src text not null
);
create index jp_block_matches_r on public.jp_block_matches (region, year);
alter table public.jp_block_matches enable row level security;
create policy "members read" on public.jp_block_matches for select to authenticated using (private.is_member());
create or replace function private.jp_block_clean() returns trigger language plpgsql set search_path = '' as $$
begin new.a_pref := nullif(regexp_replace(new.a_pref, '[0-9]+$', ''), ''); new.b_pref := nullif(regexp_replace(new.b_pref, '[0-9]+$', ''), ''); return new; end $$;
create trigger jp_block_clean before insert on public.jp_block_matches for each row execute function private.jp_block_clean();
create view public.jp_block_top with (security_invoker = true) as
with m as (
  select region, kind, year, gender, src, rnd,
    case when a_sets > b_sets then a_name else b_name end w, case when a_sets > b_sets then a_pref else b_pref end wp,
    case when a_sets > b_sets then b_name else a_name end l, case when a_sets > b_sets then b_pref else a_pref end lp
  from public.jp_block_matches where a_sets is distinct from b_sets
), fl as (
  select region, kind, year, gender, src, name, pref, sum(win) wins from (
    select region, kind, year, gender, src, w name, wp pref, 1 win from m where rnd = 'FL'
    union all select region, kind, year, gender, src, l, lp, 0 from m where rnd = 'FL') x
  group by 1,2,3,4,5,6,7
), flr as (select *, rank() over (partition by src, gender order by wins desc) rk from fl
), t as (
  select region, kind, year, gender, src, w name, wp pref, 1 place from m where rnd = 'F'
  union all select region, kind, year, gender, src, l, lp, 2 from m where rnd = 'F'
  union all select region, kind, year, gender, src, l, lp, 3 from m where rnd = 'SF'
  union all select region, kind, year, gender, src, w, wp, 3 from m where rnd = 'SF'
  union all select region, kind, year, gender, src, name, pref,
    case when rk = 1 and not exists (select 1 from m where m.src = flr.src and m.gender = flr.gender and m.rnd = 'F') then 1 else 3 end
  from flr where rk <= 4
)
select region, kind, year, gender, src, name, pref, min(place) place, private.jp_sid(name, pref, gender) school_id
from t group by region, kind, year, gender, src, name, pref;
grant select on public.jp_block_top to authenticated;
create or replace function private.jp_block_call() returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(
    url := 'https://juhcaodotxspzzzfzrnt.supabase.co/functions/v1/jp-block',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron')),
    timeout_milliseconds := 150000)
$$;

-- ========== 7. 예약 작업 (UTC) ==========
-- push-hourly 매시 정각 (사람마다 고른 시각에 아침·저녁 알림)
-- jp-sync-new 05:00 KST · jp-sync-full 05:30 KST (매일), jp-nat-weekly · jp-retag-weekly · jp-fill-weekly (월 19:00~19:45 UTC → 화요일 새벽), jp-pref-weekly 화 04:15 KST, jp-schools-daily 06:00 KST (하루 60개교)
select cron.schedule('jp-fill-weekly', '45 19 * * 1', 'select private.jp_sync_call(''fill'')');
select cron.schedule('jp-rank-daily', '50 21 * * *', 'select private.jp_rank_refresh()');
select cron.schedule('jp-block-weekly', '10 19 * * 1', 'select private.jp_block_call()');
select cron.schedule('jp-roster-weekly', '20 19 * * 1', 'select private.jp_roster_call()');
select cron.schedule('jp-pref-weekly', '15 19 * * 1', 'select private.jp_pref_call()');
select cron.schedule('jp-schools-daily', '0 21 * * *', 'select private.jp_sync_call(''schools'')');
select cron.schedule('jp-nat-weekly', '0 19 * * 1', 'select private.jp_nat_call()');
select cron.schedule('jp-retag-weekly', '30 19 * * 1', 'select private.jp_sync_call(''retag'')');
select cron.schedule('jp-sync-full', '30 20 * * *', 'select private.jp_sync_call(''full'')');
select cron.schedule('jp-sync-new', '0 20 * * *', 'select private.jp_sync_call(''new'')');
select cron.schedule('push-hourly', '0 * * * *', 'select private.push_call(''morning''); select private.push_call(''evening'');');

-- ========== 8. 팀 기본 행 ==========
insert into public.teams (id, name, label, net_cm, swap_days) values
  ('men', 'SNUVT', '남자부', 243, false),
  ('women', 'SNUVT', '여자부', 224, true)
on conflict (id) do nothing;

-- ========== 교내 대회 (2026-10-26 추가): 1학기 총장배 · 2학기 종합체육대회, 남녀 함께 쓰는 표 ==========
create table public.cups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  kind text not null check (kind in ('pres', 'gen')),
  start_date date not null,
  end_date date not null,
  place text check (place is null or length(place) <= 60),
  cafe_url text check (cafe_url is null or (length(cafe_url) <= 300 and cafe_url ~ '^https://')),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create table public.cup_teams (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  grp text check (grp is null or length(grp) <= 4),
  sort int not null default 9,
  withdrawn boolean not null default false,
  ours boolean not null default false
);
create index cup_teams_cup on public.cup_teams (cup_id);
create table public.cup_matches (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  stage text not null default 'group' check (stage in ('group', 'r6', 'qf', 'sf', '3rd', 'f', 'etc')),
  label text check (label is null or length(label) <= 40),
  team_a uuid references public.cup_teams(id) on delete set null,
  team_b uuid references public.cup_teams(id) on delete set null,
  a_label text check (a_label is null or length(a_label) <= 20),
  b_label text check (b_label is null or length(b_label) <= 20),
  score text check (score is null or length(score) <= 40),
  winner uuid references public.cup_teams(id) on delete set null,
  refs jsonb not null default '{}'::jsonb -- {ju 주심, bu 부심, s1·s2 선심, rec 기록심} = 이름
);
create index cup_matches_cup on public.cup_matches (cup_id, date);
create table public.cup_avail (
  cup_id uuid not null references public.cups(id) on delete cascade,
  date date not null,
  player_id uuid not null references public.players(id) on delete cascade,
  name text,
  team_id text,
  going boolean not null,
  note text check (note is null or length(note) <= 60),
  updated_at timestamptz not null default now(),
  primary key (cup_id, date, player_id)
);
-- 이름·팀은 선수 표에서 채움 (다른 팀 선수 표는 못 읽으므로)
create or replace function private.cup_avail_fill() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  select p.name, p.team_id into new.name, new.team_id from public.players p where p.id = new.player_id;
  new.updated_at := now();
  return new;
end $$;
create trigger cup_avail_fill before insert or update on public.cup_avail for each row execute function private.cup_avail_fill();
alter table public.cups enable row level security;
alter table public.cup_teams enable row level security;
alter table public.cup_matches enable row level security;
alter table public.cup_avail enable row level security;
create policy "members read cups" on public.cups for select to authenticated using (private.is_member());
create policy "schedule writes cups" on public.cups for all to authenticated using (private.can('schedule')) with check (private.can('schedule'));
create policy "members read cup_teams" on public.cup_teams for select to authenticated using (private.is_member());
create policy "schedule writes cup_teams" on public.cup_teams for all to authenticated using (private.can('schedule')) with check (private.can('schedule'));
create policy "members read cup_matches" on public.cup_matches for select to authenticated using (private.is_member());
create policy "schedule writes cup_matches" on public.cup_matches for all to authenticated using (private.can('schedule')) with check (private.can('schedule'));
create policy "members read cup_avail" on public.cup_avail for select to authenticated using (private.is_member());
create policy "self or schedule writes cup_avail" on public.cup_avail for all to authenticated
  using ((private.is_member() and player_id = private.my_player_id()) or private.can('schedule'))
  with check ((private.is_member() and player_id = private.my_player_id()) or private.can('schedule'));
revoke all on public.cups, public.cup_teams, public.cup_matches, public.cup_avail from anon;
grant select, insert, update, delete on public.cups, public.cup_teams, public.cup_matches, public.cup_avail to authenticated;
-- 심판 배정용 남녀 명단 (이름·팀만, 부원만)
create or replace function public.cup_people()
 returns table (id uuid, name text, team_id text)
 language sql stable security definer set search_path to ''
as $$
  select p.id, p.name, p.team_id from public.players p
  where private.is_member() and not coalesce(p.alumni, false)
  order by p.team_id, p.name
$$;
revoke all on function public.cup_people() from public, anon;
grant execute on function public.cup_people() to authenticated;
alter table public.cups add column if not exists adv int not null default 2 check (adv between 1 and 4); -- 조 n위까지 본선
-- 2026-10-26: OB전(전원 참, 투표 없음) · 교내 대회 가능일 불참 사유
alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind = any (array['major','minor','tryout','off','termend','ob']));
alter table public.cup_avail add column if not exists reason text check (reason is null or reason = any (array['class','sick','personal','etc']));
-- 2026-10-27: 경기 기록 (세트 점수) — 일정 담당·관리자 또는 그 경기 주심·부심·기록심
alter table public.cup_matches add column if not exists sets jsonb;
create or replace function public.cup_score(mid uuid, new_sets jsonb, new_score text, new_winner uuid)
 returns void language plpgsql security definer set search_path to ''
as $$
declare m public.cup_matches; me text;
begin
  select * into m from public.cup_matches where id = mid;
  if m.id is null then raise exception '경기를 찾을 수 없어요'; end if;
  select name into me from public.players where id = private.my_player_id();
  if not (private.can('schedule') or (private.is_member() and me is not null and me in (m.refs->>'ju', m.refs->>'bu', m.refs->>'rec'))) then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if new_winner is not null and not exists (select 1 from public.cup_teams t where t.id = new_winner and t.cup_id = m.cup_id) then
    raise exception '잘못된 팀이에요' using errcode = '23514';
  end if;
  if new_score is not null and length(new_score) > 40 then raise exception '점수가 너무 길어요' using errcode = '23514'; end if;
  update public.cup_matches set sets = new_sets, score = new_score, winner = new_winner where id = mid;
end $$;
revoke all on function public.cup_score(uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.cup_score(uuid, jsonb, text, uuid) to authenticated;
alter table public.cup_teams add column if not exists ko_out boolean not null default false; -- 본선만 기권 (예선 기록은 남기고 다음 순위가 진출)
alter table public.cups add column if not exists picks jsonb not null default '{}'::jsonb; -- 조 1위의 본선 자리 선택 {"B": "6강 1경기"}
-- 2026-10-29: 교내 대회 팀 사진(비공개 버킷 cup-photos) · 대회 공지 문구
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cup-photos', 'cup-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
create policy "members read cup photos" on storage.objects for select to authenticated using (bucket_id = 'cup-photos' and private.is_member());
create policy "members upload cup photos" on storage.objects for insert to authenticated with check (bucket_id = 'cup-photos' and private.is_member());
create policy "owner or schedule delete cup photos" on storage.objects for delete to authenticated using (bucket_id = 'cup-photos' and (owner = auth.uid() or private.can('schedule')));
create table public.cup_photos (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  match_id uuid references public.cup_matches(id) on delete set null,
  team_id uuid not null references public.cup_teams(id) on delete cascade,
  path text not null check (path like 'cup/%' and length(path) <= 200),
  author uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index cup_photos_cup on public.cup_photos (cup_id);
alter table public.cup_photos enable row level security;
create policy "members read cup_photos" on public.cup_photos for select to authenticated using (private.is_member());
create policy "members add cup_photos" on public.cup_photos for insert to authenticated with check (private.is_member() and author = auth.uid());
create policy "owner or schedule delete cup_photos" on public.cup_photos for delete to authenticated using (author = auth.uid() or private.can('schedule'));
revoke all on public.cup_photos from anon;
grant select, insert, delete on public.cup_photos to authenticated;
alter table public.cups add column if not exists notice text check (notice is null or length(notice) <= 2000);
-- 2026-10-29: 전력분석 코트 입력 (예전 VolleyballLogger 방식) — 라인업 · 동작 · 우리/상대 로테 · 점수
alter table public.scout_matches add column if not exists lineup jsonb not null default '{}'::jsonb;
alter table public.scout_matches add column if not exists stage text check (stage is null or length(stage) <= 30);
alter table public.scout_matches add column if not exists recorder text check (recorder is null or length(recorder) <= 30);
alter table public.scout_events add column if not exists action text check (action is null or length(action) <= 30);
alter table public.scout_events add column if not exists detail text check (detail is null or length(detail) <= 30);
alter table public.scout_events add column if not exists rot smallint check (rot is null or rot between 1 and 6);
alter table public.scout_events add column if not exists opp_rot smallint check (opp_rot is null or opp_rot between 1 and 6);
alter table public.scout_events add column if not exists serve text check (serve is null or serve in ('us', 'opp'));
alter table public.scout_events add column if not exists point text check (point is null or point in ('us', 'opp'));
alter table public.scout_events add column if not exists score text check (score is null or length(score) <= 10);
alter table public.scout_events drop constraint if exists scout_events_skill_check;
alter table public.scout_events add constraint scout_events_skill_check check (skill = any (array['serve', 'receive', 'attack', 'block', 'dig', 'set', 'free', 'fault']));
alter table public.scout_points add column if not exists opp_rot smallint check (opp_rot is null or opp_rot between 1 and 6);
alter table public.scout_points add column if not exists event_id uuid references public.scout_events(id) on delete cascade;
-- 2026-10-29: 학사일정 (남녀 함께) · 일정 종류 '개강'
alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind = any (array['major','minor','tryout','off','termend','ob','semstart']));
create table public.terms (
  id text primary key check (id ~ '^\d{4}-[12]$'),
  start_date date,
  end_date date,
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date > start_date)
);
alter table public.terms enable row level security;
create policy "members read terms" on public.terms for select to authenticated using (private.is_member());
create policy "schedule writes terms" on public.terms for all to authenticated using (private.can('schedule')) with check (private.can('schedule'));
revoke all on public.terms from anon;
grant select, insert, update, delete on public.terms to authenticated;
-- 2026-10-29: 경기 기록은 부원 누구나 (cup_score 권한 넓힘)
create or replace function public.cup_score(mid uuid, new_sets jsonb, new_score text, new_winner uuid)
 returns void language plpgsql security definer set search_path to ''
as $$
declare m public.cup_matches;
begin
  select * into m from public.cup_matches where id = mid;
  if m.id is null then raise exception '경기를 찾을 수 없어요'; end if;
  if not (private.is_member() or private.can('schedule')) then raise exception '권한이 없어요' using errcode = '42501'; end if;
  if new_winner is not null and not exists (select 1 from public.cup_teams t where t.id = new_winner and t.cup_id = m.cup_id) then
    raise exception '잘못된 팀이에요' using errcode = '23514';
  end if;
  if new_score is not null and length(new_score) > 40 then raise exception '점수가 너무 길어요' using errcode = '23514'; end if;
  update public.cup_matches set sets = new_sets, score = new_score, winner = new_winner where id = mid;
end $$;
-- 2026-10-29: 경기 기록은 그 경기 기록심 + 관리자·주장·부주장만 (위 cup_score 대신)
create or replace function public.cup_score(mid uuid, new_sets jsonb, new_score text, new_winner uuid)
 returns void language plpgsql security definer set search_path to ''
as $$
declare m public.cup_matches; me text;
begin
  select * into m from public.cup_matches where id = mid;
  if m.id is null then raise exception '경기를 찾을 수 없어요'; end if;
  select name into me from public.players where id = private.my_player_id();
  if not (private.can('schedule') or (private.is_member() and me is not null and me = m.refs->>'rec')) then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if new_winner is not null and not exists (select 1 from public.cup_teams t where t.id = new_winner and t.cup_id = m.cup_id) then
    raise exception '잘못된 팀이에요' using errcode = '23514';
  end if;
  if new_score is not null and length(new_score) > 40 then raise exception '점수가 너무 길어요' using errcode = '23514'; end if;
  update public.cup_matches set sets = new_sets, score = new_score, winner = new_winner where id = mid;
end $$;
-- 2026-10-29: 전력분석 치지직 다시보기 · 경기 기록은 그 경기 주심·부심·기록심 + 관리자·주장·부주장
alter table public.scout_matches add column if not exists vod text check (vod is null or (length(vod) <= 200 and vod ~ '^https://(m\.)?chzzk\.naver\.com/video/[0-9]+'));
create or replace function public.cup_score(mid uuid, new_sets jsonb, new_score text, new_winner uuid)
 returns void language plpgsql security definer set search_path to ''
as $$
declare m public.cup_matches; me text;
begin
  select * into m from public.cup_matches where id = mid;
  if m.id is null then raise exception '경기를 찾을 수 없어요'; end if;
  select name into me from public.players where id = private.my_player_id();
  if not (private.can('schedule') or (private.is_member() and me is not null and me in (m.refs->>'ju', m.refs->>'bu', m.refs->>'rec'))) then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if new_winner is not null and not exists (select 1 from public.cup_teams t where t.id = new_winner and t.cup_id = m.cup_id) then
    raise exception '잘못된 팀이에요' using errcode = '23514';
  end if;
  if new_score is not null and length(new_score) > 40 then raise exception '점수가 너무 길어요' using errcode = '23514'; end if;
  update public.cup_matches set sets = new_sets, score = new_score, winner = new_winner where id = mid;
end $$;

-- 전력분석 코트 입력: 교체 기록 (skill 'sub', zone = 바뀐 자리 1~6, detail = 나간 선수)
alter table public.scout_events drop constraint scout_events_skill_check;
alter table public.scout_events add constraint scout_events_skill_check check (skill = any (array['serve','receive','attack','block','dig','set','free','fault','sub']));

-- 전력분석 = 예전 프로그램: 6/9인제, 랠리, Settings 기록
alter table public.scout_matches add column if not exists division text not null default '6' check (division in ('6','9'));
alter table public.scout_events add column if not exists rally smallint check (rally is null or (rally >= 1 and rally <= 200));
alter table public.scout_events drop constraint scout_events_skill_check;
alter table public.scout_events add constraint scout_events_skill_check check (skill = any (array['serve','receive','attack','block','dig','set','free','fault','sub','cfg']));

-- 대회 실시간 기록 (live.js): 경기마다 랠리 결과만
create table public.live_games (
  id uuid primary key default gen_random_uuid(),
  team_id text not null default private.my_team(),
  ref_kind text not null check (ref_kind in ('event','friendly')),
  ref_id text not null check (char_length(ref_id) <= 64),
  label text check (label is null or char_length(label) <= 40),
  opponent text not null check (char_length(opponent) between 1 and 60),
  sets jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index live_games_ref on public.live_games (ref_kind, ref_id);
create table public.live_rallies (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.live_games(id) on delete cascade,
  set_no smallint not null check (set_no between 1 and 5),
  rot smallint check (rot is null or rot between 1 and 6),
  serve text not null check (serve in ('us','opp')),
  won boolean not null,
  how text check (how is null or char_length(how) <= 12),
  player_id uuid references public.players(id) on delete set null,
  pass text check (pass is null or pass in ('A','B','C')),
  author uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index live_rallies_game on public.live_rallies (game_id, set_no, created_at);
create or replace function private.live_team(g uuid) returns text language sql stable security definer set search_path = '' as $$ select team_id from public.live_games where id = g $$;
alter table public.live_games enable row level security;
alter table public.live_rallies enable row level security;
create policy "team scope" on public.live_games as restrictive for all using (team_id = (select private.my_team())) with check (team_id = (select private.my_team()));
create policy "live read" on public.live_games for select using (private.is_member());
create policy "live write" on public.live_games for all using (private.can('analysis') or private.can('schedule')) with check (private.can('analysis') or private.can('schedule'));
create policy "team scope" on public.live_rallies as restrictive for all using (private.live_team(game_id) = (select private.my_team())) with check (private.live_team(game_id) = (select private.my_team()));
create policy "rally read" on public.live_rallies for select using (private.is_member());
create policy "rally add" on public.live_rallies for insert with check ((private.can('analysis') or private.can('schedule')) and author = (select auth.uid()));
create policy "rally del" on public.live_rallies for delete using (author = (select auth.uid()) or private.can('analysis') or private.can('schedule'));
grant select, insert, update, delete on public.live_games, public.live_rallies to authenticated;

-- 실시간 기록을 우리 선수 플레이 단위로
alter table public.live_rallies alter column won drop not null;
alter table public.live_rallies add column if not exists kind text check (kind is null or kind in ('rcv','atk','blk','srv','set','err','opt','oer'));
alter table public.live_rallies add column if not exists res text check (res is null or char_length(res) <= 8);
alter table public.live_rallies add column if not exists zone smallint check (zone is null or zone between 1 and 6);
alter table public.live_rallies add column if not exists opp_no smallint check (opp_no is null or opp_no between 0 and 99);
alter table public.live_rallies add column if not exists blockers smallint check (blockers is null or blockers between 1 and 3);
alter table public.live_rallies add column if not exists point text check (point is null or point in ('us','opp'));

-- 실시간 기록 버튼판: 우리·상대 둘 다
alter table public.live_rallies add column if not exists side text not null default 'us' check (side in ('us','opp'));
alter table public.live_rallies drop constraint if exists live_rallies_kind_check;
alter table public.live_rallies add constraint live_rallies_kind_check check (kind is null or kind in ('rcv','atk','blk','srv','dig','set','err','opt','oer'));

-- 실시간 기록: 공격 종류 · 떨어진 자리
alter table public.live_rallies add column if not exists atype text check (atype is null or atype in ('w4','o2','q3','pipe','etc'));
alter table public.live_rallies add column if not exists x smallint check (x is null or x between 0 and 100);
alter table public.live_rallies add column if not exists y smallint check (y is null or y between 0 and 100);
alter table public.live_rallies drop constraint if exists live_rallies_zone_check;
alter table public.live_rallies add constraint live_rallies_zone_check check (zone is null or zone between 1 and 9);

-- live_shot
alter table public.live_rallies add column if not exists shot text check (shot is null or shot in ('spike','tip'));

-- live_atype2_miss
alter table public.live_rallies drop constraint if exists live_rallies_atype_check;
alter table public.live_rallies add constraint live_rallies_atype_check check (atype is null or atype in ('lo','lq','ro','rq','a','b','mv','fc','bc','pipe','back','etc','w4','o2','q3'));
alter table public.live_rallies add column if not exists miss text check (miss is null or miss in ('atk','set'));

-- analysis_any_team (분석 팀이 SNU가 아니어도 됨 · 전력분석에서 실시간 경기 분석)
alter table public.live_games drop constraint if exists live_games_ref_kind_check;
alter table public.live_games add constraint live_games_ref_kind_check check (ref_kind in ('event','friendly','scout'));
alter table public.live_games add column if not exists team text check (team is null or char_length(team) between 1 and 60);
alter table public.live_games add column if not exists roster jsonb not null default '{}'::jsonb;
alter table public.scout_matches add column if not exists team text check (team is null or char_length(team) between 1 and 60);

-- live_realtime (실시간 경기 분석: 다른 사람 기록이 바로 보이게)
alter publication supabase_realtime add table public.live_rallies, public.live_games;

-- live_rally_tag (번호 대신 이름표: OH1 · Li …)
alter table public.live_rallies add column if not exists tag text check (tag is null or char_length(tag) between 1 and 8);

-- weight_private (여자부: 몸무게 비공개 → 저장 안 함)
alter table public.player_private add column if not exists weight_private boolean not null default false;
create or replace function public.set_weight_private(on_ boolean) returns void language plpgsql security definer set search_path = '' as $$
declare pid uuid := private.my_player_id();
begin
  if pid is null then raise exception '권한이 없어요' using errcode = '42501'; end if;
  insert into public.player_private (player_id, weight, weight_private, updated_at) values (pid, null, coalesce(on_, false), now())
    on conflict (player_id) do update set weight_private = coalesce(on_, false), weight = case when coalesce(on_, false) then null else public.player_private.weight end, updated_at = now();
  if coalesce(on_, false) then update public.players set weight = null where id = pid; end if;
end $$;
revoke all on function public.set_weight_private(boolean) from public, anon;
grant execute on function public.set_weight_private(boolean) to authenticated;

-- live_setter (세트: 누가 올렸는지 · 세트 점수)
alter table public.live_rallies add column if not exists setter text check (setter is null or char_length(setter) <= 40);
alter table public.live_rallies add column if not exists set_q smallint check (set_q is null or set_q between 1 and 3);

-- live_flow_kinds (캐치 · 넘김 · 세트 이단 · 타법 밀어넣기 · 연타)
alter table public.live_rallies drop constraint if exists live_rallies_kind_check;
alter table public.live_rallies add constraint live_rallies_kind_check check (kind is null or kind in ('rcv','atk','blk','srv','dig','set','err','opt','oer','cat','ovr'));
alter table public.live_rallies drop constraint if exists live_rallies_shot_check;
alter table public.live_rallies add constraint live_rallies_shot_check check (shot is null or shot in ('spike','tip','push','soft'));
alter table public.live_rallies add column if not exists two boolean;

-- live_cover_kind (막힌 공 커버한 사람)
alter table public.live_rallies drop constraint if exists live_rallies_kind_check;
alter table public.live_rallies add constraint live_rallies_kind_check check (kind is null or kind in ('rcv','atk','blk','srv','dig','set','err','opt','oer','cat','ovr','cov'));

-- live_mode (전체 기록 / 라이트)
alter table public.live_games add column if not exists mode text not null default 'full' check (mode in ('full','lite'));

-- live_video_mode (영상 분석 방식 · 서브 종류)
alter table public.live_games drop constraint if exists live_games_mode_check;
alter table public.live_games add constraint live_games_mode_check check (mode in ('full','lite','video'));
alter table public.live_rallies add column if not exists stype text check (stype is null or stype in ('fl','jf','js','un'));

-- live_video_links (영상 분석 방식: 유튜브 · 치지직)
alter table public.live_games add column if not exists yt text check (yt is null or char_length(yt) <= 200);
alter table public.live_games add column if not exists vod text check (vod is null or char_length(vod) <= 200);

-- 일본 고교 영상: 채널 이름 (2026-10-31)
alter table public.jp_videos add column if not exists ch text;
-- 일본 고교 영상: 다른 사이트 재생이 막힌 영상 (oEmbed 401/403/404)
alter table public.jp_videos add column if not exists noembed boolean;
-- 일본 고교: 경기마다 영상 찾아본 시각, 빠진 상대 학교 후보
alter table public.jp_matches add column if not exists searched_at timestamptz;
create table if not exists public.jp_school_cand (
  name text not null, pref text not null, n int not null default 0, g text, status text, wiki text, school_id text, tried_at timestamptz,
  primary key (name, pref)
);
alter table public.jp_school_cand enable row level security;
