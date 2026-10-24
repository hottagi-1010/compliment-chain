import Link from "next/link";
import { PraiseFeed } from "@/components/praise-feed";
import { buttonClass, inputClass } from "@/components/ui";
import { fetchCategories, fetchPraises, parseFilters } from "@/lib/praises";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const [categories, feed] = await Promise.all([fetchCategories(), fetchPraises(filters)]);

  // 클라이언트 "더 보기"에 넘길 검색 조건 (문자열만)
  const params: Record<string, string> = {};
  for (const key of ["to", "q", "category", "from", "until"] as const) {
    const v = raw[key];
    if (typeof v === "string" && v) params[key] = v;
  }
  const hasFilter = Object.keys(params).length > 0;

  const categoryHref = (id?: number) => {
    const next = new URLSearchParams(params);
    if (id) next.set("category", String(id));
    else next.delete("category");
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">오늘도 고마운 동료에게</h1>
          <p className="mt-1 text-sm text-stone-500">동료들이 남긴 칭찬을 최신순으로 모았어요.</p>
        </div>
        <Link href="/praises/new" className={buttonClass}>
          + 칭찬하기
        </Link>
      </div>

      <form
        method="get"
        className="mb-4 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]"
      >
        {filters.categoryId && <input type="hidden" name="category" value={filters.categoryId} />}
        <input
          name="to"
          defaultValue={filters.recipient}
          placeholder="받는 사람 이름"
          className={inputClass}
          aria-label="받는 사람 이름"
        />
        <input
          name="q"
          defaultValue={filters.keyword}
          placeholder="내용 키워드"
          className={inputClass}
          aria-label="내용 키워드"
        />
        <input
          type="date"
          name="from"
          defaultValue={filters.from}
          className={inputClass}
          aria-label="시작일"
        />
        <input
          type="date"
          name="until"
          defaultValue={filters.to}
          className={inputClass}
          aria-label="종료일"
        />
        <div className="flex gap-2">
          <button type="submit" className={buttonClass}>
            검색
          </button>
          {hasFilter && (
            <Link
              href="/"
              className="inline-flex items-center rounded-lg px-3 text-sm text-stone-500 hover:bg-stone-100"
            >
              초기화
            </Link>
          )}
        </div>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={categoryHref()}
          className={`rounded-full px-3 py-1 text-sm ${
            !filters.categoryId ? "bg-stone-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
          }`}
        >
          전체
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={categoryHref(c.id)}
            className={`rounded-full px-3 py-1 text-sm ${
              filters.categoryId === c.id
                ? "bg-brand-600 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <PraiseFeed
        key={JSON.stringify(params)}
        initialItems={feed.items}
        initialCursor={feed.nextCursor}
        params={params}
      />
    </>
  );
}
