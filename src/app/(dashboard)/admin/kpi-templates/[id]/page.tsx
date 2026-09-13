import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { sumWeights } from "@/lib/services/scoring";
import { activateTemplate, deleteKpi } from "../actions";
import AddKpiForm from "./AddKpiForm";
import ActivateButton from "./ActivateButton";

const MEASUREMENT_LABELS: Record<string, string> = {
  NUMBER: "رقم",
  PERCENTAGE: "نسبة مئوية",
  CURRENCY: "قيمة مالية",
  RATING_1_5: "تقييم 1-5",
  SUBCRITERIA_RATING: "معايير فرعية",
};

export default async function KpiTemplateDetailPage({ params }: { params: { id: string } }) {
  const template = await prisma.kpiTemplate.findUnique({
    where: { id: params.id },
    include: {
      jobTitle: true,
      kpis: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { subcriteria: true } } } },
    },
  });
  if (!template) notFound();

  const total = sumWeights(template.kpis.map((k) => Number(k.weight)));
  const isValidTotal = total === 100;

  return (
    <div>
      <PageHeader
        title={`قالب مؤشرات: ${template.jobTitle.name}`}
        description={template.name}
        actions={
          <ActivateButton templateId={template.id} disabled={!isValidTotal || template.isActive} action={activateTemplate} />
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge tone={template.isActive ? "green" : "amber"}>{template.isActive ? "مفعّل حاليًا" : "غير مفعّل"}</Badge>
        <Badge tone={isValidTotal ? "green" : "red"}>مجموع الأوزان: {total}%</Badge>
      </div>

      <div className="card mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">الترتيب</th>
              <th className="px-4 py-3">اسم المؤشر</th>
              <th className="px-4 py-3">الوزن</th>
              <th className="px-4 py-3">نوع القياس</th>
              <th className="px-4 py-3">الاتجاه</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {template.kpis.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-3 text-slate-500">{k.sortOrder}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{k.name}</td>
                <td className="px-4 py-3">{Number(k.weight)}%</td>
                <td className="px-4 py-3">{MEASUREMENT_LABELS[k.measurementType]}</td>
                <td className="px-4 py-3 text-slate-500">
                  {k.direction === "HIGHER_IS_BETTER" ? "الأعلى أفضل" : "الأقل أفضل"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {k.measurementType === "SUBCRITERIA_RATING" && (
                      <Link href={`/admin/kpi-templates/kpi/${k.id}/subcriteria`} className="text-primary-600 hover:underline">
                        المعايير الفرعية ({k._count.subcriteria})
                      </Link>
                    )}
                    <form
                      action={async () => {
                        "use server";
                        await deleteKpi(k.id, template.id);
                      }}
                    >
                      <button className="text-red-500 hover:underline">حذف</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddKpiForm kpiTemplateId={template.id} />
    </div>
  );
}
