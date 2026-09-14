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
 *
 * أداء حرج: كل القراءات (فروع/أقسام/مسميات/قوالب/أهداف/مراجعات موجودة مسبقًا) تُجلَب دفعة
 * واحدة قبل المعاملة، والكتابات كلها عبر createMany/createManyAndReturn دفعة واحدة عبر كل
 * الموظفين معًا - وليس استعلامًا منفصلاً لكل موظف كما كان سابقًا. هذا ليس تحسينًا اختياريًا:
 * النسخة القديمة (استعلام لكل موظف داخل حلقة) فشلت فعليًا على بيانات إنتاج حقيقية (23 موظفًا)
 * بعد 77 ثانية بخطأ Prisma P2028 ("Transaction not found") لأن طول المعاملة (مئات الاستعلامات
 * المتتالية × زمن استجابة الشبكة لقاعدة بيانات بعيدة) تجاوز ما يسمح به مُجمِّع اتصالات Supabase.
 */
export async function materializeEvaluationsForCycle(cycleId: string) {
  const cycle = await prisma.evaluationCycle.findUniqueOrThrow({ where: { id: cycleId } });
  // نستخدم getAssignmentCoverage مباشرة بدل getCycleOpenReadiness لتفادي فحص وجود الدورة
  // المكرَّر (سبق التحقق أعلاه) - كل جولة إضافية للشبكة لها تكلفة حقيقية مع قاعدة بيانات بعيدة.
  const readiness = await getAssignmentCoverage();
  const readyIds = readiness.filter((r) => r.isReady).map((r) => r.employeeId);

  const [employees, assignments] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: readyIds } },
      include: { jobTitle: { include: { kpiTemplates: { where: { isActive: true } } } } },
    }),
    prisma.evaluatorAssignment.findMany({
      where: { isActive: true },
      include: { rules: true, specificEmployees: { select: { employeeId: true } } },
    }) as Promise<AssignmentWithRules[]>,
  ]);

  if (employees.length === 0) {
    return { reviewsCreated: 0, reviewsSkippedExisting: 0, readiness };
  }

  const templateIds = [...new Set(employees.map((e) => e.jobTitle.kpiTemplates[0]?.id).filter((id): id is string => !!id))];

  const [templatesWithKpis, allBranches, allDepartments, allJobTitles, existingReviews] = await Promise.all([
    prisma.kpiTemplate.findMany({ where: { id: { in: templateIds } }, include: { kpis: { where: { isActive: true } } } }),
    prisma.branch.findMany(),
    prisma.department.findMany(),
    prisma.jobTitle.findMany(),
    prisma.performanceReview.findMany({ where: { cycleId, employeeId: { in: readyIds } }, select: { employeeId: true } }),
  ]);

  const kpisByTemplateId = new Map(templatesWithKpis.map((t) => [t.id, t.kpis]));
  const branchById = new Map(allBranches.map((b) => [b.id, b]));
  const departmentById = new Map(allDepartments.map((d) => [d.id, d]));
  const jobTitleById = new Map(allJobTitles.map((j) => [j.id, j]));
  const existingEmployeeIds = new Set(existingReviews.map((r) => r.employeeId));

  const allNumericKpiIds = templatesWithKpis.flatMap((t) =>
    t.kpis
      .filter((k) => k.measurementType === "NUMBER" || k.measurementType === "PERCENTAGE" || k.measurementType === "CURRENCY")
      .map((k) => k.id)
  );
  const allTargets =
    allNumericKpiIds.length > 0
      ? await prisma.target.findMany({ where: { kpiId: { in: allNumericKpiIds }, month: cycle.month, year: cycle.year } })
      : [];
  const targetsByKpiId = new Map<string, typeof allTargets>();
  for (const t of allTargets) {
    const list = targetsByKpiId.get(t.kpiId) ?? [];
    list.push(t);
    targetsByKpiId.set(t.kpiId, list);
  }

  const employeesToProcess = employees.filter((e) => !existingEmployeeIds.has(e.id));
  const reviewsSkippedExisting = employees.length - employeesToProcess.length;

  if (employeesToProcess.length === 0) {
    return { reviewsCreated: 0, reviewsSkippedExisting, readiness };
  }

  let reviewsCreated = 0;

  await prisma.$transaction(
    async (tx) => {
      // --- 1) PerformanceReview لكل الموظفين دفعة واحدة ---
      const reviewInputs: Prisma.PerformanceReviewCreateManyInput[] = employeesToProcess.map((emp) => {
        const template = emp.jobTitle.kpiTemplates[0];
        const branch = branchById.get(emp.branchId)!;
        const department = emp.departmentId ? (departmentById.get(emp.departmentId) ?? null) : null;
        const jobTitle = jobTitleById.get(emp.jobTitleId)!;
        return {
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
        };
      });

      const createdReviews = await tx.performanceReview.createManyAndReturn({ data: reviewInputs });
      reviewsCreated = createdReviews.length;
      const reviewIdByEmployeeId = new Map(createdReviews.map((r) => [r.employeeId, r.id]));

      const kpisByReviewId = new Map<string, (typeof templatesWithKpis)[number]["kpis"]>();
      for (const emp of employeesToProcess) {
        const reviewId = reviewIdByEmployeeId.get(emp.id)!;
        const template = emp.jobTitle.kpiTemplates[0];
        kpisByReviewId.set(reviewId, kpisByTemplateId.get(template.id) ?? []);
      }

      // --- 2) ReviewKpiActual لكل الموظفين دفعة واحدة ---
      const kpiActualInputs: Prisma.ReviewKpiActualCreateManyInput[] = [];
      for (const emp of employeesToProcess) {
        const reviewId = reviewIdByEmployeeId.get(emp.id)!;
        const kpis = kpisByReviewId.get(reviewId) ?? [];
        const numericKpis = kpis.filter(
          (k) => k.measurementType === "NUMBER" || k.measurementType === "PERCENTAGE" || k.measurementType === "CURRENCY"
        );

        const employeeContext: EmployeeContext = {
          employeeId: emp.id,
          branchId: emp.branchId,
          departmentId: emp.departmentId,
          jobTitleId: emp.jobTitleId,
        };

        for (const kpi of numericKpis) {
          const targetRecords: TargetRecord[] = (targetsByKpiId.get(kpi.id) ?? []).map((t) => ({
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
              configurationErrorReason = 'الهدف يجب أن يكون أكبر من صفر لمؤشر من نوع "الأعلى أفضل" - راجع الإدارة';
            }
          }

          kpiActualInputs.push({
            reviewId,
            kpiId: kpi.id,
            kpiNameSnapshot: kpi.name,
            kpiWeightSnapshot: kpi.weight,
            kpiDirectionSnapshot: kpi.direction,
            kpiMeasurementTypeSnapshot: kpi.measurementType,
            targetValueSnapshot,
            targetScopeLevelSnapshot,
            isConfigurationError,
            configurationErrorReason,
          });
        }
      }

      if (kpiActualInputs.length > 0) {
        await tx.reviewKpiActual.createMany({ data: kpiActualInputs });
      }

      // --- 3) ReviewEvaluator لكل تعيين مطابق عبر كل الموظفين دفعة واحدة ---
      const reviewEvaluatorInputs: Prisma.ReviewEvaluatorCreateManyInput[] = [];
      for (const emp of employeesToProcess) {
        const reviewId = reviewIdByEmployeeId.get(emp.id)!;
        const matchingAssignments = assignments.filter((a) => assignmentCoversEmployee(a, emp));
        for (const assignment of matchingAssignments) {
          reviewEvaluatorInputs.push({
            reviewId,
            evaluatorId: assignment.evaluatorId,
            weightSnapshot: assignment.defaultWeight,
            status: "NOT_STARTED",
          });
        }
      }

      const createdReviewEvaluators =
        reviewEvaluatorInputs.length > 0 ? await tx.reviewEvaluator.createManyAndReturn({ data: reviewEvaluatorInputs }) : [];

      // --- 4) ReviewEvaluatorItem الفارغة لكل (مقيّم × مؤشر) دفعة واحدة ---
      const reviewEvaluatorItemInputs: Prisma.ReviewEvaluatorItemCreateManyInput[] = [];
      for (const re of createdReviewEvaluators) {
        const kpis = kpisByReviewId.get(re.reviewId) ?? [];
        for (const kpi of kpis) {
          reviewEvaluatorItemInputs.push({ reviewEvaluatorId: re.id, kpiId: kpi.id });
        }
      }

      if (reviewEvaluatorItemInputs.length > 0) {
        await tx.reviewEvaluatorItem.createMany({ data: reviewEvaluatorItemInputs });
      }
    },
    // 120 ثانية بدل 60 - هامش أمان إضافي لبطء اتصال Postgres الخارجي (Supabase) المُلاحَظ فعليًا؛
    // بعد إصلاح انفجار عدد الجولات (batching)، الوقت الفعلي المتوقَّع أقل بكثير من هذا الحد.
    { timeout: 120_000 }
  );

  return { reviewsCreated, reviewsSkippedExisting, readiness };
}
