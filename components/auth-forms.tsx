"use client";

import { useActionState } from "react";
import { login, reportPasswordLoss, signup } from "@/actions/auth";
import { FormMessage, inputClass, SubmitButton } from "./ui";

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className={inputClass}
      />
    </label>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(login, {});
  return (
    <form action={formAction} className="space-y-4">
      <Field label="사번" name="employeeNo" autoComplete="username" />
      <Field label="비밀번호" name="password" type="password" autoComplete="current-password" />
      <FormMessage state={state} />
      <SubmitButton className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        로그인
      </SubmitButton>
    </form>
  );
}

export function SignupForm({ domain }: { domain: string }) {
  const [state, formAction] = useActionState(signup, {});
  if (state.message) return <FormMessage state={state} />;

  return (
    <form action={formAction} className="space-y-4">
      <Field label="사번" name="employeeNo" autoComplete="username" />
      <Field label="이름" name="name" autoComplete="name" />
      <Field
        label="사내 이메일"
        name="email"
        type="email"
        autoComplete="email"
        placeholder={domain ? `name@${domain}` : undefined}
      />
      <Field label="비밀번호 (8자 이상)" name="password" type="password" autoComplete="new-password" />
      <Field label="비밀번호 확인" name="passwordConfirm" type="password" autoComplete="new-password" />
      <FormMessage state={state} />
      <SubmitButton className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        가입하기
      </SubmitButton>
    </form>
  );
}

export function PasswordReportForm() {
  const [state, formAction] = useActionState(reportPasswordLoss, {});
  if (state.message) return <FormMessage state={state} />;

  return (
    <form action={formAction} className="space-y-4">
      <Field label="사번" name="employeeNo" />
      <Field label="사내 이메일" name="email" type="email" />
      <FormMessage state={state} />
      <SubmitButton className="w-full rounded-lg bg-stone-800 py-2.5 text-sm font-semibold text-white hover:bg-stone-900 disabled:opacity-60">
        분실 신고
      </SubmitButton>
    </form>
  );
}
