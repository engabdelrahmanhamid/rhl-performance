/**
 * أدوات مساعدة لبناء بيانات تكامل معزولة (Branch/Employee/KpiTemplate/Cycle/...) في نفس
 * قاعدة البيانات الفعلية، ثم تنظيفها بالكامل بعد كل اختبار. كل الأسماء/المعرّفات مُميَّزة
 * عبر runId عشوائي لتفادي أي تعارض مع بيانات Seed أو بين ملفات اختبار تعمل بالتوازي.
 */
import { prisma } from "@/lib/prisma";

export interface OrgFixture {
  runId: string;
  branchId: string;
  departmentId: string;
  jobTitleId: string;
  employeeId: string;
  evaluatorUserIds: string[];
  assignmentIds: string[];
  kpiTemplateId: string;
  numericKpiId: string;
  ratingKpiId: string;
  targetId: string | null;
  cycleId: string;
  month: number;
  year: number;
}

export async function createOrgFixture(opts?: {
  /** وزن كل مقيّم يُعيَّن على نطاق الفرع بالكامل - افتراضيًا مقيّم واحد بوزن 100%. */
  evaluatorWeights?: number[];
  /** قيمة هدف GLOBAL للمؤشر الرقمي - null لتعمّد عدم إنشاء أي هدف (اختبار خطأ الإعداد). */
  targetValue?: number | null;
  month?: number;
  year?: number;
}): Promise<OrgFixture> {
  const weights = opts?.evaluatorWeights ?? [100];
  const rand = Math.floor(Math.random() * 1_000_000);
  const runId = `${Date.now()}_${rand}`;
  // سنوات بعيدة عمدًا لتفادي أي تعارض مع دورات حقيقية أو دورات اختبار أخرى تعمل بالتوازي.
  const month = opts?.month ?? (1 + (rand % 12));
  const year = opts?.year ?? (2200 + (rand % 700));

  const branch = await prisma.branch.create({ data: { name: `TestBranch_${runId}`, code: `TB_${runId}` } });
  const department = await prisma.department.create({ data: { name: `TestDept_${runId}` } });
  const jobTitle = await prisma.jobTitle.create({ data: { name: `TestJob_${runId}` } });

  const employee = await prisma.employee.create({
    data: {
      employeeNumber: `EMP_${runId}`,
      fullName: `Test Employee ${runId}`,
      branchId: branch.id,
      departmentId: department.id,
      jobTitleId: jobTitle.id,
      hireDate: new Date("2020-01-01"),
    },
  });

  const kpiTemplate = await prisma.kpiTemplate.create({
    data: { jobTitleId: jobTitle.id, name: `Template ${runId}`, version: 1, isActive: true },
  });

  const numericKpi = await prisma.kpi.create({
    data: {
      kpiTemplateId: kpiTemplate.id,
      name: "الإيرادات",
      weight: 60,
      measurementType: "NUMBER",
      direction: "HIGHER_IS_BETTER",
    },
  });

  const ratingKpi = await prisma.kpi.create({
    data: {
      kpiTemplateId: kpiTemplate.id,
      name: "العمل الجماعي",
      weight: 40,
      measurementType: "RATING_1_5",
    },
  });

  let targetId: string | null = null;
  if (opts?.targetValue !== null) {
    const target = await prisma.target.create({
      data: {
        kpiId: numericKpi.id,
        scopeType: "GLOBAL",
        scopeKey: "GLOBAL",
        applicationMode: "PER_EMPLOYEE",
        month,
        year,
        value: opts?.targetValue ?? 100,
      },
    });
    targetId = target.id;
  }

  const evaluatorUserIds: string[] = [];
  const assignmentIds: string[] = [];
  for (let i = 0; i < weights.length; i++) {
    const user = await prisma.user.create({
      data: {
        fullName: `Test Evaluator ${runId}_${i}`,
        email: `evaluator_${runId}_${i}@test.local`,
        passwordHash: "test-hash",
        role: "EVALUATOR",
      },
    });
    const assignment = await prisma.evaluatorAssignment.create({
      data: {
        evaluatorId: user.id,
        defaultWeight: weights[i],
        isActive: true,
        rules: { create: [{ branchId: branch.id }] },
      },
    });
    evaluatorUserIds.push(user.id);
    assignmentIds.push(assignment.id);
  }

  const cycle = await prisma.evaluationCycle.create({
    data: {
      name: `Test Cycle ${runId}`,
      month,
      year,
      periodStart: new Date(year, month - 1, 1),
      periodEnd: new Date(year, month, 0),
      openDate: new Date(year, month - 1, 1),
      deadline: new Date(year, month, 5),
      status: "DRAFT",
    },
  });

  return {
    runId,
    branchId: branch.id,
    departmentId: department.id,
    jobTitleId: jobTitle.id,
    employeeId: employee.id,
    evaluatorUserIds,
    assignmentIds,
    kpiTemplateId: kpiTemplate.id,
    numericKpiId: numericKpi.id,
    ratingKpiId: ratingKpi.id,
    targetId,
    cycleId: cycle.id,
    month,
    year,
  };
}

/** يحذف كل ما أنشأه createOrgFixture (وأي مراجعات أُنشئت عليه لاحقًا) بترتيب آمن للـ FKs. */
export async function cleanupOrgFixture(fx: OrgFixture) {
  await prisma.performanceReview.deleteMany({ where: { cycleId: fx.cycleId } });
  await prisma.target.deleteMany({ where: { kpiId: { in: [fx.numericKpiId, fx.ratingKpiId] } } });
  await prisma.kpi.deleteMany({ where: { id: { in: [fx.numericKpiId, fx.ratingKpiId] } } });
  await prisma.kpiTemplate.deleteMany({ where: { id: fx.kpiTemplateId } });
  await prisma.evaluatorAssignment.deleteMany({ where: { id: { in: fx.assignmentIds } } });
  await prisma.employee.deleteMany({ where: { id: fx.employeeId } });
  await prisma.user.deleteMany({ where: { id: { in: fx.evaluatorUserIds } } });
  await prisma.jobTitle.deleteMany({ where: { id: fx.jobTitleId } });
  await prisma.department.deleteMany({ where: { id: fx.departmentId } });
  await prisma.branch.deleteMany({ where: { id: fx.branchId } });
  await prisma.evaluationCycle.deleteMany({ where: { id: fx.cycleId } });
}
