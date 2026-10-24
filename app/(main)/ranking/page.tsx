import Link from "next/link";
import { PageTitle } from "@/components/app-shell";
import { displayName, monthRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Period = "month" | "last" | "all";

type RankingRow = {
  rank: number;
  recipient_id: string;
  name: string;
  is_active: boolean;
  praise_count: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function RankingPage({ searchParams }: PageProps<"/ranking">) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = rawPeriod === "last" || rawPeriod === "all" ? rawPeriod : "month";

  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);
  const tabs: { key: Period; label: string }[] = [
    { key: "month", label: `이달의 칭찬왕 (${thisMonth.label})` },
    { key: "last", label: `지난달 (${lastMonth.label})` },
    { key: "all", label: "누적" },
  ];
  const range = period === "month" ? thisMonth : period === "last" ? lastMonth : null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("public_ranking", {
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
    p_limit: 20,
  });
  const rows = (data ?? []) as RankingRow[];

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="칭찬 순위" description="받은 칭찬 횟수 기준입니다. 숨김 처리된 글은 제외됩니다." />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "month" ? "/ranking" : `/ranking?period=${t.key}`}
            className={`rounded-full px-3 py-1 text-sm ${
              period === t.key ? "bg-brand-600 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
          이 기간에는 아직 칭찬이 없어요.
        </p>
      ) : (
        <ol className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {rows.map((r) => (
            <li key={r.recipient_id} className="flex items-center gap-4 px-5 py-3">
              <span className="w-8 text-center text-lg font-bold text-stone-400">
                {MEDALS[r.rank - 1] ?? r.rank}
              </span>
              <span className="flex-1 font-medium">{displayName(r.name, r.is_active)}</span>
              <span className="text-sm text-stone-500">
                칭찬 <strong className="text-brand-700">{r.praise_count}</strong>회
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
