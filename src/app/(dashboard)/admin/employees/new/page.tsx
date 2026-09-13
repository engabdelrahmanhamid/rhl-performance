import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import { createEmployee } from "../actions";

export default async function NewEmployeePage() {
  const [branches, departments, jobTitles] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.jobTitle.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  async function action(formData: FormData) {
    "use server";
    await createEmployee(formData);
    redirect("/admin/employees");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="موظف جديد" />
      <form action={action} className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className="label-field">الرقم الوظيفي</label>
          <input name="employeeNumber" required className="input-field" dir="ltr" />
        </div>
        <div>
          <label className="label-field">الاسم الكامل</label>
          <input name="fullName" required className="input-field" />
        </div>
        <div>
          <label className="label-field">الفرع</label>
          <select name="branchId" required className="input-field">
            <option value="">اختر الفرع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">القسم (اختياري)</label>
          <select name="departmentId" className="input-field">
            <option value="">— بدون —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">المسمى الوظيفي</label>
          <select name="jobTitleId" required className="input-field">
            <option value="">اختر المسمى</option>
            {jobTitles.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">حالة التوظيف</label>
          <select name="employmentStatus" className="input-field" defaultValue="ACTIVE">
            <option value="ACTIVE">نشط</option>
            <option value="INACTIVE">غير نشط</option>
          </select>
        </div>
        <div>
          <label className="label-field">تاريخ التعيين</label>
          <input type="date" name="hireDate" required className="input-field" />
        </div>
        <div>
          <label className="label-field">البريد الإلكتروني (اختياري)</label>
          <input type="email" name="email" className="input-field" dir="ltr" />
        </div>
        <div>
          <label className="label-field">الجوال (اختياري)</label>
          <input name="phone" className="input-field" dir="ltr" />
        </div>
        <div className="sm:col-span-2">
          <label className="label-field">ملاحظات (اختياري)</label>
          <textarea name="notes" rows={3} className="input-field" />
        </div>
        <div className="flex items-center gap-2 pt-2 sm:col-span-2">
          <button type="submit" className="btn-primary">
            حفظ
          </button>
          <Link href="/admin/employees" className="btn-secondary">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
