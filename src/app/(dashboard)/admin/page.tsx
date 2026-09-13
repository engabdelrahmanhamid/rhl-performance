import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { Users, Building2, UserCog, CalendarRange, AlertTriangle, History, CalendarX } from "lucide-react";
import { getAssignmentCoverage } from "@/lib/services/cycleOpening";

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

export default async function AdminDashboardPage() {
  const [employeeCount, branchCount, evaluatorCount, currentCycle, recentAuditLogs] = await Promise.all([
    prisma.employee.count({ where: { archivedAt: null, employmentStatus: "ACTIVE" } }),
    prisma.branch.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "EVALUATOR", isActive: true } }),
    prisma.evaluationCycle.findFirst({ where: { status: "OPEN" }, orderBy: { openDate: "desc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: true } }),
  ]);

  let cycleStats: { total: number; completed: number; awaiting: number; completionPct: number } | null = null;
  if (currentCycle) {
    const reviews = await prisma.performanceReview.findMany({ where: { cycleId: currentCycle.id }, select: { status: true } });
    const total = reviews.length;
    const completed = reviews.filter((r) => r.status === "COMPLETED").length;
    const awaiting = reviews.filter((r) => r.status !== "COMPLETED").length;
    cycleStats = { total, completed, awaiting, completionPct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }

  const coverage = await getAssignmentCoverage();
  const notReady = coverage.filter((c) => !c.isReady);

  return (
    <div>
      <PageHeader title="لوحة التحكم" description="نظرة عامة سريعة على حالة النظام والدورة الحالية." />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="الموظفون النشطون" value={employeeCount} icon={Users} />
        <StatCard label="الفروع" value={branchCount} icon={Building2} />
        <StatCard label="المقيّمون" value={evaluatorCount} icon={UserCog} />
        <StatCard label="نسبة إنجاز الدورة الحالية" value={cycleStats ? `${cycleStats.completionPct}%` : "—"} icon={CalendarRange} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold text-slate-800">الدورة الحالية</div>
            <Link href="/admin/evaluation-cycles" className="text-sm text-primary-600 hover:underline">
              كل الدورات
            </Link>
          </div>
          {!currentCycle ? (
            <EmptyState icon={CalendarX} title="لا توجد دورة مفتوحة حاليًا" />
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="font-medium text-slate-700">{currentCycle.name}</div>
                <Badge tone="green">مفتوحة</Badge>
              </div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {cycleStats?.completed} من {cycleStats?.total} مراجعة مكتملة
                </span>
                <span className="text-slate-500">{cycleStats?.completionPct}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all"
                  style={{ width: `${cycleStats?.completionPct ?? 0}%` }}
                />
              </div>
              <Link
                href={`/admin/evaluation-cycles/${currentCycle.id}`}
                className="mt-4 inline-block text-sm text-primary-600 hover:underline"
              >
                عرض تفاصيل الدورة
              </Link>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold text-slate-800">آخر العمليات</div>
            <Link href="/admin/audit-logs" className="text-sm text-primary-600 hover:underline">
              سجل العمليات الكامل
            </Link>
          </div>
          {recentAuditLogs.length === 0 ? (
            <EmptyState icon={History} title="لا توجد عمليات مسجَّلة بعد" />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAuditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-slate-700">{AUDIT_ACTION_LABELS[log.action] ?? log.action}</span>
                    <span className="text-slate-400"> — {log.entity}</span>
                  </div>
                  <div className="text-left text-xs text-slate-400">
                    <div>{log.user?.fullName ?? "النظام"}</div>
                    <div>{log.createdAt.toLocaleString("ar-SA")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {notReady.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 p-5">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-800">
            <AlertTriangle size={18} />
            {notReady.length} موظف غير جاهز لفتح دورة تقييم عليه حاليًا
          </div>
          <ul className="space-y-1 text-sm text-amber-700">
            {notReady.slice(0, 8).map((r) => (
              <li key={r.employeeId}>
                {r.employeeName} ({r.jobTitleName}): {r.issues.join("، ")}
              </li>
            ))}
          </ul>
          {notReady.length > 8 && <div className="mt-1 text-xs text-amber-600">و{notReady.length - 8} موظف آخر...</div>}
          <Link href="/admin/evaluator-assignments" className="mt-3 inline-block text-sm text-amber-800 hover:underline">
            مراجعة تعيينات المقيّمين
          </Link>
        </div>
      )}
    </div>
  );
}
