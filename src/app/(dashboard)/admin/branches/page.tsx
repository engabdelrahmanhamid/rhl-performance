import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { toggleBranchActive } from "./actions";

export default async function BranchesPage() {
  const branches = await prisma.branch.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { employees: true, branchDepartments: true } } },
  });

  return (
    <div>
      <PageHeader
        title="الفروع"
        description="إدارة فروع المكتب. الفروع بيانات قابلة للتعديل بالكامل ولا تعتمد على قيم ثابتة في الكود."
        actions={
          <Link href="/admin/branches/new" className="btn-primary">
            <Plus size={16} /> فرع جديد
          </Link>
        }
      />

      {branches.length === 0 ? (
        <EmptyState icon={Building2} title="لا توجد فروع بعد" description='ابدأ بإضافة أول فرع من زر "فرع جديد".' />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">الاسم</th>
                <th className="px-5 py-3">الرمز</th>
                <th className="px-5 py-3">عدد الموظفين</th>
                <th className="px-5 py-3">عدد الأقسام</th>
                <th className="px-5 py-3">الحالة</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-800">{b.name}</td>
                  <td className="px-5 py-3 text-slate-500" dir="ltr">
                    {b.code}
                  </td>
                  <td className="px-5 py-3">{b._count.employees}</td>
                  <td className="px-5 py-3">{b._count.branchDepartments}</td>
                  <td className="px-5 py-3">
                    <Badge tone={b.isActive ? "green" : "slate"}>{b.isActive ? "مفعّل" : "معطّل"}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/branches/${b.id}/edit`} className="text-primary-600 hover:underline">
                        تعديل
                      </Link>
                      <form
                        action={async () => {
                          "use server";
                          await toggleBranchActive(b.id, !b.isActive);
                        }}
                      >
                        <button className="text-slate-500 hover:underline">
                          {b.isActive ? "تعطيل" : "تفعيل"}
                        </button>
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
