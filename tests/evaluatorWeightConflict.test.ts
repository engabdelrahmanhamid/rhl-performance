/**
 * §18 من المراجعة: finalScore/status=COMPLETED لا يُحسب إلا بعد إرسال (Submit) كل
 * مقيّمي الموظف وأن يكون مجموع أوزانهم = 100% بالضبط. هذه الاختبارات تبني ReviewEvaluator
 * مباشرة (بدل المرور عبر فتح الدورة الكامل) للتحكم الدقيق في حالة الإرسال والوزن،
 * وتتحقق من أن recalculatePerformanceReviewStatus يطبّق آلة الحالة هذه بصرامة.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { recalculatePerformanceReviewStatus } from "@/lib/services/reviewEngine";
import { createOrgFixture, cleanupOrgFixture, type OrgFixture } from "./helpers/dbFixtures";

async function createBareReview(fx: OrgFixture) {
  return prisma.performanceReview.create({
    data: {
      cycleId: fx.cycleId,
      employeeId: fx.employeeId,
      employeeNumberSnapshot: `EMP_${fx.runId}`,
      employeeNameSnapshot: `Test Employee ${fx.runId}`,
      branchIdSnapshot: fx.branchId,
      branchNameSnapshot: `TestBranch_${fx.runId}`,
      jobTitleIdSnapshot: fx.jobTitleId,
      jobTitleNameSnapshot: `TestJob_${fx.runId}`,
      kpiTemplateId: fx.kpiTemplateId,
      templateVersionSnapshot: 1,
      status: "NOT_STARTED",
    },
  });
}

describe("recalculatePerformanceReviewStatus — كل المقيّمين أرسلوا ومجموع الأوزان 100% => COMPLETED", () => {
  let fx: OrgFixture;

  beforeAll(async () => {
    // مثال §17 المرجعي: A(50%,4.5) + B(30%,4.0) + C(20%,4.8) => 4.41/5 و88.2%
    fx = await createOrgFixture({ evaluatorWeights: [50, 30, 20] });
    const review = await createBareReview(fx);
    const scores = [4.5, 4.0, 4.8];
    for (let i = 0; i < fx.evaluatorUserIds.length; i++) {
      await prisma.reviewEvaluator.create({
        data: {
          reviewId: review.id,
          evaluatorId: fx.evaluatorUserIds[i],
          weightSnapshot: [50, 30, 20][i],
          status: "SUBMITTED",
          overallScore: scores[i],
          overallPercentage: (scores[i] / 5) * 100,
        },
      });
    }
    await recalculatePerformanceReviewStatus(review.id);
  });

  afterAll(async () => {
    await cleanupOrgFixture(fx);
  });

  it("الحالة تصبح COMPLETED بنتيجة نهائية مرجّحة صحيحة", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({
      where: { cycleId_employeeId: { cycleId: fx.cycleId, employeeId: fx.employeeId } },
    });

    expect(review.status).toBe("COMPLETED");
    expect(Number(review.finalScore)).toBeCloseTo(4.41, 2);
    expect(Number(review.finalPercentage)).toBeCloseTo(88.2, 1);
    expect(review.completedAt).not.toBeNull();
    expect(review.performanceLabelSnapshot).toBeTruthy();
  });
});

describe("recalculatePerformanceReviewStatus — تضارب الأوزان: الجميع أرسل لكن المجموع ≠ 100%", () => {
  let fx: OrgFixture;
  let reviewId: string;

  beforeAll(async () => {
    fx = await createOrgFixture({ evaluatorWeights: [60, 30] }); // المجموع 90% وليس 100%
    const review = await createBareReview(fx);
    reviewId = review.id;
    for (let i = 0; i < fx.evaluatorUserIds.length; i++) {
      await prisma.reviewEvaluator.create({
        data: {
          reviewId: review.id,
          evaluatorId: fx.evaluatorUserIds[i],
          weightSnapshot: [60, 30][i],
          status: "SUBMITTED",
          overallScore: 4.0,
          overallPercentage: 80,
        },
      });
    }
    await recalculatePerformanceReviewStatus(review.id);
  });

  afterAll(async () => {
    await cleanupOrgFixture(fx);
  });

  it("§18: لا تُعتمد نتيجة نهائية رغم إرسال الجميع - تبقى AWAITING_EVALUATIONS بلا finalScore", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({ where: { id: reviewId } });

    expect(review.status).toBe("AWAITING_EVALUATIONS");
    expect(review.finalScore).toBeNull();
    expect(review.completedAt).toBeNull();
  });
});

describe("recalculatePerformanceReviewStatus — إرسال جزئي: مجموع الأوزان صحيح لكن مقيّمًا واحدًا لم يُرسل بعد", () => {
  let fx: OrgFixture;
  let reviewId: string;

  beforeAll(async () => {
    fx = await createOrgFixture({ evaluatorWeights: [60, 40] }); // المجموع 100% صحيح
    const review = await createBareReview(fx);
    reviewId = review.id;
    await prisma.reviewEvaluator.create({
      data: { reviewId: review.id, evaluatorId: fx.evaluatorUserIds[0], weightSnapshot: 60, status: "SUBMITTED", overallScore: 4.0, overallPercentage: 80 },
    });
    await prisma.reviewEvaluator.create({
      data: { reviewId: review.id, evaluatorId: fx.evaluatorUserIds[1], weightSnapshot: 40, status: "DRAFT" },
    });
    await recalculatePerformanceReviewStatus(review.id);
  });

  afterAll(async () => {
    await cleanupOrgFixture(fx);
  });

  it("تبقى AWAITING_EVALUATIONS حتى يُرسل كل المقيّمين", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({ where: { id: reviewId } });
    expect(review.status).toBe("AWAITING_EVALUATIONS");
    expect(review.finalScore).toBeNull();
  });
});

describe("recalculatePerformanceReviewStatus — لم يبدأ أي مقيّم بعد", () => {
  let fx: OrgFixture;
  let reviewId: string;

  beforeAll(async () => {
    fx = await createOrgFixture({ evaluatorWeights: [100] });
    const review = await createBareReview(fx);
    reviewId = review.id;
    await prisma.reviewEvaluator.create({
      data: { reviewId: review.id, evaluatorId: fx.evaluatorUserIds[0], weightSnapshot: 100, status: "NOT_STARTED" },
    });
    await recalculatePerformanceReviewStatus(review.id);
  });

  afterAll(async () => {
    await cleanupOrgFixture(fx);
  });

  it("الحالة تبقى/تُضبط على NOT_STARTED", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({ where: { id: reviewId } });
    expect(review.status).toBe("NOT_STARTED");
  });
});

describe("recalculatePerformanceReviewStatus — إعادة فتح مقيّم بعد اكتمال المراجعة يمسح النتيجة النهائية القديمة", () => {
  let fx: OrgFixture;
  let reviewId: string;
  let reviewEvaluatorIds: string[];

  beforeAll(async () => {
    fx = await createOrgFixture({ evaluatorWeights: [60, 40] });
    const review = await createBareReview(fx);
    reviewId = review.id;
    const created = await Promise.all(
      [60, 40].map((weight, i) =>
        prisma.reviewEvaluator.create({
          data: {
            reviewId: review.id,
            evaluatorId: fx.evaluatorUserIds[i],
            weightSnapshot: weight,
            status: "SUBMITTED",
            overallScore: 4.0,
            overallPercentage: 80,
          },
        })
      )
    );
    reviewEvaluatorIds = created.map((e) => e.id);
    await recalculatePerformanceReviewStatus(review.id);
  });

  afterAll(async () => {
    await cleanupOrgFixture(fx);
  });

  it("تصبح COMPLETED أولاً بنتيجة نهائية فعلية (فحص سلامة الاختبار)", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({ where: { id: reviewId } });
    expect(review.status).toBe("COMPLETED");
    expect(review.finalScore).not.toBeNull();
    expect(review.performanceLabelSnapshot).toBeTruthy();
  });

  it("بعد إعادة فتح مقيّم واحد (REOPENED) - الحالة تعود AWAITING_EVALUATIONS وتُمسَح finalScore/finalPercentage/performanceLabelSnapshot/completedAt القديمة تمامًا", async () => {
    await prisma.reviewEvaluator.update({ where: { id: reviewEvaluatorIds[0] }, data: { status: "REOPENED" } });
    await recalculatePerformanceReviewStatus(reviewId);

    const review = await prisma.performanceReview.findUniqueOrThrow({ where: { id: reviewId } });
    expect(review.status).toBe("AWAITING_EVALUATIONS");
    expect(review.finalScore).toBeNull();
    expect(review.finalPercentage).toBeNull();
    expect(review.performanceLabelSnapshot).toBeNull();
    expect(review.completedAt).toBeNull();
  });
});
