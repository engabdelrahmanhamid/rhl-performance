/**
 * خدمة الإشعارات داخل النظام (In-App) — §36 من المتطلبات.
 * Architecture تسمح مستقبلاً بإضافة Email/WhatsApp دون تغيير نقاط الاستدعاء هنا.
 */

import { prisma } from "@/lib/prisma";

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}) {
  return prisma.notification.create({ data: input });
}

export async function notifyCycleOpened(cycleId: string) {
  const cycle = await prisma.evaluationCycle.findUniqueOrThrow({ where: { id: cycleId } });

  const grouped = await prisma.reviewEvaluator.groupBy({
    by: ["evaluatorId"],
    where: { review: { cycleId }, status: "NOT_STARTED" },
    _count: { id: true },
  });

  for (const g of grouped) {
    await createNotification({
      userId: g.evaluatorId,
      type: "CYCLE_OPENED",
      title: `فُتحت دورة ${cycle.name}`,
      body: `لديك ${g._count.id} تقييمًا مطلوبًا في هذه الدورة.`,
      link: "/evaluator",
    });
  }
}

/** reviewEvaluatorId: مساهمة المقيّم المحدد التي أُعيد فتحها بعد إرسالها - §3 (ReviewEvaluator منفصل لكل مقيّم). */
export async function notifyEvaluationReopened(reviewEvaluatorId: string, reason: string) {
  const reviewEvaluator = await prisma.reviewEvaluator.findUniqueOrThrow({
    where: { id: reviewEvaluatorId },
    include: { review: true },
  });

  await createNotification({
    userId: reviewEvaluator.evaluatorId,
    type: "EVALUATION_REOPENED",
    title: `تم إعادة فتح تقييم ${reviewEvaluator.review.employeeNameSnapshot}`,
    body: reason,
    link: `/evaluator/evaluate/${reviewEvaluatorId}`,
  });
}

export async function notifyDeadlineApproaching(cycleId: string, daysLeft: number) {
  const cycle = await prisma.evaluationCycle.findUniqueOrThrow({ where: { id: cycleId } });
  const pendingEvaluators = await prisma.reviewEvaluator.groupBy({
    by: ["evaluatorId"],
    where: { review: { cycleId }, status: { in: ["NOT_STARTED", "DRAFT", "REOPENED"] } },
  });

  for (const g of pendingEvaluators) {
    await createNotification({
      userId: g.evaluatorId,
      type: "DEADLINE_REMINDER",
      title: `تبقّى ${daysLeft} يومًا على إغلاق ${cycle.name}`,
      body: "يرجى إكمال التقييمات المتبقية قبل الموعد النهائي.",
      link: "/evaluator",
    });
  }
}
