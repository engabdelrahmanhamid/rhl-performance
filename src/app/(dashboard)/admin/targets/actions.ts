"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { targetSchema } from "@/lib/validations";
import { buildScopeKey, type TargetScopeType } from "@/lib/services/targetResolution";

export async function createOrUpdateTarget(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = targetSchema.parse({
    kpiId: formData.get("kpiId"),
    level: formData.get("level"),
    applicationMode: formData.get("applicationMode") || "PER_EMPLOYEE",
    branchId: formData.get("branchId") || null,
    departmentId: formData.get("departmentId") || null,
    jobTitleId: formData.get("jobTitleId") || null,
    employeeId: formData.get("employeeId") || null,
    month: formData.get("month"),
    year: formData.get("year"),
    value: formData.get("value"),
  });

  const scopeType = parsed.level as TargetScopeType;

  // فرض الحقول ذات الصلة بالمستوى المختار فقط، وتصفير الباقي - يمنع تضارب scopeKey
  const branchId = scopeType === "BRANCH" ? parsed.branchId : null;
  const departmentId = scopeType === "DEPARTMENT" ? parsed.departmentId : null;
  const jobTitleId = scopeType === "JOB_TITLE" ? parsed.jobTitleId : null;
  const employeeId = scopeType === "EMPLOYEE" ? parsed.employeeId : null;

  if (scopeType === "BRANCH" && !branchId) throw new Error("يجب اختيار الفرع");
  if (scopeType === "DEPARTMENT" && !departmentId) throw new Error("يجب اختيار القسم");
  if (scopeType === "JOB_TITLE" && !jobTitleId) throw new Error("يجب اختيار المسمى الوظيفي");
  if (scopeType === "EMPLOYEE" && !employeeId) throw new Error("يجب اختيار الموظف");

  const scopeKey = buildScopeKey(scopeType, { branchId, departmentId, jobTitleId, employeeId });

  const existing = await prisma.target.findUnique({
    where: {
      kpiId_scopeType_scopeKey_month_year: {
        kpiId: parsed.kpiId,
        scopeType,
        scopeKey,
        month: parsed.month,
        year: parsed.year,
      },
    },
  });

  const target = existing
    ? await prisma.target.update({
        where: { id: existing.id },
        data: { value: parsed.value, applicationMode: parsed.applicationMode },
      })
    : await prisma.target.create({
        data: {
          kpiId: parsed.kpiId,
          scopeType,
          scopeKey,
          applicationMode: parsed.applicationMode,
          branchId,
          departmentId,
          jobTitleId,
          employeeId,
          month: parsed.month,
          year: parsed.year,
          value: parsed.value,
        },
      });

  await writeAuditLog({
    userId: session.user.id,
    action: "CHANGE_TARGET",
    entity: "Target",
    entityId: target.id,
    beforeData: existing,
    afterData: target,
  });

  revalidatePath("/admin/targets");
}

export async function deleteTarget(id: string) {
  const session = await requireSuperAdmin();
  const before = await prisma.target.findUniqueOrThrow({ where: { id } });
  await prisma.target.delete({ where: { id } });
  await writeAuditLog({ userId: session.user.id, action: "CHANGE_TARGET", entity: "Target", entityId: id, beforeData: before });
  revalidatePath("/admin/targets");
}
