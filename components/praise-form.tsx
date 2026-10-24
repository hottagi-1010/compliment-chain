"use client";

import { useActionState, useEffect, useState } from "react";
import { createPraise, searchRecipients } from "@/actions/praises";
import type { Category } from "@/lib/types";
import { FormMessage, inputClass, SubmitButton } from "./ui";

type Person = { id: string; name: string; employee_no: string };

const MAX_LENGTH = 2000;

export function PraiseForm({ categories }: { categories: Category[] }) {
  const [state, formAction] = useActionState(createPraise, {});
  const [selected, setSelected] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // 입력이 멈추면 직원 검색 (250ms)
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchRecipients(q);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const add = (person: Person) => {
    setSelected((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]));
    setQuery("");
    setResults([]);
  };
  const remove = (id: string) => setSelected((prev) => prev.filter((p) => p.id !== id));

  const visibleResults = query.trim()
    ? results.filter((r) => !selected.some((s) => s.id === r.id))
    : [];

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          받는 사람 <span className="font-normal text-stone-500">(1명 이상)</span>
        </legend>
        {selected.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {selected.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-1 rounded-full bg-brand-100 py-1 pl-3 pr-1 text-sm text-brand-700"
              >
                {p.name}
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label={`${p.name} 제외`}
                  className="rounded-full px-1.5 hover:bg-brand-200"
                >
                  ×
                </button>
                <input type="hidden" name="recipientIds" value={p.id} />
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (visibleResults[0]) add(visibleResults[0]);
              }
            }}
            placeholder="이름 또는 사번으로 검색"
            className={inputClass}
            aria-label="받는 사람 검색"
          />
          {visibleResults.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-stone-200 bg-white shadow-lg">
              {visibleResults.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => add(p)}
                    className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"
                  >
                    <span>{p.name}</span>
                    <span className="text-stone-400">{p.employee_no}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">카테고리</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className="cursor-pointer">
              <input
                type="radio"
                name="categoryId"
                value={c.id}
                checked={categoryId === c.id}
                onChange={() => setCategoryId(c.id)}
                className="peer sr-only"
              />
              <span className="inline-block rounded-full border border-stone-300 px-3 py-1 text-sm peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-200">
                {c.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="content" className="mb-2 block text-sm font-semibold">
          칭찬 내용
        </label>
        <textarea
          id="content"
          name="content"
          rows={6}
          maxLength={MAX_LENGTH}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="어떤 점이 고마웠는지 구체적으로 남겨 주세요."
          className={inputClass}
          required
        />
        <p className="mt-1 text-right text-xs text-stone-400">
          {content.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="isAnonymous"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="mt-0.5 accent-brand-600"
        />
        <span>
          익명으로 남기기
          <span className="block text-xs text-stone-500">
            익명 글의 작성자는 관리자와 운영 담당자를 포함해 누구에게도 공개되지 않습니다.
          </span>
        </span>
      </label>

      <FormMessage state={state} />

      <div className="flex justify-end">
        <SubmitButton pendingText="남기는 중…">칭찬 남기기</SubmitButton>
      </div>
    </form>
  );
}
