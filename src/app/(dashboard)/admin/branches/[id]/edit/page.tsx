import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import { updateBranch } from "../../actions";

export default async function EditBranchPage({ params }: { params: { id: string } }) {
  const branch = await prisma.branch.findUnique({ where: { id: params.id } });
  if (!branch) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateBranch(params.id, formData);
    redirect("/admin/branches");
  }

  return (
    <div className="max-w-lg">
      <PageHeader title={`تعديل: ${branch.name}`} />
      <form action={action} className="card space-y-4 p-6">
        <div>
          <label className="label-field">اسم الفرع</label>
          <input name="name" required defaultValue={branch.name} className="input-field" />
        </div>
        <div>
          <label className="label-field">رمز الفرع</label>
          <input name="code" required defaultValue={branch.code} className="input-field" dir="ltr" />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="btn-primary">
            حفظ التعديلات
          </button>
          <Link href="/admin/branches" className="btn-secondary">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
