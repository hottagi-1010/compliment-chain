import Link from "next/link";
import { PageTitle } from "@/components/app-shell";
import { CategoryBadge } from "@/components/praise-card";
import { formatDate, recipientNames } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { MyPraise } from "@/lib/types";

function StatusBadge({ praise }: { praise: MyPraise }) {
  if (praise.is_hidden) {
    return <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">삭제 처리 완료</span>;
  }
  if (praise.request_status === "pending") {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">삭제 요청 접수됨</span>;
  }
  return null;
}

export default async function MyActivityPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_praises");
  const praises = (data ?? []) as MyPraise[];

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="내 활동" description="내가 쓴 칭찬과 삭제 요청 상태를 확인할 수 있어요." />

      {praises.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
          아직 남긴 칭찬이 없어요.{" "}
          <Link href="/praises/new" className="text-brand-700 hover:underline">
            첫 칭찬 남기기
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {praises.map((p) => {
            const body = (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">To. {recipientNames(p.recipients)}</span>
                  <CategoryBadge name={p.category_name} />
                  {p.is_anonymous && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">익명</span>
                  )}
                  <StatusBadge praise={p} />
                  <span className="ml-auto text-xs text-stone-400">{formatDate(p.created_at)}</span>
                </div>
                <p className="line-clamp-2 text-sm text-stone-600">{p.content}</p>
              </>
            );
            return (
              <li key={p.id}>
                {p.is_hidden ? (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 opacity-70">{body}</div>
                ) : (
                  <Link
                    href={`/praises/${p.id}`}
                    className="block rounded-xl border border-stone-200 bg-white p-4 hover:shadow-sm"
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
