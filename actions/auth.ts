"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  firstIssue,
  isAllowedDomain,
  loginSchema,
  passwordReportSchema,
  signupSchema,
} from "@/lib/validators";
import type { ActionState } from "@/lib/types";

const LOGIN_FAILED = "사번 또는 비밀번호가 올바르지 않습니다.";

type ExistingProfile = {
  id: string;
  employee_no: string;
  email: string;
  is_active: boolean;
};

// 사번으로 로그인: 사번 → 이메일을 서버에서 찾은 뒤 Supabase Auth로 인증
export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    employeeNo: formData.get("employeeNo"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, is_active")
    .eq("employee_no", parsed.data.employeeNo)
    .is("archived_at", null)
    .maybeSingle<{ email: string; is_active: boolean }>();

  if (!profile) return { error: LOGIN_FAILED };
  if (!profile.is_active) {
    return { error: "비활성화된 계정입니다. 재가입 후 이용해 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "이메일 인증이 완료되지 않았습니다. 받은 메일의 링크를 눌러 주세요." };
    }
    return { error: LOGIN_FAILED };
  }

  redirect("/");
}

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    employeeNo: formData.get("employeeNo"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { employeeNo, name, email, password } = parsed.data;
  if (!isAllowedDomain(email)) {
    return { error: "사내 이메일로만 가입할 수 있습니다." };
  }

  const admin = createAdminClient();
  const [byNo, byEmail] = await Promise.all([
    admin
      .from("profiles")
      .select("id, employee_no, email, is_active")
      .eq("employee_no", employeeNo)
      .is("archived_at", null),
    admin
      .from("profiles")
      .select("id, employee_no, email, is_active")
      .eq("email", email)
      .is("archived_at", null),
  ]);
  if (byNo.error || byEmail.error) {
    return { error: "가입을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const existing = new Map<string, ExistingProfile>();
  for (const row of [...(byNo.data ?? []), ...(byEmail.data ?? [])] as ExistingProfile[]) {
    existing.set(row.id, row);
  }

  if ([...existing.values()].some((p) => p.is_active)) {
    return { error: "이미 가입된 사번 또는 이메일입니다." };
  }
  // 재가입은 사번과 이메일이 모두 기존 비활성 계정과 같을 때만 허용한다
  if ([...existing.values()].some((p) => p.employee_no !== employeeNo || p.email !== email)) {
    return { error: "이미 사용 중인 사번 또는 이메일입니다. 관리자에게 문의해 주세요." };
  }

  // 재가입: 기존 비활성 프로필은 삭제하지 않고 보관 처리해 사번·이메일을 비운다
  for (const old of existing.values()) {
    const archivedEmail = `archived+${old.id}@archived.invalid`;
    const { error: authError } = await admin.auth.admin.updateUserById(old.id, {
      email: archivedEmail,
      email_confirm: true,
    });
    if (authError) {
      return { error: "가입을 처리하지 못했습니다. 관리자에게 문의해 주세요." };
    }
    await admin
      .from("profiles")
      .update({
        employee_no: `${old.employee_no}#${old.id.slice(0, 8)}`,
        email: archivedEmail,
        archived_at: new Date().toISOString(),
      })
      .eq("id", old.id);
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { employee_no: employeeNo, name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    return { error: "가입을 완료하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요." };
  }

  return {
    message: "인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료한 뒤 로그인해 주세요.",
  };
}

// 비밀번호 분실 신고: 결과와 관계없이 같은 안내를 보여준다 (계정 존재 여부 비노출)
export async function reportPasswordLoss(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordReportSchema.safeParse({
    employeeNo: formData.get("employeeNo"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("employee_no", parsed.data.employeeNo)
    .eq("email", parsed.data.email)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle<{ id: string }>();

  if (profile) {
    // 이미 처리 대기 중인 신고가 있으면 유니크 인덱스로 무시된다
    await admin.from("password_reports").insert({ profile_id: profile.id });
  }

  return {
    message:
      "신고가 접수되었습니다. 관리자가 계정을 비활성화하면 같은 사번과 이메일로 재가입할 수 있습니다.",
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
