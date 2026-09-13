"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createCycle } from "./actions";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default function NewCycleForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} /> دورة جديدة
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-3"
      action={(formData) => {
        setError(null);
        const month = Number(formData.get("month"));
        const year = formData.get("year");
        if (!formData.get("name")) {
          formData.set("name", `تقييم ${MONTHS[month - 1]} ${year}`);
        }
        startTransition(async () => {
          try {
            await createCycle(formData);
            setOpen(false);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "تعذّر إنشاء الدورة");
          }
        });
      }}
    >
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-3">{error}</div>}
      <div className="sm:col-span-3">
        <label className="label-field">اسم الدورة (اختياري - يُولَّد تلقائيًا)</label>
        <input name="name" className="input-field" placeholder="مثال: تقييم سبتمبر 2026" />
      </div>
      <div>
        <label className="label-field">الشهر</label>
        <select name="month" required className="input-field" defaultValue={new Date().getMonth() + 1}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label-field">السنة</label>
        <input type="number" name="year" required defaultValue={new Date().getFullYear()} className="input-field" />
      </div>
      <div />
      <div>
        <label className="label-field">بداية فترة التقييم</label>
        <input type="date" name="periodStart" required className="input-field" />
      </div>
      <div>
        <label className="label-field">نهاية فترة التقييم</label>
        <input type="date" name="periodEnd" required className="input-field" />
      </div>
      <div>
        <label className="label-field">تاريخ فتح الدورة</label>
        <input type="date" name="openDate" required className="input-field" />
      </div>
      <div>
        <label className="label-field">الموعد النهائي (Deadline)</label>
        <input type="date" name="deadline" required className="input-field" />
      </div>
      <div className="flex items-center gap-2 sm:col-span-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "جارِ الحفظ..." : "إنشاء الدورة"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          إلغاء
        </button>
      </div>
    </form>
  );
}
