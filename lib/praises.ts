import "server-only";
import { createClient } from "./supabase/server";
import { dateInputToIso } from "./format";
import { GENERIC_ERROR } from "./errors";
import type { Category, PraiseCard } from "./types";

export const PAGE_SIZE = 12;

export type PraiseFilters = {
  recipient?: string;
  keyword?: string;
  categoryId?: number;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD (포함)
};

export type FeedCursor = { createdAt: string; id: string };

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() ? v.trim().slice(0, 100) : undefined;
}

export function parseFilters(params: SearchParams): PraiseFilters {
  const categoryId = Number(single(params.category));
  return {
    recipient: single(params.to),
    keyword: single(params.q),
    categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : undefined,
    from: single(params.from),
    to: single(params.until),
  };
}

export async function fetchPraises(filters: PraiseFilters, cursor?: FeedCursor | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_praises", {
    p_recipient: filters.recipient ?? null,
    p_keyword: filters.keyword ?? null,
    p_category_id: filters.categoryId ?? null,
    p_from: dateInputToIso(filters.from),
    p_to: dateInputToIso(filters.to, true),
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: PAGE_SIZE + 1,
  });
  if (error) throw new Error(GENERIC_ERROR);

  const rows = (data ?? []) as PraiseCard[];
  const items = rows.slice(0, PAGE_SIZE);
  const last = items[items.length - 1];
  const nextCursor: FeedCursor | null =
    rows.length > PAGE_SIZE && last ? { createdAt: last.created_at, id: last.id } : null;
  return { items, nextCursor };
}

export async function fetchPraise(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("praises_public")
    .select(
      "id, author_id, author_name, author_is_active, is_anonymous, category_id, category_name, content, created_at, is_mine, recipients, like_count, liked_by_me, comment_count",
    )
    .eq("id", id)
    .maybeSingle<PraiseCard>();
  return data;
}

export async function fetchCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("id");
  return (data ?? []) as Category[];
}
