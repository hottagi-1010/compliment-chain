# CLAUDE.md: 동료 칭찬 게시판 개발 가이드

> 이 문서는 AI 코딩 도구가 프로젝트를 이해하고 일관되게 구현하도록 돕는 개발 규칙입니다.
> 요구사항의 기준 문서는 `PRD.md`입니다. 두 문서가 충돌하면 PRD를 우선합니다.
> 상태: 초안 (v0.1) | 작성일: 2026-10-25

## 1. 프로젝트 요약

- 사내 전 직원(수백 명)이 쓰는 **사내 전용** 동료 칭찬 웹 애플리케이션
- 칭찬 작성(익명 선택 가능), 카드형 조회, 좋아요, 댓글, 검색, 공개 순위, 삭제 요청
- 역할: 일반 사용자 / 관리자 / 운영 담당자
- 핵심 원칙: **익명 글의 작성자는 누구에게도 노출하지 않는다** (운영 담당자와 관리자 포함)

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router, TypeScript) | Vercel 배포에 최적화 |
| 스타일 | Tailwind CSS | 반응형 기본 |
| 데이터 | Supabase (PostgreSQL) | 저장과 인증 |
| 인증 | Supabase Auth (이메일·비밀번호) | 사내 도메인 제한 적용 |
| 서버 로직 | Next.js Server Actions + Supabase RLS | 민감 로직은 DB 함수에 둔다 |
| 배포 | Vercel | Preview와 Production 분리 |

> 위 프레임워크 선택은 제안입니다. 다른 스택을 원하면 알려 주세요.

