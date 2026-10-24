import "server-only";
import { createClient } from "@supabase/supabase-js";

// service role 클라이언트. RLS를 우회하므로 이 파일에서만 키를 참조한다.
// 가입 전 중복 확인, 사번 로그인, 비밀번호 분실 신고, 계정 차단에만 사용한다.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
