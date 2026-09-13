import type { Metadata } from "next";
import "./globals.css";
import AuthSessionProvider from "@/components/shared/SessionProvider";

export const metadata: Metadata = {
  title: "نظام إدارة تقييم الأداء - مكتب المحامي رامي الحامد",
  description: "RHL Performance Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
