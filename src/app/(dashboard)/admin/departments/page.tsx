import Link from "next/link";
import { Plus, Network } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { toggleDepartmentActive } from "./actions";

export default async function DepartmentsPage() {
  const departments = await prisma.department.findMany({
    orderBy: { createdAt: "asc" },
    include: { branchDepartments: { include: { branch: true } }, _count: { select: { employees: true } } },
  });

  return (
    <div>
      <PageHeader
        title="الأقسام"
        description="الأقسام اختيارية داخل الفرع وتُستخدم كمستوى وسيط في تحديد الأهداف ونطاق المقيّمين."
        actions={
          <Link href="/admin/departments/new" className="btn-primary">
            <Plus size={16} /> قسم جديد
          </Link>
        }
      />

      {departments.length === 0 ? (
        <EmptyState icon={Network} title="لا توجد أقسام بعد" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">الاسم</th>
                <th className="px-5 py-3">الفروع</th>
                <th className="px-5 py-3">عدد الموظفين</th>
                <th className="px-5 py-3">الحالة</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-800">{d.name}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {d.branchDepartments.length > 0 ? d.branchDepartments.map((bd) => bd.branch.name).join("، ") : "كل الفروع"}
                  </td>
                  <td className="px-5 py-3">{d._count.employees}</td>
                  <td className="px-5 py-3">
                    <Badge tone={d.isActive ? "green" : "slate"}>{d.isActive ? "مفعّل" : "معطّل"}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/departments/${d.id}/edit`} className="text-primary-600 hover:underline">
                        تعديل
                      </Link>
                      <form
                        action={async () => {
                          "use server";
                          await toggleDepartmentActive(d.id, !d.isActive);
                        }}
                      >
                        <button className="text-slate-500 hover:underline">{d.isActive ? "تعطيل" : "تفعيل"}</button>
                      </form>
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
