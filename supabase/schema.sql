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
