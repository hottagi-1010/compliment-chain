# 칭찬 릴레이 (동료 칭찬 게시판)

사내 전용 동료 칭찬 웹앱입니다. 요구사항은 [PRD.md](PRD.md), 개발 규칙은 [CLAUDE.md](CLAUDE.md)를 따릅니다.

- Next.js 16 (App Router, TypeScript) + Tailwind CSS 4
- Supabase (PostgreSQL, Auth, RLS)
- Vercel 배포

## 1. Supabase 준비

1. Supabase 프로젝트를 만듭니다. (Production과 Preview는 서로 다른 프로젝트를 권장)
2. **SQL Editor**에서 순서대로 실행합니다.
   1. [supabase/migrations/20261025000000_init.sql](supabase/migrations/20261025000000_init.sql)
   2. [supabase/seed.sql](supabase/seed.sql) — 실행 전에 `allowed_email_domain` 값을 실제 사내 도메인으로 바꿉니다.
3. **Authentication 설정**
   - Sign In / Providers → Email: `Enable Email provider` 켜기, `Confirm email` 켜기
   - URL Configuration → `Site URL`에 배포 주소, `Redirect URLs`에 `https://<배포주소>/auth/callback`과 `http://localhost:3000/auth/callback` 추가
4. 첫 관리자 지정: 가입·이메일 인증을 마친 뒤 SQL Editor에서 실행합니다.

   ```sql
   update profiles set role = 'admin' where employee_no = '<관리자 사번>';
   ```

   이후 역할 변경은 앱의 **계정 관리** 화면에서 합니다.

## 2. 로컬 실행

```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                   # http://localhost:3000
```

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon(public) 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | service role 키. **서버 전용** (`lib/supabase/admin.ts`에서만 사용) |
| `ALLOWED_EMAIL_DOMAIN` | 가입 허용 도메인 (예: `company.co.kr`). seed의 값과 같게 |

## 3. Vercel 배포

1. Vercel에서 이 GitHub 저장소를 Import 합니다. (`main` → Production, 그 외 브랜치 → Preview)
2. Settings → Environment Variables에 위 4개 값을 Production / Preview 별로 넣습니다.
3. 배포 순서: **Supabase 마이그레이션 적용 → Vercel 배포**
4. 배포 후 확인: 가입·로그인, 칭찬 작성, 익명 글 조회, 삭제 요청 흐름

## 4. 화면

| 경로 | 화면 | 권한 |
|---|---|---|
| `/login`, `/signup`, `/password-report` | 로그인, 가입, 비밀번호 분실 신고 | 누구나 |
| `/` | 카드 갤러리 (받는 사람·키워드·카테고리·기간 검색) | 로그인 |
| `/praises/new` | 칭찬 작성 | 로그인 |
| `/praises/[id]` | 상세, 좋아요, 댓글, 삭제 요청 | 로그인 |
| `/ranking` | 공개 순위 (이번 달 / 지난달 / 누적) | 로그인 |
| `/me` | 내가 쓴 글, 삭제 요청 상태 | 로그인 |
| `/requests`, `/stats` | 삭제 요청 처리, 운영 통계 | 운영·관리자 |
| `/accounts` | 계정 비활성화, 역할 변경, 분실 신고 처리 | 관리자 |

## 5. 익명 글 보호 구조

- `praises` 원본 테이블은 클라이언트 역할(anon, authenticated)에 **어떤 권한도 주지 않습니다.**
- 조회는 `praises_public` 뷰로만 합니다. 뷰는 소유자 권한으로 실행되며 익명 글의 `author_id`, `author_name`을 `null`로 돌려줍니다.
- 작성은 `create_praise` 함수, 내 글 조회는 `my_praises` 함수로만 합니다.
- 삭제 요청의 요청자는 곧 작성자이므로, 운영 담당자는 요청자 정보가 빠진 `ops_list_deletion_requests` 함수로만 요청을 봅니다.
- 작성자 기준 통계는 만들지 않습니다.

## 6. 미정 항목에 적용한 기본값

| 항목 | 적용한 기본값 |
|---|---|
| 받는 사람 선택 | 직원 검색(이름·사번) 후 선택, 최대 20명, 본인 제외 |
| 카테고리 | 협업, 문제해결, 배려, 성장 (`seed.sql`) |
| 순위 기준 | 받은 칭찬 횟수 (좋아요 미포함), 숨김 글 제외 |
| 운영 통계 지표 | 칭찬 수, 칭찬 받은 직원 수·비율, 익명 수, 좋아요, 댓글, 숨김, 대기 요청, 카테고리별, 일별 |
| 댓글 익명 | 지원 안 함 (작성자 항상 표시) |
| 비활성 회원 글 | 유지, 이름은 "비활성 회원"으로 표시, 순위에는 반영 |
| 비밀번호 분실 | 사번+이메일로 신고 → 관리자가 비활성화 → 같은 사번·이메일로 재가입 (기존 프로필은 보관 처리) |
| 숨김 글 보관 기간 | 무기한 (물리 삭제 없음) |
