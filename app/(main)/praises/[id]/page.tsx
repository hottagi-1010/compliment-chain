import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteComment, requestDeletion } from "@/actions/praises";
import { CommentForm } from "@/components/comment-form";
import { LikeButton } from "@/components/like-button";
import { authorLabel, CategoryBadge } from "@/components/praise-card";
import { ActionButton } from "@/components/ui";
import { isOpsRole, requireProfile } from "@/lib/auth";
import { displayName, formatDateTime, recipientNames } from "@/lib/format";
import { fetchPraise } from "@/lib/praises";
import { createClient } from "@/lib/supabase/server";
import type { Comment, RequestStatus } from "@/lib/types";
import { uuidSchema } from "@/lib/validators";

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "삭제 요청 접수됨",
  done: "처리 완료",
};

export default async function PraiseDetailPage({ params }: PageProps<"/praises/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const profile = await requireProfile();
  const praise = await fetchPraise(id);
  if (!praise) notFound();

  const supabase = await createClient();
  const [{ data: commentRows }, { data: request }] = await Promise.all([
    supabase
      .from("comments")
      .select("id, author_id, content, created_at, author:profiles(name, is_active)")
      .eq("praise_id", id)
      .order("created_at")
      .returns<Comment[]>(),
    // 본인 글일 때만 의미가 있다 (RLS상 본인 요청만 조회됨)
    praise.is_mine
      ? supabase
          .from("deletion_requests")
          .select("status")
          .eq("praise_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ status: RequestStatus }>()
      : Promise.resolve({ data: null }),
  ]);
  const comments = commentRows ?? [];
  const canModerate = isOpsRole(profile.role);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="text-sm text-stone-500 hover:text-brand-700">
        ← 목록으로
      </Link>

      <article className="mt-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-bold">
            <span className="text-stone-400">To.</span> {recipientNames(praise.recipients)}
          </h1>
          <CategoryBadge name={praise.category_name} />
        </div>
        <p className="mt-5 whitespace-pre-line leading-relaxed text-stone-800">{praise.content}</p>
        <p className="mt-6 text-sm text-stone-500">
          From. {authorLabel(praise)} · {formatDateTime(praise.created_at)}
          {praise.is_mine && praise.is_anonymous && (
            <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs">내가 쓴 익명 글</span>
          )}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
          <LikeButton
            praiseId={praise.id}
            initialLiked={praise.liked_by_me}
            initialCount={praise.like_count}
          />
          {praise.is_mine &&
            (request ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">
                {STATUS_LABEL[request.status]}
              </span>
            ) : (
              <ActionButton
                action={requestDeletion.bind(null, praise.id)}
                label="삭제 요청"
                pendingText="요청 중…"
                confirmText="이 글의 삭제를 요청할까요? 운영 담당자가 확인 후 처리합니다."
              />
            ))}
        </div>
      </article>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">댓글 {comments.length}</h2>
        <ul className="mb-4 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{displayName(c.author?.name, c.author?.is_active)}</span>
                <span className="text-xs text-stone-400">{formatDateTime(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-line text-sm text-stone-700">{c.content}</p>
              {(c.author_id === profile.id || canModerate) && (
                <div className="mt-2 text-right">
                  <ActionButton
                    action={deleteComment.bind(null, c.id, praise.id)}
                    label="삭제"
                    pendingText="삭제 중…"
                    confirmText="댓글을 삭제할까요?"
                    className="text-xs text-stone-400 hover:text-red-600"
                  />
                </div>
              )}
            </li>
          ))}
          {comments.length === 0 && (
            <li className="text-sm text-stone-500">첫 댓글을 남겨 보세요.</li>
          )}
        </ul>
        <CommentForm praiseId={praise.id} />
      </section>
    </div>
  );
}
