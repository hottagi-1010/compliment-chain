"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/lib/errors";
import { uuidSchema } from "@/lib/validators";
import type { ActionState } from "@/lib/types";

// 삭제 요청 처리: DB 함수가 권한 확인, 숨김 처리, 감사 기록을 한 번에 한다
export async function processDeletion(requestId: string, _prev: ActionState): Promise<ActionState> {
  await requireProfile(["ops", "admin"]);
  if (!uuidSchema.safeParse(requestId).success) return { error: toUserMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ops_process_deletion", { p_request_id: requestId });
  if (error) return { error: toUserMessage(error) };

  revalidatePath("/requests");
  revalidatePath("/");
  return { message: "처리했습니다." };
}
