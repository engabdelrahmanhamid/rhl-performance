"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

export async function markNotificationRead(id: string) {
  const session = await requireSession();
  await prisma.notification.updateMany({ where: { id, userId: session.user.id }, data: { isRead: true } });
  revalidatePath("/admin/notifications");
  revalidatePath("/evaluator/notifications");
}

export async function markAllNotificationsRead() {
  const session = await requireSession();
  await prisma.notification.updateMany({ where: { userId: session.user.id, isRead: false }, data: { isRead: true } });
  revalidatePath("/admin/notifications");
  revalidatePath("/evaluator/notifications");
}
