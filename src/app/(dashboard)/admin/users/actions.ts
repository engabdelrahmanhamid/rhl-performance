"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const createUserSchema = z.object({
  fullName: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل"),
  role: z.enum(["SUPER_ADMIN", "EVALUATOR"]),
});

export async function createUser(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = createUserSchema.parse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const user = await prisma.user.create({
    data: {
      fullName: parsed.fullName,
      email: parsed.email.toLowerCase().trim(),
      passwordHash,
      role: parsed.role,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    afterData: { ...user, passwordHash: undefined },
  });

  revalidatePath("/admin/users");
}

export async function toggleUserActive(id: string, isActive: boolean) {
  const session = await requireSuperAdmin();
  const before = await prisma.user.findUniqueOrThrow({ where: { id } });
  const after = await prisma.user.update({ where: { id }, data: { isActive } });

  await writeAuditLog({
    userId: session.user.id,
    action: isActive ? "RESTORE" : "ARCHIVE",
    entity: "User",
    entityId: id,
    beforeData: { ...before, passwordHash: undefined },
    afterData: { ...after, passwordHash: undefined },
  });

  revalidatePath("/admin/users");
}

/** §9.2: إعادة تعيين كلمة المرور يدويًا من الإدارة إلى حين توفر SMTP فعلي. */
export async function resetUserPassword(id: string, newPassword: string) {
  const session = await requireSuperAdmin();
  if (newPassword.length < 8) throw new Error("كلمة المرور 8 أحرف على الأقل");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  await writeAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    reason: "إعادة تعيين كلمة المرور يدويًا من قِبل مدير النظام",
  });

  revalidatePath("/admin/users");
}
