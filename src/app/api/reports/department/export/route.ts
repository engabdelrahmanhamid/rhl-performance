import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { getDepartmentReport } from "@/lib/services/reports";

export async function GET(req: NextRequest) {
  const session = await requireSuperAdmin();
  const departmentId = req.nextUrl.searchParams.get("departmentId");
  const cycleId = req.nextUrl.searchParams.get("cycleId");
  if (!departmentId || !cycleId) return NextResponse.json({ error: "departmentId و cycleId مطلوبان" }, { status: 400 });

  const department = await prisma.department.findUniqueOrThrow({ where: { id: departmentId } });
  const report = await getDepartmentReport(departmentId, cycleId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("تقرير القسم");
  sheet.views = [{ rightToLeft: true }];

  sheet.addRow(["القسم", department.name]);
  sheet.addRow(["الدورة", report.cycleName]);
  sheet.addRow(["إجمالي المراجعات", report.totalReviews]);
  sheet.addRow(["مكتملة", report.completedReviews]);
  sheet.addRow(["نسبة الإنجاز", `${report.completionPct}%`]);
  sheet.addRow(["متوسط النتيجة", report.averageFinalPercentage !== null ? `${report.averageFinalPercentage.toFixed(1)}%` : "—"]);
  sheet.addRow([]);

  if (report.labelDistribution.length > 0) {
    const labelHeader = sheet.addRow(["التصنيف", "العدد"]);
    labelHeader.font = { bold: true };
    for (const l of report.labelDistribution) sheet.addRow([l.label, l.count]);
    sheet.addRow([]);
  }

  if (report.metricRollups.length > 0) {
    const metricHeader = sheet.addRow(["المقياس", "طريقة التجميع", "القيمة", "الوحدة", "عدد العينات"]);
    metricHeader.font = { bold: true };
    for (const m of report.metricRollups) {
      sheet.addRow([m.name, m.aggregationMethod, m.value !== null ? Number(m.value.toFixed(2)) : "—", m.unit ?? "", m.sampleCount]);
    }
  }

  sheet.columns.forEach((col) => (col.width = 24));

  const buffer = await workbook.xlsx.writeBuffer();

  await writeAuditLog({
    userId: session.user.id,
    action: "REPORT_EXPORT",
    entity: "Department",
    entityId: departmentId,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="department_report.xlsx"; filename*=UTF-8''${encodeURIComponent(`department_report_${department.name}.xlsx`)}`,
    },
  });
}
