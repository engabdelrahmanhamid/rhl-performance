"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { departmentSchema } from "@/lib/validations";

export async function createDepartment(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = departmentSchema.parse({
    name: formData.get("name"),
    branchIds: formData.getAll("branchIds"),
  });

  const dept = await prisma.department.create({
    data: {
      name: parsed.name,
      branchDepartments: { create: parsed.branchIds.map((branchId) => ({ branchId })) },
    },
  });

  await writeAuditLog({ userId: session.user.id, action: "CREATE", entity: "Department", entityId: dept.id, afterData: dept });
  revalidatePath("/admin/departments");
}

export async function updateDepartment(id: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = departmentSchema.parse({
    name: formData.get("name"),
    branchIds: formData.getAll("branchIds"),
  });

  const before = await prisma.department.findUniqueOrThrow({ where: { id } });
  const after = await prisma.department.update({
    where: { id },
    data: {
      name: parsed.name,
      branchDepartments: { deleteMany: {}, create: parsed.branchIds.map((branchId) => ({ branchId })) },
    },
  });

  await writeAuditLog({ userId: session.user.id, action: "UPDATE", entity: "Department", entityId: id, beforeData: before, afterData: after });
  revalidatePath("/admin/departments");
}

export async function toggleDepartmentActive(id: string, isActive: boolean) {
  const session = await requireSuperAdmin();
  const before = await prisma.department.findUniqueOrThrow({ where: { id } });
  const after = await prisma.department.update({ where: { id }, data: { isActive } });

  await writeAuditLog({
    userId: session.user.id,
    action: isActive ? "RESTORE" : "ARCHIVE",
    entity: "Department",
    entityId: id,
    beforeData: before,
    afterData: after,
  });
  revalidatePath("/admin/departments");
}
