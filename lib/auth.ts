import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Role } from "./types";

// 요청 단위로 한 번만 조회한다
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, employee_no, name, email, role, is_active")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  return data;
});

export async function requireProfile(roles?: Role[]) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (roles && !roles.includes(profile.role)) redirect("/");
  return profile;
}

export function isOpsRole(role: Role) {
  return role === "ops" || role === "admin";
}
