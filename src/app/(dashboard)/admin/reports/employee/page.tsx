import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { Download, FileText, User } from "lucide-react";
import { getEmployeeReport } from "@/lib/services/reports";

const STATUS_LABELS: Record<string, { label: string; tone: "slate" | "amber" | "green" }> = {
  NOT_STARTED: { label: "لم يبدأ", tone: "slate" },
  IN_PROGRESS: { label: "قيد التقييم", tone: "amber" },
  AWAITING_EVALUATIONS: { label: "بانتظار المقيّمين", tone: "amber" },
  COMPLETED: { label: "مكتملة", tone: "green" },
};

export default async function EmployeeReportPage({ searchParams }: { searchParams: { employeeId?: string } }) {
  const employees = await prisma.employee.findMany({
    where: { archivedAt: null },
    orderBy: { fullName: "asc" },
    include: { branch: true, jobTitle: true },
  });

  const selected = searchParams.employeeId ? employees.find((e) => e.id === searchParams.employeeId) : undefined;
  const rows = selected ? await getEmployeeReport(selected.id) : [];

  return (
    <div>
      <PageHeader
        title="تقرير الموظف"
        description="سجل النتائج النهائية لموظف واحد عبر كل الدورات المكتملة."
        actions={
          selected && (
            <>
              <a href={`/api/reports/employee/export?employeeId=${selected.id}`} className="btn-secondary">
                <Download size={16} /> تصدير Excel
              </a>
              <a href={`/api/reports/employee/export-pdf?employeeId=${selected.id}`} className="btn-secondary">
                <FileText size={16} /> تصدير PDF
              </a>
            </>
          )
        }
      />

      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[240px]">
          <label className="label-field">الموظف</label>
          <select name="employeeId" defaultValue={searchParams.employeeId ?? ""} className="input-field">
            <option value="">— اختر موظفًا —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} — {e.jobTitle.name} — {e.branch.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary">عرض التقرير</button>
      </form>

      {!selected ? (
        <EmptyState icon={User} title="اختر موظفًا لعرض تقريره" />
      ) : rows.length === 0 ? (
        <EmptyState icon={User} title="لا توجد مراجعات أداء لهذا الموظف بعد" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">الدورة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">النتيجة (من 5)</th>
                <th className="px-4 py-3">النسبة</th>
                <th className="px-4 py-3">التصنيف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.reviewId}>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.cycleName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_LABELS[r.status].tone}>{STATUS_LABELS[r.status].label}</Badge>
                  </td>
                  <td className="px-4 py-3">{r.finalScore !== null ? r.finalScore.toFixed(2) : "—"}</td>
                  <td className="px-4 py-3">{r.finalPercentage !== null ? `${r.finalPercentage.toFixed(1)}%` : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.performanceLabel ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
