"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { uploadImportFile, confirmImport } from "../actions";

type Row = {
  id: string;
  rowNumber: number;
  status: "READY" | "WARNING" | "ERROR";
  messages: string[];
  rawData: Record<string, string>;
};

type Batch = {
  id: string;
  totalRows: number;
  readyRows: number;
  warningRows: number;
  errorRows: number;
  rows: Row[];
};

export default function ImportWizard() {
  const router = useRouter();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);

    startTransition(async () => {
      try {
        const b = await uploadImportFile(fd);
        setBatch(b as unknown as Batch);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذّر معالجة الملف");
      }
    });
  }

  function handleConfirm() {
    if (!batch) return;
    startTransition(async () => {
      const res = await confirmImport(batch.id);
      setResult(res);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="font-medium text-slate-800">الخطوة 1: تحميل النموذج</div>
          <div className="text-sm text-slate-500">حمّل قالب Excel القياسي وعبّئه بالأعمدة السبعة المطلوبة.</div>
        </div>
        <a href="/api/employees/import-template" className="btn-secondary">
          <Download size={16} /> تحميل القالب
        </a>
      </div>

      <div className="card p-5">
        <div className="mb-3 font-medium text-slate-800">الخطوة 2: رفع الملف</div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-10 text-slate-500 hover:bg-slate-50">
          <Upload size={18} />
          {pending ? "جارِ المعالجة..." : "اضغط لاختيار ملف Excel (.xlsx)"}
          <input type="file" accept=".xlsx" className="hidden" onChange={handleUpload} disabled={pending} />
        </label>
        {error && <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>

      {batch && !result && (
        <div className="card p-5">
          <div className="mb-4 font-medium text-slate-800">
            الخطوة 3: المعاينة — تم العثور على {batch.totalRows} موظفًا
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700">
              <CheckCircle2 size={18} /> {batch.readyRows} جاهز للاستيراد
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-amber-700">
              <AlertTriangle size={18} /> {batch.warningRows} يحتاج مراجعة
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-red-700">
              <XCircle size={18} /> {batch.errorRows} خطأ
            </div>
          </div>

          <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-right text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-2">الصف</th>
                  <th className="px-4 py-2">الرقم الوظيفي</th>
                  <th className="px-4 py-2">الاسم</th>
                  <th className="px-4 py-2">الحالة</th>
                  <th className="px-4 py-2">الملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batch.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.rowNumber}</td>
                    <td className="px-4 py-2" dir="ltr">
                      {r.rawData["employee_number"]}
                    </td>
                    <td className="px-4 py-2">{r.rawData["name"]}</td>
                    <td className="px-4 py-2">
                      {r.status === "READY" && <span className="text-emerald-600">✓ جاهز</span>}
                      {r.status === "WARNING" && <span className="text-amber-600">⚠ يحتاج مراجعة</span>}
                      {r.status === "ERROR" && <span className="text-red-600">✕ خطأ</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{r.messages.join("، ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={handleConfirm} disabled={pending || batch.readyRows + batch.warningRows === 0} className="btn-primary">
              {pending ? "جارِ الاستيراد..." : `تأكيد استيراد ${batch.readyRows + batch.warningRows} موظف`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="card flex items-center gap-3 p-5 text-emerald-700">
          <CheckCircle2 size={22} />
          تم استيراد {result.imported} موظفًا بنجاح.
        </div>
      )}
    </div>
  );
}
