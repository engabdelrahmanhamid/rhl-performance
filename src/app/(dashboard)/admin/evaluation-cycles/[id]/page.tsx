import { Fragment } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { Users, CheckCircle2, Clock, Percent, Inbox } from "lucide-react";
import { getCycleOpenReadiness } from "@/lib/services/cycleOpening";
import CycleActions from "../CycleActions";

const REVIEW_STATUS_LABELS: Record<string, { label: string; tone: "slate" | "amber" | "green" }> = {
  NOT_STARTED: { label: "لم يبدأ", tone: "slate" },
  IN_PROGRESS: { label: "قيد التقييم", tone: "amber" },
  AWAITING_EVALUATIONS: { label: "بانتظار اكتمال المقيّمين", tone: "amber" },
  COMPLETED: { label: "مكتملة", tone: "green" },
};

const EVALUATOR_STATUS_LABELS: Record<string, { label: string; tone: "slate" | "amber" | "green" }> = {
  NOT_STARTED: { label: "لم يبدأ", tone: "slate" },
  DRAFT: { label: "مسودة", tone: "amber" },
  SUBMITTED: { label: "مُرسَل", tone: "green" },
  REOPENED: { label: "أُعيد فتحه", tone: "amber" },
};

export default async function CycleDetailPage({ params }: { params: { id: string } }) {
  const cycle = await prisma.evaluationCycle.findUnique({
    where: { id: params.id },
    include: {
      reviews: {
        include: { evaluators: { include: { evaluator: true }, orderBy: { createdAt: "asc" } } },
        orderBy: { employeeNameSnapshot: "asc" },
      },
    },
  });
  if (!cycle) notFound();

  const total = cycle.reviews.length;
  const completed = cycle.reviews.filter((r) => r.status === "COMPLETED").length;
  const awaiting = cycle.reviews.filter((r) => r.status === "AWAITING_EVALUATIONS").length;
  const notStarted = cycle.reviews.filter((r) => r.status === "NOT_STARTED").length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const readiness = cycle.status === "DRAFT" ? await getCycleOpenReadiness(cycle.id) : [];
  const notReady = readiness.filter((r) => !r.isReady);

  return (
    <div>
      <PageHeader
        title={cycle.name}
        description={`الفترة: ${cycle.periodStart.toLocaleDateString("ar-SA")} — ${cycle.periodEnd.toLocaleDateString("ar-SA")}`}
        actions={<CycleActions cycleId={cycle.id} status={cycle.status} />}
      />

      {cycle.status === "DRAFT" && notReady.length > 0 && (
        <div className="card mb-6 border-amber-200 bg-amber-50 p-5">
          <div className="mb-2 font-medium text-amber-800">
            {notReady.length} موظف غير جاهز لفتح الدورة عليهم (لن يُنشأ لهم مراجعة أداء عند الفتح):
          </div>
          <ul className="space-y-1 text-sm text-amber-700">
            {notReady.slice(0, 15).map((r) => (
              <li key={r.employeeId}>
                {r.employeeName} ({r.jobTitleName}): {r.issues.join("، ")}
              </li>
            ))}
          </ul>
          {notReady.length > 15 && <div className="mt-1 text-xs text-amber-600">و{notReady.length - 15} موظف آخر...</div>}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="إجمالي المراجعات" value={total} icon={Users} />
        <StatCard label="مكتملة" value={completed} icon={CheckCircle2} tone="success" />
        <StatCard label="بانتظار الإكمال" value={awaiting + notStarted} icon={Clock} tone="warning" />
        <StatCard label="نسبة الإنجاز" value={`${completionPct}%`} icon={Percent} />
      </div>

      {total === 0 ? (
        <EmptyState
          icon={Inbox}
          title="لا توجد مراجعات أداء في هذه الدورة بعد"
          description={cycle.status === "DRAFT" ? "افتح الدورة لإنشاء مراجعات الأداء للموظفين الجاهزين." : undefined}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">الموظف / المقيّم</th>
                <th className="px-4 py-3">الوزن</th>
                <th className="px-4 py-3">حالة المقيّم</th>
                <th className="px-4 py-3">نتيجة المقيّم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cycle.reviews.map((review) => (
                <Fragment key={review.id}>
                  <tr className="bg-slate-50/70">
                    <td colSpan={2} className="px-4 py-2.5 font-medium text-slate-800">
                      {review.employeeNameSnapshot}
                      <span className="mr-2 font-normal text-slate-400">{review.jobTitleNameSnapshot}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={REVIEW_STATUS_LABELS[review.status].tone}>{REVIEW_STATUS_LABELS[review.status].label}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {review.finalPercentage !== null
                        ? `${Number(review.finalPercentage)}% — ${review.performanceLabelSnapshot ?? ""}`
                        : "—"}
                    </td>
                  </tr>
                  {review.evaluators.map((ev) => (
                    <tr key={ev.id}>
                      <td className="px-4 py-3 pr-8 text-slate-600">{ev.evaluator.fullName}</td>
                      <td className="px-4 py-3">{Number(ev.weightSnapshot)}%</td>
                      <td className="px-4 py-3">
                        <Badge tone={EVALUATOR_STATUS_LABELS[ev.status].tone}>{EVALUATOR_STATUS_LABELS[ev.status].label}</Badge>
                      </td>
                      <td className="px-4 py-3">{ev.overallPercentage !== null ? `${Number(ev.overallPercentage)}%` : "—"}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
