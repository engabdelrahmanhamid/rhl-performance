import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { getEmployeeReport } from "@/lib/services/reports";
import { renderHtmlToPdf, reportHtmlShell, escapeHtml } from "@/lib/services/pdfExport";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  NOT_STARTED: { label: "لم يبدأ", tone: "slate" },
  IN_PROGRESS: { label: "قيد التقييم", tone: "amber" },
  AWAITING_EVALUATIONS: { label: "بانتظار المقيّمين", tone: "amber" },
  COMPLETED: { label: "مكتملة", tone: "green" },
};

export async function GET(req: NextRequest) {
  const session = await requireSuperAdmin();
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  if (!employeeId) return NextResponse.json({ error: "employeeId مطلوب" }, { status: 400 });

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    include: { branch: true, jobTitle: true },
  });
  const rows = await getEmployeeReport(employeeId);

  const rowsHtml = rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.cycleName)}</td>
        <td><span class="badge ${STATUS_LABELS[r.status].tone}">${STATUS_LABELS[r.status].label}</span></td>
        <td>${r.finalScore !== null ? r.finalScore.toFixed(2) : "—"}</td>
        <td>${r.finalPercentage !== null ? `${r.finalPercentage.toFixed(1)}%` : "—"}</td>
        <td>${escapeHtml(r.performanceLabel ?? "—")}</td>
      </tr>`
    )
    .join("");

  const body = `
    <h1>تقرير الموظف</h1>
    <p class="subtitle">${escapeHtml(employee.fullName)} — ${escapeHtml(employee.jobTitle.name)} — ${escapeHtml(employee.branch.name)} (${escapeHtml(employee.employeeNumber)})</p>
    <table>
      <thead><tr><th>الدورة</th><th>الحالة</th><th>النتيجة (من 5)</th><th>النسبة</th><th>التصنيف</th></tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="5">لا توجد مراجعات أداء لهذا الموظف بعد</td></tr>`}</tbody>
    </table>
  `;

  const pdf = await renderHtmlToPdf(reportHtmlShell(`تقرير الموظف - ${employee.fullName}`, body));

  await writeAuditLog({ userId: session.user.id, action: "REPORT_EXPORT", entity: "Employee", entityId: employeeId });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="employee_report.pdf"; filename*=UTF-8''${encodeURIComponent(`employee_report_${employee.employeeNumber}.pdf`)}`,
    },
  });
}
