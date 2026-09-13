"use client";

import Link from "next/link";
import { useState } from "react";
import { Save } from "lucide-react";

export default function BottomBar({ reviewEvaluatorId }: { reviewEvaluatorId: string }) {
  const [savedNote, setSavedNote] = useState(false);

  return (
    <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      <button
        className="btn-secondary"
        onClick={() => {
          setSavedNote(true);
          setTimeout(() => setSavedNote(false), 2000);
        }}
      >
        <Save size={16} /> {savedNote ? "تم الحفظ التلقائي بالفعل ✓" : "حفظ كمسودة"}
      </button>
      <Link href={`/evaluator/review/${reviewEvaluatorId}`} className="btn-primary">
        مراجعة التقييم
      </Link>
    </div>
  );
}
