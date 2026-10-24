-- SNUVT 피지컬 보드 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor > New query 에 전체를 붙여넣고 Run 하세요. 한 번만 실행합니다.
--
-- 권한 구조
--   pending : 가입만 한 상태. 아무 데이터도 볼 수 없음 (담당자가 승인해야 함)
--   player  : 선수. 명단·처방·측정값을 보고, 자기 기록만 남기고 볼 수 있음. 자기 부상 정보만 볼 수 있음
--   coach   : 피지컬 담당자. 모든 데이터를 보고 수정함. 팀원 승인과 선수 연결을 함

create extension if not exists pgcrypto;

-- ---------- 테이블 ----------

create table public.settings (
  id          int  primary key default 1 check (id = 1),
  name        text not null default '서울대배',
  block_start date not null,
  start_date  date not null,
  end_date    date not null
);

create table public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  pos        text not null check (pos in ('OH','MB','OP','S','Li')),
  year       text,
  height     numeric,
  weight     numeric,
  exp        numeric,
  weight_exp text check (weight_exp in ('none','lt6','gte6')),
  adjust     jsonb not null default '{}'::jsonb,   -- 처방 조정 코드 (이유는 health 에만 있음)
  sort       int  not null default 99,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'pending' check (role in ('pending','player','coach')),
  player_id  uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.health (
  player_id   uuid primary key references public.players(id) on delete cascade,
  ankle_l     int  not null default 0,
  ankle_r     int  not null default 0,
  ankle_last  text,
  knee_injury boolean not null default false,
  pain        jsonb not null default '{}'::jsonb,   -- {"knee":0,"shoulder":0,"ankle":0,"back":0}
  note        text,
  consent     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table public.tests (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  date       date not null,
  reach      numeric,
  cmj        numeric,
  block      numeric,
  approach   numeric,
  bal_l      boolean,
  bal_r      boolean,
  hs_stage   int check (hs_stage between 1 and 4),
  hs_sec     int,
  squat      numeric,
  rdl        numeric,
  pull       int,
  created_at timestamptz not null default now()
);

create table public.logs (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  author     uuid default auth.uid() references auth.users(id) on delete set null,
  date       date not null,
  type       text not null check (type in ('A','B','team','act','match','other')),
  minutes    int  not null check (minutes between 1 and 400),
  rpe        int  not null check (rpe between 0 and 10),
  jumps      int  check (jumps between 0 and 2000),
  pain_area  text check (pain_area in ('knee','shoulder','ankle','back')),
  pain       int  not null default 0 check (pain between 0 and 10),
  note       text,
  created_at timestamptz not null default now()
);

create index tests_player_idx on public.tests (player_id, date);
create index logs_player_idx  on public.logs  (player_id, date);
create index profiles_player_idx on public.profiles (player_id);
create index logs_author_idx on public.logs (author);

-- ---------- 권한 확인 함수 ----------
-- REST API(/rpc)로 노출되지 않도록 비공개 스키마에 둔다
create schema if not exists private;
grant usage on schema private to anon, authenticated;


create or replace function private.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'coach' from public.profiles where id = auth.uid()), false)
$$;

create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('player','coach') from public.profiles where id = auth.uid()), false)
$$;

create or replace function private.my_player_id() returns uuid
language sql stable security definer set search_path = public as $$
  select player_id from public.profiles where id = auth.uid()
$$;

-- 가입하면 profiles 에 'pending' 으로 자동 등록
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- ---------- 행 단위 보안 (RLS) ----------

alter table public.settings enable row level security;
alter table public.players  enable row level security;
alter table public.profiles enable row level security;
alter table public.health   enable row level security;
alter table public.tests    enable row level security;
alter table public.logs     enable row level security;

-- 설정, 선수 명단, 측정값: 승인된 팀원은 읽기, 담당자만 쓰기
create policy "members read settings" on public.settings for select using (private.is_member());
create policy "coach writes settings" on public.settings for all using (private.is_coach()) with check (private.is_coach());

