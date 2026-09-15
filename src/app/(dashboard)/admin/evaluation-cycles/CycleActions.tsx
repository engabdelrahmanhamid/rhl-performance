"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { openCycle, closeCycle, deleteCycle } from "./actions";

export default function CycleActions({ cycleId, status }: { cycleId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {status !== "CLOSED" && status !== "OPEN" && (
        <button
          disabled={pending}
          className="text-emerald-600 hover:underline"
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                const res = await openCycle(cycleId);
                const msg =
                  res.reviewsSkippedExisting > 0
                    ? `تم فتح الدورة: ${res.reviewsCreated} مراجعة جديدة (تجاوز ${res.reviewsSkippedExisting} موجودة مسبقًا).`
                    : `تم فتح الدورة وإنشاء ${res.reviewsCreated} مراجعة أداء.`;
                alert(msg);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "تعذّر فتح الدورة");
              }
            })
          }
        >
          فتح الدورة
        </button>
      )}
      {status === "OPEN" && (
        <button
          disabled={pending}
          className="text-slate-600 hover:underline"
          onClick={() =>
            startTransition(async () => {
              if (!confirm("هل أنت متأكد من إغلاق الدورة؟ لن يستطيع المقيّمون تعديل تقييماتهم بعد ذلك.")) return;
              await closeCycle(cycleId);
              router.refresh();
            })
          }
        >
          إغلاق الدورة
        </button>
      )}
      <button
        disabled={pending}
        className="text-red-600 hover:underline"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            if (!confirm("هل أنت متأكد من حذف هذه الدورة نهائيًا؟ هذا الإجراء لا يمكن التراجع عنه.")) return;
            try {
              await deleteCycle(cycleId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "تعذّر حذف الدورة");
            }
          })
        }
      >
        حذف الدورة
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
