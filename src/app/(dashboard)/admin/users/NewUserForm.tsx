"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createUser } from "./actions";

export default function NewUserForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} /> مستخدم جديد
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          try {
            await createUser(formData);
            formRef.current?.reset();
            setOpen(false);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "تعذّر إنشاء المستخدم");
          }
        });
      }}
    >
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-4">{error}</div>}
      <div>
        <label className="label-field">الاسم الكامل</label>
        <input name="fullName" required className="input-field" />
      </div>
      <div>
        <label className="label-field">البريد الإلكتروني</label>
        <input type="email" name="email" required className="input-field" dir="ltr" />
      </div>
      <div>
        <label className="label-field">كلمة المرور المبدئية</label>
        <input type="password" name="password" required minLength={8} className="input-field" dir="ltr" />
      </div>
      <div>
        <label className="label-field">الدور</label>
        <select name="role" className="input-field" defaultValue="EVALUATOR">
          <option value="EVALUATOR">مقيّم</option>
          <option value="SUPER_ADMIN">مدير النظام</option>
        </select>
      </div>
      <div className="flex items-center gap-2 sm:col-span-4">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "جارِ الحفظ..." : "حفظ"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          إلغاء
        </button>
      </div>
    </form>
  );
}
