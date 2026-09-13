/**
 * خدمة حل الهدف الفعّال (Target Resolution Hierarchy) — نسخة مُصححة.
 *
 * التصحيحات بعد المراجعة المعمارية:
 *  - §10: التفرّد يُبنى على scopeKey نصي طبيعي بدل الاعتماد على تفرّد NULL في Postgres
 *    (لم يعد هذا الملف مسؤولاً عن الـUniqueness نفسها - تلك مسؤولية Prisma schema - لكن
 *    دالة buildScopeKey هنا هي المصدر الوحيد لتوليد المفتاح بالتناسق مع القيود في القاعدة).
 *  - §11: هرمية الحل (Employee -> JobTitle -> Department -> Branch -> Global) تُطبَّق
 *    فقط على أهداف applicationMode = PER_EMPLOYEE. أهداف AGGREGATE تُستبعد تمامًا من هذا الحل
 *    لأنها أرقام إجمالية لتقارير الفروع/الأقسام ولا تُورَّث كهدف فردي.
 */

export type TargetScopeType = "GLOBAL" | "BRANCH" | "DEPARTMENT" | "JOB_TITLE" | "EMPLOYEE";
export type TargetApplicationMode = "PER_EMPLOYEE" | "AGGREGATE";

export interface TargetRecord {
  scopeType: TargetScopeType;
  scopeKey: string;
  applicationMode: TargetApplicationMode;
  branchId: string | null;
  departmentId: string | null;
  jobTitleId: string | null;
  employeeId: string | null;
  value: number;
}

export interface EmployeeContext {
  employeeId: string;
  branchId: string;
  departmentId: string | null;
  jobTitleId: string;
}

/** المصدر الوحيد لتوليد scopeKey - يجب استخدامه عند إنشاء/تحديث أي Target. */
export function buildScopeKey(
  scopeType: TargetScopeType,
  ids: { branchId?: string | null; departmentId?: string | null; jobTitleId?: string | null; employeeId?: string | null }
): string {
  switch (scopeType) {
    case "GLOBAL":
      return "GLOBAL";
    case "BRANCH":
      return `BRANCH:${ids.branchId}`;
    case "DEPARTMENT":
      return `DEPARTMENT:${ids.departmentId}`;
    case "JOB_TITLE":
      return `JOB_TITLE:${ids.jobTitleId}`;
    case "EMPLOYEE":
      return `EMPLOYEE:${ids.employeeId}`;
  }
}

/**
 * يحل الهدف الفعّال لموظف معيّن من قائمة أهداف مُسبقة الجلب (لكل KPI/شهر/سنة).
 * يعيد null إذا لم يُعثر على أي هدف PER_EMPLOYEE صالح على أي مستوى — ولا يُخترع رقم افتراضي.
 */
export function resolveEffectiveTarget(
  targets: TargetRecord[],
  employee: EmployeeContext
): { value: number; sourceLevel: TargetScopeType } | null {
  const perEmployeeTargets = targets.filter((t) => t.applicationMode === "PER_EMPLOYEE");

  const byLevel = (level: TargetScopeType) =>
    perEmployeeTargets.find((t) => {
      if (t.scopeType !== level) return false;
      switch (level) {
        case "EMPLOYEE":
          return t.employeeId === employee.employeeId;
        case "JOB_TITLE":
          return t.jobTitleId === employee.jobTitleId;
        case "DEPARTMENT":
          return employee.departmentId !== null && t.departmentId === employee.departmentId;
        case "BRANCH":
          return t.branchId === employee.branchId;
        case "GLOBAL":
          return true;
        default:
          return false;
      }
    });

  const order: TargetScopeType[] = ["EMPLOYEE", "JOB_TITLE", "DEPARTMENT", "BRANCH", "GLOBAL"];

  for (const level of order) {
    const found = byLevel(level);
    if (found) return { value: found.value, sourceLevel: level };
  }

  return null;
}
