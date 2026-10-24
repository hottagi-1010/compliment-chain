import { setAccountActive, setAccountRole } from "@/actions/admin";
import { PageTitle } from "@/components/app-shell";
import { RoleForm } from "@/components/role-form";
import { ActionButton, buttonClass, inputClass } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

type AccountRow = Profile & { created_at: string };
type ReportRow = { id: string; profile_id: string; created_at: string };

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  const me = await requireProfile(["admin"]);
  const { q: rawQ, status: rawStatus } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 50) : "";
  const status = rawStatus === "inactive" ? "inactive" : rawStatus === "all" ? "all" : "active";

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, employee_no, name, email, role, is_active, created_at")
    .is("archived_at", null)
    .order("name")
    .limit(200);
  if (status !== "all") query = query.eq("is_active", status === "active");
  if (q) {
    // PostgREST or 구문을 깨는 문자는 제거한다
    const safe = q.replace(/[,()*%\\]/g, "");
    if (safe) query = query.or(`name.ilike.%${safe}%,employee_no.ilike.${safe}%,email.ilike.%${safe}%`);
  }

  const [{ data: accountRows }, { data: reportRows }] = await Promise.all([
    query.returns<AccountRow[]>(),
    supabase
      .from("password_reports")
      .select("id, profile_id, created_at")
      .is("processed_at", null)
      .order("created_at")
      .returns<ReportRow[]>(),
  ]);
  const accounts = accountRows ?? [];
  const reports = reportRows ?? [];
  const reportedAt = new Map(reports.map((r) => [r.profile_id, r.created_at]));

  // 신고된 계정이 목록 필터에 걸리지 않아도 상단에 보이도록 따로 조회
  const { data: reportedRows } = reports.length
    ? await supabase
        .from("profiles")
        .select("id, employee_no, name, email, role, is_active, created_at")
        .in("id", reports.map((r) => r.profile_id))
        .returns<AccountRow[]>()
    : { data: [] as AccountRow[] };

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="계정 관리" description="퇴사자와 비밀번호 분실 신고 계정을 비활성화하고 역할을 관리합니다." />

      {(reportedRows ?? []).length > 0 && (
        <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 font-semibold text-amber-900">비밀번호 분실 신고 {reports.length}건</h2>
          <ul className="space-y-2">
            {(reportedRows ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                <span className="font-medium">{a.name}</span>
                <span className="text-stone-500">{a.employee_no}</span>
                <span className="text-stone-500">{a.email}</span>
                <span className="text-xs text-stone-400">
                  신고 {formatDateTime(reportedAt.get(a.id) ?? a.created_at)}
                </span>
                <span className="ml-auto">
                  <ActionButton
                    action={setAccountActive.bind(null, a.id, false)}
                    label="비활성화"
                    pendingText="처리 중…"
                    confirmText={`${a.name} 계정을 비활성화할까요? 이후 재가입이 필요합니다.`}
                    className={buttonClass}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="이름, 사번, 이메일" className={`${inputClass} max-w-xs`} />
        <select name="status" defaultValue={status} className="rounded-lg border border-stone-300 bg-white px-3 text-sm">
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
          <option value="all">전체</option>
        </select>
        <button type="submit" className={buttonClass}>
          검색
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-stone-50 text-left text-xs text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">사번</th>
              <th className="px-4 py-2 font-medium">이메일</th>
              <th className="px-4 py-2 font-medium">가입일</th>
              <th className="px-4 py-2 font-medium">역할</th>
              <th className="px-4 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {accounts.map((a) => {
              const isMe = a.id === me.id;
              return (
                <tr key={a.id} className={a.is_active ? "" : "bg-stone-50 text-stone-500"}>
                  <td className="px-4 py-2 font-medium">
                    {a.name}
                    {isMe && <span className="ml-1 text-xs text-stone-400">(나)</span>}
                  </td>
                  <td className="px-4 py-2">{a.employee_no}</td>
                  <td className="px-4 py-2">{a.email}</td>
                  <td className="px-4 py-2">{formatDate(a.created_at)}</td>
                  <td className="px-4 py-2">
                    {isMe ? (
                      "관리자"
                    ) : (
                      <RoleForm action={setAccountRole.bind(null, a.id)} role={a.role} />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isMe ? (
                      "활성"
                    ) : (
                      <ActionButton
                        action={setAccountActive.bind(null, a.id, !a.is_active)}
                        label={a.is_active ? "비활성화" : "활성화"}
                        pendingText="처리 중…"
                        confirmText={
                          a.is_active
                            ? `${a.name} 계정을 비활성화할까요? 로그인과 모든 쓰기가 차단됩니다.`
                            : `${a.name} 계정을 다시 활성화할까요?`
                        }
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                  계정이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
