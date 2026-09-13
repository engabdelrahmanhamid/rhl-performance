/**
 * خدمة حل نطاق المقيّم (Evaluator Scope Resolution) — نسخة مُصححة بعد المراجعة.
 *
 * §4 من المراجعة: القواعد المتعددة تحت نفس EvaluatorAssignment تُجمَع بمنطق OR،
 * وكل الحقول المحددة داخل نفس القاعدة (Branch/Department/JobTitle) تُطبَّق بمنطق AND.
 * مثال: قاعدة واحدة {branch=جدة, jobTitle=محامي مرخص} تعني "محامو جدة المرخصون فقط"،
 * وليس "كل موظفي جدة" اتحادًا مع "كل المحامين المرخصين عالميًا".
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getEmployeeVisibilityFilter(
  evaluatorUserId: string
): Promise<Prisma.EmployeeWhereInput> {
  const assignments = await prisma.evaluatorAssignment.findMany({
    where: { evaluatorId: evaluatorUserId, isActive: true },
    include: { rules: true, specificEmployees: { select: { employeeId: true } } },
  });

  if (assignments.length === 0) return { id: { in: [] } };

  const orConditions: Prisma.EmployeeWhereInput[] = [];

  for (const assignment of assignments) {
    for (const rule of assignment.rules) {
      if (rule.isAllEmployees) {
        orConditions.push({});
        continue;
      }

      // AND بين كل الحقول المحددة داخل نفس القاعدة
      const andCondition: Prisma.EmployeeWhereInput = {};
      if (rule.branchId) andCondition.branchId = rule.branchId;
      if (rule.departmentId) andCondition.departmentId = rule.departmentId;
      if (rule.jobTitleId) andCondition.jobTitleId = rule.jobTitleId;

      if (Object.keys(andCondition).length > 0) {
        orConditions.push(andCondition);
      }
    }

    if (assignment.specificEmployees.length > 0) {
      orConditions.push({ id: { in: assignment.specificEmployees.map((e) => e.employeeId) } });
    }
  }

  if (orConditions.length === 0) return { id: { in: [] } };

  const hasUnrestricted = orConditions.some((c) => Object.keys(c).length === 0);
  if (hasUnrestricted) return {};

  return { OR: orConditions };
}

export async function isEmployeeInEvaluatorScope(
  evaluatorUserId: string,
  employeeId: string
): Promise<boolean> {
  const filter = await getEmployeeVisibilityFilter(evaluatorUserId);
  const match = await prisma.employee.findFirst({
    where: { AND: [{ id: employeeId }, filter] },
    select: { id: true },
  });
  return match !== null;
}

/**
 * يُقيَّم مرة واحدة فقط لحظة فتح الدورة (Materialization) — وليس ديناميكيًا بعد ذلك.
 * يحدد أي EvaluatorAssignment(s) يغطي موظفًا معينًا وقت الفتح، تمهيدًا لإنشاء
 * ReviewEvaluator بوزن مجمَّد (weightSnapshot) لكل تعيين مطابق.
 */
export function assignmentCoversEmployee(
  assignment: {
    rules: { isAllEmployees: boolean; branchId: string | null; departmentId: string | null; jobTitleId: string | null }[];
    specificEmployees: { employeeId: string }[];
  },
  employee: { id: string; branchId: string; departmentId: string | null; jobTitleId: string }
): boolean {
  const ruleMatch = assignment.rules.some((rule) => {
    if (rule.isAllEmployees) return true;

    const conditions: boolean[] = [];
    if (rule.branchId) conditions.push(rule.branchId === employee.branchId);
    if (rule.departmentId) conditions.push(rule.departmentId === employee.departmentId);
    if (rule.jobTitleId) conditions.push(rule.jobTitleId === employee.jobTitleId);

    if (conditions.length === 0) return false; // قاعدة فارغة بلا isAllEmployees - تُتجاهل
    return conditions.every(Boolean); // AND بين كل شروط القاعدة الواحدة
  });

  const specificMatch = assignment.specificEmployees.some((e) => e.employeeId === employee.id);

  return ruleMatch || specificMatch; // OR بين القواعد والموظفين المحددين
}
