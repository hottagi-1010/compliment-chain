"use client";

import { useState, useTransition } from "react";
import { toggleLike } from "@/actions/praises";

export function LikeButton({
  praiseId,
  initialLiked,
  initialCount,
}: {
  praiseId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const prevLiked = liked;
    const prevCount = count;
    // 낙관적 업데이트 후 서버 값으로 맞춘다
    setLiked(!prevLiked);
    setCount(prevCount + (prevLiked ? -1 : 1));
    startTransition(async () => {
      const result = await toggleLike(praiseId, prevLiked);
      if ("error" in result) {
        setLiked(prevLiked);
        setCount(prevCount);
        setError(result.error ?? null);
        return;
      }
      setLiked(result.liked);
      setCount(result.likeCount);
      setError(null);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={liked}
        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition ${
          liked
            ? "border-rose-300 bg-rose-50 text-rose-600"
            : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
        }`}
      >
        <span aria-hidden>{liked ? "♥" : "♡"}</span>
        좋아요 {count}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
