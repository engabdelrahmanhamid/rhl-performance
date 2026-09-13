/**
 * خدمة استيراد الموظفين من Excel — §8 من المتطلبات.
 * Workflow: Upload -> Validate -> Preview (READY/WARNING/ERROR) -> Confirm Import.
 * لا يستورد أي صف بحالة ERROR، ويُعلَّم صف WARNING للمراجعة لكنه يُستورد.
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export const IMPORT_TEMPLATE_COLUMNS = [
  "employee_number",
  "name",
  "branch",
  "department",
  "job_title",
  "status",
  "hire_date",
] as const;

export interface ParsedImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  status: "READY" | "WARNING" | "ERROR";
  messages: string[];
  resolved?: {
    employeeNumber: string;
    fullName: string;
    branchId: string;
    departmentId: string | null;
    jobTitleId: string;
    status: "ACTIVE" | "INACTIVE";
    hireDate: Date;
  };
}

export async function buildImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees");
  sheet.views = [{ rightToLeft: true }];
  sheet.addRow(IMPORT_TEMPLATE_COLUMNS as unknown as string[]);
  sheet.addRow([
    "EMP-1001",
    "أحمد محمد",
    "فرع جدة",
    "خدمة العملاء",
    "خدمة العملاء",
    "active",
    "2024-01-15",
  ]);
  sheet.columns.forEach((col) => (col.width = 22));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function parseAndValidateEmployeeSheet(fileBuffer: Buffer): Promise<ParsedImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const [branches, departments, jobTitles, existingEmployees] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true } }),
    prisma.department.findMany({ where: { isActive: true } }),
    prisma.jobTitle.findMany({ where: { isActive: true } }),
    prisma.employee.findMany({ select: { employeeNumber: true } }),
  ]);

  const existingNumbers = new Set(existingEmployees.map((e) => e.employeeNumber));
  const seenInFile = new Set<string>();

  const headerRow = sheet.getRow(1).values as unknown[];
  const headers = headerRow.slice(1).map((h) => String(h ?? "").trim());

  const results: ParsedImportRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Header

    const values = row.values as unknown[];
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = String(values[idx + 1] ?? "").trim();
    });

    if (Object.values(raw).every((v) => v === "")) return; // صف فارغ تمامًا - تجاهل

    const messages: string[] = [];
    let status: ParsedImportRow["status"] = "READY";

    const employeeNumber = raw["employee_number"];
    const fullName = raw["name"];
    const branchName = raw["branch"];
    const departmentName = raw["department"];
    const jobTitleName = raw["job_title"];
    const statusRaw = (raw["status"] || "active").toLowerCase();
    const hireDateRaw = raw["hire_date"];

    if (!employeeNumber) {
      messages.push("الرقم الوظيفي مطلوب");
      status = "ERROR";
    } else if (existingNumbers.has(employeeNumber) || seenInFile.has(employeeNumber)) {
      messages.push(`الرقم الوظيفي ${employeeNumber} مكرر`);
      status = "ERROR";
    }
    seenInFile.add(employeeNumber);

    if (!fullName) {
      messages.push("اسم الموظف مطلوب");
      status = "ERROR";
    }

    const branch = branches.find((b) => b.name === branchName);
    if (!branch) {
      messages.push(`الفرع "${branchName}" غير موجود`);
      status = "ERROR";
    }

    const jobTitle = jobTitles.find((j) => j.name === jobTitleName);
    if (!jobTitle) {
      messages.push(`المسمى الوظيفي "${jobTitleName}" غير موجود`);
      status = "ERROR";
    }

    const department = departments.find((d) => d.name === departmentName);
    if (departmentName && !department) {
      messages.push(`القسم "${departmentName}" غير موجود - سيُترك فارغًا`);
      if (status !== "ERROR") status = "WARNING";
    }

    const employmentStatus = statusRaw === "inactive" ? "INACTIVE" : "ACTIVE";
    if (statusRaw !== "active" && statusRaw !== "inactive") {
      messages.push(`قيمة الحالة "${raw["status"]}" غير معروفة - سيُفترض "نشط"`);
      if (status !== "ERROR") status = "WARNING";
    }

    let hireDate: Date | null = null;
    if (!hireDateRaw) {
      messages.push("تاريخ التعيين مطلوب");
      status = "ERROR";
    } else {
      hireDate = new Date(hireDateRaw);
      if (isNaN(hireDate.getTime())) {
        messages.push(`تاريخ التعيين "${hireDateRaw}" غير صالح`);
        status = "ERROR";
      } else if (hireDate.getTime() > Date.now()) {
        messages.push("تاريخ التعيين في المستقبل - يحتاج مراجعة");
        if (status !== "ERROR") status = "WARNING";
      }
    }

    results.push({
      rowNumber,
      raw,
      status,
      messages,
      resolved:
        status !== "ERROR" && branch && jobTitle && hireDate
          ? {
              employeeNumber,
              fullName,
              branchId: branch.id,
              departmentId: department?.id ?? null,
              jobTitleId: jobTitle.id,
              status: employmentStatus,
              hireDate,
            }
          : undefined,
    });
  });

  return results;
}
