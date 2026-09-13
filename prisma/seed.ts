/**
 * Seed Data — بيانات أولية قابلة للتعديل بالكامل من الإدارة (لا شيء Hardcoded في الواجهة).
 * يغطي: الفروع الأربعة (§4)، المسميات الوظيفية (§6)، KPI Templates والـKPIs (§12)،
 * تصنيفات الأداء الافتراضية (§23)، كتالوج الصلاحيات الدقيقة (§5 من المراجعة)،
 * تصنيف مقاييس التقارير الموحّدة ReportingMetric (§12 من المراجعة)، وحساب Super Admin أولي.
 *
 * تنبيه: بعض الـTargets في المصدر الأصلي غير محددة رقميًا بدقة (راجع §9.3 من وثيقة التصميم)
 * لذلك لا تُدخل أي قيم Target هنا؛ تُدخل لاحقًا من شاشة "الأهداف" قبل فتح أي دورة تقييم.
 *
 * تنبيه ثانٍ (Decision Required سابقًا، تم حله بأفضل تقدير قابل للتعديل): ربط كل KPI رقمي
 * بمقياس تقرير (ReportingMetric) هو تصنيف أولي مبدئي لتمكين تقارير الفروع/الأقسام من التجميع؛
 * يمكن للإدارة تعديل هذا الربط لاحقًا من واجهة إدارة القوالب دون أي قيد برمجي.
 */

