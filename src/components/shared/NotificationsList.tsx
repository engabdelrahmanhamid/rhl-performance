import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { Bell, BellOff } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/services/notificationActions";

export default async function NotificationsList() {
  const session = await getServerSession(authOptions);
  const notifications = await prisma.notification.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="الإشعارات"
        actions={
          notifications.some((n) => !n.isRead) && (
            <form action={markAllNotificationsRead}>
              <button className="btn-secondary">تعليم الكل كمقروء</button>
            </form>
          )
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={BellOff} title="لا توجد إشعارات" />
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.isRead ? "bg-primary-50/40" : ""}`}>
              <div className="mt-0.5 text-primary-600">
                <Bell size={16} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">{n.title}</div>
                <div className="text-sm text-slate-500">{n.body}</div>
                <div className="mt-1 text-xs text-slate-400">{n.createdAt.toLocaleString("ar-SA")}</div>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs">
                {n.link && (
                  <Link href={n.link} className="text-primary-600 hover:underline">
                    عرض
                  </Link>
                )}
                {!n.isRead && (
                  <form
                    action={async () => {
                      "use server";
                      await markNotificationRead(n.id);
                    }}
                  >
                    <button className="text-slate-400 hover:underline">تعليم كمقروء</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
