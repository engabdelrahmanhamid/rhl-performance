"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { jobTitleSchema } from "@/lib/validations";

export async function createJobTitle(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = jobTitleSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || null,
  });

  const jt = await prisma.jobTitle.create({ data: parsed });
  await writeAuditLog({ userId: session.user.id, action: "CREATE", entity: "JobTitle", entityId: jt.id, afterData: jt });
  revalidatePath("/admin/job-titles");
}

export async function updateJobTitle(id: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = jobTitleSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || null,
  });

  const before = await prisma.jobTitle.findUniqueOrThrow({ where: { id } });
  const after = await prisma.jobTitle.update({ where: { id }, data: parsed });
  await writeAuditLog({ userId: session.user.id, action: "UPDATE", entity: "JobTitle", entityId: id, beforeData: before, afterData: after });
  revalidatePath("/admin/job-titles");
}

export async function toggleJobTitleActive(id: string, isActive: boolean) {
  const session = await requireSuperAdmin();
  const before = await prisma.jobTitle.findUniqueOrThrow({ where: { id } });
  const after = await prisma.jobTitle.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    userId: session.user.id,
    action: isActive ? "RESTORE" : "ARCHIVE",
    entity: "JobTitle",
    entityId: id,
    beforeData: before,
    afterData: after,
  });
  revalidatePath("/admin/job-titles");
}
