/**
 * حراس الصلاحيات (Guards) — يُستدعى في بداية كل Server Action / Route Handler.
 * §38: "لا تعتمد على Frontend فقط في Authorization — كل Permission يجب التحقق منها Backend."
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor(message = "غير مصرح لك بتنفيذ هذا الإجراء") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new UnauthorizedError("يجب تسجيل الدخول أولاً");
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (session.user.role !== "SUPER_ADMIN") {
    throw new UnauthorizedError("هذا الإجراء متاح لمدير النظام فقط");
  }
  return session;
}

export async function requireEvaluator() {
  const session = await requireSession();
  if (session.user.role !== "EVALUATOR") {
    throw new UnauthorizedError("هذا الإجراء متاح للمقيّمين فقط");
  }
  return session;
}
