/**
 * خدمة التقارير — §1 من الملخص: المقارنة دائمًا "موظف مقابل هدفه"، ولا يوجد أبدًا ترتيب
 * موظف مقابل موظف (Employee Ranking) - محظور صراحة. لذلك تقارير الفرع/القسم هنا تعرض
 * مجاميع/متوسطات/توزيعات فقط، ولا تعرض أبدًا قائمة موظفين مُرتَّبة حسب النتيجة.
 *
 * تعتمد على الحقول *Snapshot المجمَّدة وقت فتح الدورة (branchIdSnapshot/departmentIdSnapshot)
 * لضمان دقة تاريخية - لا تتأثر بنقل موظف لفرع آخر لاحقًا (§3.6 من HANDOFF).
 */

import { prisma } from "@/lib/prisma";

export interface EmployeeReportRow {
  reviewId: string;
  cycleId: string;
  cycleName: string;
  month: number;
  year: number;
  status: string;
  finalScore: number | null;
  finalPercentage: number | null;
  performanceLabel: string | null;
}

export async function getEmployeeReport(employeeId: string): Promise<EmployeeReportRow[]> {
  const reviews = await prisma.performanceReview.findMany({
    where: { employeeId },
    include: { cycle: true },
    orderBy: [{ cycle: { year: "desc" } }, { cycle: { month: "desc" } }],
  });

  return reviews.map((r) => ({
    reviewId: r.id,
    cycleId: r.cycleId,
    cycleName: r.cycle.name,
    month: r.cycle.month,
    year: r.cycle.year,
    status: r.status,
    finalScore: r.finalScore !== null ? Number(r.finalScore) : null,
    finalPercentage: r.finalPercentage !== null ? Number(r.finalPercentage) : null,
    performanceLabel: r.performanceLabelSnapshot,
  }));
}

export interface MetricRollup {
  code: string;
  name: string;
  unit: string | null;
  aggregationMethod: string;
  value: number | null;
  sampleCount: number;
}

export interface ScopeReportSummary {
  cycleId: string;
  cycleName: string;
  totalReviews: number;
  completedReviews: number;
  completionPct: number;
  averageFinalPercentage: number | null;
  labelDistribution: { label: string; count: number }[];
  metricRollups: MetricRollup[];
}

function aggregate(values: number[], method: string): number | null {
  if (values.length === 0) return null;
  switch (method) {
    case "SUM":
      return values.reduce((s, v) => s + v, 0);
    case "COUNT":
      return values.length;
    case "AVERAGE":
    case "PERCENTAGE":
    case "CUSTOM":
    default:
      return values.reduce((s, v) => s + v, 0) / values.length;
  }
}

async function buildScopeReport(cycleId: string, reviewWhere: { branchIdSnapshot?: string; departmentIdSnapshot?: string }): Promise<ScopeReportSummary> {
  const cycle = await prisma.evaluationCycle.findUniqueOrThrow({ where: { id: cycleId } });

  const reviews = await prisma.performanceReview.findMany({
    where: { cycleId, ...reviewWhere },
    select: { id: true, status: true, finalPercentage: true, performanceLabelSnapshot: true },
  });

  const totalReviews = reviews.length;
  const completed = reviews.filter((r) => r.status === "COMPLETED");
  const completionPct = totalReviews > 0 ? Math.round((completed.length / totalReviews) * 100) : 0;

  const finalPcts = completed.map((r) => Number(r.finalPercentage)).filter((v) => !Number.isNaN(v));
  const averageFinalPercentage = finalPcts.length > 0 ? finalPcts.reduce((s, v) => s + v, 0) / finalPcts.length : null;

  const labelCounts = new Map<string, number>();
  for (const r of completed) {
    const label = r.performanceLabelSnapshot ?? "غير مصنَّف";
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  const labelDistribution = Array.from(labelCounts.entries()).map(([label, count]) => ({ label, count }));

  const reviewIds = reviews.map((r) => r.id);
  const metrics = await prisma.reportingMetric.findMany({ orderBy: { code: "asc" } });
  const metricRollups: MetricRollup[] = [];

  if (reviewIds.length > 0) {
    const actuals = await prisma.reviewKpiActual.findMany({
      where: { reviewId: { in: reviewIds }, actualValue: { not: null }, isConfigurationError: false },
      include: { kpi: true },
    });

    for (const metric of metrics) {
      const values = actuals.filter((a) => a.kpi.reportingMetricCode === metric.code).map((a) => Number(a.actualValue));
      metricRollups.push({
        code: metric.code,
        name: metric.name,
        unit: metric.unit,
        aggregationMethod: metric.aggregationMethod,
        value: aggregate(values, metric.aggregationMethod),
        sampleCount: values.length,
      });
    }
  }

  return {
    cycleId,
    cycleName: cycle.name,
    totalReviews,
    completedReviews: completed.length,
    completionPct,
    averageFinalPercentage,
    labelDistribution,
    metricRollups: metricRollups.filter((m) => m.sampleCount > 0),
  };
}

export async function getBranchReport(branchId: string, cycleId: string): Promise<ScopeReportSummary> {
  return buildScopeReport(cycleId, { branchIdSnapshot: branchId });
}

export async function getDepartmentReport(departmentId: string, cycleId: string): Promise<ScopeReportSummary> {
  return buildScopeReport(cycleId, { departmentIdSnapshot: departmentId });
}
