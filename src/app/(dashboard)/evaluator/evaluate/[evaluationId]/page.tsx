import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "./KpiCard";
import BottomBar from "./BottomBar";

export default async function EvaluateEmployeePage({ params }: { params: { evaluationId: string } }) {
  const session = await getServerSession(authOptions);

  const reviewEvaluator = await prisma.reviewEvaluator.findUnique({
    where: { id: params.evaluationId },
    include: { review: { include: { cycle: true } } },
  });
  if (!reviewEvaluator) notFound();
  if (reviewEvaluator.evaluatorId !== session!.user.id) notFound();

  if (reviewEvaluator.status === "SUBMITTED") {
    redirect(`/evaluator/review/${reviewEvaluator.id}`);
  }

  const template = await prisma.kpiTemplate.findUniqueOrThrow({
    where: { id: reviewEvaluator.review.kpiTemplateId },
    include: {
      kpis: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { subcriteria: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  const [items, actuals, attachments] = await Promise.all([
    prisma.reviewEvaluatorItem.findMany({
      where: { reviewEvaluatorId: reviewEvaluator.id },
      include: { subcriteriaScores: true },
    }),
    prisma.reviewKpiActual.findMany({ where: { reviewId: reviewEvaluator.reviewId } }),
    prisma.reviewAttachment.findMany({ where: { reviewEvaluatorId: reviewEvaluator.id } }),
  ]);

  const completedCount = items.filter((i) => i.scoreContribution !== null).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={reviewEvaluator.review.employeeNameSnapshot}
        description={`${reviewEvaluator.review.jobTitleNameSnapshot} — ${reviewEvaluator.review.branchNameSnapshot} — ${reviewEvaluator.review.cycle.name}`}
      />

      <div className="card mb-6 flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-slate-500">النتيجة الحالية (تقديرية)</div>
          <div className="text-2xl font-bold text-slate-900">
            {reviewEvaluator.overallPercentage !== null ? `${Number(reviewEvaluator.overallPercentage).toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="text-sm text-slate-500">
          {completedCount} / {template.kpis.length} مؤشرات مكتملة
        </div>
      </div>

      <div className="space-y-4">
        {template.kpis.map((kpi) => {
          const item = items.find((i) => i.kpiId === kpi.id)!;
          const actual = actuals.find((a) => a.kpiId === kpi.id) ?? null;
          return (
            <KpiCard
              key={kpi.id}
              reviewEvaluatorId={reviewEvaluator.id}
              kpi={{
                id: kpi.id,
                name: kpi.name,
                description: kpi.description,
                weight: Number(kpi.weight),
                measurementType: kpi.measurementType,
                direction: kpi.direction,
                measurementInstructions: kpi.measurementInstructions,
                subcriteria: kpi.subcriteria.map((s) => ({ id: s.id, name: s.name, description: s.description, weight: s.weight ? Number(s.weight) : null })),
              }}
              actual={
                actual
                  ? {
                      actualValue: actual.actualValue !== null ? Number(actual.actualValue) : null,
                      targetValue: actual.targetValueSnapshot !== null ? Number(actual.targetValueSnapshot) : null,
                      isConfigurationError: actual.isConfigurationError,
                      configurationErrorReason: actual.configurationErrorReason,
                    }
                  : null
              }
              item={{
                ratingValue: item.ratingValue,
                achievementPct: item.achievementPct !== null ? Number(item.achievementPct) : null,
                scoreContribution: item.scoreContribution !== null ? Number(item.scoreContribution) : null,
                justification: item.justification,
                notes: item.notes,
                subcriteriaScores: item.subcriteriaScores.map((s) => ({
                  subcriterionId: s.subcriterionId,
                  rating: s.rating,
                  justification: s.justification,
                })),
              }}
              attachments={attachments.filter((a) => a.kpiId === kpi.id || a.kpiId === null)}
            />
          );
        })}
      </div>

      <BottomBar reviewEvaluatorId={reviewEvaluator.id} />
    </div>
  );
}
