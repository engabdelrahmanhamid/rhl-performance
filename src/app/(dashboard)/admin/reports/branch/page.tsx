import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { Download, FileText, Building2, Users, CheckCircle2, Percent } from "lucide-react";
import { getBranchReport } from "@/lib/services/reports";

export default async function BranchReportPage({ searchParams }: { searchParams: { branchId?: string; cycleId?: string } }) {
  const [branches, cycles] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.evaluationCycle.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] }),
  ]);

  const branchId = searchParams.branchId;
  const cycleId = searchParams.cycleId ?? cycles[0]?.id;
  const branch = branchId ? branches.find((b) => b.id === branchId) : undefined;
  const report = branch && cycleId ? await getBranchReport(branch.id, cycleId) : null;

  return (
    <div>
      <PageHeader
        title="تقرير الفرع"
        description="ملخص مجمَّع فقط - بلا أي ترتيب أو مقارنة بين الموظفين."
        actions={
          report && (
            <>
              <a href={`/api/reports/branch/export?branchId=${branch!.id}&cycleId=${cycleId}`} className="btn-secondary">
                <Download size={16} /> تصدير Excel
              </a>
              <a href={`/api/reports/branch/export-pdf?branchId=${branch!.id}&cycleId=${cycleId}`} className="btn-secondary">
                <FileText size={16} /> تصدير PDF
              </a>
            </>
          )
        }
      />

      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px]">
          <label className="label-field">الفرع</label>
          <select name="branchId" defaultValue={branchId ?? ""} className="input-field">
            <option value="">— اختر فرعًا —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className="label-field">الدورة</label>
          <select name="cycleId" defaultValue={cycleId ?? ""} className="input-field">
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary">عرض التقرير</button>
      </form>

      {!branch ? (
        <EmptyState icon={Building2} title="اختر فرعًا ودورة لعرض التقرير" />
      ) : !report || report.totalReviews === 0 ? (
        <EmptyState icon={Building2} title="لا توجد مراجعات أداء لهذا الفرع في هذه الدورة" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="إجمالي المراجعات" value={report.totalReviews} icon={Users} />
            <StatCard label="مكتملة" value={report.completedReviews} icon={CheckCircle2} tone="success" />
            <StatCard label="نسبة الإنجاز" value={`${report.completionPct}%`} icon={Percent} />
            <StatCard
              label="متوسط النتيجة"
              value={report.averageFinalPercentage !== null ? `${report.averageFinalPercentage.toFixed(1)}%` : "—"}
              icon={Building2}
              tone="default"
            />
          </div>

          {report.labelDistribution.length > 0 && (
            <div className="card mb-6 p-5">
              <div className="mb-3 font-semibold text-slate-800">توزيع التصنيفات (للمراجعات المكتملة فقط)</div>
              <div className="flex flex-wrap gap-4">
                {report.labelDistribution.map((l) => (
                  <div key={l.label} className="rounded-xl bg-slate-50 px-4 py-3 text-center">
                    <div className="text-2xl font-bold text-slate-800">{l.count}</div>
                    <div className="text-sm text-slate-500">{l.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.metricRollups.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-100 p-5 font-semibold text-slate-800">مجاميع مقاييس التقارير (ReportingMetric)</div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">المقياس</th>
                    <th className="px-4 py-3">طريقة التجميع</th>
                    <th className="px-4 py-3">القيمة</th>
                    <th className="px-4 py-3">عدد العينات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.metricRollups.map((m) => (
                    <tr key={m.code}>
                      <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                      <td className="px-4 py-3 text-slate-500">{m.aggregationMethod}</td>
                      <td className="px-4 py-3">
                        {m.value !== null ? m.value.toLocaleString("ar-SA", { maximumFractionDigits: 2 }) : "—"} {m.unit ?? ""}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{m.sampleCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
