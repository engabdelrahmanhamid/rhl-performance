import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import NewCycleForm from "./NewCycleForm";
import CycleActions from "./CycleActions";

const STATUS_LABELS: Record<string, { label: string; tone: "slate" | "amber" | "green" | "blue" }> = {
  DRAFT: { label: "مسودة", tone: "slate" },
  UPCOMING: { label: "قادمة", tone: "amber" },
  OPEN: { label: "مفتوحة", tone: "green" },
  CLOSED: { label: "مغلقة", tone: "blue" },
};

export default async function EvaluationCyclesPage() {
  const cycles = await prisma.evaluationCycle.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { _count: { select: { reviews: true } } },
  });

  return (
    <div>
      <PageHeader title="دورات التقييم" description="كل شهر يمثل دورة تقييم مستقلة ومحفوظة تاريخيًا." />

      <div className="mb-6">
        <NewCycleForm />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">الاسم</th>
              <th className="px-4 py-3">الفترة</th>
              <th className="px-4 py-3">الموعد النهائي</th>
              <th className="px-4 py-3">عدد التقييمات</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cycles.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3 text-slate-500">
                  {c.periodStart.toLocaleDateString("ar-SA")} — {c.periodEnd.toLocaleDateString("ar-SA")}
                </td>
                <td className="px-4 py-3 text-slate-500">{c.deadline.toLocaleDateString("ar-SA")}</td>
                <td className="px-4 py-3">{c._count.reviews}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_LABELS[c.status].tone}>{STATUS_LABELS[c.status].label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/evaluation-cycles/${c.id}`} className="text-primary-600 hover:underline">
                      التفاصيل
                    </Link>
                    <CycleActions cycleId={c.id} status={c.status} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
