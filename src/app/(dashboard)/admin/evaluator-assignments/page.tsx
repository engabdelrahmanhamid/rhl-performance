import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import AssignmentForm from "./AssignmentForm";
import { toggleAssignmentActive } from "./actions";
import { getAssignmentCoverage } from "@/lib/services/cycleOpening";

function describeRule(rule: {
  isAllEmployees: boolean;
  branch: { name: string } | null;
  department: { name: string } | null;
  jobTitle: { name: string } | null;
}): string {
  if (rule.isAllEmployees) return "كل الموظفين";
  const parts = [rule.branch?.name, rule.department?.name, rule.jobTitle?.name].filter(Boolean);
  return parts.length > 0 ? parts.join(" و") : "قاعدة فارغة (لا تطابق أحدًا)";
}

export default async function EvaluatorAssignmentsPage() {
  const [assignments, evaluators, branches, departments, jobTitles, employees, coverage] = await Promise.all([
    prisma.evaluatorAssignment.findMany({
      include: {
        evaluator: true,
        rules: { include: { branch: true, department: true, jobTitle: true } },
        specificEmployees: { include: { employee: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { role: "EVALUATOR" }, orderBy: { fullName: "asc" } }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.jobTitle.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { archivedAt: null }, orderBy: { fullName: "asc" } }),
    getAssignmentCoverage(),
  ]);

  const invalidCoverage = coverage.filter((c) => c.assignmentsCount > 0 && c.evaluatorWeightSum !== 100);

  return (
    <div>
      <PageHeader
        title="تعيينات المقيّمين"
        description="حدّد نطاق كل مقيّم ووزنه لكل موظف. مجموع أوزان كل المقيّمين لنفس الموظف يجب أن يساوي 100% تمامًا وقت فتح الدورة."
      />

      {invalidCoverage.length > 0 && (
        <div className="card mb-6 border-amber-200 bg-amber-50 p-5">
          <div className="mb-2 font-medium text-amber-800">
            {invalidCoverage.length} موظف لديه مجموع أوزان مقيّمين لا يساوي 100%:
          </div>
          <ul className="space-y-1 text-sm text-amber-700">
            {invalidCoverage.slice(0, 10).map((c) => (
              <li key={c.employeeId}>
                {c.employeeName}: {c.evaluatorWeightSum}% ({c.assignmentsCount} مقيّم)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6">
        <AssignmentForm
          evaluators={evaluators.map((e) => ({ id: e.id, name: e.fullName }))}
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
              <th className="px-4 py-3">المقيّم</th>
              <th className="px-4 py-3">الوصف</th>
              <th className="px-4 py-3">الوزن</th>
              <th className="px-4 py-3">النطاق</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{a.evaluator.fullName}</td>
                <td className="px-4 py-3 text-slate-500">{a.label ?? "—"}</td>
                <td className="px-4 py-3">{Number(a.defaultWeight)}%</td>
                <td className="px-4 py-3 text-slate-500">
                  {a.rules.map(describeRule).join(" أو ")}
                  {a.rules.length > 0 && a.specificEmployees.length > 0 && " + "}
                  {a.specificEmployees.length > 0 &&
                    `${a.specificEmployees.length} موظف محدد بالاسم (${a.specificEmployees
                      .slice(0, 3)
                      .map((se) => se.employee.fullName)
                      .join("، ")}${a.specificEmployees.length > 3 ? "..." : ""})`}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={a.isActive ? "green" : "slate"}>{a.isActive ? "مفعّل" : "معطّل"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <form
                    action={async () => {
                      "use server";
                      await toggleAssignmentActive(a.id, !a.isActive);
                    }}
                  >
                    <button className="text-slate-500 hover:underline">{a.isActive ? "تعطيل" : "تفعيل"}</button>
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
