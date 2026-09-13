/**
 * خدمة فتح دورة التقييم — نسخة مُصححة بعد المراجعة المعمارية.
 *
 * تُجسِّد (materialize) عند فتح الدورة فقط:
 *   - PerformanceReview  لكل موظف "جاهز" (قالب مفعّل + مقيّم واحد على الأقل بمجموع أوزان 100%)
 *     مع تجميد كامل (Snapshot) للهيكل التنظيمي والقالب - §2/§8/§9 من المراجعة.
 *   - ReviewKpiActual    سجل واحد فقط لكل (مراجعة × مؤشر رقمي) - القيمة المشتركة بين كل
 *     المقيّمين - مع Snapshot للهدف المُحلَّل وقت الفتح (أو خطأ إعداد صريح إن تعذّر حله) - §7/§15/§16.
 *   - ReviewEvaluator    سجل واحد لكل تعيين مطابق، بوزن مجمَّد (weightSnapshot) من
 *     EvaluatorAssignment.defaultWeight وقت الفتح فقط - §3/§9 من المراجعة.
 *   - ReviewEvaluatorItem سجل فارغ لكل (مقيّم × مؤشر) ليُملأ لاحقًا أثناء التقييم.
 *
 * كل عملية الفتح تُنفَّذ داخل معاملة واحدة (transaction) - §26 من المراجعة: إما تكتمل
 * بالكامل أو لا يتغيّر شيء إطلاقًا.
 */

import { prisma } from "@/lib/prisma";
import { isWeightSumValid } from "@/lib/services/scoring";
import { assignmentCoversEmployee } from "@/lib/services/evaluatorScope";
import {
  buildScopeKey,
  resolveEffectiveTarget,
  type TargetRecord,
  type EmployeeContext,
  type TargetScopeType,
} from "@/lib/services/targetResolution";
import type { Prisma, MeasurementType } from "@prisma/client";

export interface CycleReadinessRow {
  employeeId: string;
  employeeName: string;
  jobTitleName: string;
  hasActiveTemplate: boolean;
  assignmentsCount: number;
  evaluatorWeightSum: number;
  isReady: boolean;
  issues: string[];
}

type AssignmentWithRules = Prisma.EvaluatorAssignmentGetPayload<{
  include: { rules: true; specificEmployees: { select: { employeeId: true } } };
}>;

/**
 * حالة الاستعداد لكل الموظفين النشطين — مستقلة عن أي دورة تقييم محددة
 * (تعتمد فقط على التعيينات الفعّالة الحالية وقوالب KPI المفعّلة الحالية).
 * تُستخدم في شاشة "تعيينات المقيّمين" وفي معاينة فتح الدورة.
 *
 * ملاحظة: أخطاء إعداد الأهداف (Target مفقود أو Target<=0 لمؤشر "الأعلى أفضل") لا تُفحص هنا -
 * تُكتشف لكل مؤشر على حدة وقت الفتح الفعلي وتُسجَّل كـ ReviewKpiActual.isConfigurationError،
 * وتمنع الإرسال (Submit) لاحقًا بدل منع فتح الدورة بالكامل لكل الموظفين.
 */
export async function getAssignmentCoverage(): Promise<CycleReadinessRow[]> {
  const employees = await prisma.employee.findMany({
    where: { archivedAt: null, employmentStatus: "ACTIVE" },
    include: { jobTitle: { include: { kpiTemplates: { where: { isActive: true } } } } },
  });

  const assignments: AssignmentWithRules[] = await prisma.evaluatorAssignment.findMany({
    where: { isActive: true },
    include: { rules: true, specificEmployees: { select: { employeeId: true } } },
  });

  const rows: CycleReadinessRow[] = [];

  for (const emp of employees) {
    const matchingAssignments = assignments.filter((a) => assignmentCoversEmployee(a, emp));
    const weightSum = matchingAssignments.reduce((s, a) => s + Number(a.defaultWeight), 0);
    const hasActiveTemplate = emp.jobTitle.kpiTemplates.length > 0;

    const issues: string[] = [];
    if (!hasActiveTemplate) issues.push("لا يوجد قالب KPI مفعّل لمسماه الوظيفي");
    if (matchingAssignments.length === 0) issues.push("لا يوجد مقيّم مُعيَّن له");
    if (matchingAssignments.length > 0 && !isWeightSumValid([weightSum]))
      issues.push(`مجموع أوزان المقيّمين = ${weightSum}% (يجب أن يساوي 100%)`);

    rows.push({
      employeeId: emp.id,
      employeeName: emp.fullName,
      jobTitleName: emp.jobTitle.name,
      hasActiveTemplate,
      assignmentsCount: matchingAssignments.length,
      evaluatorWeightSum: weightSum,
      isReady: issues.length === 0,
      issues,
    });
  }

  return rows;
}

export async function getCycleOpenReadiness(cycleId: string): Promise<CycleReadinessRow[]> {
  await prisma.evaluationCycle.findUniqueOrThrow({ where: { id: cycleId } });
  return getAssignmentCoverage();
}

/**
 * ينشئ PerformanceReview + ReviewKpiActual + ReviewEvaluator (+ العناصر الفارغة) لكل موظف
 * "جاهز" (له قالب مفعّل ومقيّم واحد على الأقل بمجموع أوزان صحيح)، ويترك الموظفين غير الجاهزين
 * بلا مراجعة في هذه الدورة (يظهرون كتحذير للإدارة قبل الفتح). العملية بأكملها ذرية.
 */
