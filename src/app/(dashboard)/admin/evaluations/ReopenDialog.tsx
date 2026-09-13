"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reopenEvaluation } from "./actions";

export default function ReopenDialog({ reviewEvaluatorId }: { reviewEvaluatorId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-amber-600 hover:underline">
        إعادة فتح
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        ref={formRef}
        className="card w-full max-w-md space-y-4 p-6"
        action={(formData) => {
          setError(null);
          formData.set("reviewEvaluatorId", reviewEvaluatorId);
          startTransition(async () => {
            try {
              await reopenEvaluation(formData);
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "تعذّر إعادة الفتح");
            }
          });
        }}
      >
        <div className="font-semibold text-slate-800">إعادة فتح التقييم</div>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div>
          <label className="label-field">سبب إعادة الفتح (إلزامي)</label>
          <textarea name="reason" required minLength={5} rows={3} className="input-field" />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "جارِ التنفيذ..." : "تأكيد إعادة الفتح"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
