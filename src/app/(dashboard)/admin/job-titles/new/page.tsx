import { redirect } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { createJobTitle } from "../actions";

export default function NewJobTitlePage() {
  async function action(formData: FormData) {
    "use server";
    await createJobTitle(formData);
    redirect("/admin/job-titles");
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="مسمى وظيفي جديد" />
      <form action={action} className="card space-y-4 p-6">
        <div>
          <label className="label-field">اسم المسمى الوظيفي</label>
          <input name="name" required className="input-field" />
        </div>
        <div>
          <label className="label-field">وصف (اختياري)</label>
          <textarea name="description" className="input-field" rows={3} />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="btn-primary">
            حفظ
          </button>
          <Link href="/admin/job-titles" className="btn-secondary">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
