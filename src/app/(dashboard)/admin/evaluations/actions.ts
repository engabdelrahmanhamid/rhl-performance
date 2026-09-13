"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { reopenEvaluationSchema } from "@/lib/validations";
import { notifyEvaluationReopened } from "@/lib/notifications";
import { recalculatePerformanceReviewStatus } from "@/lib/services/reviewEngine";

/**
 * §27: Super Admin لا يستطيع تعديل تقييم المقيّم مباشرة، لكن يستطيع إعادة فتحه بسبب إلزامي.
 * كل عملية Reopen تُسجَّل كاملة في Audit Log (§5.9/§28)، وتُعاد حساب حالة PerformanceReview
 * الأب فورًا (§18) - قد تنتقل من COMPLETED إلى AWAITING_EVALUATIONS وتُمسَح نتيجتها النهائية.
 */
export async function reopenEvaluation(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = reopenEvaluationSchema.parse({
    reviewEvaluatorId: formData.get("reviewEvaluatorId"),
    reason: formData.get("reason"),
  });

  const before = await prisma.reviewEvaluator.findUniqueOrThrow({ where: { id: parsed.reviewEvaluatorId } });
  if (before.status !== "SUBMITTED") {
    throw new Error("لا يمكن إعادة فتح تقييم غير مُرسَل");
  }

  const after = await prisma.reviewEvaluator.update({
    where: { id: parsed.reviewEvaluatorId },
    data: {
      status: "REOPENED",
      reopenedAt: new Date(),
      reopenReason: parsed.reason,
      lockedAt: null,
    },
  });

  await recalculatePerformanceReviewStatus(before.reviewId);

  await writeAuditLog({
    userId: session.user.id,
    action: "EVALUATION_REOPEN",
    entity: "ReviewEvaluator",
    entityId: parsed.reviewEvaluatorId,
    beforeData: { status: before.status },
    afterData: { status: after.status },
    reason: parsed.reason,
  });

  await notifyEvaluationReopened(parsed.reviewEvaluatorId, parsed.reason);

  revalidatePath("/admin/evaluations");
}
