import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import TargetForm from "./TargetForm";
import { deleteTarget } from "./actions";

const LEVEL_LABELS: Record<string, string> = {
  GLOBAL: "عام",
  BRANCH: "فرع",
  DEPARTMENT: "قسم",
  JOB_TITLE: "مسمى وظيفي",
  EMPLOYEE: "موظف",
};

export default async function TargetsPage() {
  const [kpis, branches, departments, jobTitles, employees, targets] = await Promise.all([
    prisma.kpi.findMany({
      where: { kpiTemplate: { isActive: true } },
      include: { kpiTemplate: { include: { jobTitle: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.jobTitle.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { archivedAt: null }, orderBy: { fullName: "asc" } }),
    prisma.target.findMany({
      include: { kpi: true, branch: true, department: true, jobTitle: true, employee: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 100,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="الأهداف (Targets)"
        description="ترتيب الأولوية عند التعارض: موظف ← مسمى وظيفي ← قسم ← فرع ← عام. لا تُخترع قيمة افتراضية لأي هدف غير محدد."
      />

      <div className="mb-6">
        <TargetForm
          kpis={kpis.map((k) => ({
            id: k.id,
            name: k.name,
            jobTitleId: k.kpiTemplate.jobTitleId,
            jobTitleName: k.kpiTemplate.jobTitle.name,
          }))}
          branches={branches}
          departments={departments}
          jobTitles={jobTitles}
          employees={employees.map((e) => ({ id: e.id, name: e.fullName }))}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">المؤشر</th>
              <th className="px-4 py-3">المستوى</th>
              <th className="px-4 py-3">النطاق</th>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3">الشهر/السنة</th>
              <th className="px-4 py-3">القيمة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {targets.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{t.kpi.name}</td>
                <td className="px-4 py-3">{LEVEL_LABELS[t.scopeType]}</td>
                <td className="px-4 py-3 text-slate-500">
                  {t.branch?.name ?? t.department?.name ?? t.jobTitle?.name ?? t.employee?.fullName ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {t.applicationMode === "AGGREGATE" ? (
                    <Badge tone="amber">إجمالي</Badge>
                  ) : (
                    <Badge tone="slate">فردي</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {t.month}/{t.year}
                </td>
                <td className="px-4 py-3">{Number(t.value)}</td>
                <td className="px-4 py-3">
                  <form
                    action={async () => {
                      "use server";
                      await deleteTarget(t.id);
                    }}
                  >
                    <button className="text-red-500 hover:underline">حذف</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
