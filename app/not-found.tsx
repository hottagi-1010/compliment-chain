import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <p className="text-lg font-semibold">페이지를 찾을 수 없어요</p>
      <p className="text-sm text-stone-500">삭제되었거나 주소가 올바르지 않습니다.</p>
      <Link href="/" className="text-sm text-brand-700 hover:underline">
        칭찬 목록으로
      </Link>
    </main>
  );
}
