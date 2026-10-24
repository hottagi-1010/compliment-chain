"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toUserMessage } from "@/lib/errors";
import { roleSchema, uuidSchema } from "@/lib/validators";
import type { ActionState } from "@/lib/types";

// 비활성화하면 Supabase Auth에서도 로그인을 막는다 (RLS의 is_active 조건과 이중 차단)
const BAN_FOREVER = "876000h";

export async function setAccountActive(
  userId: string,
  active: boolean,
  _prev: ActionState,
): Promise<ActionState> {
  await requireProfile(["admin"]);
  if (!uuidSchema.safeParse(userId).success) return { error: toUserMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_active", {
    p_user_id: userId,
    p_active: active,
  });
  if (error) return { error: toUserMessage(error) };

  const { error: banError } = await createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });

  revalidatePath("/accounts");
  if (banError) {
    return { error: "계정 상태는 변경했지만 로그인 차단 설정에 실패했습니다. 다시 시도해 주세요." };
  }
  return { message: active ? "활성화했습니다." : "비활성화했습니다." };
}

export async function setAccountRole(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile(["admin"]);
  const role = roleSchema.safeParse(formData.get("role"));
  if (!uuidSchema.safeParse(userId).success || !role.success) {
    return { error: toUserMessage(null) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    p_user_id: userId,
    p_role: role.data,
  });
  if (error) return { error: toUserMessage(error) };

  revalidatePath("/accounts");
  return { message: "역할을 변경했습니다." };
}
