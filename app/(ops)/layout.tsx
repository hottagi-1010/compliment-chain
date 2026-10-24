import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile(["ops", "admin"]);
  return <AppShell profile={profile}>{children}</AppShell>;
}
