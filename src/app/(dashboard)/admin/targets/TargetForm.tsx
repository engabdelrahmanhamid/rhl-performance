"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrUpdateTarget } from "./actions";

type Option = { id: string; name: string };

export default function TargetForm({
  kpis,
  branches,
  departments,
  jobTitles,
  employees,
}: {
  kpis: (Option & { jobTitleId: string; jobTitleName: string })[];
  branches: Option[];
  departments: Option[];
  jobTitles: Option[];
  employees: Option[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [level, setLevel] = useState("GLOBAL");
  const [kpiJobTitleFilter, setKpiJobTitleFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filteredKpis = kpis.filter((k) => k.jobTitleId === kpiJobTitleFilter);

  return (
    <form
      ref={formRef}
      className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-3"
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          try {
            await createOrUpdateTarget(formData);
            formRef.current?.reset();
            setLevel("GLOBAL");
            setKpiJobTitleFilter("");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "تعذّر حفظ الهدف");
          }
        })
      }
    >
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-3">{error}</div>}

      <div>
        <label className="label-field">١. المسمى الوظيفي (لتصفية المؤشرات)</label>
        <select
          className="input-field"
          value={kpiJobTitleFilter}
          onChange={(e) => setKpiJobTitleFilter(e.target.value)}
        >
          <option value="">اختر المسمى الوظيفي أولًا...</option>
          {jobTitles.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label-field">٢. المؤشر (KPI)</label>
        <select key={kpiJobTitleFilter} name="kpiId" required className="input-field" defaultValue="">
          <option value="" disabled>
            {kpiJobTitleFilter ? "اختر المؤشر..." : "اختر المسمى الوظيفي أولًا"}
          </option>
          {filteredKpis.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label-field">المستوى</label>
        <select name="level" required className="input-field" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="GLOBAL">عام (Global)</option>
          <option value="BRANCH">فرع</option>
          <option value="DEPARTMENT">قسم</option>
          <option value="JOB_TITLE">مسمى وظيفي</option>
          <option value="EMPLOYEE">موظف محدد</option>
        </select>
      </div>

      <div>
        <label className="label-field">القيمة المستهدفة</label>
        <input type="number" step="0.01" name="value" required className="input-field" />
      </div>

      <div>
        <label className="label-field">نوع التطبيق</label>
        <select name="applicationMode" required className="input-field" defaultValue="PER_EMPLOYEE">
          <option value="PER_EMPLOYEE">فردي (يخضع لهرمية الأولوية لكل موظف)</option>
          <option value="AGGREGATE">إجمالي (للتقارير فقط - لا يُورَّث كهدف فردي)</option>
        </select>
      </div>

      {level === "BRANCH" && (
        <div>
          <label className="label-field">الفرع</label>
          <select name="branchId" className="input-field">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {level === "DEPARTMENT" && (
        <div>
          <label className="label-field">القسم</label>
          <select name="departmentId" className="input-field">
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {level === "JOB_TITLE" && (
        <div>
          <label className="label-field">المسمى الوظيفي</label>
          <select name="jobTitleId" className="input-field">
            {jobTitles.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {level === "EMPLOYEE" && (
        <div>
          <label className="label-field">الموظف</label>
          <select name="employeeId" className="input-field">
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label-field">الشهر</label>
        <select name="month" required className="input-field" defaultValue={new Date().getMonth() + 1}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label-field">السنة</label>
        <input type="number" name="year" required defaultValue={new Date().getFullYear()} className="input-field" />
      </div>

      <div className="sm:col-span-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "جارِ الحفظ..." : "حفظ الهدف"}
        </button>
      </div>
    </form>
  );
}
