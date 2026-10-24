import type { PersonRef } from "./types";

const TIME_ZONE = "Asia/Seoul";

export const INACTIVE_NAME = "비활성 회원";
export const ANONYMOUS_NAME = "익명";

// 비활성 회원은 이름 대신 "비활성 회원"으로 표시한다 (CLAUDE.md 6.7)
export function displayName(name: string | null | undefined, isActive: boolean | null | undefined) {
  if (isActive === false) return INACTIVE_NAME;
  return name ?? INACTIVE_NAME;
}

export function recipientNames(recipients: PersonRef[]) {
  return recipients.map((r) => displayName(r.name, r.is_active)).join(", ");
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// 서울 기준 월 범위. offset 0 = 이번 달, -1 = 지난 달
export function monthRange(offset = 0) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value) - 1 + offset;

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const label = `${start.getUTCFullYear()}년 ${start.getUTCMonth() + 1}월`;
  return { from: seoulMidnight(start), to: seoulMidnight(end), label };
}

function seoulMidnight(utcDate: Date) {
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00+09:00`;
}

// "YYYY-MM-DD" 입력을 서울 자정 시각으로. toExclusive면 다음 날 자정
export function dateInputToIso(value: string | undefined, toExclusive = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const base = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(base.getTime())) return null;
  if (toExclusive) base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString();
}

// ISO 시각을 서울 기준 "YYYY-MM-DD" (date input 값)로
export function isoToDateInput(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(iso));
}