## 3. 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # 서버 전용. 클라이언트 코드에서 절대 참조 금지
ALLOWED_EMAIL_DOMAIN=           # 예: company.co.kr
```

- `SUPABASE_SERVICE_ROLE_KEY`는 서버 코드에서만 사용한다.
- `.env.local`은 커밋하지 않는다. Vercel 대시보드에서 Production과 Preview 값을 따로 설정한다.

## 4. 데이터 모델 (Supabase)

### 4.1 테이블 개요

| 테이블 | 용도 |
|---|---|
| `profiles` | 사용자 정보 (auth.users와 1:1) |
| `praises` | 칭찬 글 |
| `praise_recipients` | 칭찬 받는 사람 (복수 지정) |
| `categories` | 카테고리 목록 |
| `praise_likes` | 좋아요 |
| `comments` | 댓글 |
| `deletion_requests` | 삭제 요청 |
| `audit_logs` | 주요 처리 이력 |

### 4.2 스키마 초안

```sql
-- 사용자 프로필
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_no text unique not null,
  name text not null,
  email text unique not null,
  role text not null default 'user' check (role in ('user','ops','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table categories (
  id serial primary key,
  name text unique not null,
  is_active boolean not null default true
);

-- 칭찬 글
create table praises (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id),
  is_anonymous boolean not null default false,
  category_id int references categories(id),
  content text not null check (char_length(content) between 1 and 2000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- 받는 사람 (복수 지정)
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

create table audit_logs (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  created_at timestamptz not null default now()
);
```

### 4.3 익명 글 보호 규칙 (필수)

- `praises.author_id`는 DB에 저장하되, **직접 조회하는 경로를 열지 않는다.**
- `praises`, `praise_recipients` 원본 테이블은 클라이언트 역할(`anon`, `authenticated`)에 **어떤 권한도 주지 않는다.** 일반·운영·관리자 모두 동일하다.
- 클라이언트 조회는 **뷰 `praises_public`**을 통해서만 한다. 이 뷰는 익명 글이면 `author_id`와 `author_name`을 `null`로 반환한다.
- 쓰기와 본인 글 조회는 `security definer` 함수로만 한다.
  - 작성: `create_praise` / 내 글 조회(숨김 포함): `my_praises` / 삭제 요청: `request_deletion`
  - 작성자 본인 여부는 뷰의 `is_mine` 컬럼(`author_id = auth.uid()`)으로만 알 수 있다. 본인에게만 `true`다.
- 삭제 요청의 요청자는 곧 작성자다. 따라서 `deletion_requests`는 **요청자 본인 행만** 직접 조회할 수 있다.
  - 운영 담당자는 `requester_id`를 반환하지 않는 `ops_list_deletion_requests` 함수로만 요청을 본다.
  - 처리는 `ops_process_deletion` 함수로 `praise_id` 기준으로만 수행한다. 운영 담당자에게 작성자 식별 정보를 보여주지 않는다.
- 작성자 기준 집계·통계는 만들지 않는다.

```sql
-- 요약본. 전체 정의는 supabase/migrations/ 참고
create view praises_public with (security_barrier = true) as
select
  p.id,
  case when p.is_anonymous then null else p.author_id end as author_id,
  case when p.is_anonymous then null else a.name end as author_name,
  p.is_anonymous,
  p.category_id,
  p.content,
  p.created_at,
  (p.author_id = auth.uid()) as is_mine
  -- + 받는 사람 목록, 좋아요 수, 댓글 수 등
from praises p
join profiles a on a.id = p.author_id
where p.is_hidden = false
  and is_active_user();
```

> 뷰는 `security_invoker`를 **쓰지 않고** 소유자 권한으로 실행한다.
> `security_invoker = true`로 만들면 호출자에게 `praises` 테이블 SELECT 권한이 필요해지고,
> 그 권한으로 `author_id`를 직접 조회할 수 있게 되어 익명 보호가 깨지기 때문이다.
> 대신 뷰 안의 `is_active_user()` 조건으로 비로그인·비활성 사용자를 걸러내고,
> `security_barrier`로 호출자 조건을 이용한 우회 조회를 막는다.
> (Supabase 대시보드의 "Security Definer View" 경고는 이 의도에 따른 것이다.)

## 5. 인증과 권한

### 5.1 가입
- 가입 시 **사번, 이름, 사내 이메일**을 받는다.
- 이메일 도메인이 `ALLOWED_EMAIL_DOMAIN`과 일치하지 않으면 가입을 거부한다.
- 사번 중복은 `profiles.employee_no` 유니크 제약으로 막는다.
- 가입 후 이메일 인증을 거친다.

### 5.2 비밀번호 분실과 퇴사
- 비밀번호 분실 시 **계정을 비활성화**하고 재가입을 안내한다. 자동 재설정 메일은 보내지 않는다.
  - 비활성화 요청은 사용자의 "비밀번호 분실 신고"로 접수하고, 처리는 관리자가 한다 (구현 방식은 `[확인 필요]`).
- 퇴사자는 관리자가 `is_active = false`로 변경한다.
- 비활성 계정은 로그인과 모든 쓰기 작업을 막는다. RLS에서 `is_active = true`를 조건으로 건다.
- 재가입 시 같은 사번과 이메일을 사용할 수 있도록 **기존 프로필을 삭제하지 않고 유지**한다. (PRD 4.2 참고)

### 5.3 역할별 권한

| 기능 | 일반 | 운영 | 관리자 |
|---|:-:|:-:|:-:|
| 칭찬 작성, 좋아요, 댓글 | ✅ | ✅ | ✅ |
| 본인 글 삭제 요청 | ✅ | ✅ | ✅ |
| 삭제 요청 처리 | ❌ | ✅ | ✅ |
| 통계와 순위 집계 관리 | ❌ | ✅ | ✅ |
| 공개 순위 조회 | ✅ | ✅ | ✅ |
| 계정 비활성화, 역할 변경 | ❌ | ❌ | ✅ |
| 익명 글 작성자 조회 | ❌ | ❌ | ❌ |

> "익명 글 작성자 조회 ❌"은 어떤 역할에도 예외가 없음을 뜻합니다.

### 5.4 RLS 기본 원칙
- 모든 테이블에 RLS를 **활성화**한다.
- 기본 정책은 거부(deny)이며, 필요한 권한만 명시적으로 허용한다.
- 역할 판별은 `profiles.role`을 기준으로 하는 `security definer` 함수로 구현한다 (예: `is_ops()`, `is_admin()`).
- 비활성 사용자(`is_active = false`)는 모든 정책에서 제외한다.

```sql
create or replace function is_active_user() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active = true
  );
$$;
```

## 6. 주요 기능 구현 규칙

### 6.1 칭찬 작성
- 받는 사람은 **1명 이상**이어야 한다. (서버에서 검증)
- 받는 사람 선택: `[미정]`. 기본은 **직원 검색 후 선택**으로 구현한다 (사번 또는 이름 검색, `profiles` 기준).
- 칭찬 글과 받는 사람 목록은 **하나의 트랜잭션**으로 저장한다. (DB 함수 `create_praise` 사용)
- 자기 자신을 받는 사람으로 지정할 수 없다. (기본값, 확인 필요)
- 작성 후 본문 길이는 2,000자 이하로 제한한다.

### 6.2 조회와 검색
- 메인 목록은 `praises_public`을 기준으로 **커서 기반 페이지네이션**(created_at + id)을 사용한다.
- 검색 조건: 받는 사람(이름), 키워드(본문), 카테고리, 기간.
- 이름 검색은 `profiles.name` 인덱스를 사용한다. 키워드 검색은 `pg_trgm` 확장을 쓴다.

### 6.3 좋아요
- `praise_likes`의 복합 기본키로 1인 1회를 보장한다.
- 좋아요 수는 집계 쿼리 또는 뷰로 계산한다. 글마다 카운트 컬럼을 두지 않는다. (규모가 커지면 재검토)

### 6.4 댓글
- 댓글 작성자는 항상 식별된다. (댓글 익명 기능은 미정)
- 댓글 삭제는 본인 또는 운영 담당자가 할 수 있다.

### 6.5 삭제 요청
- 작성자는 본인 글에 대해서만 요청할 수 있다. (RLS로 강제)
- 같은 글에 대해 `pending` 상태의 요청은 하나만 허용한다. (부분 유니크 인덱스)
- 운영 담당자가 처리하면 글에 `is_hidden = true`를 설정하고 `status = 'done'`으로 바꾼다. 물리 삭제는 기본 정책이 아니다. (PRD의 "삭제"를 숨김으로 구현, 보관 기간은 `[미정]`)
- 처리 시 `audit_logs`를 남긴다.

### 6.6 공개 순위와 운영 통계
- 순위 집계 기준: `[미정]`. 초안은 **받은 칭찬 횟수** 기준이다.
- 순위와 통계는 **DB 뷰 또는 함수**로 계산한다. 클라이언트에서 계산하지 않는다.
- 공개 순위는 `praise_recipients` 기준으로 집계하며, 숨김 처리된 글은 제외한다.
- 익명 여부와 관계없이 **받은 사람 기준**으로 집계한다. 작성자 기준 집계는 만들지 않는다.

### 6.7 비활성화 회원의 글
- 글과 댓글은 유지한다.
- 표시 이름은 `profiles.is_active = false`이면 "비활성 회원"으로 치환한다. (화면 렌더링 시 처리)
- 순위 집계에는 그대로 반영한다.

## 7. 디렉터리 구조 (제안)

```
app/
  (auth)/login/page.tsx
  (auth)/signup/page.tsx
  (main)/page.tsx                 # 카드 갤러리
  (main)/praises/new/page.tsx     # 칭찬 작성
  (main)/praises/[id]/page.tsx    # 상세
  (main)/ranking/page.tsx         # 공개 순위
  (main)/me/page.tsx              # 내 활동
  (ops)/requests/page.tsx         # 삭제 요청 목록
  (ops)/stats/page.tsx            # 운영 통계
  (admin)/accounts/page.tsx       # 계정 관리
lib/
  supabase/client.ts              # 브라우저용
  supabase/server.ts              # 서버용 (쿠키 기반)
  supabase/admin.ts               # service role (서버 전용)
  validators.ts                   # 입력 검증 (zod)
actions/                          # Server Actions
supabase/
  migrations/                     # 스키마와 RLS 정책
  seed.sql                        # 카테고리 초기값
```

## 8. 코딩 규칙

- 언어: TypeScript 기본. `any` 사용을 피한다.
- 입력 검증은 서버에서 한다. 클라이언트 검증은 편의용이다.
- DB 스키마 변경은 **반드시 migration 파일**로 남긴다. 대시보드에서 직접 수정하지 않는다.
- Supabase 클라이언트는 용도에 맞게 나눈다 (브라우저 / 서버 / admin).
- `SUPABASE_SERVICE_ROLE_KEY`는 `lib/supabase/admin.ts`에서만 사용하고, 그 파일은 서버 전용으로 표시한다.
- 에러 메시지는 사용자에게 **내부 구조를 노출하지 않는** 문장으로 보여준다.
- 익명 글과 관련된 코드를 바꿀 때는 **작성자 노출 여부를 반드시 확인**한다.
- 커밋 메시지는 한국어 또는 영어 중 하나로 통일한다. (결정 필요)

## 9. 테스트 체크리스트

- [ ] 사내 도메인이 아닌 이메일로 가입이 거부되는가
- [ ] 익명 글을 일반 사용자, 운영, 관리자 계정으로 조회해도 작성자가 보이지 않는가
- [ ] 비활성 계정이 로그인과 쓰기 작업을 할 수 없는가
- [ ] 본인이 아닌 글에 삭제 요청을 할 수 없는가
- [ ] 같은 글에 대기 중인 삭제 요청이 두 번 생기지 않는가
- [ ] 좋아요를 두 번 눌러도 한 번만 반영되는가
- [ ] 비활성 회원의 글이 "비활성 회원"으로 표시되는가
- [ ] 모바일 화면에서 카드 갤러리와 작성 화면이 정상 동작하는가

## 10. 배포 (Vercel)

- Git 저장소를 Vercel에 연결한다. `main` 브랜치는 Production, 그 외는 Preview로 배포한다.
- Supabase 마이그레이션은 배포 전에 적용한다. (순서: 마이그레이션 → Vercel 배포)
- Production과 Preview는 **서로 다른 Supabase 프로젝트**를 사용한다.
- 배포 후 확인: 로그인, 칭찬 작성, 익명 글 조회, 삭제 요청 흐름.

## 11. 미정 항목 (PRD와 동일)

1. 받는 사람 선택 방식 (기본값: 직원 검색 선택)
2. 카테고리 목록
3. 순위 집계 기준 (기본값: 받은 횟수)
4. 운영 담당자 통계 상세 지표
5. 댓글 익명 기능 여부
6. 비활성화 회원의 기존 글 처리 (기본값: 유지 + "비활성 회원" 표기)
7. 비밀번호 분실 신고 처리 방식 (구현 방식)
8. 숨김 글 보관 기간
9. 커밋 메시지 언어

## 12. AI 작업 지침

- 작업 전에 `PRD.md`와 이 문서를 먼저 읽는다.
- 미정 항목에 해당하는 구현은 기본값으로 진행하되, 결과 보고에 어떤 기본값을 썼는지 명시한다.
- 요구사항이 PRD와 충돌하면 구현하지 말고 질문한다.
- 익명 글 보호 규칙(4.3)과 권한 표(5.3)를 바꾸는 변경은 사용자 확인 후에만 진행한다.
