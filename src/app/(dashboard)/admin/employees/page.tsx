import Link from "next/link";
import { Plus, Upload, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { archiveEmployee } from "./actions";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { q?: string; branchId?: string; jobTitleId?: string; status?: string };
}) {
  const [branches, jobTitles] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.jobTitle.findMany({ orderBy: { name: "asc" } }),
  ]);

  const employees = await prisma.employee.findMany({
    where: {
      archivedAt: null,
      ...(searchParams.branchId ? { branchId: searchParams.branchId } : {}),
      ...(searchParams.jobTitleId ? { jobTitleId: searchParams.jobTitleId } : {}),
      ...(searchParams.status ? { employmentStatus: searchParams.status as "ACTIVE" | "INACTIVE" } : {}),
      ...(searchParams.q
        ? {
            OR: [
              { fullName: { contains: searchParams.q, mode: "insensitive" } },
              { employeeNumber: { contains: searchParams.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { branch: true, department: true, jobTitle: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="الموظفون"
        description="السجل الأساسي للموظفين. لا يُحذف أي موظف لديه تقييمات تاريخية — يُؤرشف فقط."
        actions={
          <>
            <Link href="/admin/employees/import" className="btn-secondary">
              <Upload size={16} /> استيراد Excel
            </Link>
            <Link href="/admin/employees/new" className="btn-primary">
              <Plus size={16} /> موظف جديد
            </Link>
          </>
        }
      />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label-field">بحث</label>
          <input name="q" defaultValue={searchParams.q} placeholder="الاسم أو الرقم الوظيفي" className="input-field" />
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
            <option value="ACTIVE">نشط</option>
            <option value="INACTIVE">غير نشط</option>
          </select>
        </div>
        <button className="btn-secondary">تصفية</button>
      </form>

      {employees.length === 0 ? (
        <EmptyState icon={Users} title="لا يوجد موظفون مطابقون" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">الرقم الوظيفي</th>
                <th className="px-5 py-3">الاسم</th>
                <th className="px-5 py-3">الفرع</th>
                <th className="px-5 py-3">القسم</th>
                <th className="px-5 py-3">المسمى الوظيفي</th>
                <th className="px-5 py-3">الحالة</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-500" dir="ltr">
                    {e.employeeNumber}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-800">{e.fullName}</td>
                  <td className="px-5 py-3">{e.branch.name}</td>
                  <td className="px-5 py-3">{e.department?.name ?? "—"}</td>
                  <td className="px-5 py-3">{e.jobTitle.name}</td>
                  <td className="px-5 py-3">
                    <Badge tone={e.employmentStatus === "ACTIVE" ? "green" : "slate"}>
                      {e.employmentStatus === "ACTIVE" ? "نشط" : "غير نشط"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/reports/employee/${e.id}`} className="text-primary-600 hover:underline">
                        التقرير
                      </Link>
                      <Link href={`/admin/employees/${e.id}/edit`} className="text-primary-600 hover:underline">
                        تعديل
                      </Link>
                      <form
                        action={async () => {
                          "use server";
                          await archiveEmployee(e.id, true);
                        }}
                      >
                        <button className="text-slate-500 hover:underline">أرشفة</button>
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
