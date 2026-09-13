import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCycleOpenReadiness, materializeEvaluationsForCycle } from "@/lib/services/cycleOpening";
import { createOrgFixture, cleanupOrgFixture, type OrgFixture } from "./helpers/dbFixtures";

describe("فتح الدورة — الحالة الأساسية: موظف جاهز بمقيّم واحد بوزن 100% وهدف صحيح", () => {
  let fx: OrgFixture;

  beforeAll(async () => {
    fx = await createOrgFixture({ evaluatorWeights: [100], targetValue: 100 });
  });

  afterAll(async () => {
    await cleanupOrgFixture(fx);
  });

  it("الجاهزية: isReady=true بلا أي مشاكل", async () => {
    const readiness = await getCycleOpenReadiness(fx.cycleId);
    const row = readiness.find((r) => r.employeeId === fx.employeeId);
    expect(row).toBeDefined();
    expect(row?.isReady).toBe(true);
    expect(row?.issues).toHaveLength(0);
    expect(row?.evaluatorWeightSum).toBe(100);
  });

  it("الفتح الأول: يُنشئ PerformanceReview واحد بـ Snapshot تنظيمي صحيح", async () => {
    const result = await materializeEvaluationsForCycle(fx.cycleId);
    expect(result.reviewsCreated).toBe(1);
    expect(result.reviewsSkippedExisting).toBe(0);

    const review = await prisma.performanceReview.findUniqueOrThrow({
      where: { cycleId_employeeId: { cycleId: fx.cycleId, employeeId: fx.employeeId } },
    });

    expect(review.employeeNumberSnapshot).toBe(`EMP_${fx.runId}`);
    expect(review.employeeNameSnapshot).toBe(`Test Employee ${fx.runId}`);
    expect(review.branchIdSnapshot).toBe(fx.branchId);
    expect(review.branchNameSnapshot).toBe(`TestBranch_${fx.runId}`);
    expect(review.jobTitleIdSnapshot).toBe(fx.jobTitleId);
    expect(review.jobTitleNameSnapshot).toBe(`TestJob_${fx.runId}`);
    expect(review.kpiTemplateId).toBe(fx.kpiTemplateId);
    expect(review.templateVersionSnapshot).toBe(1);
    expect(review.status).toBe("NOT_STARTED");
  });

  it("ReviewKpiActual: سجل واحد فقط للمؤشر الرقمي (§7) - لا سجل للمؤشر من نوع Rating", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({
      where: { cycleId_employeeId: { cycleId: fx.cycleId, employeeId: fx.employeeId } },
    });
    const actuals = await prisma.reviewKpiActual.findMany({ where: { reviewId: review.id } });

    expect(actuals).toHaveLength(1);
    expect(actuals[0].kpiId).toBe(fx.numericKpiId);
    expect(Number(actuals[0].targetValueSnapshot)).toBe(100);
    expect(actuals[0].targetScopeLevelSnapshot).toBe("GLOBAL");
    expect(actuals[0].isConfigurationError).toBe(false);
  });

  it("ReviewEvaluator: وزن مجمَّد من defaultWeight وحالة NOT_STARTED", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({
      where: { cycleId_employeeId: { cycleId: fx.cycleId, employeeId: fx.employeeId } },
    });
    const evaluators = await prisma.reviewEvaluator.findMany({ where: { reviewId: review.id } });

    expect(evaluators).toHaveLength(1);
    expect(evaluators[0].evaluatorId).toBe(fx.evaluatorUserIds[0]);
    expect(Number(evaluators[0].weightSnapshot)).toBe(100);
    expect(evaluators[0].status).toBe("NOT_STARTED");
  });

  it("ReviewEvaluatorItem: عنصر فارغ واحد لكل مؤشر في القالب (رقمي + Rating = 2)", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({
      where: { cycleId_employeeId: { cycleId: fx.cycleId, employeeId: fx.employeeId } },
    });
    const evaluator = await prisma.reviewEvaluator.findFirstOrThrow({ where: { reviewId: review.id } });
    const items = await prisma.reviewEvaluatorItem.findMany({ where: { reviewEvaluatorId: evaluator.id } });

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.kpiId).sort()).toEqual([fx.numericKpiId, fx.ratingKpiId].sort());
  });

  it("إعادة فتح نفس الدورة لا تُنشئ نسخة مكررة (Idempotent)", async () => {
    const result = await materializeEvaluationsForCycle(fx.cycleId);
    expect(result.reviewsCreated).toBe(0);
    expect(result.reviewsSkippedExisting).toBe(1);

    const count = await prisma.performanceReview.count({ where: { cycleId: fx.cycleId, employeeId: fx.employeeId } });
    expect(count).toBe(1);
  });
});

describe("فتح الدورة — خطأ إعداد الهدف (§15/§16): لا يوجد Target للمؤشر الرقمي إطلاقًا", () => {
  let fx: OrgFixture;

  beforeAll(async () => {
    fx = await createOrgFixture({ evaluatorWeights: [100], targetValue: null });
    await materializeEvaluationsForCycle(fx.cycleId);
  });

  afterAll(async () => {
    await cleanupOrgFixture(fx);
  });

  it("ReviewKpiActual يُسجَّل كخطأ إعداد صريح بدل اختلاق قيمة", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({
      where: { cycleId_employeeId: { cycleId: fx.cycleId, employeeId: fx.employeeId } },
    });
    const actual = await prisma.reviewKpiActual.findUniqueOrThrow({
      where: { reviewId_kpiId: { reviewId: review.id, kpiId: fx.numericKpiId } },
    });

    expect(actual.isConfigurationError).toBe(true);
    expect(actual.targetValueSnapshot).toBeNull();
    expect(actual.configurationErrorReason).toBeTruthy();
  });
});

describe("فتح الدورة — تضارب الأوزان (§5 من الملخص): مجموع أوزان المقيّمين ≠ 100%", () => {
  let fx: OrgFixture;

  beforeAll(async () => {
    fx = await createOrgFixture({ evaluatorWeights: [60, 30] }); // المجموع 90%، غير صالح
  });

  afterAll(async () => {
    await cleanupOrgFixture(fx);
  });

  it("الجاهزية: isReady=false مع رسالة توضح مجموع الأوزان الخاطئ", async () => {
    const readiness = await getCycleOpenReadiness(fx.cycleId);
    const row = readiness.find((r) => r.employeeId === fx.employeeId);

    expect(row?.isReady).toBe(false);
    expect(row?.evaluatorWeightSum).toBe(90);
    expect(row?.issues.some((msg) => msg.includes("90"))).toBe(true);
  });

  it("الفتح: الموظف غير الجاهز لا يحصل على أي PerformanceReview في هذه الدورة", async () => {
    const result = await materializeEvaluationsForCycle(fx.cycleId);
    expect(result.reviewsCreated).toBe(0);

    const count = await prisma.performanceReview.count({ where: { cycleId: fx.cycleId, employeeId: fx.employeeId } });
    expect(count).toBe(0);
  });
});
