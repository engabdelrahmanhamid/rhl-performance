import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function NotificationBell({ userId, role }: { userId: string; role: "SUPER_ADMIN" | "EVALUATOR" }) {
  const unread = await prisma.notification.count({ where: { userId, isRead: false } });
  const href = role === "SUPER_ADMIN" ? "/admin/notifications" : "/evaluator/notifications";

  return (
    <Link href={href} className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
      <Bell size={17} />
      {unread > 0 && (
        <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
