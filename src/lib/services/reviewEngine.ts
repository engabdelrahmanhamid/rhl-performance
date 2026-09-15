/**
 * محرك مراجعة الأداء (Review Engine) — يحل محل evaluationEngine.ts القديم بعد المراجعة المعمارية.
 * يربط بين: PerformanceReview (الأب) + ReviewKpiActual (القيمة الموضوعية المشتركة)
 * + ReviewEvaluator (مساهمة مقيّم واحد) + ReviewEvaluatorItem (الرأي الذاتي).
 */

import { prisma } from "@/lib/prisma";
import {
  evaluateAchievement,
  calculateKpiScoreContribution,
  calculateRatingScoreContribution,
  calculateSubcriteriaAverage,
  aggregateEvaluatorScore,
  calculateWeightedFinalScore,
  resolvePerformanceLabel,
} from "@/lib/services/scoring";
import type { KpiDirection } from "@/lib/services/scoring";

/**
 * إعادة حساب عنصر تقييم مقيّم واحد (ReviewEvaluatorItem):
 *  - للمؤشرات الرقمية (NUMBER/PERCENTAGE/CURRENCY): تُقرأ القيمة الفعلية والهدف من
 *    ReviewKpiActual المشترك (نفس القيمة لكل المقيّمين - §7 من المراجعة).
 *  - لمؤشرات Rating/Subcriteria: القيمة ذاتية خاصة بهذا المقيّم فقط.
 */
export async function recalculateReviewEvaluatorItem(itemId: string) {
  const item = await prisma.reviewEvaluatorItem.findUniqueOrThrow({
    where: { id: itemId },
    include: {
      kpi: true,
      subcriteriaScores: { include: { subcriterion: true } },
      reviewEvaluator: true,
    },
  });

  const weight = Number(item.kpi.weight);
  const direction = item.kpi.direction as KpiDirection;
  let achievementPct: number | null = null;
  let scoreContribution: number | null = null;

  if (item.kpi.measurementType === "RATING_1_5") {
    if (item.ratingValue !== null) {
      scoreContribution = calculateRatingScoreContribution(item.ratingValue, weight);
      achievementPct = (item.ratingValue / 5) * 100;
    }
  } else if (item.kpi.measurementType === "SUBCRITERIA_RATING") {
    if (item.subcriteriaScores.length > 0) {
      const avg = calculateSubcriteriaAverage(
        item.subcriteriaScores.map((s) => ({
          rating: s.rating,
          weight: s.subcriterion.weight ? Number(s.subcriterion.weight) : null,
        }))
      );
      scoreContribution = calculateRatingScoreContribution(avg, weight);
      achievementPct = (avg / 5) * 100;
    }
  } else {
    // مؤشر موضوعي - يُقرأ من ReviewKpiActual المشترك، وليس من بيانات خاصة بهذا المقيّم
    const actual = await prisma.reviewKpiActual.findUnique({
      where: { reviewId_kpiId: { reviewId: item.reviewEvaluator.reviewId, kpiId: item.kpiId } },
    });

    if (actual && !actual.isConfigurationError && actual.actualValue !== null && actual.targetValueSnapshot !== null) {
      const result = evaluateAchievement(direction, Number(actual.targetValueSnapshot), Number(actual.actualValue));
      if (result.ok) {
        achievementPct = result.achievementPct;
        scoreContribution = calculateKpiScoreContribution(achievementPct, weight);
      }
    }
  }

  await prisma.reviewEvaluatorItem.update({
    where: { id: itemId },
    data: { achievementPct, scoreContribution },
  });

  await recalculateReviewEvaluatorTotals(item.reviewEvaluatorId);
}

export async function recalculateReviewEvaluatorTotals(reviewEvaluatorId: string) {
  const items = await prisma.reviewEvaluatorItem.findMany({ where: { reviewEvaluatorId } });
  const completed = items.filter((i) => i.scoreContribution !== null);

  if (completed.length === 0) {
    await prisma.reviewEvaluator.update({ where: { id: reviewEvaluatorId }, data: { overallScore: null, overallPercentage: null } });
    return;
  }

  const { percentage, score } = aggregateEvaluatorScore(completed.map((i) => ({ scoreContribution: Number(i.scoreContribution) })));
  await prisma.reviewEvaluator.update({ where: { id: reviewEvaluatorId }, data: { overallScore: score, overallPercentage: percentage } });
}

/**
 * §18 من المراجعة — النتيجة النهائية لا تظهر كمعتمدة إلا بعد اكتمال إرسال كل المقيّمين
 * ووصول مجموع أوزانهم إلى 100%. تُحدَّث حالة PerformanceReview تبعًا لذلك.
 */
