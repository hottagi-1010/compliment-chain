"use client";

import { useState, useTransition } from "react";
import { loadMorePraises } from "@/actions/praises";
import type { FeedCursor } from "@/lib/praises";
import type { PraiseCard } from "@/lib/types";
import { PraiseCardView } from "./praise-card";
import { secondaryButtonClass } from "./ui";

export function PraiseFeed({
  initialItems,
  initialCursor,
  params,
}: {
  initialItems: PraiseCard[];
  initialCursor: FeedCursor | null;
  params: Record<string, string>;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadMore = () => {
    if (!cursor) return;
    startTransition(async () => {
      try {
        const next = await loadMorePraises(params, cursor);
        setItems((prev) => [...prev, ...next.items]);
        setCursor(next.nextCursor);
        setError(false);
      } catch {
        setError(true);
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
        아직 칭찬이 없어요. 첫 칭찬을 남겨 보세요!
      </div>
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((praise) => (
          <li key={praise.id}>
            <PraiseCardView praise={praise} />
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col items-center gap-2">
        {error && <p className="text-sm text-red-600">목록을 불러오지 못했습니다. 다시 시도해 주세요.</p>}
        {cursor && (
          <button type="button" onClick={loadMore} disabled={pending} className={secondaryButtonClass}>
            {pending ? "불러오는 중…" : "더 보기"}
          </button>
        )}
      </div>
    </>
  );
}
