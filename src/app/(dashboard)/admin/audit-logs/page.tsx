import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { History } from "lucide-react";
import type { Prisma } from "@prisma/client";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "تسجيل دخول ناجح",
  LOGIN_FAILED: "محاولة دخول فاشلة",
  CREATE: "إنشاء",
  UPDATE: "تعديل",
  ARCHIVE: "أرشفة",
  RESTORE: "استعادة",
  IMPORT_EMPLOYEES: "استيراد موظفين",
  CREATE_CYCLE: "إنشاء دورة",
  OPEN_CYCLE: "فتح دورة",
  CLOSE_CYCLE: "إغلاق دورة",
  CHANGE_TARGET: "تعديل هدف",
  CHANGE_ASSIGNMENT: "تعديل تعيين مقيّم",
  CHANGE_EVALUATOR_WEIGHT: "تعديل وزن مقيّم",
  EVALUATION_SAVE: "حفظ تقييم",
  EVALUATION_SUBMIT: "إرسال تقييم",
  EVALUATION_REOPEN: "إعادة فتح تقييم",
  ATTACHMENT_UPLOAD: "رفع مرفق",
  REPORT_EXPORT: "تصدير تقرير",
  GRANT_PERMISSION: "منح صلاحية",
  REVOKE_PERMISSION: "سحب صلاحية",
  RESET_PASSWORD: "إعادة تعيين كلمة مرور",
};

const PAGE_SIZE = 50;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { action?: string; entity?: string; userId?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [actions, entities, users] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    prisma.user.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  const where: Prisma.AuditLogWhereInput = {
    ...(searchParams.action ? { action: searchParams.action } : {}),
    ...(searchParams.entity ? { entity: searchParams.entity } : {}),
    ...(searchParams.userId ? { userId: searchParams.userId } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (searchParams.action) params.set("action", searchParams.action);
    if (searchParams.entity) params.set("entity", searchParams.entity);
    if (searchParams.userId) params.set("userId", searchParams.userId);
    params.set("page", String(p));
    return `/admin/audit-logs?${params.toString()}`;
  }

  return (
    <div>
      <PageHeader title="سجل العمليات" description="سجل غير قابل للتعديل بكل العمليات الحساسة على النظام (§21/§28)." />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label-field">العملية</label>
          <select name="action" defaultValue={searchParams.action ?? ""} className="input-field">
            <option value="">الكل</option>
            {actions.map((a) => (
              <option key={a.action} value={a.action}>
                {AUDIT_ACTION_LABELS[a.action] ?? a.action}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">الكيان</label>
          <select name="entity" defaultValue={searchParams.entity ?? ""} className="input-field">
            <option value="">الكل</option>
            {entities.map((e) => (
              <option key={e.entity} value={e.entity}>
                {e.entity}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">المستخدم</label>
          <select name="userId" defaultValue={searchParams.userId ?? ""} className="input-field">
            <option value="">الكل</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">تصفية</button>
      </form>

      {logs.length === 0 ? (
        <EmptyState icon={History} title="لا توجد عمليات مطابقة" />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-right text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">الوقت</th>
                  <th className="px-4 py-3">المستخدم</th>
                  <th className="px-4 py-3">العملية</th>
                  <th className="px-4 py-3">الكيان</th>
                  <th className="px-4 py-3">السبب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{log.createdAt.toLocaleString("ar-SA")}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{log.user?.fullName ?? "النظام"}</td>
                    <td className="px-4 py-3">{AUDIT_ACTION_LABELS[log.action] ?? log.action}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {log.entity}
                      {log.entityId && <span className="text-slate-400"> ({log.entityId.slice(0, 8)}…)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{log.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                صفحة {page} من {totalPages} ({total} سجل)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a href={pageHref(page - 1)} className="btn-secondary">
                    السابق
                  </a>
                )}
                {page < totalPages && (
                  <a href={pageHref(page + 1)} className="btn-secondary">
                    التالي
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
