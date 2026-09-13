import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/shared/Sidebar";
import Header from "@/components/shared/Header";
import NotificationBell from "@/components/shared/NotificationBell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const roleLabel = session.user.role === "SUPER_ADMIN" ? "مدير النظام" : "مقيّم";

  return (
    <div className="flex min-h-screen">
      <Sidebar role={session.user.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header
          fullName={session.user.name ?? ""}
          roleLabel={roleLabel}
          notificationBell={<NotificationBell userId={session.user.id} role={session.user.role} />}
        />
        <main className="flex-1 bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
