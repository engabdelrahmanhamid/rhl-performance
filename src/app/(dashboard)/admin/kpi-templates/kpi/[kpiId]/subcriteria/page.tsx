import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import { sumWeights } from "@/lib/services/scoring";
import { addSubcriterion, deleteSubcriterion } from "../../../actions";

export default async function SubcriteriaPage({ params }: { params: { kpiId: string } }) {
  const kpi = await prisma.kpi.findUnique({
    where: { id: params.kpiId },
    include: { subcriteria: { orderBy: { sortOrder: "asc" } }, kpiTemplate: { include: { jobTitle: true } } },
  });
  if (!kpi) notFound();

  const weighted = kpi.subcriteria.filter((s) => s.weight !== null);
  const totalWeight = weighted.length > 0 ? sumWeights(weighted.map((s) => Number(s.weight))) : null;

  async function action(formData: FormData) {
    "use server";
    await addSubcriterion(formData);
  }

  return (
    <div>
      <PageHeader
        title={`المعايير الفرعية: ${kpi.name}`}
        description={`${kpi.kpiTemplate.jobTitle.name} — إذا لم تُحدَّد أوزان يُستخدم المتوسط الحسابي البسيط.`}
        actions={
          <Link href={`/admin/kpi-templates/${kpi.kpiTemplateId}`} className="btn-secondary">
            رجوع للقالب
          </Link>
        }
      />

      {totalWeight !== null && (
        <div className="mb-4">
          <span className={totalWeight === 100 ? "text-emerald-600" : "text-red-600"}>
            مجموع الأوزان المحدّدة: {totalWeight}% {totalWeight !== 100 && "(يجب أن يساوي 100% إذا استخدمت أوزانًا)"}
          </span>
        </div>
      )}

      <div className="card mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">الاسم</th>
              <th className="px-4 py-3">الوصف</th>
              <th className="px-4 py-3">الوزن</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kpi.subcriteria.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                <td className="px-4 py-3 text-slate-500">{s.description ?? "—"}</td>
                <td className="px-4 py-3">{s.weight !== null ? `${Number(s.weight)}%` : "بدون وزن (متوسط)"}</td>
                <td className="px-4 py-3">
                  <form
                    action={async () => {
                      "use server";
                      await deleteSubcriterion(s.id, kpi.id);
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

      <form action={action} className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-4">
        <input type="hidden" name="kpiId" value={kpi.id} />
        <div className="sm:col-span-2">
          <label className="label-field">اسم المعيار الفرعي</label>
          <input name="name" required className="input-field" />
        </div>
        <div>
          <label className="label-field">الوزن % (اختياري)</label>
          <input type="number" name="weight" step="0.01" min="0" max="100" className="input-field" />
        </div>
        <div>
          <label className="label-field">ترتيب العرض</label>
          <input type="number" name="sortOrder" defaultValue={0} className="input-field" />
        </div>
        <div className="sm:col-span-4">
          <label className="label-field">وصف (اختياري)</label>
          <textarea name="description" rows={2} className="input-field" />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            إضافة معيار فرعي
          </button>
        </div>
      </form>
    </div>
  );
}
