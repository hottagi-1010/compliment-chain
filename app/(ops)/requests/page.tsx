import { processDeletion } from "@/actions/ops";
import { PageTitle } from "@/components/app-shell";
import { CategoryBadge } from "@/components/praise-card";
import { ActionButton, buttonClass } from "@/components/ui";
import { formatDateTime, recipientNames } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { PersonRef, RequestStatus } from "@/lib/types";

// 요청자(= 작성자) 정보는 DB 함수가 반환하지 않는다
type DeletionRequestRow = {
  id: string;
  praise_id: string;
  status: RequestStatus;
  created_at: string;
  processed_at: string | null;
  content: string;
  category_name: string | null;
  recipients: PersonRef[];
};

export default async function DeletionRequestsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ops_list_deletion_requests", { p_status: null });
  const rows = (data ?? []) as DeletionRequestRow[];
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="삭제 요청"
        description={`처리 대기 ${pending}건. 처리하면 글이 숨김 처리되고 처리 이력이 남습니다.`}
      />
      {error && <p className="mb-4 text-sm text-red-600">목록을 불러오지 못했습니다.</p>}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
          접수된 삭제 요청이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`rounded-xl border p-4 ${
                r.status === "pending" ? "border-amber-200 bg-white" : "border-stone-200 bg-stone-50"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">To. {recipientNames(r.recipients)}</span>
                <CategoryBadge name={r.category_name} />
                <span className="ml-auto text-xs text-stone-400">
                  요청 {formatDateTime(r.created_at)}
                </span>
              </div>
              <p className="mb-3 line-clamp-3 whitespace-pre-line text-sm text-stone-700">{r.content}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-stone-400">글 ID {r.praise_id.slice(0, 8)}</span>
                {r.status === "pending" ? (
                  <ActionButton
                    action={processDeletion.bind(null, r.id)}
                    label="삭제 처리"
                    pendingText="처리 중…"
                    confirmText="이 글을 삭제(숨김) 처리할까요?"
                    className={buttonClass}
                  />
                ) : (
                  <span className="text-xs text-stone-500">
                    처리 완료 {r.processed_at && formatDateTime(r.processed_at)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
