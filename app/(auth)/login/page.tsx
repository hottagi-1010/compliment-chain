import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";

const NOTICES: Record<string, string> = {
  inactive: "비활성화된 계정입니다. 재가입 후 이용해 주세요.",
  confirm: "이메일 인증 링크가 만료되었거나 올바르지 않습니다. 다시 가입해 주세요.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const notice = typeof error === "string" ? NOTICES[error] : undefined;

  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">로그인</h1>
      {notice && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>
      )}
      <LoginForm />
      <div className="mt-6 flex justify-between text-sm text-stone-500">
        <Link href="/signup" className="hover:text-brand-700">
          회원가입
        </Link>
        <Link href="/password-report" className="hover:text-brand-700">
          비밀번호를 잊으셨나요?
        </Link>
      </div>
    </>
  );
}
