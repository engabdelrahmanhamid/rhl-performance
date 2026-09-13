"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addKpi } from "../actions";

export default function AddKpiForm({ kpiTemplateId }: { kpiTemplateId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      ref={formRef}
      className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-3"
      action={(formData) =>
        startTransition(async () => {
          await addKpi(formData);
          formRef.current?.reset();
          router.refresh();
        })
      }
    >
      <input type="hidden" name="kpiTemplateId" value={kpiTemplateId} />
      <div className="sm:col-span-3 font-medium text-slate-800">إضافة مؤشر جديد</div>
      <div className="sm:col-span-2">
        <label className="label-field">اسم المؤشر</label>
        <input name="name" required className="input-field" />
      </div>
      <div>
        <label className="label-field">الوزن (%)</label>
        <input type="number" name="weight" step="0.01" min="0.01" max="100" required className="input-field" />
      </div>
      <div>
        <label className="label-field">نوع القياس</label>
        <select name="measurementType" className="input-field" defaultValue="NUMBER">
          <option value="NUMBER">رقم</option>
          <option value="PERCENTAGE">نسبة مئوية</option>
          <option value="CURRENCY">قيمة مالية</option>
          <option value="RATING_1_5">تقييم 1-5</option>
          <option value="SUBCRITERIA_RATING">معايير فرعية</option>
        </select>
      </div>
      <div>
        <label className="label-field">الاتجاه</label>
        <select name="direction" className="input-field" defaultValue="HIGHER_IS_BETTER">
          <option value="HIGHER_IS_BETTER">الأعلى أفضل</option>
          <option value="LOWER_IS_BETTER">الأقل أفضل</option>
        </select>
      </div>
      <div>
        <label className="label-field">ترتيب العرض</label>
        <input type="number" name="sortOrder" defaultValue={0} className="input-field" />
      </div>
      <div className="sm:col-span-3">
        <label className="label-field">تعليمات القياس (اختياري)</label>
        <textarea name="measurementInstructions" rows={2} className="input-field" />
      </div>
      <div className="sm:col-span-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "جارِ الإضافة..." : "إضافة المؤشر"}
        </button>
      </div>
    </form>
  );
}
