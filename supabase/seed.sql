-- 카테고리 초기값 (PRD 예시 기준, 확정 전 기본값)
insert into categories (name) values
  ('협업'), ('문제해결'), ('배려'), ('성장')
on conflict (name) do nothing;

-- 가입 허용 이메일 도메인 (DB 수준 검증). 실제 사내 도메인으로 바꿔서 실행하세요.
insert into app_config (key, value) values ('allowed_email_domain', 'company.co.kr')
on conflict (key) do update set value = excluded.value;