export async function recalculatePerformanceReviewStatus(reviewId: string) {
  const evaluators = await prisma.reviewEvaluator.findMany({ where: { reviewId } });

  if (evaluators.length === 0) return;

  const allSubmitted = evaluators.every((e) => e.status === "SUBMITTED");
  const anyStarted = evaluators.some((e) => e.status !== "NOT_STARTED");
  const weightSum = evaluators.reduce((s, e) => s + Number(e.weightSnapshot), 0);

  // أي حالة غير COMPLETED يجب ألا تحمل نتيجة نهائية متبقية من حالة COMPLETED سابقة
  // (مثال: مقيّم أُعيد فتح تقييمه بعد أن كانت المراجعة مكتملة بالفعل) - §18.
  const clearedFinalResult = { finalScore: null, finalPercentage: null, performanceLabelSnapshot: null, completedAt: null };

  if (!anyStarted) {
    await prisma.performanceReview.update({ where: { id: reviewId }, data: { status: "NOT_STARTED", ...clearedFinalResult } });
    return;
  }

  if (!allSubmitted) {
    await prisma.performanceReview.update({ where: { id: reviewId }, data: { status: "AWAITING_EVALUATIONS", ...clearedFinalResult } });
    return;
  }

  if (Math.abs(weightSum - 100) > 0.01) {
    // كل المقيّمين أرسلوا لكن الأوزان غير مكتملة (إعداد خاطئ) - لا نتيجة نهائية معتمدة
    await prisma.performanceReview.update({ where: { id: reviewId }, data: { status: "AWAITING_EVALUATIONS", ...clearedFinalResult } });
    return;
  }

  const { finalScore, finalPercentage } = calculateWeightedFinalScore(
    evaluators.map((e) => ({ score: Number(e.overallScore ?? 0), weight: Number(e.weightSnapshot) }))
  );

  const labels = await prisma.performanceLabel.findMany({ orderBy: { sortOrder: "asc" } });
  const labelName = resolvePerformanceLabel(
    finalPercentage,
    labels.map((l) => ({ label: l.label, minPct: Number(l.minPct), maxPct: Number(l.maxPct) }))
  );

  await prisma.performanceReview.update({
    where: { id: reviewId },
    data: {
      status: "COMPLETED",
      finalScore,
      finalPercentage,
      performanceLabelSnapshot: labelName,
      completedAt: new Date(),
    },
  });
}

export interface ValidationIssue {
  kpiId: string;
  kpiName: string;
  message: string;
}

/** التحقق الكامل قبل Submit لمقيّم واحد ضمن مراجعة أداء. */
export async function validateReviewEvaluatorForSubmit(reviewEvaluatorId: string): Promise<ValidationIssue[]> {
  const reviewEvaluator = await prisma.reviewEvaluator.findUniqueOrThrow({
    where: { id: reviewEvaluatorId },
    include: {
      review: true,
      items: { include: { kpi: { include: { subcriteria: true } }, subcriteriaScores: true } },
    },
  });

  const template = await prisma.kpiTemplate.findUniqueOrThrow({
    where: { id: reviewEvaluator.review.kpiTemplateId },
    include: { kpis: { where: { isActive: true }, include: { subcriteria: true } } },
  });

  const actuals = await prisma.reviewKpiActual.findMany({ where: { reviewId: reviewEvaluator.reviewId } });

  const issues: ValidationIssue[] = [];

  for (const kpi of template.kpis) {
    const item = reviewEvaluator.items.find((i) => i.kpiId === kpi.id);

    if (kpi.measurementType === "RATING_1_5") {
      if (!item || item.ratingValue === null) issues.push({ kpiId: kpi.id, kpiName: kpi.name, message: "التقييم (1-5) مطلوب" });
      else if (item.ratingValue < 3 && !item.justification)
        issues.push({ kpiId: kpi.id, kpiName: kpi.name, message: "التبرير إلزامي للتقييمات المنخفضة (أقل من 3)" });
    } else if (kpi.measurementType === "SUBCRITERIA_RATING") {
      const requiredSubIds = kpi.subcriteria.map((s) => s.id);
      const providedSubIds = item?.subcriteriaScores.map((s) => s.subcriterionId) ?? [];
      const missing = requiredSubIds.filter((id) => !providedSubIds.includes(id));
      if (missing.length > 0) issues.push({ kpiId: kpi.id, kpiName: kpi.name, message: `${missing.length} معيار فرعي غير مكتمل` });
      const missingJustification = item?.subcriteriaScores.some((s) => s.rating < 3 && !s.justification) ?? false;
      if (missingJustification)
        issues.push({ kpiId: kpi.id, kpiName: kpi.name, message: "التبرير إلزامي للمعايير الفرعية ذات التقييم المنخفض (أقل من 3)" });
    } else {
      const actual = actuals.find((a) => a.kpiId === kpi.id);
      if (!actual || actual.isConfigurationError) {
        issues.push({
          kpiId: kpi.id,
          kpiName: kpi.name,
          message: actual?.configurationErrorReason ?? "لا يوجد هدف صالح لهذا المؤشر - راجع الإدارة",
        });
      } else if (actual.actualValue === null) {
        issues.push({ kpiId: kpi.id, kpiName: kpi.name, message: "القيمة الفعلية (Actual) مطلوبة" });
      }
    }
  }

  return issues;
}
