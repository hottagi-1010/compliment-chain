-- =====================================================================
-- 동료 칭찬 게시판: 초기 스키마, RLS, DB 함수
-- 원칙
--   1) 모든 테이블 RLS 활성화, 기본 거부
--   2) 익명 글 작성자(praises.author_id)는 어떤 역할에도 노출하지 않는다
--   3) 민감한 쓰기 로직은 security definer 함수에 둔다
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- 설정 (가입 허용 도메인 등). 클라이언트 접근 불가
-- ---------------------------------------------------------------------
create table app_config (
  key text primary key,
  value text not null
);

-- ---------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_no text unique not null,
  name text not null,
  email text unique not null,
  role text not null default 'user' check (role in ('user','ops','admin')),
  is_active boolean not null default true,
  archived_at timestamptz,           -- 재가입으로 보관 처리된 프로필
  created_at timestamptz not null default now()
);

create table categories (
  id serial primary key,
  name text unique not null,
  is_active boolean not null default true
);

create table praises (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id),
  is_anonymous boolean not null default false,
  category_id int references categories(id),
  content text not null check (char_length(content) between 1 and 2000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table praise_recipients (
  praise_id uuid references praises(id) on delete cascade,
  recipient_id uuid references profiles(id),
  primary key (praise_id, recipient_id)
);

create table praise_likes (
  praise_id uuid references praises(id) on delete cascade,
  user_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (praise_id, user_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  praise_id uuid not null references praises(id) on delete cascade,
  author_id uuid not null references profiles(id),
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table deletion_requests (
  id uuid primary key default gen_random_uuid(),
  praise_id uuid not null references praises(id) on delete cascade,
  requester_id uuid not null references profiles(id),
  status text not null default 'pending' check (status in ('pending','done')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- 비밀번호 분실 신고 (관리자가 확인 후 계정 비활성화)
create table password_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table audit_logs (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 인덱스
-- ---------------------------------------------------------------------
create index praises_feed_idx on praises (created_at desc, id desc) where is_hidden = false;
create index praises_content_trgm_idx on praises using gin (content extensions.gin_trgm_ops);
create index profiles_name_trgm_idx on profiles using gin (name extensions.gin_trgm_ops);
create index praise_recipients_recipient_idx on praise_recipients (recipient_id);
create index comments_praise_idx on comments (praise_id, created_at);
create unique index deletion_requests_one_pending_idx on deletion_requests (praise_id) where status = 'pending';
create unique index password_reports_one_open_idx on password_reports (profile_id) where processed_at is null;

-- ---------------------------------------------------------------------
-- 권한 판별 함수
-- ---------------------------------------------------------------------
create or replace function is_active_user() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_active = true
  );
$$;

create or replace function is_ops() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active = true and role in ('ops','admin')
  );
$$;

create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active = true and role = 'admin'
  );
$$;

create or replace function praise_is_visible(p_praise_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from praises where id = p_praise_id and is_hidden = false);
$$;

create or replace function like_escape(p text) returns text
language sql immutable as $$
  select replace(replace(replace(p, '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- ---------------------------------------------------------------------
-- 가입 시 프로필 자동 생성 + 사내 도메인 검증 (DB 수준 강제)
-- ---------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_domain text;
begin
  select value into v_domain from app_config where key = 'allowed_email_domain';
  if v_domain is not null
     and lower(split_part(new.email, '@', 2)) <> lower(v_domain) then
    raise exception 'EMAIL_DOMAIN_NOT_ALLOWED';
  end if;

  insert into profiles (id, employee_no, name, email)
  values (
    new.id,
    btrim(new.raw_user_meta_data ->> 'employee_no'),
    btrim(new.raw_user_meta_data ->> 'name'),
    lower(new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- 조회용 뷰: praises_public
--   - 익명 글이면 author_id / author_name 을 null 로 반환
--   - 뷰 소유자 권한으로 실행(security definer 뷰)하여 praises 테이블 직접
--     SELECT 권한 없이 조회 가능. praises 테이블은 누구에게도 열지 않는다.
--   - is_active_user() 조건으로 비로그인·비활성 사용자는 빈 결과
-- ---------------------------------------------------------------------
create view praises_public with (security_barrier = true) as
select
  p.id,
  case when p.is_anonymous then null else p.author_id end as author_id,
  case when p.is_anonymous then null else a.name end as author_name,
  case when p.is_anonymous then null else a.is_active end as author_is_active,
  p.is_anonymous,
  p.category_id,
  c.name as category_name,
  p.content,
  p.created_at,
  (p.author_id = auth.uid()) as is_mine,
  coalesce(r.recipients, '[]'::jsonb) as recipients,
  coalesce(r.recipient_names, '') as recipient_names,
  (select count(*) from praise_likes l where l.praise_id = p.id)::int as like_count,
  exists (
    select 1 from praise_likes l where l.praise_id = p.id and l.user_id = auth.uid()
  ) as liked_by_me,
  (select count(*) from comments m where m.praise_id = p.id)::int as comment_count
from praises p
join profiles a on a.id = p.author_id
left join categories c on c.id = p.category_id
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object('id', rp.id, 'name', rp.name, 'is_active', rp.is_active)
      order by rp.name
    ) as recipients,
    string_agg(rp.name, ' ') as recipient_names
  from praise_recipients pr
  join profiles rp on rp.id = pr.recipient_id
  where pr.praise_id = p.id
) r on true
where p.is_hidden = false
  and is_active_user();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table app_config enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table praises enable row level security;
alter table praise_recipients enable row level security;
alter table praise_likes enable row level security;
alter table comments enable row level security;
alter table deletion_requests enable row level security;
alter table password_reports enable row level security;
alter table audit_logs enable row level security;

-- 사내 전용: 비로그인(anon) 접근 전면 차단
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 원본 테이블은 클라이언트에 열지 않는다 (뷰·함수로만 접근)
revoke all on app_config, praises, praise_recipients, deletion_requests,
  password_reports, audit_logs from authenticated;
revoke insert, update, delete on profiles, categories from authenticated;
revoke update on praise_likes, comments from authenticated;

grant select on praises_public to authenticated;
grant select on audit_logs, password_reports, deletion_requests to authenticated;

-- profiles: 본인 행 + 활성 사용자는 전체 조회 (이름 검색·표시용)
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_active_user());

-- categories: 활성 사용자 조회
create policy categories_select on categories for select to authenticated
  using (is_active_user());

-- praise_likes: 본인 것만 조회·추가·취소
create policy likes_select on praise_likes for select to authenticated
  using (user_id = auth.uid());
create policy likes_insert on praise_likes for insert to authenticated
  with check (user_id = auth.uid() and is_active_user() and praise_is_visible(praise_id));
create policy likes_delete on praise_likes for delete to authenticated
  using (user_id = auth.uid() and is_active_user());

-- comments: 활성 사용자 조회, 본인 작성, 본인 또는 운영 담당자 삭제
create policy comments_select on comments for select to authenticated
  using (is_active_user() and praise_is_visible(praise_id));
create policy comments_insert on comments for insert to authenticated
  with check (author_id = auth.uid() and is_active_user() and praise_is_visible(praise_id));
create policy comments_delete on comments for delete to authenticated
  using (is_active_user() and (author_id = auth.uid() or is_ops()));

-- deletion_requests: 요청자 본인만 직접 조회 가능
--   운영 담당자는 requester_id(= 작성자)가 빠진 함수로만 조회한다.
create policy deletion_requests_select_own on deletion_requests for select to authenticated
  using (requester_id = auth.uid());

-- password_reports, audit_logs: 관리자만 조회
create policy password_reports_select on password_reports for select to authenticated
  using (is_admin());
create policy audit_logs_select on audit_logs for select to authenticated
  using (is_admin());

-- 운영 담당자가 남의 댓글을 삭제하면 감사 기록
create or replace function log_comment_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.author_id is distinct from auth.uid() then
    insert into audit_logs (actor_id, action, target_type, target_id)
    values (auth.uid(), 'comment.delete', 'comment', old.id::text);
  end if;
  return old;
end;
$$;

create trigger on_comment_deleted
  after delete on comments
  for each row execute function log_comment_delete();

-- ---------------------------------------------------------------------
-- 칭찬 작성 (글 + 받는 사람을 한 트랜잭션으로)
-- ---------------------------------------------------------------------
create or replace function create_praise(
  p_recipient_ids uuid[],
  p_category_id int,
  p_content text,
  p_is_anonymous boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_ids uuid[];
  v_valid int;
begin
  if not is_active_user() then
    raise exception 'NOT_ALLOWED';
  end if;

  p_content := btrim(coalesce(p_content, ''));
  if char_length(p_content) not between 1 and 2000 then
    raise exception 'INVALID_CONTENT';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_recipient_ids) as x where x is not null;
  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'RECIPIENT_REQUIRED';
  end if;
  if cardinality(v_ids) > 20 then
    raise exception 'TOO_MANY_RECIPIENTS';
  end if;
  if v_uid = any(v_ids) then
    raise exception 'SELF_RECIPIENT';
  end if;

  select count(*) into v_valid from profiles where id = any(v_ids) and is_active = true;
  if v_valid <> cardinality(v_ids) then
    raise exception 'INVALID_RECIPIENT';
  end if;

  if p_category_id is null
     or not exists (select 1 from categories where id = p_category_id and is_active = true) then
    raise exception 'INVALID_CATEGORY';
  end if;

  insert into praises (author_id, is_anonymous, category_id, content)
  values (v_uid, coalesce(p_is_anonymous, false), p_category_id, p_content)
  returning id into v_id;

  insert into praise_recipients (praise_id, recipient_id)
  select v_id, unnest(v_ids);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 목록·검색 (커서 기반: created_at + id)
-- ---------------------------------------------------------------------
create or replace function search_praises(
  p_recipient text default null,
  p_keyword text default null,
  p_category_id int default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 20
) returns setof praises_public
language sql stable set search_path = public as $$
  select v.*
  from praises_public v
  where (nullif(btrim(p_recipient), '') is null
         or v.recipient_names ilike '%' || like_escape(btrim(p_recipient)) || '%')
    and (nullif(btrim(p_keyword), '') is null
         or v.content ilike '%' || like_escape(btrim(p_keyword)) || '%')
    and (p_category_id is null or v.category_id = p_category_id)
    and (p_from is null or v.created_at >= p_from)
    and (p_to is null or v.created_at < p_to)
    and (p_cursor_created_at is null
         or (v.created_at, v.id) < (p_cursor_created_at, p_cursor_id))
  order by v.created_at desc, v.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- 받는 사람 선택용 직원 검색 (이름 또는 사번)
create or replace function search_profiles(p_query text)
returns table (id uuid, name text, employee_no text)
language sql stable set search_path = public as $$
  select p.id, p.name, p.employee_no
  from profiles p
  where is_active_user()
    and p.is_active = true
    and p.id <> auth.uid()
    and char_length(btrim(coalesce(p_query, ''))) >= 1
    and (p.name ilike '%' || like_escape(btrim(p_query)) || '%'
         or p.employee_no ilike like_escape(btrim(p_query)) || '%')
  order by p.name
  limit 10;
$$;

-- ---------------------------------------------------------------------
-- 내 활동: 내가 쓴 글 (숨김 포함) + 삭제 요청 상태
-- ---------------------------------------------------------------------
create or replace function my_praises()
returns table (
  id uuid,
  content text,
  is_anonymous boolean,
  is_hidden boolean,
  category_name text,
  created_at timestamptz,
  recipients jsonb,
  request_status text
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.content, p.is_anonymous, p.is_hidden, c.name, p.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', rp.id, 'name', rp.name, 'is_active', rp.is_active)
                       order by rp.name)
      from praise_recipients pr join profiles rp on rp.id = pr.recipient_id
      where pr.praise_id = p.id
    ), '[]'::jsonb),
    (select d.status from deletion_requests d
      where d.praise_id = p.id order by d.created_at desc limit 1)
  from praises p
  left join categories c on c.id = p.category_id
  where p.author_id = auth.uid()
    and is_active_user()
  order by p.created_at desc;
$$;

-- ---------------------------------------------------------------------
-- 삭제 요청 (작성자 본인만)
-- ---------------------------------------------------------------------
create or replace function request_deletion(p_praise_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_active_user() then
    raise exception 'NOT_ALLOWED';
  end if;
  if not exists (
    select 1 from praises
    where id = p_praise_id and author_id = auth.uid() and is_hidden = false
  ) then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into deletion_requests (praise_id, requester_id)
  values (p_praise_id, auth.uid())
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'ALREADY_REQUESTED';
end;
$$;

-- 운영 담당자용 삭제 요청 목록: 요청자(= 작성자) 정보는 반환하지 않는다
create or replace function ops_list_deletion_requests(p_status text default null)
returns table (
  id uuid,
  praise_id uuid,
  status text,
  created_at timestamptz,
  processed_at timestamptz,
  content text,
  category_name text,
  recipients jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_ops() then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
  select
    d.id, d.praise_id, d.status, d.created_at, d.processed_at,
    p.content, c.name,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', rp.id, 'name', rp.name, 'is_active', rp.is_active)
                       order by rp.name)
      from praise_recipients pr join profiles rp on rp.id = pr.recipient_id
      where pr.praise_id = p.id
    ), '[]'::jsonb)
  from deletion_requests d
  join praises p on p.id = d.praise_id
  left join categories c on c.id = p.category_id
  where p_status is null or d.status = p_status
  order by (d.status = 'pending') desc, d.created_at desc;
end;
$$;

-- 삭제 요청 처리: 숨김 처리 + 완료 + 감사 기록
create or replace function ops_process_deletion(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_praise_id uuid;
begin
  if not is_ops() then
    raise exception 'NOT_ALLOWED';
  end if;

  update deletion_requests
     set status = 'done', processed_at = now()
   where id = p_request_id and status = 'pending'
  returning praise_id into v_praise_id;

  if v_praise_id is null then
    raise exception 'ALREADY_PROCESSED';
  end if;

  update praises set is_hidden = true where id = v_praise_id;

  insert into audit_logs (actor_id, action, target_type, target_id)
  values (auth.uid(), 'praise.hide', 'praise', v_praise_id::text);
end;
$$;

-- ---------------------------------------------------------------------
-- 공개 순위: 받는 사람 기준, 숨김 글 제외
-- ---------------------------------------------------------------------
create or replace function public_ranking(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 20
) returns table (
  rank int,
  recipient_id uuid,
  name text,
  is_active boolean,
  praise_count int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_active_user() then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
  select
    (dense_rank() over (order by count(*) desc))::int,
    rp.id, rp.name, rp.is_active, count(*)::int
  from praise_recipients pr
  join praises p on p.id = pr.praise_id and p.is_hidden = false
  join profiles rp on rp.id = pr.recipient_id
  where (p_from is null or p.created_at >= p_from)
    and (p_to is null or p.created_at < p_to)
  group by rp.id, rp.name, rp.is_active
  order by count(*) desc, rp.name
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

-- ---------------------------------------------------------------------
-- 운영 통계 (작성자 기준 집계는 만들지 않는다)
-- ---------------------------------------------------------------------
create or replace function ops_stats(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_ops() then
    raise exception 'NOT_ALLOWED';
  end if;

  return (
  with ps as (
    select * from praises
    where created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'praise_count', (select count(*) from ps where not is_hidden),
    'anonymous_count', (select count(*) from ps where not is_hidden and is_anonymous),
    'hidden_count', (select count(*) from ps where is_hidden),
    'recipient_count', (
      select count(distinct pr.recipient_id)
      from praise_recipients pr join ps on ps.id = pr.praise_id and not ps.is_hidden
    ),
    'like_count', (
      select count(*) from praise_likes l
      where l.created_at >= p_from and l.created_at < p_to
    ),
    'comment_count', (
      select count(*) from comments m
      where m.created_at >= p_from and m.created_at < p_to
    ),
    'pending_requests', (select count(*) from deletion_requests where status = 'pending'),
    'active_users', (select count(*) from profiles where is_active),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(c.name, '미지정'), 'count', x.cnt)
                       order by x.cnt desc)
      from (
        select category_id, count(*) as cnt from ps where not is_hidden group by category_id
      ) x
      left join categories c on c.id = x.category_id
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt) order by d.day)
      from (
        select to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day, count(*) as cnt
        from ps where not is_hidden group by 1
      ) d
    ), '[]'::jsonb)
  )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 관리자: 계정 활성/비활성, 역할 변경
