import { redirect } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { createBranch } from "../actions";

export default function NewBranchPage() {
  async function action(formData: FormData) {
    "use server";
    await createBranch(formData);
    redirect("/admin/branches");
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="فرع جديد" />
      <form action={action} className="card space-y-4 p-6">
        <div>
          <label className="label-field">اسم الفرع</label>
          <input name="name" required className="input-field" placeholder="مثال: فرع جدة" />
        </div>
        <div>
          <label className="label-field">رمز الفرع</label>
          <input name="code" required className="input-field" placeholder="مثال: JED" dir="ltr" />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button type="submit" className="btn-primary">
            حفظ
          </button>
          <Link href="/admin/branches" className="btn-secondary">
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
