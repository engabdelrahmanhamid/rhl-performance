/**
 * نموذج الصلاحيات الدقيقة (Permissions) — منفصل تمامًا عن نطاق المقيّم (Scope).
 * الصلاحية تُجيب: "ماذا يمكن لهذا المستخدم أن يفعل؟"
 * النطاق (evaluatorScope.ts) يُجيب: "على مَن يمكنه تنفيذ ذلك؟"
 * راجع §5 من المراجعة المعمارية.
 */

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/rbac";

export const PERMISSIONS = {
  EVALUATION_PERFORM: "evaluation.perform",
  EVALUATION_VIEW_HISTORY: "evaluation.view_history",
  EVALUATION_UPLOAD_EVIDENCE: "evaluation.upload_evidence",
  REPORT_VIEW_EMPLOYEE: "report.view_employee",
  REPORT_VIEW_BRANCH: "report.view_branch",
  REPORT_VIEW_DEPARTMENT: "report.view_department",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  [PERMISSIONS.EVALUATION_PERFORM]: "تنفيذ التقييمات",
  [PERMISSIONS.EVALUATION_VIEW_HISTORY]: "عرض السجل التاريخي للتقييمات",
  [PERMISSIONS.EVALUATION_UPLOAD_EVIDENCE]: "رفع الأدلة والمرفقات",
  [PERMISSIONS.REPORT_VIEW_EMPLOYEE]: "عرض تقرير الموظف",
  [PERMISSIONS.REPORT_VIEW_BRANCH]: "عرض تقرير الفرع",
  [PERMISSIONS.REPORT_VIEW_DEPARTMENT]: "عرض تقرير القسم",
};

/** Super Admin يملك كل الصلاحيات ضمنيًا دون الحاجة لسجلات UserPermission. */
export async function userHasPermission(userId: string, code: PermissionCode): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "SUPER_ADMIN") return true;

  const grant = await prisma.userPermission.findUnique({
    where: { userId_permissionCode: { userId, permissionCode: code } },
  });
  return grant !== null;
}

/** يُستخدم في بداية أي Server Action يتطلب صلاحية دقيقة (بعد requireSession). */
export async function requirePermission(code: PermissionCode) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new UnauthorizedError("يجب تسجيل الدخول أولاً");

  const allowed = await userHasPermission(session.user.id, code);
  if (!allowed) {
    throw new UnauthorizedError(`لا تملك صلاحية "${PERMISSION_LABELS[code]}"`);
  }
  return session;
}
