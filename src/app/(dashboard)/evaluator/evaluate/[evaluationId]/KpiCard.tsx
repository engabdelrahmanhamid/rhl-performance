"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Paperclip, Check, Loader2 } from "lucide-react";
import { saveActualValue, saveItemFields, saveSubcriterionScore, uploadAttachment } from "../../actions";

type Subcriterion = { id: string; name: string; description: string | null; weight: number | null };
type SubScore = { subcriterionId: string; rating: number; justification: string };
type Attachment = { id: string; fileName: string };

const MEASUREMENT_UNIT: Record<string, string> = {
  NUMBER: "",
  PERCENTAGE: "%",
  CURRENCY: "ريال",
  RATING_1_5: "",
  SUBCRITERIA_RATING: "",
};

export default function KpiCard({
  reviewEvaluatorId,
  kpi,
  actual,
  item,
  attachments,
}: {
  reviewEvaluatorId: string;
  kpi: {
    id: string;
    name: string;
    description: string | null;
    weight: number;
    measurementType: string;
    direction: string;
    measurementInstructions: string | null;
    subcriteria: Subcriterion[];
  };
  /** القيمة الفعلية/الهدف المشتركان بين كل المقيّمين (ReviewKpiActual) - null للمؤشرات غير الموضوعية. */
  actual: {
    actualValue: number | null;
    targetValue: number | null;
    isConfigurationError: boolean;
    configurationErrorReason: string | null;
  } | null;
  /** رأي هذا المقيّم بالذات (ReviewEvaluatorItem). */
  item: {
    ratingValue: number | null;
    achievementPct: number | null;
    scoreContribution: number | null;
    justification: string | null;
    notes: string | null;
    subcriteriaScores: SubScore[];
  };
  attachments: Attachment[];
}) {
  const [actualValue, setActualValue] = useState(actual?.actualValue?.toString() ?? "");
  const [ratingValue, setRatingValue] = useState(item.ratingValue ?? 0);
  const [justification, setJustification] = useState(item.justification ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [subScores, setSubScores] = useState<Record<string, { rating: number; justification: string }>>(
    Object.fromEntries(item.subcriteriaScores.map((s) => [s.subcriterionId, { rating: s.rating, justification: s.justification }]))
  );
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const actualDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function markSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function scheduleSaveActual(nextValue: string) {
    if (actualDebounceRef.current) clearTimeout(actualDebounceRef.current);
    actualDebounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("reviewEvaluatorId", reviewEvaluatorId);
        fd.set("kpiId", kpi.id);
        fd.set("actualValue", nextValue);
        await saveActualValue(fd);
        markSaved();
      });
    }, 700);
  }

  function scheduleSaveFields(next: { justification?: string; notes?: string; ratingValue?: number }) {
    if (fieldsDebounceRef.current) clearTimeout(fieldsDebounceRef.current);
    fieldsDebounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("reviewEvaluatorId", reviewEvaluatorId);
        fd.set("kpiId", kpi.id);
        const nextRating = next.ratingValue ?? (isRating ? ratingValue : 0);
        fd.set("ratingValue", nextRating > 0 ? String(nextRating) : "");
        fd.set("justification", next.justification ?? justification);
        fd.set("notes", next.notes ?? notes);
        await saveItemFields(fd);
        markSaved();
      });
    }, 700);
  }

  useEffect(
    () => () => {
      if (actualDebounceRef.current) clearTimeout(actualDebounceRef.current);
      if (fieldsDebounceRef.current) clearTimeout(fieldsDebounceRef.current);
    },
    []
  );

  const isRating = kpi.measurementType === "RATING_1_5";
  const isSubcriteria = kpi.measurementType === "SUBCRITERIA_RATING";
  const isNumeric = !isRating && !isSubcriteria;

  async function handleSubScoreChange(subId: string, rating: number, just: string) {
    setSubScores((prev) => ({ ...prev, [subId]: { rating, justification: just } }));
    if (!just.trim()) return; // لا نحفظ بدون تبرير - الحقل إلزامي
    startTransition(async () => {
      await saveSubcriterionScore(reviewEvaluatorId, kpi.id, subId, rating, just);
      markSaved();
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("reviewEvaluatorId", reviewEvaluatorId);
    fd.set("kpiId", kpi.id);
    fd.set("file", file);
    startTransition(async () => {
      await uploadAttachment(fd);
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-slate-800">{kpi.name}</div>
          {kpi.description && <div className="mt-0.5 text-sm text-slate-500">{kpi.description}</div>}
          {kpi.measurementInstructions && (
            <div className="mt-1 text-xs text-slate-400">تعليمات: {kpi.measurementInstructions}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="badge bg-primary-50 text-primary-700">الوزن {kpi.weight}%</span>
          {pending && <Loader2 size={16} className="animate-spin text-slate-400" />}
          {saved && !pending && <Check size={16} className="text-emerald-500" />}
        </div>
      </div>

      {isNumeric && actual?.isConfigurationError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {actual.configurationErrorReason ?? "لا يوجد هدف صالح لهذا المؤشر - راجع الإدارة"}
        </div>
      )}

      {isNumeric && !actual?.isConfigurationError && (
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
          <div>
            <div className="text-slate-400">الهدف (Target)</div>
            <div className="font-medium text-slate-700">
              {actual?.targetValue !== null && actual?.targetValue !== undefined
                ? `${actual.targetValue} ${MEASUREMENT_UNIT[kpi.measurementType]}`
                : "غير محدد - راجع الإدارة"}
            </div>
          </div>
          <div>
            <div className="text-slate-400">نسبة الإنجاز</div>
            <div className="font-medium text-slate-700">{item.achievementPct !== null ? `${item.achievementPct.toFixed(1)}%` : "—"}</div>
          </div>
          <div>
            <div className="text-slate-400">المساهمة بالنتيجة</div>
            <div className="font-medium text-slate-700">
              {item.scoreContribution !== null ? `${item.scoreContribution.toFixed(2)} / ${kpi.weight}` : "—"}
            </div>
          </div>
        </div>
      )}

      {isNumeric && (
        <div className="mb-3">
          <label className="label-field">
            القيمة الفعلية (Actual) <span className="text-xs font-normal text-slate-400">- مشتركة بين كل المقيّمين</span>
          </label>
          <input
            type="number"
            step="0.01"
            className="input-field max-w-xs"
            value={actualValue}
            onChange={(e) => {
              setActualValue(e.target.value);
              scheduleSaveActual(e.target.value);
            }}
          />
        </div>
      )}

      {isRating && (
        <div className="mb-3">
          <label className="label-field">التقييم</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setRatingValue(n);
                  scheduleSaveFields({ ratingValue: n });
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold ${
                  ratingValue === n ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {(isRating || isNumeric) && (
        <div className="mb-3">
          <label className="label-field">
            التبرير {isRating && <span className="text-red-500">(إلزامي)</span>}
          </label>
          <textarea
            rows={2}
            className="input-field"
            value={justification}
            onChange={(e) => {
              setJustification(e.target.value);
              scheduleSaveFields({ justification: e.target.value });
            }}
            placeholder="اشرح سبب هذا التقييم..."
          />
        </div>
      )}

      {isSubcriteria && (
        <div className="mb-3 space-y-3">
          {kpi.subcriteria.map((sub) => {
            const current = subScores[sub.id] ?? { rating: 0, justification: "" };
            return (
              <div key={sub.id} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {sub.name} {sub.weight !== null && <span className="text-slate-400">({sub.weight}%)</span>}
                  </span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleSubScoreChange(sub.id, n, current.justification)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold ${
                          current.rating === n ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300 text-slate-600"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={2}
                  className="input-field"
                  placeholder="التبرير إلزامي..."
                  value={current.justification}
                  onChange={(e) => handleSubScoreChange(sub.id, current.rating || 0, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-3">
        <label className="label-field">ملاحظات (اختياري)</label>
        <textarea
          rows={2}
          className="input-field"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            scheduleSaveFields({ notes: e.target.value });
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-primary-600 hover:underline">
          <Paperclip size={14} /> إرفاق ملف
          <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" />
        </label>
        {attachments.map((a) => (
          <a key={a.id} href={`/api/attachments/${a.id}`} className="text-xs text-slate-500 hover:underline">
            📎 {a.fileName}
          </a>
        ))}
      </div>
    </div>
  );
}
