import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import { createDepartment } from "../actions";

export default async function NewDepartmentPage() {
  const branches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  async function action(formData: FormData) {
    "use server";
    await createDepartment(formData);
    redirect("/admin/departments");
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="قسم جديد" />
      <form action={action} className="card space-y-4 p-6">
        <div>
          <label className="label-field">اسم القسم</label>
          <input name="name" required className="input-field" />
        </div>
        <div>
          <label className="label-field">الفروع (اختياري - اتركه فارغًا ليكون القسم متاحًا في كل الفروع)</label>
          <select name="branchIds" multiple className="input-field h-32">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="btn-primary">
            حفظ
          </button>
          <Link href="/admin/departments" className="btn-secondary">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
