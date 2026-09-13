/**
 * §3.6 من HANDOFF (Snapshot شامل): كل شيء يؤثر على الحساب يُنسخ فعليًا وقت فتح الدورة،
 * والتعديلات اللاحقة على البيانات الحية (الموظف، الفرع، المسمى الوظيفي، القالب، الهدف)
 * يجب ألا تغيّر أي دورة فُتحت بالفعل. هذا الاختبار يفتح الدورة، يعدّل كل الكيانات الحية
 * المصدر للـ Snapshot، ثم يتحقق أن السجلات المجمَّدة سابقًا لم تتغيّر إطلاقًا.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { materializeEvaluationsForCycle } from "@/lib/services/cycleOpening";
import { createOrgFixture, cleanupOrgFixture, type OrgFixture } from "./helpers/dbFixtures";

describe("Snapshot شامل — تعديل البيانات الحية بعد فتح الدورة لا يغيّر مراجعة أُنشئت بالفعل", () => {
  let fx: OrgFixture;
  let reviewId: string;
  let originalReview: { branchNameSnapshot: string; jobTitleNameSnapshot: string; employeeNameSnapshot: string; templateVersionSnapshot: number };
  let originalActual: { kpiNameSnapshot: string; kpiWeightSnapshot: number; targetValueSnapshot: number | null };

  beforeAll(async () => {
    fx = await createOrgFixture({ evaluatorWeights: [100], targetValue: 100 });
    await materializeEvaluationsForCycle(fx.cycleId);

    const review = await prisma.performanceReview.findUniqueOrThrow({
      where: { cycleId_employeeId: { cycleId: fx.cycleId, employeeId: fx.employeeId } },
    });
    reviewId = review.id;
    originalReview = {
      branchNameSnapshot: review.branchNameSnapshot,
      jobTitleNameSnapshot: review.jobTitleNameSnapshot,
      employeeNameSnapshot: review.employeeNameSnapshot,
      templateVersionSnapshot: review.templateVersionSnapshot,
    };

    const actual = await prisma.reviewKpiActual.findUniqueOrThrow({
      where: { reviewId_kpiId: { reviewId: review.id, kpiId: fx.numericKpiId } },
    });
    originalActual = {
      kpiNameSnapshot: actual.kpiNameSnapshot,
      kpiWeightSnapshot: Number(actual.kpiWeightSnapshot),
      targetValueSnapshot: actual.targetValueSnapshot === null ? null : Number(actual.targetValueSnapshot),
    };

    // --- تعديل كل الكيانات الحية المصدر للـ Snapshot أعلاه، بعد الفتح مباشرة ---
    await prisma.employee.update({ where: { id: fx.employeeId }, data: { fullName: "اسم مُعدَّل بعد الفتح" } });
    await prisma.branch.update({ where: { id: fx.branchId }, data: { name: "فرع مُعدَّل بعد الفتح" } });
    await prisma.jobTitle.update({ where: { id: fx.jobTitleId }, data: { name: "مسمى مُعدَّل بعد الفتح" } });
    await prisma.kpiTemplate.update({ where: { id: fx.kpiTemplateId }, data: { version: 99 } });
    await prisma.kpi.update({ where: { id: fx.numericKpiId }, data: { name: "مؤشر مُعدَّل بعد الفتح", weight: 1 } });
    if (fx.targetId) {
      await prisma.target.update({ where: { id: fx.targetId }, data: { value: 999999 } });
    }
  });

  afterAll(async () => {
    await cleanupOrgFixture(fx);
  });

  it("تعديل الكيانات الحية فعلاً أثّر عليها (فحص سلامة الاختبار نفسه)", async () => {
    const liveEmployee = await prisma.employee.findUniqueOrThrow({ where: { id: fx.employeeId } });
    const liveBranch = await prisma.branch.findUniqueOrThrow({ where: { id: fx.branchId } });
    expect(liveEmployee.fullName).toBe("اسم مُعدَّل بعد الفتح");
    expect(liveBranch.name).toBe("فرع مُعدَّل بعد الفتح");
  });

  it("PerformanceReview.*Snapshot تبقى كما كانت وقت الفتح رغم تعديل الموظف/الفرع/المسمى/القالب", async () => {
    const review = await prisma.performanceReview.findUniqueOrThrow({ where: { id: reviewId } });

    expect(review.employeeNameSnapshot).toBe(originalReview.employeeNameSnapshot);
    expect(review.branchNameSnapshot).toBe(originalReview.branchNameSnapshot);
    expect(review.jobTitleNameSnapshot).toBe(originalReview.jobTitleNameSnapshot);
    expect(review.templateVersionSnapshot).toBe(originalReview.templateVersionSnapshot);

    expect(review.employeeNameSnapshot).not.toBe("اسم مُعدَّل بعد الفتح");
    expect(review.branchNameSnapshot).not.toBe("فرع مُعدَّل بعد الفتح");
    expect(review.jobTitleNameSnapshot).not.toBe("مسمى مُعدَّل بعد الفتح");
    expect(review.templateVersionSnapshot).not.toBe(99);
  });

  it("ReviewKpiActual.*Snapshot (اسم/وزن المؤشر + قيمة الهدف) تبقى مجمَّدة رغم تعديل Kpi/Target الحيّين", async () => {
    const actual = await prisma.reviewKpiActual.findUniqueOrThrow({
      where: { reviewId_kpiId: { reviewId, kpiId: fx.numericKpiId } },
    });

    expect(actual.kpiNameSnapshot).toBe(originalActual.kpiNameSnapshot);
    expect(Number(actual.kpiWeightSnapshot)).toBe(originalActual.kpiWeightSnapshot);
    expect(Number(actual.targetValueSnapshot)).toBe(originalActual.targetValueSnapshot);

    expect(actual.kpiNameSnapshot).not.toBe("مؤشر مُعدَّل بعد الفتح");
    expect(Number(actual.targetValueSnapshot)).not.toBe(999999);
  });
});
