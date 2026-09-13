import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { sumWeights } from "@/lib/services/scoring";
import { createKpiTemplateForJobTitle } from "./actions";

export default async function KpiTemplatesPage() {
  const jobTitles = await prisma.jobTitle.findMany({
    orderBy: { name: "asc" },
    include: { kpiTemplates: { include: { kpis: true }, orderBy: { version: "desc" } } },
  });

  return (
    <div>
      <PageHeader title="قوالب KPI" description="كل مسمى وظيفي له قالب مؤشرات مستقل. مجموع الأوزان يجب أن يساوي 100% قبل التفعيل." />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3">المسمى الوظيفي</th>
              <th className="px-5 py-3">القالب النشط</th>
              <th className="px-5 py-3">مجموع الأوزان</th>
              <th className="px-5 py-3">عدد المؤشرات</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobTitles.map((jt) => {
              const activeTemplate = jt.kpiTemplates.find((t) => t.isActive) ?? jt.kpiTemplates[0];
              const total = activeTemplate ? sumWeights(activeTemplate.kpis.map((k) => Number(k.weight))) : 0;
              return (
                <tr key={jt.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-800">{jt.name}</td>
                  <td className="px-5 py-3">
                    {activeTemplate ? (
                      <Badge tone={activeTemplate.isActive ? "green" : "amber"}>
                        {activeTemplate.isActive ? "مفعّل" : "مسودة - غير مفعّل"}
                      </Badge>
                    ) : (
                      <Badge tone="red">لا يوجد قالب</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={total === 100 ? "text-emerald-600" : "text-amber-600"}>{total}%</span>
                  </td>
                  <td className="px-5 py-3">{activeTemplate?.kpis.length ?? 0}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {activeTemplate ? (
                        <Link href={`/admin/kpi-templates/${activeTemplate.id}`} className="text-primary-600 hover:underline">
                          إدارة المؤشرات
                        </Link>
                      ) : (
                        <form
                          action={async () => {
                            "use server";
                            await createKpiTemplateForJobTitle(jt.id);
                          }}
                        >
                          <button className="text-primary-600 hover:underline">إنشاء قالب</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
