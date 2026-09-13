"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitEvaluation } from "../../actions";

export default function SubmitButton({ reviewEvaluatorId, disabled }: { reviewEvaluatorId: string; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button disabled={disabled} className="btn-primary" onClick={() => setConfirming(true)}>
          إرسال التقييم
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="card max-w-md space-y-4 p-6">
      <div className="font-semibold text-slate-800">تأكيد إرسال التقييم</div>
      <p className="text-sm text-slate-600">
        بعد الإرسال سيتم <span className="font-semibold text-red-600">قفل هذا التقييم نهائيًا</span> ولن تتمكن من تعديله
        إلا إذا أعادت الإدارة فتحه بسبب مسجَّل. هل أنت متأكد؟
      </p>
      <div className="flex gap-2">
        <button
          disabled={pending}
          className="btn-primary"
          onClick={() =>
            startTransition(async () => {
              try {
                await submitEvaluation(reviewEvaluatorId);
                router.push("/evaluator");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "تعذّر الإرسال");
                setConfirming(false);
              }
            })
          }
        >
          {pending ? "جارِ الإرسال..." : "نعم، أرسل التقييم"}
        </button>
        <button className="btn-secondary" onClick={() => setConfirming(false)}>
          تراجع
        </button>
      </div>
    </div>
  );
}
