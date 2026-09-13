"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createAssignment } from "./actions";

type Option = { id: string; name: string };

type RuleRow = {
  isAllEmployees: boolean;
  branchId?: string;
  departmentId?: string;
  jobTitleId?: string;
};

const EMPTY_RULE: RuleRow = { isAllEmployees: true };

export default function AssignmentForm({
  evaluators,
  branches,
  departments,
  jobTitles,
  employees,
}: {
  evaluators: Option[];
  branches: Option[];
  departments: Option[];
  jobTitles: Option[];
  employees: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<RuleRow[]>([{ ...EMPTY_RULE }]);
  const [specificIds, setSpecificIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} /> تعيين جديد
      </button>
    );
  }

  return (
    <form
      className="card space-y-5 p-6"
      action={(formData) => {
        setError(null);
        formData.set("rulesJson", JSON.stringify(rules));
        formData.set("specificEmployeeIdsJson", JSON.stringify(specificIds));
        startTransition(async () => {
          try {
            await createAssignment(formData);
            setOpen(false);
            setRules([{ ...EMPTY_RULE }]);
            setSpecificIds([]);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "تعذّر إنشاء التعيين");
          }
        });
      }}
    >
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label-field">المقيّم</label>
          <select name="evaluatorId" required className="input-field">
            {evaluators.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">وزن هذا المقيّم لكل موظف يشمله (%)</label>
          <input type="number" name="defaultWeight" step="0.01" min="0.01" max="100" required className="input-field" />
        </div>
        <div>
          <label className="label-field">وصف التعيين (اختياري)</label>
          <input name="label" className="input-field" placeholder="مثال: عثمان - فرع جدة" />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label-field !mb-0">
            قواعد النطاق (كل قاعدة تجمع حقولها بمنطق AND، والقواعد المتعددة تُجمَع بينها بمنطق OR)
          </label>
          <button
            type="button"
            className="text-sm text-primary-600 hover:underline"
            onClick={() => setRules([...rules, { isAllEmployees: false }])}
          >
            + إضافة قاعدة
          </button>
        </div>

        {rules.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">
            لا توجد قواعد نطاق - تأكد من اختيار موظفين محددين أدناه بدلًا من ذلك.
          </p>
        )}

        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <div key={idx} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={rule.isAllEmployees}
                    onChange={(e) => {
                      const next = [...rules];
                      next[idx] = { isAllEmployees: e.target.checked };
                      setRules(next);
                    }}
                  />
                  كل الموظفين (بلا أي قيد آخر)
                </label>
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {!rule.isAllEmployees && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <select
                    className="input-field"
                    value={rule.branchId ?? ""}
                    onChange={(e) => {
                      const next = [...rules];
                      next[idx] = { ...rule, branchId: e.target.value || undefined };
                      setRules(next);
                    }}
                  >
                    <option value="">أي فرع</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input-field"
                    value={rule.departmentId ?? ""}
                    onChange={(e) => {
                      const next = [...rules];
                      next[idx] = { ...rule, departmentId: e.target.value || undefined };
                      setRules(next);
                    }}
                  >
                    <option value="">أي قسم</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input-field"
                    value={rule.jobTitleId ?? ""}
                    onChange={(e) => {
                      const next = [...rules];
                      next[idx] = { ...rule, jobTitleId: e.target.value || undefined };
                      setRules(next);
                    }}
                  >
                    <option value="">أي مسمى وظيفي</option>
                    {jobTitles.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label-field">موظفون محددون إضافيون (اختياري - OR منفصل عن القواعد أعلاه)</label>
        <select
          multiple
          className="input-field h-40"
          value={specificIds}
          onChange={(e) => setSpecificIds(Array.from(e.target.selectedOptions, (o) => o.value))}
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "جارِ الحفظ..." : "حفظ التعيين"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          إلغاء
        </button>
      </div>
    </form>
  );
}
