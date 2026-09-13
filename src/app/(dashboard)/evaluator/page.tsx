import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { ClipboardList, CheckCircle2, Clock, ListTodo, CalendarX } from "lucide-react";

export default async function EvaluatorDashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const currentCycle = await prisma.evaluationCycle.findFirst({
    where: { status: "OPEN" },
    orderBy: { openDate: "desc" },
  });

  if (!currentCycle) {
    return (
      <div>
        <PageHeader title={`مرحبًا، ${session!.user.name}`} />
        <EmptyState
          icon={CalendarX}
          title="لا توجد دورة تقييم مفتوحة حاليًا"
          description="سيظهر هنا تقييماتك بمجرد أن تفتح الإدارة دورة التقييم الشهرية."
        />
      </div>
    );
  }

  const myEvaluations = await prisma.reviewEvaluator.findMany({
    where: { evaluatorId: userId, review: { cycleId: currentCycle.id } },
    include: { review: true },
    orderBy: { review: { employeeNameSnapshot: "asc" } },
  });

  const completed = myEvaluations.filter((e) => e.status === "SUBMITTED").length;
  const inProgress = myEvaluations.filter((e) => e.status === "DRAFT" || e.status === "REOPENED").length;
  const notStarted = myEvaluations.filter((e) => e.status === "NOT_STARTED").length;
  const total = myEvaluations.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <PageHeader title={`مرحبًا، ${session!.user.name}`} description={currentCycle.name} />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="المطلوب مني" value={total} icon={ListTodo} />
        <StatCard label="المكتمل" value={completed} icon={CheckCircle2} tone="success" />
        <StatCard label="قيد التقييم" value={inProgress} icon={Clock} tone="warning" />
        <StatCard label="المتبقي" value={notStarted} icon={ClipboardList} />
      </div>

      <div className="card mb-6 p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">نسبة الإنجاز</span>
          <span className="text-slate-500">{progressPct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {myEvaluations.length === 0 ? (
        <EmptyState icon={ClipboardList} title="لا يوجد موظفون مكلَّف بتقييمهم في هذه الدورة" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myEvaluations.map((e) => (
            <div key={e.id} className="card p-5">
              <div className="mb-3">
                <div className="font-semibold text-slate-800">{e.review.employeeNameSnapshot}</div>
                <div className="text-sm text-slate-500">
                  {e.review.jobTitleNameSnapshot} — {e.review.branchNameSnapshot}
                </div>
              </div>
              <div className="mb-4">
                {e.status === "NOT_STARTED" && <span className="badge bg-slate-100 text-slate-600">لم يبدأ</span>}
                {e.status === "DRAFT" && <span className="badge bg-amber-100 text-amber-700">قيد التقييم</span>}
                {e.status === "REOPENED" && <span className="badge bg-amber-100 text-amber-700">أُعيد فتحه للتعديل</span>}
                {e.status === "SUBMITTED" && <span className="badge bg-emerald-100 text-emerald-700">مكتمل</span>}
              </div>
              {e.status === "SUBMITTED" ? (
                <Link href={`/evaluator/review/${e.id}`} className="btn-secondary w-full">
                  عرض بعد الإرسال
                </Link>
              ) : (
                <Link href={`/evaluator/evaluate/${e.id}`} className="btn-primary w-full">
                  {e.status === "NOT_STARTED" ? "ابدأ التقييم" : "استكمال"}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
