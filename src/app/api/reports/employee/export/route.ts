import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { getEmployeeReport } from "@/lib/services/reports";

export async function GET(req: NextRequest) {
  const session = await requireSuperAdmin();
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  if (!employeeId) return NextResponse.json({ error: "employeeId مطلوب" }, { status: 400 });

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    include: { branch: true, jobTitle: true },
  });
  const rows = await getEmployeeReport(employeeId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("تقرير الموظف");
  sheet.views = [{ rightToLeft: true }];

  sheet.addRow(["الموظف", employee.fullName]);
  sheet.addRow(["الرقم الوظيفي", employee.employeeNumber]);
  sheet.addRow(["المسمى الوظيفي", employee.jobTitle.name]);
  sheet.addRow(["الفرع", employee.branch.name]);
  sheet.addRow([]);

  const headerRow = sheet.addRow(["الدورة", "الحالة", "النتيجة (من 5)", "النسبة", "التصنيف"]);
  headerRow.font = { bold: true };

  for (const r of rows) {
    sheet.addRow([
      r.cycleName,
      r.status,
      r.finalScore !== null ? r.finalScore.toFixed(2) : "—",
      r.finalPercentage !== null ? `${r.finalPercentage.toFixed(1)}%` : "—",
      r.performanceLabel ?? "—",
    ]);
  }

  sheet.columns.forEach((col) => (col.width = 22));

  const buffer = await workbook.xlsx.writeBuffer();

  await writeAuditLog({
    userId: session.user.id,
    action: "REPORT_EXPORT",
    entity: "Employee",
    entityId: employeeId,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="employee_report_${employee.employeeNumber}.xlsx"`,
    },
  });
}
