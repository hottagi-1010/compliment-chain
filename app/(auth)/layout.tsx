export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-2xl font-bold text-brand-700">칭찬 릴레이</p>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
