"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export const buttonClass =
  "inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60";

export function SubmitButton({
  children,
  pendingText = "처리 중…",
  className = buttonClass,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {state.message}
      </p>
    );
  }
  return null;
}

// 서버 액션 하나를 실행하는 버튼. confirmText가 있으면 실행 전에 확인한다.
export function ActionButton({
  action,
  label,
  pendingText,
  confirmText,
  className = secondaryButtonClass,
}: {
  action: (prev: ActionState) => Promise<ActionState>;
  label: string;
  pendingText?: string;
  confirmText?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      <SubmitButton className={className} pendingText={pendingText}>
        {label}
      </SubmitButton>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.message && <span className="text-xs text-emerald-700">{state.message}</span>}
    </form>
  );
}
