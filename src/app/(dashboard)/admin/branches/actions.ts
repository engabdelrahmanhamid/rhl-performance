"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { branchSchema } from "@/lib/validations";

export async function createBranch(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = branchSchema.parse({
    name: formData.get("name"),
    code: formData.get("code"),
  });

  const branch = await prisma.branch.create({ data: parsed });

  await writeAuditLog({
    userId: session.user.id,
    action: "CREATE",
    entity: "Branch",
    entityId: branch.id,
    afterData: branch,
  });

  revalidatePath("/admin/branches");
}

export async function updateBranch(id: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = branchSchema.parse({
    name: formData.get("name"),
    code: formData.get("code"),
  });

  const before = await prisma.branch.findUniqueOrThrow({ where: { id } });
  const after = await prisma.branch.update({ where: { id }, data: parsed });

  await writeAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entity: "Branch",
    entityId: id,
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin/branches");
}

export async function toggleBranchActive(id: string, isActive: boolean) {
  const session = await requireSuperAdmin();
  const before = await prisma.branch.findUniqueOrThrow({ where: { id } });
  const after = await prisma.branch.update({ where: { id }, data: { isActive } });

  await writeAuditLog({
    userId: session.user.id,
    action: isActive ? "RESTORE" : "ARCHIVE",
    entity: "Branch",
    entityId: id,
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin/branches");
}
