import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
