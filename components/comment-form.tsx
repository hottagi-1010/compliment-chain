"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment } from "@/actions/praises";
import { FormMessage, inputClass, SubmitButton } from "./ui";

export function CommentForm({ praiseId }: { praiseId: string }) {
  const [state, formAction] = useActionState(addComment, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="praiseId" value={praiseId} />
      <textarea
        name="content"
        rows={3}
        maxLength={1000}
        required
        placeholder="따뜻한 한마디를 남겨 주세요."
        className={inputClass}
        aria-label="댓글 내용"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">{state.error && <FormMessage state={{ error: state.error }} />}</div>
        <SubmitButton pendingText="등록 중…">댓글 등록</SubmitButton>
      </div>
    </form>
  );
}