import { PrismaClient, MeasurementType, KpiDirection, AggregationMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // -------------------------------------------------------------------
  // 1) الفروع
  // -------------------------------------------------------------------
  const branchesData = [
    { name: "فرع جدة", code: "JED" },
    { name: "فرع الرياض", code: "RUH" },
    { name: "فرع الدمام", code: "DMM" },
    { name: "فرع المدينة", code: "MED" },
  ];

  const branches: Record<string, string> = {};
  for (const b of branchesData) {
    const branch = await prisma.branch.upsert({
      where: { name: b.name },
      update: {},
      create: b,
    });
    branches[b.name] = branch.id;
  }

  // -------------------------------------------------------------------
  // 2) المسميات الوظيفية
  // -------------------------------------------------------------------
  const jobTitleNames = [
    "مستشار قانوني",
    "محامي مرخص",
    "محامي متدرب",
    "سكرتير قانوني",
    "موظف استقبال",
    "خدمة العملاء",
  ];

  const jobTitles: Record<string, string> = {};
  for (const name of jobTitleNames) {
    const jt = await prisma.jobTitle.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    jobTitles[name] = jt.id;
  }

  // -------------------------------------------------------------------
  // 2.1) الأقسام — كيان تنظيمي مستقل عن الفرع (§12 من المراجعة: Department لم يعد
  // يحمل branchId؛ الربط الاختياري بالفروع يتم عبر BranchDepartment).
  // قسم افتراضي واحد "خدمة العملاء" متاح في الفروع الأربعة (قابل للتعديل/الحذف من الإدارة).
  // -------------------------------------------------------------------
  const customerServiceDept = await prisma.department.upsert({
    where: { name: "خدمة العملاء" },
    update: {},
    create: { name: "خدمة العملاء" },
  });

  for (const branchId of Object.values(branches)) {
    await prisma.branchDepartment.upsert({
      where: { branchId_departmentId: { branchId, departmentId: customerServiceDept.id } },
      update: {},
      create: { branchId, departmentId: customerServiceDept.id },
    });
  }

  // -------------------------------------------------------------------
  // 3) مقاييس التقارير الموحّدة (ReportingMetric) — §12 من المراجعة
  // -------------------------------------------------------------------
  const reportingMetrics = [
    { code: "REVENUE", name: "الإيرادات", unit: "SAR", aggregationMethod: AggregationMethod.SUM },
    {
      code: "CUSTOMER_SATISFACTION",
      name: "رضا العملاء",
      unit: "%",
      aggregationMethod: AggregationMethod.AVERAGE,
    },
    {
      code: "CASE_SUCCESS_RATE",
      name: "نسبة نجاح القضايا",
      unit: "%",
      aggregationMethod: AggregationMethod.AVERAGE,
    },
    { code: "NEW_CLIENTS", name: "عملاء/استشارات جدد", unit: null, aggregationMethod: AggregationMethod.SUM },
    {
      code: "SESSIONS_COMPLETED",
      name: "الجلسات والمراجعات المكتملة",
      unit: null,
      aggregationMethod: AggregationMethod.SUM,
    },
    {
      code: "RESPONSE_TIME",
      name: "زمن الاستجابة",
      unit: "دقيقة",
      aggregationMethod: AggregationMethod.AVERAGE,
    },
    {
      code: "DOCUMENTATION_QUALITY",
      name: "جودة التوثيق والمستندات",
      unit: "%",
      aggregationMethod: AggregationMethod.AVERAGE,
    },
  ];

  for (const m of reportingMetrics) {
    await prisma.reportingMetric.upsert({
      where: { code: m.code },
      update: {},
      create: m,
    });
  }

  // -------------------------------------------------------------------
  // 4) كتالوج الصلاحيات الدقيقة (Permission) — §5 من المراجعة، منفصل عن النطاق (Scope)
  // -------------------------------------------------------------------
  const permissions = [
    { code: "evaluation.perform", description: "تنفيذ التقييمات" },
    { code: "evaluation.view_history", description: "عرض السجل التاريخي للتقييمات" },
    { code: "evaluation.upload_evidence", description: "رفع الأدلة والمرفقات" },
    { code: "report.view_employee", description: "عرض تقرير الموظف" },
    { code: "report.view_branch", description: "عرض تقرير الفرع" },
    { code: "report.view_department", description: "عرض تقرير القسم" },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  // -------------------------------------------------------------------
  // 5) KPI Templates + KPIs (§12) — الأوزان كما وردت بالنص الأصلي بالضبط
  // -------------------------------------------------------------------
  type KpiSeed = {
    name: string;
    weight: number;
    description?: string;
    measurementType?: MeasurementType;
    direction?: KpiDirection;
    measurementInstructions?: string;
    reportingMetricCode?: string;
  };

  const templates: { jobTitle: string; kpis: KpiSeed[] }[] = [
    {
      jobTitle: "مستشار قانوني",
      kpis: [
        {
          name: "تحقيق إيرادات الفرع",
          weight: 35,
          description: "يربط المبيعات بالإيراد الفعلي ويضمن نمو الفرع.",
          measurementType: MeasurementType.CURRENCY,
          measurementInstructions: "إجمالي الإيرادات. الهدف: زيادة 10% (يُحدَّد رقميًا من شاشة الأهداف).",
          reportingMetricCode: "REVENUE",
        },
        {
          name: "نسبة رضا العملاء",
          weight: 20,
          measurementType: MeasurementType.PERCENTAGE,
          measurementInstructions: "استطلاع بعد كل قضية + استطلاع شهري. الهدف: 80%.",
          reportingMetricCode: "CUSTOMER_SATISFACTION",
        },
        {
          name: "نجاح القضية",
          weight: 15,
          measurementType: MeasurementType.PERCENTAGE,
          measurementInstructions: "عدد القضايا الناجحة / القضايا المنتهية. الهدف: >= 70%.",
          reportingMetricCode: "CASE_SUCCESS_RATE",
        },
        {
          name: "عدد الاستشارات والعملاء الجدد",
          weight: 10,
          measurementType: MeasurementType.NUMBER,
          measurementInstructions: "عدد العملاء الذين تم التوقيع معهم / نمو العملاء. الهدف: زيادة 10%.",
          reportingMetricCode: "NEW_CLIENTS",
        },
        {
          name: "تطوير الفريق",
          weight: 10,
          measurementType: MeasurementType.RATING_1_5,
          measurementInstructions: "التقييم الداخلي + التدريب (360 الكامل مؤجل لـPhase 2).",
        },
        { name: "المبادرة", weight: 10, measurementType: MeasurementType.SUBCRITERIA_RATING },
      ],
    },
    {
      jobTitle: "محامي مرخص",
      kpis: [
        {
          name: "تحقيق الهدف من الجلسة",
          weight: 25,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "CASE_SUCCESS_RATE",
        },
        { name: "المبيعات", weight: 25, measurementType: MeasurementType.CURRENCY, reportingMetricCode: "REVENUE" },
        {
          name: "عدد الجلسات والمراجعات المكتملة والمعدة قبل موعدها",
          weight: 15,
          measurementType: MeasurementType.NUMBER,
          reportingMetricCode: "SESSIONS_COMPLETED",
        },
        {
          name: "رضا العميل عن الخدمة",
          weight: 15,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "CUSTOMER_SATISFACTION",
        },
        {
          name: "عدد الكتابات القانونية عالية الجودة",
          weight: 10,
          measurementType: MeasurementType.NUMBER,
          reportingMetricCode: "DOCUMENTATION_QUALITY",
        },
        { name: "المبادرة", weight: 10, measurementType: MeasurementType.SUBCRITERIA_RATING },
      ],
    },
    {
      jobTitle: "محامي متدرب",
      kpis: [
        {
          name: "إنجاز المحررات",
          weight: 20,
          measurementType: MeasurementType.NUMBER,
          reportingMetricCode: "DOCUMENTATION_QUALITY",
        },
        {
          name: "دقة التقارير والمستندات",
          weight: 25,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "DOCUMENTATION_QUALITY",
        },
        {
          name: "عدد الجلسات والمراجعات",
          weight: 20,
          measurementType: MeasurementType.NUMBER,
          reportingMetricCode: "SESSIONS_COMPLETED",
        },
        {
          name: "رضا الإدارة القانونية",
          weight: 15,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "CUSTOMER_SATISFACTION",
        },
        { name: "الاستشارات", weight: 10, measurementType: MeasurementType.NUMBER, reportingMetricCode: "NEW_CLIENTS" },
        { name: "المبادرة", weight: 10, measurementType: MeasurementType.SUBCRITERIA_RATING },
      ],
    },
    {
      jobTitle: "سكرتير قانوني",
      kpis: [
        {
          name: "دقة تحديث الجلسات والمواعيد",
          weight: 25,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "DOCUMENTATION_QUALITY",
        },
        {
          name: "سرعة الرد على الاستفسارات",
          weight: 25,
          measurementType: MeasurementType.NUMBER,
          direction: KpiDirection.LOWER_IS_BETTER,
          measurementInstructions: "الزمن بالدقائق للرد - الأقل أفضل.",
          reportingMetricCode: "RESPONSE_TIME",
        },
        {
          name: "رضا العملاء عن التواصل",
          weight: 20,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "CUSTOMER_SATISFACTION",
        },
        {
          name: "دقة إدخال البيانات والأرشفة",
          weight: 10,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "DOCUMENTATION_QUALITY",
        },
        {
          name: "عدد المستندات والمهام المجهزة",
          weight: 10,
          measurementType: MeasurementType.NUMBER,
          reportingMetricCode: "SESSIONS_COMPLETED",
        },
        { name: "المبادرة", weight: 10, measurementType: MeasurementType.SUBCRITERIA_RATING },
      ],
    },
    {
      jobTitle: "موظف استقبال",
      kpis: [
        { name: "الترحيب واحتواء العملاء", weight: 25, measurementType: MeasurementType.RATING_1_5 },
        {
          name: "دقة تسجيل البيانات",
          weight: 20,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "DOCUMENTATION_QUALITY",
        },
        { name: "تقييم تجربة العميل عند الوصول", weight: 25, measurementType: MeasurementType.RATING_1_5 },
        {
          name: "عدد العملاء الذين تم استقبالهم بسلاسة",
          weight: 10,
          measurementType: MeasurementType.NUMBER,
          reportingMetricCode: "SESSIONS_COMPLETED",
        },
        { name: "الالتزام بالوقت والمظهر", weight: 10, measurementType: MeasurementType.RATING_1_5 },
        { name: "المبادرة", weight: 10, measurementType: MeasurementType.SUBCRITERIA_RATING },
      ],
    },
    {
      jobTitle: "خدمة العملاء",
      kpis: [
        {
          name: "عدد الاستشارات المحجوزة",
          weight: 15,
          measurementType: MeasurementType.NUMBER,
          reportingMetricCode: "NEW_CLIENTS",
        },
        {
          name: "نسبة التحويل",
          weight: 20,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "CASE_SUCCESS_RATE",
        },
        {
          name: "سرعة الرد - أول رد",
          weight: 15,
          measurementType: MeasurementType.NUMBER,
          direction: KpiDirection.LOWER_IS_BETTER,
          measurementInstructions: "الزمن بالدقائق للرد الأول - الأقل أفضل.",
          reportingMetricCode: "RESPONSE_TIME",
        },
        {
          name: "رضا العملاء الجدد",
          weight: 20,
          measurementType: MeasurementType.PERCENTAGE,
          reportingMetricCode: "CUSTOMER_SATISFACTION",
        },
        {
          name: "عدد المتابعات الناجحة",
          weight: 20,
          measurementType: MeasurementType.NUMBER,
          reportingMetricCode: "SESSIONS_COMPLETED",
        },
        { name: "المبادرة", weight: 10, measurementType: MeasurementType.SUBCRITERIA_RATING },
      ],
    },
  ];

  const initiativeSubcriteria = [
    "تحمل المسؤولية",
    "حل المشكلات",
    "اقتراح تحسينات",
    "تطوير العمل",
    "زيادة الإنتاجية",
    "خفض التكاليف",
  ];

  for (const tpl of templates) {
    const jobTitleId = jobTitles[tpl.jobTitle];
    const totalWeight = tpl.kpis.reduce((s, k) => s + k.weight, 0);

    const existing = await prisma.kpiTemplate.findFirst({ where: { jobTitleId, version: 1 } });
    const template =
      existing ??
      (await prisma.kpiTemplate.create({
        data: {
          jobTitleId,
          name: `قالب ${tpl.jobTitle} - الإصدار 1`,
          version: 1,
          isActive: Math.abs(totalWeight - 100) < 0.01, // يُفعَّل تلقائيًا فقط إذا كان المجموع 100% تمامًا
        },
      }));

    for (let i = 0; i < tpl.kpis.length; i++) {
      const k = tpl.kpis[i];
      const kpi = await prisma.kpi.findFirst({ where: { kpiTemplateId: template.id, name: k.name } });
      const kpiRecord =
        kpi ??
        (await prisma.kpi.create({
          data: {
            kpiTemplateId: template.id,
            name: k.name,
            description: k.description,
            weight: k.weight,
            measurementType: k.measurementType ?? MeasurementType.NUMBER,
            direction: k.direction ?? KpiDirection.HIGHER_IS_BETTER,
            measurementInstructions: k.measurementInstructions,
            reportingMetricCode: k.reportingMetricCode,
            sortOrder: i,
          },
        }));

      if (k.name === "المبادرة" && kpiRecord.measurementType === MeasurementType.SUBCRITERIA_RATING) {
        const subCount = await prisma.kpiSubcriterion.count({ where: { kpiId: kpiRecord.id } });
        if (subCount === 0) {
          for (let s = 0; s < initiativeSubcriteria.length; s++) {
            await prisma.kpiSubcriterion.create({
              data: { kpiId: kpiRecord.id, name: initiativeSubcriteria[s], sortOrder: s },
            });
          }
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `KPI Template "${tpl.jobTitle}": مجموع الأوزان = ${totalWeight}%${
        Math.abs(totalWeight - 100) > 0.01 ? "  ⚠ لا يساوي 100% - يتطلب مراجعة قبل التفعيل" : " ✓"
      }`
    );
  }

  // -------------------------------------------------------------------
  // 6) تصنيفات الأداء الافتراضية (§23) — مُتحقق منها بعدم التداخل (§22 من المراجعة)
  // -------------------------------------------------------------------
  const labels = [
    { label: "متميز", minPct: 90, maxPct: 999, colorHex: "#16a34a", sortOrder: 1 },
    { label: "يفوق التوقعات", minPct: 80, maxPct: 89.99, colorHex: "#4338ca", sortOrder: 2 },
    { label: "جيد", minPct: 70, maxPct: 79.99, colorHex: "#0ea5e9", sortOrder: 3 },
    { label: "يحتاج تطوير", minPct: 60, maxPct: 69.99, colorHex: "#f59e0b", sortOrder: 4 },
    { label: "يحتاج متابعة", minPct: -999, maxPct: 59.99, colorHex: "#dc2626", sortOrder: 5 },
  ];
  for (const l of labels) {
    const existing = await prisma.performanceLabel.findFirst({ where: { label: l.label } });
    if (!existing) await prisma.performanceLabel.create({ data: l });
  }

  // -------------------------------------------------------------------
  // 7) المستخدمون الأوليون
  // -------------------------------------------------------------------
  const adminPasswordHash = await bcrypt.hash("ChangeMe123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@rhl.local" },
    update: {},
    create: {
      fullName: "مدير النظام",
      email: "admin@rhl.local",
      passwordHash: adminPasswordHash,
      role: "SUPER_ADMIN",
    },
  });

  const evaluatorPasswordHash = await bcrypt.hash("ChangeMe123!", 12);
  await prisma.user.upsert({
    where: { email: "evaluator@rhl.local" },
    update: {},
    create: {
      fullName: "مقيّم تجريبي",
      email: "evaluator@rhl.local",
      passwordHash: evaluatorPasswordHash,
      role: "EVALUATOR",
    },
  });

  // -------------------------------------------------------------------
  // 8) إعدادات النظام الافتراضية
  // -------------------------------------------------------------------
  await prisma.systemSetting.upsert({
    where: { key: "file_upload" },
    update: {},
    create: {
      key: "file_upload",
      value: { maxSizeMb: 10, allowedExtensions: ["pdf", "docx", "xlsx", "png", "jpg", "jpeg"] },
    },
  });

  console.log("\n✅ Seed اكتمل بنجاح.");
  console.log("   Super Admin: admin@rhl.local / ChangeMe123!  (غيّر كلمة المرور فورًا)");
  console.log("   Evaluator تجريبي: evaluator@rhl.local / ChangeMe123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