-- ---------------------------------------------------------------------
create or replace function admin_set_active(p_user_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_SELF';
  end if;

  update profiles set is_active = p_active
   where id = p_user_id and archived_at is null;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if not p_active then
    update password_reports set processed_at = now()
     where profile_id = p_user_id and processed_at is null;
  end if;

  insert into audit_logs (actor_id, action, target_type, target_id)
  values (auth.uid(),
          case when p_active then 'account.activate' else 'account.deactivate' end,
          'profile', p_user_id::text);
end;
$$;

create or replace function admin_set_role(p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_SELF';
  end if;
  if p_role not in ('user','ops','admin') then
    raise exception 'INVALID_ROLE';
  end if;

  update profiles set role = p_role where id = p_user_id and archived_at is null;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  insert into audit_logs (actor_id, action, target_type, target_id)
  values (auth.uid(), 'account.role.' || p_role, 'profile', p_user_id::text);
end;
$$;

-- ---------------------------------------------------------------------
-- 함수 실행 권한: 로그인 사용자만
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function
  is_active_user(), is_ops(), is_admin(), praise_is_visible(uuid), like_escape(text),
  create_praise(uuid[], int, text, boolean),
  search_praises(text, text, int, timestamptz, timestamptz, timestamptz, uuid, int),
  search_profiles(text), my_praises(), request_deletion(uuid),
  ops_list_deletion_requests(text), ops_process_deletion(uuid),
  public_ranking(timestamptz, timestamptz, int), ops_stats(timestamptz, timestamptz),
  admin_set_active(uuid, boolean), admin_set_role(uuid, text)
to authenticated;
