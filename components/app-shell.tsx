import Link from "next/link";
import { logout } from "@/actions/auth";
import { isOpsRole } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { NavLinks, type NavItem } from "./nav-links";

const ROLE_LABEL = { user: "", ops: "운영", admin: "관리자" } as const;

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const items: NavItem[] = [
    { href: "/", label: "칭찬 보기" },
    { href: "/praises/new", label: "칭찬하기" },
    { href: "/ranking", label: "순위" },
    { href: "/me", label: "내 활동" },
  ];
  if (isOpsRole(profile.role)) {
    items.push({ href: "/requests", label: "삭제 요청" }, { href: "/stats", label: "통계" });
  }
  if (profile.role === "admin") {
    items.push({ href: "/accounts", label: "계정 관리" });
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="text-lg font-bold text-brand-700">
            칭찬 릴레이
          </Link>
          <NavLinks items={items} />
          <div className="ml-auto flex items-center gap-3 text-sm text-stone-600">
            <span>
              {profile.name}
              {ROLE_LABEL[profile.role] && (
                <span className="ml-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs">
                  {ROLE_LABEL[profile.role]}
                </span>
              )}
            </span>
            <form action={logout}>
              <button type="submit" className="text-stone-500 underline-offset-2 hover:underline">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
    </div>
  );
}
