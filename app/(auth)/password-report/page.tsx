import Link from "next/link";
import { PasswordReportForm } from "@/components/auth-forms";

export default function PasswordReportPage() {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">비밀번호 분실 신고</h1>
      <p className="mb-4 text-sm leading-relaxed text-stone-500">
        보안을 위해 비밀번호 재설정 메일은 보내지 않습니다. 신고가 접수되면 관리자가 계정을
        비활성화하며, 이후 같은 사번과 이메일로 다시 가입해 이용할 수 있습니다.
      </p>
      <PasswordReportForm />
      <p className="mt-6 text-center text-sm text-stone-500">
        <Link href="/login" className="text-brand-700 hover:underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </>
  );
}
