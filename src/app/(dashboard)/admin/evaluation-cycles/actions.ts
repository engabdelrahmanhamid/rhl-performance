"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
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

  let cycle;
  try {
    cycle = await prisma.evaluationCycle.create({ data: { ...parsed, status: "DRAFT" } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(`توجد دورة تقييم أخرى بالفعل لنفس الشهر/السنة (${parsed.month}/${parsed.year}).`);
    }
    throw new Error("تعذّر إنشاء الدورة - حدث خطأ غير متوقع.");
  }

  await writeAuditLog({ userId: session.user.id, action: "CREATE_CYCLE", entity: "EvaluationCycle", entityId: cycle.id, afterData: cycle });
  revalidatePath("/admin/evaluation-cycles");
  return cycle;
}

/**
 * حذف دورة تقييم مسموح فقط إن لم يُدخَل أي عمل تقييم حقيقي بعد (لا مقيّم أرسل تقييمه،
 * ولا أي مؤشر عليه قيمة/ملاحظة مُدخَلة) - حماية لمبدأ عدم حذف سجلات التقييم التاريخية،
 * مع السماح بحذف الدورات التي فُتحت بالخطأ (مثلاً بقالب KPI قديم) قبل أي استخدام فعلي.
 */
export async function deleteCycle(cycleId: string) {
  const session = await requireSuperAdmin();
  const cycle = await prisma.evaluationCycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: { reviews: { include: { evaluators: { include: { items: true } } } } },
  });

  const hasRealWork = cycle.reviews.some((r) =>
    r.evaluators.some(
      (ev) =>
        ev.status === "SUBMITTED" ||
        ev.submittedAt !== null ||
        ev.items.some(
          (it) => it.ratingValue !== null || it.achievementPct !== null || (it.justification && it.justification.trim() !== "")
        )
    )
  );

  if (hasRealWork) {
    throw new Error("لا يمكن حذف هذه الدورة - يوجد تقييمات فعلية مُدخَلة من مقيّمين. يمكن فقط الاحتفاظ بها كسجل مغلق.");
  }

  await prisma.$transaction([
    prisma.performanceReview.deleteMany({ where: { cycleId } }),
    prisma.evaluationCycle.delete({ where: { id: cycleId } }),
  ]);

  await writeAuditLog({
    userId: session.user.id,
    action: "DELETE_CYCLE",
    entity: "EvaluationCycle",
    entityId: cycleId,
    beforeData: cycle,
  });
  revalidatePath("/admin/evaluation-cycles");
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
