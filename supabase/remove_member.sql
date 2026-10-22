-- 팀원 계정 삭제 기능
-- Supabase 대시보드 > SQL Editor > New query 에 붙여넣고 Run 하세요. 한 번만 실행합니다.
--
-- 관리자(coach)가 팀원 계정을 없앤다. 그 계정에만 연결된 선수 정보도 함께 없앤다
-- (측정·기록·부상·인바디·통증 체크는 players 의 on delete cascade 로 함께 지워짐).
-- 사이트는 이 함수를 부르기 전에 선수 정보를 먼저 지우므로, 이 파일을 다시 실행하지 않아도 동작한다.
create or replace function public.remove_member(target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.profiles%rowtype;
begin
  if not private.is_coach() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception '내 계정은 여기서 없앨 수 없어요' using errcode = '42501'; end if;
  select * into t from public.profiles where id = target;
  if not found then return; end if;
  if t.player_id is not null
     and not exists (select 1 from public.profiles o where o.player_id = t.player_id and o.id <> target) then
    delete from public.players where id = t.player_id;
  end if;
  delete from auth.users where id = target;
end;
$$;

revoke execute on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;
