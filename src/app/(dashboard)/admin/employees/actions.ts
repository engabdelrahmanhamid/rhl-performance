"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { employeeSchema } from "@/lib/validations";
import { parseAndValidateEmployeeSheet } from "@/lib/services/excelImport";

export async function createEmployee(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = employeeSchema.parse({
    employeeNumber: formData.get("employeeNumber"),
    fullName: formData.get("fullName"),
    branchId: formData.get("branchId"),
    departmentId: formData.get("departmentId") || null,
    jobTitleId: formData.get("jobTitleId"),
    employmentStatus: formData.get("employmentStatus") || "ACTIVE",
    hireDate: formData.get("hireDate"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    notes: formData.get("notes") || null,
  });

  const employee = await prisma.employee.create({ data: parsed });
  await writeAuditLog({ userId: session.user.id, action: "CREATE", entity: "Employee", entityId: employee.id, afterData: employee });
  revalidatePath("/admin/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = employeeSchema.parse({
    employeeNumber: formData.get("employeeNumber"),
    fullName: formData.get("fullName"),
    branchId: formData.get("branchId"),
    departmentId: formData.get("departmentId") || null,
    jobTitleId: formData.get("jobTitleId"),
    employmentStatus: formData.get("employmentStatus") || "ACTIVE",
    hireDate: formData.get("hireDate"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    notes: formData.get("notes") || null,
  });

  const before = await prisma.employee.findUniqueOrThrow({ where: { id } });
  const after = await prisma.employee.update({ where: { id }, data: parsed });
  await writeAuditLog({ userId: session.user.id, action: "UPDATE", entity: "Employee", entityId: id, beforeData: before, afterData: after });
  revalidatePath("/admin/employees");
}

/** §5.1: لا حذف نهائي لموظف لديه تقييمات تاريخية - Soft Archive عبر archivedAt فقط. */
export async function archiveEmployee(id: string, archived: boolean) {
  const session = await requireSuperAdmin();
  const before = await prisma.employee.findUniqueOrThrow({ where: { id } });
  const after = await prisma.employee.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
  await writeAuditLog({
    userId: session.user.id,
    action: archived ? "ARCHIVE" : "RESTORE",
    entity: "Employee",
    entityId: id,
    beforeData: before,
    afterData: after,
  });
  revalidatePath("/admin/employees");
}

// ---------------------------------------------------------------------------
// استيراد Excel — §8: Upload -> Validate -> Preview -> Confirm Import
// ---------------------------------------------------------------------------

export async function uploadImportFile(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("لم يتم اختيار ملف");
  const buffer = Buffer.from(await file.arrayBuffer());
  return validateImportFile(buffer, file.name);
}

export async function validateImportFile(fileBuffer: Buffer, fileName: string) {
  const session = await requireSuperAdmin();
  const rows = await parseAndValidateEmployeeSheet(fileBuffer);

  const batch = await prisma.excelImportBatch.create({
    data: {
      fileName,
      importedById: session.user.id,
      totalRows: rows.length,
      readyRows: rows.filter((r) => r.status === "READY").length,
      warningRows: rows.filter((r) => r.status === "WARNING").length,
      errorRows: rows.filter((r) => r.status === "ERROR").length,
      rows: {
        create: rows.map((r) => ({
          rowNumber: r.rowNumber,
          rawData: r.raw,
          resolvedData: r.resolved
            ? {
                employeeNumber: r.resolved.employeeNumber,
                fullName: r.resolved.fullName,
                branchId: r.resolved.branchId,
                departmentId: r.resolved.departmentId,
                jobTitleId: r.resolved.jobTitleId,
                status: r.resolved.status,
                hireDate: r.resolved.hireDate.toISOString(),
              }
            : undefined,
          status: r.status,
          messages: r.messages,
        })),
      },
    },
    include: { rows: true },
  });

  return batch;
}

export async function confirmImport(batchId: string) {
  const session = await requireSuperAdmin();
  const batch = await prisma.excelImportBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { rows: true },
  });

  if (batch.confirmed) throw new Error("تم تأكيد هذا الاستيراد مسبقًا");

  type ResolvedRow = {
    employeeNumber: string;
    fullName: string;
    branchId: string;
    departmentId: string | null;
    jobTitleId: string;
    status: "ACTIVE" | "INACTIVE";
    hireDate: string;
  };
  const importable = batch.rows
    .filter((row) => row.status !== "ERROR" && row.resolvedData)
    .map((row) => row.resolvedData as ResolvedRow);

  // إعادة تحقق أخيرة من عدم التكرار دفعة واحدة (دفاع إضافي ضد استيراد آخر جرى بين المعاينة
  // والتأكيد) بدل استعلام + إنشاء منفصلَين لكل صف - أداء حرج مع قاعدة بيانات خارجية بعيدة
  // (كل جولة شبكة إضافية مكلفة)؛ نفس مبدأ إصلاح فتح الدورة في cycleOpening.ts.
  const employeeNumbers = importable.map((r) => r.employeeNumber);
  const existing = await prisma.employee.findMany({
    where: { employeeNumber: { in: employeeNumbers } },
    select: { employeeNumber: true },
  });
  const existingNumbers = new Set(existing.map((e) => e.employeeNumber));
  const toCreate = importable.filter((r) => !existingNumbers.has(r.employeeNumber));

  if (toCreate.length > 0) {
    await prisma.employee.createMany({
      data: toCreate.map((r) => ({
        employeeNumber: r.employeeNumber,
        fullName: r.fullName,
        branchId: r.branchId,
        departmentId: r.departmentId,
        jobTitleId: r.jobTitleId,
        employmentStatus: r.status,
        hireDate: new Date(r.hireDate),
      })),
    });
  }
  const imported = toCreate.length;

  await prisma.excelImportBatch.update({ where: { id: batchId }, data: { confirmed: true } });

  await writeAuditLog({
    userId: session.user.id,
    action: "IMPORT_EMPLOYEES",
    entity: "ExcelImportBatch",
    entityId: batchId,
    afterData: { imported, totalRows: batch.totalRows, fileName: batch.fileName },
  });

  revalidatePath("/admin/employees");
  return { imported };
}
