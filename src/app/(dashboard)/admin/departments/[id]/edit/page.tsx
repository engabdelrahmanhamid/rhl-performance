import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import { updateDepartment } from "../../actions";

export default async function EditDepartmentPage({ params }: { params: { id: string } }) {
  const [department, branches] = await Promise.all([
    prisma.department.findUnique({ where: { id: params.id }, include: { branchDepartments: true } }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  if (!department) notFound();

  const selectedBranchIds = department.branchDepartments.map((bd) => bd.branchId);

  async function action(formData: FormData) {
    "use server";
    await updateDepartment(params.id, formData);
    redirect("/admin/departments");
  }

  return (
    <div className="max-w-lg">
      <PageHeader title={`تعديل: ${department.name}`} />
      <form action={action} className="card space-y-4 p-6">
        <div>
          <label className="label-field">اسم القسم</label>
          <input name="name" required defaultValue={department.name} className="input-field" />
        </div>
        <div>
          <label className="label-field">الفروع (اختياري - اتركه فارغًا ليكون القسم متاحًا في كل الفروع)</label>
          <select name="branchIds" multiple defaultValue={selectedBranchIds} className="input-field h-32">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="btn-primary">
            حفظ التعديلات
          </button>
          <Link href="/admin/departments" className="btn-secondary">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
