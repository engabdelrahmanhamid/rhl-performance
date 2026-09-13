import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { ClipboardList } from "lucide-react";
import ReopenDialog from "./ReopenDialog";

const STATUS_LABELS: Record<string, { label: string; tone: "slate" | "amber" | "green" }> = {
  NOT_STARTED: { label: "لم يبدأ", tone: "slate" },
  DRAFT: { label: "مسودة", tone: "amber" },
  SUBMITTED: { label: "مُرسَل", tone: "green" },
  REOPENED: { label: "أُعيد فتحه", tone: "amber" },
};

export default async function AdminEvaluationsPage({
  searchParams,
}: {
  searchParams: { cycleId?: string; status?: string };
}) {
  const cycles = await prisma.evaluationCycle.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] });
  const defaultCycleId = searchParams.cycleId ?? cycles[0]?.id;

  const evaluations = defaultCycleId
    ? await prisma.reviewEvaluator.findMany({
        where: {
          review: { cycleId: defaultCycleId },
          ...(searchParams.status ? { status: searchParams.status as never } : {}),
        },
        include: { review: true, evaluator: true },
        orderBy: { review: { employeeNameSnapshot: "asc" } },
      })
    : [];

  return (
    <div>
      <PageHeader title="جميع التقييمات" description="عرض كل مساهمات المقيّمين عبر الدورات، وإعادة فتح أي مساهمة مُرسَلة بسبب مسجَّل." />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label-field">الدورة</label>
          <select name="cycleId" defaultValue={defaultCycleId} className="input-field">
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">الحالة</label>
          <select name="status" defaultValue={searchParams.status ?? ""} className="input-field">
            <option value="">الكل</option>
            <option value="NOT_STARTED">لم يبدأ</option>
            <option value="DRAFT">مسودة</option>
            <option value="SUBMITTED">مُرسَل</option>
            <option value="REOPENED">أُعيد فتحه</option>
          </select>
        </div>
        <button className="btn-secondary">تصفية</button>
      </form>

      {evaluations.length === 0 ? (
        <EmptyState icon={ClipboardList} title="لا توجد تقييمات مطابقة" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">الموظف</th>
                <th className="px-4 py-3">المقيّم</th>
                <th className="px-4 py-3">الوزن</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">النتيجة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evaluations.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{e.review.employeeNameSnapshot}</td>
                  <td className="px-4 py-3 text-slate-500">{e.evaluator.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{Number(e.weightSnapshot)}%</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_LABELS[e.status].tone}>{STATUS_LABELS[e.status].label}</Badge>
                  </td>
                  <td className="px-4 py-3">{e.overallPercentage !== null ? `${Number(e.overallPercentage).toFixed(1)}%` : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/evaluator/review/${e.id}`} className="text-primary-600 hover:underline">
                        عرض
                      </Link>
                      {e.status === "SUBMITTED" && <ReopenDialog reviewEvaluatorId={e.id} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
