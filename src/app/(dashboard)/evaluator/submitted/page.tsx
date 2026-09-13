import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ClipboardList } from "lucide-react";

export default async function SubmittedEvaluationsPage() {
  const session = await getServerSession(authOptions);

  const myEvaluations = await prisma.reviewEvaluator.findMany({
    where: { evaluatorId: session!.user.id, status: "SUBMITTED" },
    include: { review: { include: { cycle: true } } },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="التقييمات المُرسَلة" description="سجل كامل بتقييماتك السابقة عبر جميع الدورات." />

      {myEvaluations.length === 0 ? (
        <EmptyState icon={ClipboardList} title="لا توجد تقييمات مُرسَلة بعد" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">الموظف</th>
                <th className="px-4 py-3">الدورة</th>
                <th className="px-4 py-3">تاريخ الإرسال</th>
                <th className="px-4 py-3">النتيجة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myEvaluations.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{e.review.employeeNameSnapshot}</td>
                  <td className="px-4 py-3 text-slate-500">{e.review.cycle.name}</td>
                  <td className="px-4 py-3 text-slate-500">{e.submittedAt?.toLocaleDateString("ar-SA")}</td>
                  <td className="px-4 py-3">{e.overallPercentage !== null ? `${Number(e.overallPercentage).toFixed(1)}%` : "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/evaluator/review/${e.id}`} className="text-primary-600 hover:underline">
                      عرض
                    </Link>
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
