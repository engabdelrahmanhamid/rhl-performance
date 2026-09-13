import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import { updateJobTitle } from "../../actions";

export default async function EditJobTitlePage({ params }: { params: { id: string } }) {
  const jobTitle = await prisma.jobTitle.findUnique({ where: { id: params.id } });
  if (!jobTitle) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateJobTitle(params.id, formData);
    redirect("/admin/job-titles");
  }

  return (
    <div className="max-w-lg">
      <PageHeader title={`تعديل: ${jobTitle.name}`} />
      <form action={action} className="card space-y-4 p-6">
        <div>
          <label className="label-field">اسم المسمى الوظيفي</label>
          <input name="name" required defaultValue={jobTitle.name} className="input-field" />
        </div>
        <div>
          <label className="label-field">وصف (اختياري)</label>
          <textarea name="description" defaultValue={jobTitle.description ?? ""} className="input-field" rows={3} />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="btn-primary">
            حفظ التعديلات
          </button>
          <Link href="/admin/job-titles" className="btn-secondary">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
