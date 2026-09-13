import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { validateReviewEvaluatorForSubmit } from "@/lib/services/reviewEngine";
import SubmitButton from "./SubmitButton";

export default async function ReviewEvaluationPage({ params }: { params: { evaluationId: string } }) {
  const session = await getServerSession(authOptions);

  const reviewEvaluator = await prisma.reviewEvaluator.findUnique({
    where: { id: params.evaluationId },
    include: {
      review: { include: { cycle: true } },
      items: { include: { kpi: true, subcriteriaScores: { include: { subcriterion: true } } }, orderBy: { kpi: { sortOrder: "asc" } } },
      attachments: true,
    },
  });
  if (!reviewEvaluator) notFound();

  const isOwner = reviewEvaluator.evaluatorId === session!.user.id;
  const isAdmin = session!.user.role === "SUPER_ADMIN";
  if (!isOwner && !isAdmin) notFound();

  const actuals = await prisma.reviewKpiActual.findMany({ where: { reviewId: reviewEvaluator.reviewId } });

  const isReadOnly = reviewEvaluator.status === "SUBMITTED";
  const issues = isReadOnly ? [] : await validateReviewEvaluatorForSubmit(reviewEvaluator.id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`مراجعة تقييم: ${reviewEvaluator.review.employeeNameSnapshot}`}
        description={`${reviewEvaluator.review.jobTitleNameSnapshot} — ${reviewEvaluator.review.branchNameSnapshot} — ${reviewEvaluator.review.cycle.name}`}
        actions={
          !isReadOnly && (
            <Link href={`/evaluator/evaluate/${reviewEvaluator.id}`} className="btn-secondary">
              رجوع للتعديل
            </Link>
          )
        }
      />

      <div className="card mb-6 flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-slate-500">{isReadOnly ? "النتيجة النهائية" : "النتيجة التقديرية"}</div>
          <div className="text-3xl font-bold text-slate-900">
            {reviewEvaluator.overallPercentage !== null ? `${Number(reviewEvaluator.overallPercentage).toFixed(1)}%` : "—"}
          </div>
          {reviewEvaluator.overallScore !== null && (
            <div className="text-sm text-slate-500">{Number(reviewEvaluator.overallScore).toFixed(2)} / 5</div>
          )}
        </div>
        <Badge tone={isReadOnly ? "green" : "amber"}>{isReadOnly ? "مُرسَل ومقفل" : "مسودة"}</Badge>
      </div>

      {!isReadOnly && issues.length > 0 && (
        <div className="card mb-6 border-red-200 bg-red-50 p-5">
          <div className="mb-2 font-medium text-red-800">لا يمكن الإرسال - يوجد {issues.length} عنصر ناقص:</div>
          <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
            {issues.map((issue, i) => (
              <li key={i}>
                {issue.kpiName}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">المؤشر</th>
              <th className="px-4 py-3">الوزن</th>
              <th className="px-4 py-3">الهدف</th>
              <th className="px-4 py-3">الفعلي</th>
              <th className="px-4 py-3">الإنجاز</th>
              <th className="px-4 py-3">المساهمة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reviewEvaluator.items.map((item) => {
              const actual = actuals.find((a) => a.kpiId === item.kpiId);
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{item.kpi.name}</td>
                  <td className="px-4 py-3">{Number(item.kpi.weight)}%</td>
                  <td className="px-4 py-3">{actual?.targetValueSnapshot !== null && actual?.targetValueSnapshot !== undefined ? Number(actual.targetValueSnapshot) : "—"}</td>
                  <td className="px-4 py-3">
                    {item.kpi.measurementType === "RATING_1_5"
                      ? item.ratingValue ?? "—"
                      : actual?.actualValue !== null && actual?.actualValue !== undefined
                      ? Number(actual.actualValue)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{item.achievementPct !== null ? `${Number(item.achievementPct).toFixed(1)}%` : "—"}</td>
                  <td className="px-4 py-3">
                    {item.scoreContribution !== null ? `${Number(item.scoreContribution).toFixed(2)} / ${Number(item.kpi.weight)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card mb-6 space-y-4 p-5">
        <div className="font-medium text-slate-800">التبريرات والملاحظات</div>
        {reviewEvaluator.items
          .filter((i) => i.justification || i.subcriteriaScores.length > 0 || i.notes)
          .map((item) => (
            <div key={item.id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
              <div className="text-sm font-medium text-slate-700">{item.kpi.name}</div>
              {item.justification && <div className="mt-1 text-sm text-slate-600">{item.justification}</div>}
              {item.subcriteriaScores.map((s) => (
                <div key={s.id} className="mt-1 text-sm text-slate-600">
                  <span className="font-medium">{s.subcriterion.name} ({s.rating}/5):</span> {s.justification}
                </div>
              ))}
              {item.notes && <div className="mt-1 text-xs text-slate-400">ملاحظات: {item.notes}</div>}
            </div>
          ))}
      </div>

      {reviewEvaluator.attachments.length > 0 && (
        <div className="card mb-6 p-5">
          <div className="mb-2 font-medium text-slate-800">المرفقات</div>
          <div className="flex flex-wrap gap-3">
            {reviewEvaluator.attachments.map((a) => (
              <a key={a.id} href={`/api/attachments/${a.id}`} className="text-sm text-primary-600 hover:underline">
                📎 {a.fileName}
              </a>
            ))}
          </div>
        </div>
      )}

      {!isReadOnly && isOwner && (
        <div className="flex justify-end">
          <SubmitButton reviewEvaluatorId={reviewEvaluator.id} disabled={issues.length > 0} />
        </div>
      )}
    </div>
  );
}
