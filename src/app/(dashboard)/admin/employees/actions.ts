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

  const importable = batch.rows.filter((r) => r.status !== "ERROR" && r.resolvedData);
  let imported = 0;

  for (const row of importable) {
    const r = row.resolvedData as {
      employeeNumber: string;
      fullName: string;
      branchId: string;
      departmentId: string | null;
      jobTitleId: string;
      status: "ACTIVE" | "INACTIVE";
      hireDate: string;
    };

    // إعادة تحقق أخيرة من عدم التكرار (دفاع إضافي ضد استيراد آخر جرى بين المعاينة والتأكيد)
    const exists = await prisma.employee.findUnique({ where: { employeeNumber: r.employeeNumber } });
    if (exists) continue;

    await prisma.employee.create({
      data: {
        employeeNumber: r.employeeNumber,
        fullName: r.fullName,
        branchId: r.branchId,
        departmentId: r.departmentId,
        jobTitleId: r.jobTitleId,
        employmentStatus: r.status,
        hireDate: new Date(r.hireDate),
      },
    });
    imported++;
  }

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
