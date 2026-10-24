import { PageTitle } from "@/components/app-shell";
import { buttonClass, inputClass } from "@/components/ui";
import { dateInputToIso, isoToDateInput, monthRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Stats = {
  praise_count: number;
  anonymous_count: number;
  hidden_count: number;
  recipient_count: number;
  like_count: number;
  comment_count: number;
  pending_requests: number;
  active_users: number;
  by_category: { name: string; count: number }[];
  by_day: { day: string; count: number }[];
};

export default async function StatsPage({ searchParams }: PageProps<"/stats">) {
  const { from: rawFrom, until: rawUntil } = await searchParams;
  const month = monthRange(0);
  const fromInput = typeof rawFrom === "string" && dateInputToIso(rawFrom) ? rawFrom : isoToDateInput(month.from);
  const untilDefault = isoToDateInput(new Date(new Date(month.to).getTime() - 1).toISOString());
  const untilInput =
    typeof rawUntil === "string" && dateInputToIso(rawUntil) ? rawUntil : untilDefault;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ops_stats", {
    p_from: dateInputToIso(fromInput),
    p_to: dateInputToIso(untilInput, true),
  });
  const stats = data as Stats | null;

  const tiles = stats
    ? [
        { label: "칭찬 수", value: stats.praise_count },
        { label: "칭찬 받은 직원", value: stats.recipient_count },
        { label: "칭찬 받은 직원 비율", value: `${stats.active_users ? Math.round((stats.recipient_count / stats.active_users) * 100) : 0}%` },
        { label: "익명 칭찬", value: stats.anonymous_count },
        { label: "좋아요", value: stats.like_count },
        { label: "댓글", value: stats.comment_count },
        { label: "숨김 처리", value: stats.hidden_count },
        { label: "처리 대기 삭제 요청", value: stats.pending_requests },
      ]
    : [];
  const maxCategory = Math.max(1, ...(stats?.by_category.map((c) => c.count) ?? []));
  const maxDay = Math.max(1, ...(stats?.by_day.map((d) => d.count) ?? []));

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="운영 통계" description="받은 사람 기준으로 집계합니다. 작성자 기준 통계는 제공하지 않습니다." />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-stone-500">시작일</span>
          <input type="date" name="from" defaultValue={fromInput} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-stone-500">종료일</span>
          <input type="date" name="until" defaultValue={untilInput} className={inputClass} />
        </label>
        <button type="submit" className={buttonClass}>
          조회
        </button>
      </form>

      {error || !stats ? (
        <p className="text-sm text-red-600">통계를 불러오지 못했습니다.</p>
      ) : (
        <>
          <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-stone-200 bg-white p-4">
                <dt className="text-xs text-stone-500">{t.label}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums">{t.value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="mb-4 font-semibold">카테고리별 칭찬</h2>
              {stats.by_category.length === 0 ? (
                <p className="text-sm text-stone-500">데이터가 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {stats.by_category.map((c) => (
                    <li key={c.name} className="grid grid-cols-[5rem_1fr_2.5rem] items-center gap-2 text-sm">
                      <span className="truncate">{c.name}</span>
                      <span className="h-3 rounded-full bg-stone-100">
                        <span
                          className="block h-3 rounded-full bg-brand-500"
                          style={{ width: `${(c.count / maxCategory) * 100}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="mb-4 font-semibold">일별 칭찬 수</h2>
              {stats.by_day.length === 0 ? (
                <p className="text-sm text-stone-500">데이터가 없습니다.</p>
              ) : (
                <ul className="max-h-80 space-y-1 overflow-auto">
                  {stats.by_day.map((d) => (
                    <li key={d.day} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                      <span className="tabular-nums text-stone-500">{d.day.slice(5)}</span>
                      <span className="h-2.5 rounded-full bg-stone-100">
                        <span
                          className="block h-2.5 rounded-full bg-brand-500"
                          style={{ width: `${(d.count / maxDay) * 100}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">{d.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
