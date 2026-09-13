"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { evaluatorAssignmentSchema } from "@/lib/validations";

export async function createAssignment(formData: FormData) {
  const session = await requireSuperAdmin();

  const rules = JSON.parse((formData.get("rulesJson") as string) || "[]");
  const specificEmployeeIds = JSON.parse((formData.get("specificEmployeeIdsJson") as string) || "[]");

  const parsed = evaluatorAssignmentSchema.parse({
    evaluatorId: formData.get("evaluatorId"),
    label: formData.get("label") || null,
    defaultWeight: formData.get("defaultWeight"),
    rules,
    specificEmployeeIds,
  });

  const assignment = await prisma.evaluatorAssignment.create({
    data: {
      evaluatorId: parsed.evaluatorId,
      label: parsed.label,
      defaultWeight: parsed.defaultWeight,
      rules: {
        create: parsed.rules.map((r) => ({
          isAllEmployees: r.isAllEmployees,
          branchId: r.branchId || null,
          departmentId: r.departmentId || null,
          jobTitleId: r.jobTitleId || null,
        })),
      },
      ...(parsed.specificEmployeeIds.length > 0
        ? { specificEmployees: { create: parsed.specificEmployeeIds.map((employeeId) => ({ employeeId })) } }
        : {}),
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "CHANGE_ASSIGNMENT",
    entity: "EvaluatorAssignment",
    entityId: assignment.id,
    afterData: assignment,
  });

  revalidatePath("/admin/evaluator-assignments");
}

export async function toggleAssignmentActive(id: string, isActive: boolean) {
  const session = await requireSuperAdmin();
  const before = await prisma.evaluatorAssignment.findUniqueOrThrow({ where: { id } });
  const after = await prisma.evaluatorAssignment.update({ where: { id }, data: { isActive } });

  await writeAuditLog({
    userId: session.user.id,
    action: "CHANGE_ASSIGNMENT",
    entity: "EvaluatorAssignment",
    entityId: id,
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin/evaluator-assignments");
}

export async function updateAssignmentWeight(id: string, defaultWeight: number) {
  const session = await requireSuperAdmin();
  if (defaultWeight <= 0 || defaultWeight > 100) throw new Error("الوزن يجب أن يكون بين 0.01 و100");

  const before = await prisma.evaluatorAssignment.findUniqueOrThrow({ where: { id } });
  const after = await prisma.evaluatorAssignment.update({ where: { id }, data: { defaultWeight } });

  await writeAuditLog({
    userId: session.user.id,
    action: "CHANGE_EVALUATOR_WEIGHT",
    entity: "EvaluatorAssignment",
    entityId: id,
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin/evaluator-assignments");
}
