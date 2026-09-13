import Link from "next/link";
import { Plus, Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { toggleJobTitleActive } from "./actions";

export default async function JobTitlesPage() {
  const jobTitles = await prisma.jobTitle.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { employees: true } }, kpiTemplates: { where: { isActive: true } } },
  });

  return (
    <div>
      <PageHeader
        title="المسميات الوظيفية"
        description="لكل مسمى وظيفي قالب KPI مستقل. يمكن إضافة مسميات جديدة في أي وقت."
        actions={
          <Link href="/admin/job-titles/new" className="btn-primary">
            <Plus size={16} /> مسمى جديد
          </Link>
        }
      />

      {jobTitles.length === 0 ? (
        <EmptyState icon={Briefcase} title="لا توجد مسميات وظيفية بعد" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">المسمى</th>
                <th className="px-5 py-3">عدد الموظفين</th>
                <th className="px-5 py-3">قالب KPI نشط</th>
                <th className="px-5 py-3">الحالة</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobTitles.map((jt) => (
                <tr key={jt.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-800">{jt.name}</td>
                  <td className="px-5 py-3">{jt._count.employees}</td>
                  <td className="px-5 py-3">
                    {jt.kpiTemplates.length > 0 ? (
                      <Badge tone="green">مفعّل</Badge>
                    ) : (
                      <Badge tone="amber">غير مفعّل - يتطلب مراجعة</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={jt.isActive ? "green" : "slate"}>{jt.isActive ? "مفعّل" : "معطّل"}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/kpi-templates?jobTitleId=${jt.id}`} className="text-primary-600 hover:underline">
                        قالب KPI
                      </Link>
                      <Link href={`/admin/job-titles/${jt.id}/edit`} className="text-primary-600 hover:underline">
                        تعديل
                      </Link>
                      <form
                        action={async () => {
                          "use server";
                          await toggleJobTitleActive(jt.id, !jt.isActive);
                        }}
                      >
                        <button className="text-slate-500 hover:underline">{jt.isActive ? "تعطيل" : "تفعيل"}</button>
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