create policy "members read players" on public.players for select using (private.is_member());
create policy "coach writes players" on public.players for all using (private.is_coach()) with check (private.is_coach());

create policy "members read tests" on public.tests for select using (private.is_member());
create policy "coach writes tests" on public.tests for all using (private.is_coach()) with check (private.is_coach());

-- 계정: 본인과 담당자만 보기, 역할·선수 연결은 담당자만 변경 (본인이 스스로 coach 가 될 수 없음)
create policy "self or coach reads profile" on public.profiles for select using (id = auth.uid() or private.is_coach());
create policy "coach updates profiles" on public.profiles for update using (private.is_coach()) with check (private.is_coach());

-- 부상·통증: 담당자는 전체, 선수는 자기 것만 보기. 쓰기는 담당자만
create policy "coach or self reads health" on public.health for select
  using (private.is_coach() or (private.is_member() and player_id = private.my_player_id()));
create policy "coach writes health" on public.health for all using (private.is_coach()) with check (private.is_coach());

-- 세션 기록: 담당자는 전체, 선수는 자기 기록만 보고 남김. 삭제는 담당자만
create policy "coach or self reads logs" on public.logs for select
  using (private.is_coach() or (private.is_member() and player_id = private.my_player_id()));
create policy "coach or self inserts logs" on public.logs for insert
  with check (private.is_coach() or (private.my_role() = 'player' and player_id = private.my_player_id() and author = auth.uid()));
create policy "coach deletes logs" on public.logs for delete using (private.is_coach());

-- ---------- 초기 데이터 ----------

insert into public.settings (id, name, block_start, start_date, end_date)
values (1, '서울대배', '2026-10-26', '2026-11-21', '2026-11-22');

insert into public.players (name, pos, sort) values
  ('손수호', 'OH', 1),
  ('김도현', 'OH', 2),
  ('최수혁', 'S',  3),
  ('권병석', 'Li', 4),
  ('박혁찬', 'Li', 5),
  ('엄정호', 'OP', 6),
  ('윤동우', 'OP', 7),
  ('최지우', 'MB', 8),
  ('박준서', 'MB', 9);

-- ---------- 담당자 지정 (사이트에서 처음 가입한 뒤 따로 실행) ----------
-- 아래 두 줄의 이메일을 내 가입 이메일로 바꿔서, 가입 후 SQL Editor 에서 한 번 실행하세요.
--
-- update public.profiles
--   set role = 'coach', player_id = (select id from public.players where name = '최수혁')
--   where email = '내-가입-이메일@example.com';

