import Link from "next/link";
import { SignupForm } from "@/components/auth-forms";

export default function SignupPage() {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN?.trim() ?? "";
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">회원가입</h1>
      <p className="mb-4 text-sm text-stone-500">
        {domain ? `@${domain} ` : "사내 "}이메일로만 가입할 수 있습니다. 가입 후 이메일 인증을
        완료해 주세요.
      </p>
      <SignupForm domain={domain} />
      <p className="mt-6 text-center text-sm text-stone-500">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="text-brand-700 hover:underline">
          로그인
        </Link>
      </p>
    </>
  );
}
