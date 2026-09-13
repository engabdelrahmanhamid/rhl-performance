import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { Users } from "lucide-react";

export default async function AssignedEmployeesPage({
  searchParams,
}: {
  searchParams: { q?: string; branchId?: string; jobTitleId?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const currentCycle = await prisma.evaluationCycle.findFirst({ where: { status: "OPEN" }, orderBy: { openDate: "desc" } });
  const [branches, jobTitles] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.jobTitle.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const myEvaluations = currentCycle
    ? await prisma.reviewEvaluator.findMany({
        where: {
          evaluatorId: userId,
          ...(searchParams.status ? { status: searchParams.status as never } : {}),
          review: {
            cycleId: currentCycle.id,
            ...(searchParams.branchId ? { branchIdSnapshot: searchParams.branchId } : {}),
            ...(searchParams.jobTitleId ? { jobTitleIdSnapshot: searchParams.jobTitleId } : {}),
            ...(searchParams.q ? { employeeNameSnapshot: { contains: searchParams.q, mode: "insensitive" } } : {}),
          },
        },
        include: { review: true },
        orderBy: { review: { employeeNameSnapshot: "asc" } },
      })
    : [];

  return (
    <div>
      <PageHeader title="الموظفون المكلَّف بهم" description={currentCycle?.name ?? "لا توجد دورة مفتوحة"} />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label-field">بحث</label>
          <input name="q" defaultValue={searchParams.q} className="input-field" placeholder="اسم الموظف" />
        </div>
        <div>
          <label className="label-field">الفرع</label>
          <select name="branchId" defaultValue={searchParams.branchId ?? ""} className="input-field">
            <option value="">الكل</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">المسمى الوظيفي</label>
          <select name="jobTitleId" defaultValue={searchParams.jobTitleId ?? ""} className="input-field">
            <option value="">الكل</option>
            {jobTitles.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">الحالة</label>
          <select name="status" defaultValue={searchParams.status ?? ""} className="input-field">
            <option value="">الكل</option>
            <option value="NOT_STARTED">لم يبدأ</option>
            <option value="DRAFT">قيد التقييم</option>
            <option value="SUBMITTED">مكتمل</option>
          </select>
        </div>
        <button className="btn-secondary">تصفية</button>
      </form>

      {myEvaluations.length === 0 ? (
        <EmptyState icon={Users} title="لا يوجد موظفون مطابقون" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">الموظف</th>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">المسمى الوظيفي</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myEvaluations.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{e.review.employeeNameSnapshot}</td>
                  <td className="px-4 py-3 text-slate-500">{e.review.branchNameSnapshot}</td>
                  <td className="px-4 py-3 text-slate-500">{e.review.jobTitleNameSnapshot}</td>
                  <td className="px-4 py-3">
                    <Badge tone={e.status === "SUBMITTED" ? "green" : e.status === "NOT_STARTED" ? "slate" : "amber"}>
                      {{ NOT_STARTED: "لم يبدأ", DRAFT: "قيد التقييم", SUBMITTED: "مكتمل", REOPENED: "أُعيد فتحه" }[e.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={e.status === "SUBMITTED" ? `/evaluator/review/${e.id}` : `/evaluator/evaluate/${e.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      {e.status === "SUBMITTED" ? "عرض" : "تقييم"}
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