-- ---------- 가입한 사람의 자기 정보 제출 (2026-10-22 추가) ----------
-- 승인 대기(pending) 상태에서만 제출·수정할 수 있고, 승인 후 수정은 담당자가 한다.
create or replace function public.submit_my_info(info jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me        public.profiles%rowtype;
  pid       uuid;
  v_name    text := btrim(coalesce(info->>'name', ''));
  v_pos     text := info->>'pos';
  v_wexp    text := info->>'weight_exp';
  v_height  numeric := nullif(info->>'height', '')::numeric;
  v_weight  numeric := nullif(info->>'weight', '')::numeric;
  v_exp     numeric := nullif(info->>'exp', '')::numeric;
  a_l int := coalesce(nullif(info->>'ankle_l', '')::int, 0);
  a_r int := coalesce(nullif(info->>'ankle_r', '')::int, 0);
  p_knee int := coalesce(nullif(info#>>'{pain,knee}', '')::int, 0);
  p_sh   int := coalesce(nullif(info#>>'{pain,shoulder}', '')::int, 0);
  p_an   int := coalesce(nullif(info#>>'{pain,ankle}', '')::int, 0);
  p_bk   int := coalesce(nullif(info#>>'{pain,back}', '')::int, 0);
  v_adjust jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  if me.role <> 'pending' then raise exception '승인된 계정의 정보는 담당자가 수정해요' using errcode = '42501'; end if;
  if coalesce((info->>'consent')::boolean, false) is not true then raise exception '정보 사용 동의가 필요해요' using errcode = '23514'; end if;
  if v_name = '' or length(v_name) > 20 then raise exception '이름을 1–20자로 입력해 주세요' using errcode = '23514'; end if;
  if v_pos is null or v_pos not in ('OH','MB','OP','S','Li') then raise exception '포지션을 골라 주세요' using errcode = '23514'; end if;
  if v_wexp is not null and v_wexp not in ('none','lt6','gte6') then raise exception '웨이트 경험을 골라 주세요' using errcode = '23514'; end if;
  if v_height is not null and (v_height < 140 or v_height > 220) then raise exception '키를 확인해 주세요' using errcode = '23514'; end if;
  if v_weight is not null and (v_weight < 40 or v_weight > 150) then raise exception '몸무게를 확인해 주세요' using errcode = '23514'; end if;
  if v_exp is not null and (v_exp < 0 or v_exp > 20) then raise exception '배구 경력을 확인해 주세요' using errcode = '23514'; end if;
  if least(a_l, a_r) < 0 or greatest(a_l, a_r) > 30 then raise exception '발목 염좌 횟수를 확인해 주세요' using errcode = '23514'; end if;
  if least(p_knee, p_sh, p_an, p_bk) < 0 or greatest(p_knee, p_sh, p_an, p_bk) > 10 then raise exception '통증은 0–10으로 입력해 주세요' using errcode = '23514'; end if;

  v_adjust := jsonb_strip_nulls(jsonb_build_object(
    'plyo',     case when p_an >= 3 then 'hold' when p_knee >= 3 then 'iso' end,
    'overhead', case when p_sh >= 3 then true end,
    'back',     case when p_bk >= 3 then true end,
    'ankleBal', case when a_l + a_r > 0 then true end,
    'refer',    case when greatest(p_knee, p_sh, p_an, p_bk) >= 3 then true end
  ));

  if me.player_id is null then
    insert into public.players (name, pos, year, height, weight, exp, weight_exp, adjust, sort)
    values (v_name, v_pos, nullif(btrim(coalesce(info->>'year', '')), ''), v_height, v_weight, v_exp, v_wexp, v_adjust,
            (select coalesce(max(sort), 0) + 1 from public.players))
    returning id into pid;
    update public.profiles set player_id = pid where id = me.id;
  else
    pid := me.player_id;
    update public.players
       set name = v_name, pos = v_pos, year = nullif(btrim(coalesce(info->>'year', '')), ''),
           height = v_height, weight = v_weight, exp = v_exp, weight_exp = v_wexp, adjust = v_adjust
     where id = pid;
  end if;

  insert into public.health (player_id, ankle_l, ankle_r, ankle_last, knee_injury, pain, note, consent, updated_at)
  values (pid, a_l, a_r, nullif(btrim(coalesce(info->>'ankle_last', '')), ''),
          coalesce((info->>'knee_injury')::boolean, false),
          jsonb_build_object('knee', p_knee, 'shoulder', p_sh, 'ankle', p_an, 'back', p_bk),
          nullif(btrim(coalesce(info->>'note', '')), ''), true, now())
  on conflict (player_id) do update
    set ankle_l = excluded.ankle_l, ankle_r = excluded.ankle_r, ankle_last = excluded.ankle_last,
        knee_injury = excluded.knee_injury, pain = excluded.pain, note = excluded.note,
        consent = true, updated_at = now();
  return pid;
end;
$$;

revoke execute on function public.submit_my_info(jsonb) from public, anon;
grant execute on function public.submit_my_info(jsonb) to authenticated;

create policy "self reads own player" on public.players for select using (id = private.my_player_id());
create policy "pending self reads own health" on public.health for select using (player_id = private.my_player_id());

-- ---------- 상황별 처방 모듈 · 인바디 (2026-10-22 추가, 이미 적용됨) ----------
alter table public.health add column if not exists rehab jsonb not null default '[]'::jsonb; -- [{area, stage 1–4, note}]

create table if not exists public.inbody (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  date date not null,
  weight numeric check (weight between 30 and 200),
  smm numeric check (smm between 10 and 80),
  fat_mass numeric check (fat_mass between 0 and 100),
  pbf numeric check (pbf between 1 and 60),
  leg_r numeric check (leg_r between 1 and 30),
  leg_l numeric check (leg_l between 1 and 30),
  standardized boolean not null default false,
  note text,
  author uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.inbody enable row level security;
create policy "coach or self reads inbody" on public.inbody for select
  using (private.is_coach() or (private.is_member() and player_id = private.my_player_id()));
create policy "coach or self inserts inbody" on public.inbody for insert
  with check (private.is_coach() or (private.my_role() = 'player' and player_id = private.my_player_id() and author = auth.uid()));
create policy "coach or self removes inbody" on public.inbody for delete
  using (private.is_coach() or (private.my_role() = 'player' and player_id = private.my_player_id()));

-- ---------- 손목·손가락 통증 (2026-10-22 추가, 이미 적용됨) ----------
-- logs.pain_area 에 wrist·finger 허용, submit_my_info 가 pain.wrist·pain.finger 도 저장 (마이그레이션 pain_wrist_finger)
alter table public.logs drop constraint if exists logs_pain_area_check;
alter table public.logs add constraint logs_pain_area_check
  check (pain_area = any (array['knee','shoulder','ankle','back','wrist','finger']));

-- ---------- 통증 체크 · 코어 테스트 · 정보 없는 승인 계정 (2026-10-23, 이미 적용됨: 마이그레이션 pain_checks_core_tests_selfreg) ----------
-- tests: side_l, side_r, sorensen, flexor, author 추가. 선수는 코어 항목만 있는 행을 직접 추가·삭제 가능
-- pain_checks: 부위별 운동 중(during) · 다음 날 아침(morning) · 쉴 때(rest) 통증 기록, 본인·관리자만
-- submit_my_info: 승인 대기이거나 player_id 가 없는 계정이면 호출 가능, 통증은 {d, m, r} 형식으로 저장

-- ---------- 웨이트 경험 3단계 · 부상 이력 · 풀 플랭크 (2026-10-23, 이미 적용됨: 마이그레이션 weight_levels_injuries_plank) ----------
-- players.weight_exp: none 초보자 · machine 중급자 · free 숙련자 (lt6→machine, gte6→free 로 바꿈)
-- health.injuries jsonb: [{side, part, type, year, surgery}], tests.plank (풀 플랭크 초)

-- ---------- 1년 일정 · 물구나무 걷기 (2026-10-23, 이미 적용됨: 마이그레이션 season_events_handstand_walk) ----------
-- events: 대회·트라이아웃·비시즌 일정 (kind: major 주요 대회 · minor 9인제·기타 · tryout · off 비시즌·방학)
--   팀원 모두 읽기, 관리자만 추가·삭제. 프로그램은 이 일정과 날짜(학기)로 자동으로 정해짐 → settings 는 더 안 씀
-- tests.hs_stage 1–5 (5 = 혼자 걷기), tests.hs_walk 물구나무 걷기 거리 (m). 선수도 직접 기록 가능

-- ---------- 웨이트 경험 4단계 (2026-10-23, 이미 적용됨: 마이그레이션 weight_exp_four_levels) ----------
-- players.weight_exp: none 아기 · machine 유아 · free 청소년 · oly 성인(파워 클린 등 역도 동작)
-- submit_my_info 도 oly 허용.
-- inbody 테이블은 남겨 두지만 화면에서는 더 쓰지 않음

-- ---------- 2학기 종강 (2026-10-23, 이미 적용됨: 마이그레이션 events_term_end) ----------
-- events.kind 에 termend(2학기 종강) 추가. 겨울 방학(비시즌)은 앱이 자동으로 종강일 ~ 2월 말로 넣음. 여름 방학은 비시즌 아님.

-- ---------- 버티컬 · 선수 측정 입력 (2026-10-23, 이미 적용됨: 마이그레이션 tests_vertical_player_measure) ----------
-- tests.vert(버티컬, 제자리 점프 높이 cm) · tests.max_vert(맥스 버티컬, 도움닫기 점프 높이 cm) 추가
-- 정책 "player inserts own tests": 선수는 본인 측정 행을 직접 추가 (화면은 측정 주·트라이아웃·첫 측정 때만 입력 칸을 보여 줌)
-- 2학기 종강 = 학사일정의 보강 기간 마지막 날 (2026: 12/21)

-- migration: readiness_lifts_practice_media
--   wellness (player_id, date unique; sleep·fatigue·soreness·stress·mood 1–5) — 본인·관리자만
--   practice (date PK; level light|normal|heavy) — 팀원 읽기, 관리자 쓰기
--   lifts (player_id, date, lift squat|rdl|bench|hip|clean, kg, reps 1–20, rir 0–6) — 본인·관리자만
--   media (name PK, https url) — 팀원 읽기, 관리자 쓰기
--   health.custom jsonb {memo, skip[], swap[{from,to}]}
--   tests: rsi, ktw_l, ktw_r, ir_d, ir_n, er_d, er_n, hop_l, hop_r
--   logs.completion all|part|none

-- migration: lift_sets_and_custom_guard (2026-10-23)
--   lift_sets (player_id, date, name, lift squat|rdl|bench|hip|clean|null, kg, reps 1–20, rir 0–6) — 운동 창에서 세트마다 기록, 본인·관리자만
--   예전 lifts 행은 lift_sets로 옮김 (lifts·practice·media 테이블은 더 이상 쓰지 않음)
--   trigger health_custom_guard: health.custom(개인 조정)은 관리자만 바꿀 수 있음
--   wellness: 4문항(수면·피로·근육통·기분·스트레스). 기분·스트레스 답은 mood와 stress에 같이 저장

-- migration: team_off_and_day_picks (2026-10-23)
--   team_off (date PK, note) — 정규 훈련 없는 날 (체육관 통제 등), 관리자 쓰기·팀원 읽기
--   day_picks (player_id, date unique, pick lower|upper|core|recover) — 그날 선수가 고른 세션, 본인·관리자

-- ===== push_notifications (적용됨) =====
-- push_subs: 기기별 알림 구독 (본인만 RLS). train_days = 앱이 하루 한 번 올리는 앞으로 4주 운동 있는 날
-- vault: vapid_public / vapid_private / push_cron — 서버 안에서만 생성·보관 (파일·클라이언트에 없음)
-- push_targets(kind) · push_keys() · push_gone(ep) · push_set_vapid() : service_role 전용
-- push_pubkey(): 로그인한 사용자용 공개 키
-- edge function 'push' (x-cron 비밀값 확인) ← private.push_call(kind) ← pg_cron
--   push-morning '0 23 * * *' (KST 08:00, 컨디션 안 넣은 사람) · push-evening '0 13 * * *' (KST 22:00, 운동 있는 날 기록 없는 사람)

-- ===== friendlies_and_absences (적용됨) =====
-- friendlies: 교류전 (date, start_time, end_time, opponent, format '6'|'9', place, note) · 부원 읽기, 관리자 쓰기
--   그날 슬롯 = friendly, 앞뒤 날 하체 웨이트는 weekFlow가 옮김 (base = 원래 일정)
-- absences: 불참 (player_id, date, reason class|sick|personal|etc, note) · unique(player_id, date)
--   본인과 관리자만 읽기·쓰기. 아픔·부상 → 그날 회복, 나머지 → 그날은 골라서 하는 날

-- ===== notices_entries_practice_times (적용됨) =====
-- notices: 공지 (title, body, pinned, notify) · 부원 읽기, 관리자 쓰기 · insert 트리거 → 알림(push_subs.notice)
-- entries: 대회(kind 'event')·교류전('friendly')별 엔트리 명단 · 부원 읽기, 관리자 쓰기
-- practice_times: 정규 훈련 시간 key 'S1'|'S2'(학기 기본) 또는 날짜(그날만)

-- ===== tests_tryout_battery (적용됨) =====
-- tests.side_step (반복 옆뛰기 20초, 회) · tests.pro_agility (5-10-5, 초) · 블로킹 점프는 tests.block
-- update_my_profile(info): 승인된 부원이 학년·키·몸무게·배구 경력·웨이트 경험을 직접 수정

-- ===== staff_titles_roster_program_edits (적용됨) =====
-- players.title: admin 관리자 · captain 주장 (role coach, 전체) / vice 부주장 · ops 훈련부장 · treasurer 총무 · trainer 트레이닝 담당 (role player + 맡은 일)
-- private.can(perm): schedule(부주장·훈련부장) · notice(부주장·훈련부장·총무) · roster(부주장·총무) · training(트레이닝 담당), coach는 모두
-- set_member_title(target, title): 관리자·주장만, 관리자·주장 지정 시 role coach
-- players.number 등번호 · player_contacts(전화, 본인·명단 담당만) · submit_my_info 에 number
-- program_edits: 날 종류(slot)·블록(block)마다 운동 박스 add/remove, player_id 없으면 팀 전체 (트레이닝 담당 쓰기)

-- ===== private_body_and_practice_plans (적용됨) =====
-- player_private: 키·몸무게 (본인 · 관리자·주장 · 트레이닝 담당만). players.height/weight 는 비우고 트리거로 옮김
-- private.can('practice'): 관리자·주장 + 훈련부장
-- practice_plans(date pk, title, goal, blocks jsonb[{title, minutes, groups:[{name, pos[], drills:[{n, m, note}]}]}], published)

-- ===== videos_notes_push_hours (적용됨) =====
-- players.media: 영상 담당 · private.can('video'): 관리자·주장 · 부주장 · 영상 담당
-- videos(kind playlist|video, category, title, yt, date, note): 부원만 읽기 (재생목록 링크는 DB에만, 코드에 없음)
-- training_notes(player_id, date, good, fix, next, body, shared): 본인만, 공유하면 can('practice')도 읽기
-- push_subs.morning_at/evening_at (KST 시) · cron 'push-hourly' 매시 정각

-- ===== 졸업·탈퇴 (alumni_and_leave) =====
-- players.alumni, players.left_on 추가
-- private.wipe_personal(pid): 연락처·키/몸무게·부상·노트·컨디션·통증·불참·인바디·개인 편집·선택·알림 삭제
-- public.retire_member(target, wipe_all): 관리자·주장만. 졸업 = 개인정보·계정 삭제 + 이름/기록만 남김, wipe_all = 선수 행까지 삭제
-- public.leave_team(): 본인 탈퇴(계정·기록 모두 삭제), 마지막 관리자는 불가

-- ===== 훈련부장 = 훈련 파트만 · 자율 훈련 (ops_training_only_open_sessions) =====
-- private.can: schedule = vice / notice = vice·treasurer / practice = ops / attend(정규 훈련 시간·없는 날·자율 훈련·불참 확인) = ops·vice
-- practice_times · team_off 쓰기, absences 읽기 → can('attend')
-- open_sessions(date, start_time, end_time, place, note): 읽기 = 부원, 쓰기 = can('attend')
-- open_votes(session_id, player_id, going): 읽기 = 부원, 쓰기 = 본인

-- ===== 군 복무 (players_military) =====
-- players.military: 부원과 같은 권한, 상태만 '군 복무'. 리포트·팀 현황에서 제외

-- ===== 남자부·여자부 (teams_split) =====
-- teams(id, name, label, net_cm, swap_days): men(남자부, 243, 월·목/수·금) · women(여자부, 224, 학기 요일 반대)
-- profiles.team_id: 가입할 때 고른 팀 (handle_new_user 가 raw_user_meta_data.team 을 읽음)
-- 팀 단위 표(players, events, friendlies, notices, practice_plans, practice_times, team_off, videos, open_sessions, program_edits)에 team_id
--   기본값 private.my_team(), 키는 (team_id, date|key)
-- 모든 표에 restrictive 정책 "team scope": 내 팀 행만 (선수 기록 표는 private.player_team(player_id) 로 확인)
-- 관리 함수(직책·영상·졸업·삭제·탈퇴)는 같은 팀만. 공지 알림은 push_targets_team(kind, team) 으로 같은 팀에만
-- 여자부 첫 관리자: update public.profiles set role = 'coach' where email = '...' and team_id = 'women';

-- ===== 총관리자·본인 부상 (super_admin_and_my_injuries) =====
-- profiles.super: 총관리자. switch_team(t) 로 남자부·여자부를 오감
-- private.my_player_id(): 지금 보고 있는 팀의 선수일 때만 (다른 팀에 들어가면 관리자로만)
-- update_my_injuries(injuries): 운동하다 다쳤을 때 본인이 부상 이력·지금 상태를 고침

-- ===== 참가 투표 · 전력분석 · 완료율 5단계 (votes_scout_completion) =====
-- logs.completion: all(100) · most(75) · part(50) · little(25) · none(0)
-- event_votes(kind event|friendly, ref_id, player_id, going, reason, note): 대회·교류전 참가 투표, 본인만 씀
-- scout_matches(team_id, title, date, opponent, yt, note): 전력분석 경기, can('analysis') = 전력분석부장·관리자
-- scout_events(match_id, set_no, side us|opp, player_id, opp_no, skill, kind, len, zone, grade #+!-/=, t): 부원 누구나 입력, 본인 것만 지움
-- wipe_personal 에 event_votes 삭제 추가 (졸업·탈퇴 때 참가 투표도 지움)

-- ===== 전력분석 토스 위치 · 랠리 결과 (scout_src_points) =====
-- scout_events.src: 공격 토스 위치 L 레프트 · M 속공 · R 라이트 · P 파이프 · B 백라이트 (세터 분배 분석)
-- scout_points(match_id, set_no, rot 1~6, serve us|opp, won, t, author): 랠리 결과 → 로테이션별 사이드아웃·브레이크
--   읽기·입력은 팀 부원, 지우기는 본인 또는 can('analysis'). restrictive "team scope" = private.scout_team(match_id)

-- ===== 영상 정렬 (edge function yt-latest) =====
-- 부른 사람 로그인으로 videos(kind=playlist)를 읽고 유튜브 재생목록 페이지의 '마지막 업데이트' 날짜·영상 수를 돌려줌 (유튜브 주소는 안 돌려줌)
-- 일부 공개 영상은 RSS 피드에 안 나와서 페이지를 읽음. 10분 캐시. '가장 최근 영상' 칸은 없애고 최근 업데이트된 재생목록을 위로
-- yt-probe: 테스트용이었고 지금은 410만 돌려줌 (대시보드에서 지워도 됨)

-- ===== 일본 고교 배구 영상 (jp_volley_library · jp_sources_manage_cron) =====
-- jp_sources(id, kind channel|playlist, ref @핸들|재생목록ID, label, role match|visit, cursor, full_done): 모으는 유튜브 채널. 추가·삭제는 관리자
-- jp_schools(id, name_ja, name_ko, pref 都道府県, gender m|w|mw, aliases 're:'=정규식): 학교 사전 (남녀부 공통, 부원 읽기만)
-- jp_videos(id 유튜브 영상ID, source, title, published, year, tourn haruko|ih|kokutai|block|senbatsu|shinjin|practice|univ|other, rnd, gender, schools[])
-- edge function jp-sync(x-cron): 채널 영상 목록을 읽고 제목으로 학교·대회·라운드 태그. mode new|full|retag
--   private.jp_sync_call(mode), public.jp_sync_now()(관리자), cron jp-sync-new 05:00 KST · jp-sync-full 05:30 KST
-- edge function jp-search(로그인): 유튜브 검색 결과만 돌려줌(저장 안 함)
-- 학교 사전을 고친 뒤에는 select private.jp_sync_call('retag');

-- ===== 대회 엔트리 · 서브 타순 (lineups_starters_event_format) =====
-- entries.starter: 주전 여부 (엔트리 = 주전 + 후보)
-- events.format: '6' | '9' (9인제 대회면 서브 타순표)
-- lineups(team_id, kind event|friendly, ref_id, set_no 1~5, data jsonb {team, court, coachHead, coach1, coach2, captain, rows[15]{pid, chk}}): 9인제 서브 타순표. 읽기 부원, 쓰기 can('schedule')
-- jp_sources 추가: mintonette · tmsports · vbharuka · volleyball dreams (경기). 학교 사전 22곳 추가 (간토·도호쿠 등)
-- jp-sync 태그: 중학·대표팀·리그 영상은 other, 옛 '春の高校バレー 第N回'(N<45)은 1969+N 년

-- ===== 일본 고교 대회 성적 (jp_results) =====
-- jp_results(tourn haruko|ih, gender m|w, year, place 1 우승·2 준우승·3 4강, school_id, name_ja): 2010~2026 역대 결과
--   출처: 일본어 위키백과 「全日本バレーボール高等学校選手権大会」「全国高等学校総合体育大会バレーボール競技大会」(2026-10-24 확인)
--   강팀 ★·지역 순서·학교 '대회 성적'은 이 표만 씀 (영상 제목으로 짐작하지 않음). 새 대회 끝나면 여기에 한 줄씩 추가
-- 학교 사전 16곳 추가(여자부 강호 등), 남녀부 표시 수정

-- ===== 교류전 세트별 출전 · 일정 방식 · 옛 영상 정리 =====
-- 일정 추가에서 방식(6·9인제) 선택 → events.format. 대회 페이지의 방식 선택은 없앰
-- lineups.data.members: 교류전 세트별 출전 선수 (1~5세트). 9인제는 같은 세트에 서브 타순(rows)도
-- jp_videos: 2010년 이전 영상 지움 + 트리거 jp_skip_old 로 앞으로도 안 쌓음. 채널 추가: H-VB · sebas channel sports

-- ===== 전국 본선 / 현 예선 위계 (jp_matches · jp-nat) =====
-- jp_matches(tourn haruko|ih, gender, year, rnd F|SF|QF|R1~R6|rep|group|3rd, a_name, a_pref, b_name, b_pref, 세트 점수, src):
--   전국대회 대진. edge function jp-nat 가 koko-volley.com '日程・結果' 글(+ 春高 연도별 결과 글)에서 모음. 매주 월 19:00 UTC(jp-nat-weekly)
-- jp-sync 태그 순서: ① 그해 전국 대진에 두 학교가 있으면 → 전국(대진의 라운드로) ② 학교 이름을 뺀 제목에 「県男子·県大会·県総体…」 → 현 예선
--   ③ 대진이 있는 해인데 대진에 없는 대결 → 현 예선 ④ 대진이 없는 해: 같은 현끼리이거나 결승·4강인데 jp_results 와 안 맞으면 현 예선
--   令和·平成 연도도 읽음. 매주 월 19:30 UTC 에 다시 분류(jp-retag-weekly)
-- 앱: 하루코·인터하이는 결승 → 4강 → 8강 → 16강 → 2회전 → 1회전 → 현 예선 순. 학교 페이지도 대회를 고르면 같은 순서
