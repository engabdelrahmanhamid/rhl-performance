"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { evaluationCycleSchema } from "@/lib/validations";
import { materializeEvaluationsForCycle } from "@/lib/services/cycleOpening";
import { notifyCycleOpened } from "@/lib/notifications";

export async function createCycle(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = evaluationCycleSchema.parse({
    name: formData.get("name"),
    month: formData.get("month"),
    year: formData.get("year"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    openDate: formData.get("openDate"),
    deadline: formData.get("deadline"),
  });

  const cycle = await prisma.evaluationCycle.create({ data: { ...parsed, status: "DRAFT" } });
  await writeAuditLog({ userId: session.user.id, action: "CREATE_CYCLE", entity: "EvaluationCycle", entityId: cycle.id, afterData: cycle });
  revalidatePath("/admin/evaluation-cycles");
  return cycle;
}

export async function openCycle(cycleId: string) {
  const session = await requireSuperAdmin();
  const cycle = await prisma.evaluationCycle.findUniqueOrThrow({ where: { id: cycleId } });
  if (cycle.status === "OPEN" || cycle.status === "CLOSED") {
    throw new Error("الدورة مفتوحة أو مغلقة بالفعل");
  }

  const { reviewsCreated, reviewsSkippedExisting } = await materializeEvaluationsForCycle(cycleId);
  const after = await prisma.evaluationCycle.update({ where: { id: cycleId }, data: { status: "OPEN" } });
  await notifyCycleOpened(cycleId);

  await writeAuditLog({
    userId: session.user.id,
    action: "OPEN_CYCLE",
    entity: "EvaluationCycle",
    entityId: cycleId,
    beforeData: cycle,
    afterData: { ...after, reviewsCreated, reviewsSkippedExisting },
  });

  revalidatePath("/admin/evaluation-cycles");
  revalidatePath(`/admin/evaluation-cycles/${cycleId}`);
  return { reviewsCreated, reviewsSkippedExisting };
}

export async function closeCycle(cycleId: string) {
  const session = await requireSuperAdmin();
  const before = await prisma.evaluationCycle.findUniqueOrThrow({ where: { id: cycleId } });
  const after = await prisma.evaluationCycle.update({ where: { id: cycleId }, data: { status: "CLOSED" } });

  await writeAuditLog({ userId: session.user.id, action: "CLOSE_CYCLE", entity: "EvaluationCycle", entityId: cycleId, beforeData: before, afterData: after });
  revalidatePath("/admin/evaluation-cycles");
}
