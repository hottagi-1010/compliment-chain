"use client";

import { useActionState } from "react";
import type { ActionState, Role } from "@/lib/types";
import { SubmitButton } from "./ui";

export function RoleForm({
  action,
  role,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  role: Role;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <div className="flex gap-1">
        <select
          name="role"
          defaultValue={role}
          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
          aria-label="역할"
        >
          <option value="user">일반</option>
          <option value="ops">운영</option>
          <option value="admin">관리자</option>
        </select>
        <SubmitButton
          pendingText="…"
          className="rounded-md border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-60"
        >
          변경
        </SubmitButton>
      </div>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.message && <span className="text-xs text-emerald-700">{state.message}</span>}
    </form>
  );
}
