import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "칭찬 릴레이",
  description: "동료에게 고마운 마음을 전하는 사내 칭찬 게시판",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
