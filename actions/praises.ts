"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchPraises, parseFilters, type FeedCursor } from "@/lib/praises";
import { toUserMessage } from "@/lib/errors";
import { commentSchema, firstIssue, praiseSchema, uuidSchema } from "@/lib/validators";
import type { ActionState } from "@/lib/types";

export async function createPraise(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile();

  const parsed = praiseSchema.safeParse({
    recipientIds: formData.getAll("recipientIds"),
    categoryId: formData.get("categoryId"),
    content: formData.get("content"),
    isAnonymous: formData.get("isAnonymous") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_praise", {
    p_recipient_ids: parsed.data.recipientIds,
    p_category_id: parsed.data.categoryId,
    p_content: parsed.data.content,
    p_is_anonymous: parsed.data.isAnonymous,
  });
  if (error || typeof data !== "string") return { error: toUserMessage(error) };

  revalidatePath("/");
  redirect(`/praises/${data}`);
}

// params는 클라이언트에서 오므로 페이지와 같은 파서로 다시 정리한다
export async function loadMorePraises(params: Record<string, string>, cursor: FeedCursor) {
  await requireProfile();
  if (!uuidSchema.safeParse(cursor.id).success || Number.isNaN(Date.parse(cursor.createdAt))) {
    return { items: [], nextCursor: null };
  }
  return fetchPraises(parseFilters(params), cursor);
}

export async function searchRecipients(query: string) {
  await requireProfile();
  const q = query.trim().slice(0, 50);
  if (!q) return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc("search_profiles", { p_query: q });
  return (data ?? []) as { id: string; name: string; employee_no: string }[];
}

export async function toggleLike(praiseId: string, liked: boolean) {
  const profile = await requireProfile();
  if (!uuidSchema.safeParse(praiseId).success) return { error: toUserMessage(null) };

  const supabase = await createClient();
  const { error } = liked
    ? await supabase
        .from("praise_likes")
        .delete()
        .eq("praise_id", praiseId)
        .eq("user_id", profile.id)
    : await supabase.from("praise_likes").insert({ praise_id: praiseId, user_id: profile.id });

  // 이미 누른 상태에서 다시 누른 경우(23505)는 성공으로 본다
  if (error && error.code !== "23505") return { error: toUserMessage(error) };

  const { data } = await supabase
    .from("praises_public")
    .select("like_count, liked_by_me")
    .eq("id", praiseId)
    .maybeSingle<{ like_count: number; liked_by_me: boolean }>();

  revalidatePath(`/praises/${praiseId}`);
  return { likeCount: data?.like_count ?? 0, liked: data?.liked_by_me ?? !liked };
}

export async function addComment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const parsed = commentSchema.safeParse({
    praiseId: formData.get("praiseId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    praise_id: parsed.data.praiseId,
    author_id: profile.id,
    content: parsed.data.content,
  });
  if (error) return { error: toUserMessage(error) };

  revalidatePath(`/praises/${parsed.data.praiseId}`);
  return { message: "댓글을 남겼습니다." };
}

export async function deleteComment(
  commentId: string,
  praiseId: string,
  _prev: ActionState,
): Promise<ActionState> {
  await requireProfile();
  if (!uuidSchema.safeParse(commentId).success) return { error: toUserMessage(null) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .select("id");
  if (error || !data?.length) return { error: "댓글을 삭제할 수 없습니다." };

  revalidatePath(`/praises/${praiseId}`);
  return {};
}

export async function requestDeletion(praiseId: string, _prev: ActionState): Promise<ActionState> {
  await requireProfile();
  if (!uuidSchema.safeParse(praiseId).success) return { error: toUserMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_deletion", { p_praise_id: praiseId });
  if (error) return { error: toUserMessage(error) };

  revalidatePath(`/praises/${praiseId}`);
  revalidatePath("/me");
  return { message: "삭제 요청이 접수되었습니다." };
}