export async function materializeEvaluationsForCycle(cycleId: string) {
  const cycle = await prisma.evaluationCycle.findUniqueOrThrow({ where: { id: cycleId } });
  const readiness = await getCycleOpenReadiness(cycleId);
  const readyIds = readiness.filter((r) => r.isReady).map((r) => r.employeeId);

  const employees = await prisma.employee.findMany({
    where: { id: { in: readyIds } },
    include: { jobTitle: { include: { kpiTemplates: { where: { isActive: true } } } } },
  });

  const assignments: AssignmentWithRules[] = await prisma.evaluatorAssignment.findMany({
    where: { isActive: true },
    include: { rules: true, specificEmployees: { select: { employeeId: true } } },
  });

  let reviewsCreated = 0;
  let reviewsSkippedExisting = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const emp of employees) {
        const existingReview = await tx.performanceReview.findUnique({
          where: { cycleId_employeeId: { cycleId, employeeId: emp.id } },
        });
        if (existingReview) {
          reviewsSkippedExisting++;
          continue;
        }

        const template = emp.jobTitle.kpiTemplates[0];
        const kpis = await tx.kpi.findMany({
          where: { kpiTemplateId: template.id, isActive: true },
          include: { subcriteria: true },
        });

        const matchingAssignments = assignments.filter((a) => assignmentCoversEmployee(a, emp));

        // الفروع/الأقسام/المسميات ضمن Snapshot يجب جلبها من الكيانات الفعلية وقت الفتح فقط
        const [branch, department, jobTitle] = await Promise.all([
          tx.branch.findUniqueOrThrow({ where: { id: emp.branchId } }),
          emp.departmentId ? tx.department.findUnique({ where: { id: emp.departmentId } }) : null,
          tx.jobTitle.findUniqueOrThrow({ where: { id: emp.jobTitleId } }),
        ]);

        const review = await tx.performanceReview.create({
          data: {
            cycleId,
            employeeId: emp.id,
            employeeNumberSnapshot: emp.employeeNumber,
            employeeNameSnapshot: emp.fullName,
            branchIdSnapshot: branch.id,
            branchNameSnapshot: branch.name,
            departmentIdSnapshot: department?.id ?? null,
            departmentNameSnapshot: department?.name ?? null,
            jobTitleIdSnapshot: jobTitle.id,
            jobTitleNameSnapshot: jobTitle.name,
            kpiTemplateId: template.id,
            templateVersionSnapshot: template.version,
            status: "NOT_STARTED",
          },
        });
        reviewsCreated++;

        // --- ReviewKpiActual: سجل واحد فقط لكل مؤشر رقمي (NUMBER/PERCENTAGE/CURRENCY) ---
        const numericKpis = kpis.filter(
          (k) => k.measurementType === "NUMBER" || k.measurementType === "PERCENTAGE" || k.measurementType === "CURRENCY"
        );

        if (numericKpis.length > 0) {
          const kpiIds = numericKpis.map((k) => k.id);
          const allTargets = await tx.target.findMany({
            where: { kpiId: { in: kpiIds }, month: cycle.month, year: cycle.year },
          });

          const employeeContext: EmployeeContext = {
            employeeId: emp.id,
            branchId: emp.branchId,
            departmentId: emp.departmentId,
            jobTitleId: emp.jobTitleId,
          };

          for (const kpi of numericKpis) {
            const targetRecords: TargetRecord[] = allTargets
              .filter((t) => t.kpiId === kpi.id)
              .map((t) => ({
                scopeType: t.scopeType as TargetScopeType,
                scopeKey: t.scopeKey,
                applicationMode: t.applicationMode,
                branchId: t.branchId,
                departmentId: t.departmentId,
                jobTitleId: t.jobTitleId,
                employeeId: t.employeeId,
                value: Number(t.value),
              }));

            const resolved = resolveEffectiveTarget(targetRecords, employeeContext);

            let targetValueSnapshot: number | null = null;
            let targetScopeLevelSnapshot: TargetScopeType | null = null;
            let isConfigurationError = false;
            let configurationErrorReason: string | null = null;

            if (!resolved) {
              isConfigurationError = true;
              configurationErrorReason =
                "لا يوجد هدف مُعرَّف لهذا المؤشر على أي مستوى (موظف/مسمى وظيفي/قسم/فرع/عام) لهذا الشهر - راجع الإدارة";
            } else {
              targetValueSnapshot = resolved.value;
              targetScopeLevelSnapshot = resolved.sourceLevel;
              if (kpi.direction === "HIGHER_IS_BETTER" && resolved.value <= 0) {
                isConfigurationError = true;
                configurationErrorReason =
                  'الهدف يجب أن يكون أكبر من صفر لمؤشر من نوع "الأعلى أفضل" - راجع الإدارة';
              }
            }

            await tx.reviewKpiActual.create({
              data: {
                reviewId: review.id,
                kpiId: kpi.id,
                kpiNameSnapshot: kpi.name,
                kpiWeightSnapshot: kpi.weight,
                kpiDirectionSnapshot: kpi.direction,
                kpiMeasurementTypeSnapshot: kpi.measurementType,
                targetValueSnapshot,
                targetScopeLevelSnapshot,
                isConfigurationError,
                configurationErrorReason,
              },
            });
          }
        }

        // --- ReviewEvaluator + ReviewEvaluatorItem (فارغة) لكل تعيين مطابق ---
        for (const assignment of matchingAssignments) {
          const reviewEvaluator = await tx.reviewEvaluator.create({
            data: {
              reviewId: review.id,
              evaluatorId: assignment.evaluatorId,
              weightSnapshot: assignment.defaultWeight,
              status: "NOT_STARTED",
            },
          });

          for (const kpi of kpis) {
            await tx.reviewEvaluatorItem.create({
              data: {
                reviewEvaluatorId: reviewEvaluator.id,
                kpiId: kpi.id,
              },
            });
          }
        }
      }
    },
    { timeout: 60_000 }
  );

  return { reviewsCreated, reviewsSkippedExisting, readiness };
}
