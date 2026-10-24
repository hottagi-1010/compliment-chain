import Link from "next/link";
import { ANONYMOUS_NAME, displayName, formatDate, recipientNames } from "@/lib/format";
import type { PraiseCard } from "@/lib/types";

export function authorLabel(praise: Pick<PraiseCard, "is_anonymous" | "author_name" | "author_is_active">) {
  return praise.is_anonymous
    ? ANONYMOUS_NAME
    : displayName(praise.author_name, praise.author_is_active);
}

export function CategoryBadge({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
      {name}
    </span>
  );
}

export function PraiseCardView({ praise }: { praise: PraiseCard }) {
  return (
    <Link
      href={`/praises/${praise.id}`}
      className="group flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-base font-semibold text-stone-900">
          <span className="text-stone-400">To.</span> {recipientNames(praise.recipients)}
        </p>
        <CategoryBadge name={praise.category_name} />
      </div>
      <p className="line-clamp-4 flex-1 whitespace-pre-line text-sm leading-relaxed text-stone-700">
        {praise.content}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
        <span>
          From. {authorLabel(praise)} · {formatDate(praise.created_at)}
        </span>
        <span className="flex gap-2">
          <span className={praise.liked_by_me ? "text-rose-500" : ""}>♥ {praise.like_count}</span>
          <span>💬 {praise.comment_count}</span>
        </span>
      </div>
    </Link>
  );
}
