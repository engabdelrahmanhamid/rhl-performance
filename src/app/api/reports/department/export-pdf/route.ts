import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { getDepartmentReport } from "@/lib/services/reports";
import { renderHtmlToPdf, reportHtmlShell, escapeHtml } from "@/lib/services/pdfExport";

export async function GET(req: NextRequest) {
  const session = await requireSuperAdmin();
  const departmentId = req.nextUrl.searchParams.get("departmentId");
  const cycleId = req.nextUrl.searchParams.get("cycleId");
  if (!departmentId || !cycleId) return NextResponse.json({ error: "departmentId و cycleId مطلوبان" }, { status: 400 });

  const department = await prisma.department.findUniqueOrThrow({ where: { id: departmentId } });
  const report = await getDepartmentReport(departmentId, cycleId);

  const body = `
    <h1>تقرير القسم</h1>
    <p class="subtitle">${escapeHtml(department.name)} — ${escapeHtml(report.cycleName)}</p>

    <div class="stat-grid">
      <div class="stat-box"><div class="value">${report.totalReviews}</div><div class="label">إجمالي المراجعات</div></div>
      <div class="stat-box"><div class="value">${report.completedReviews}</div><div class="label">مكتملة</div></div>
      <div class="stat-box"><div class="value">${report.completionPct}%</div><div class="label">نسبة الإنجاز</div></div>
      <div class="stat-box"><div class="value">${report.averageFinalPercentage !== null ? `${report.averageFinalPercentage.toFixed(1)}%` : "—"}</div><div class="label">متوسط النتيجة</div></div>
    </div>

    ${
      report.labelDistribution.length > 0
        ? `<h2>توزيع التصنيفات (للمراجعات المكتملة فقط)</h2>
    <table>
      <thead><tr><th>التصنيف</th><th>العدد</th></tr></thead>
      <tbody>${report.labelDistribution.map((l) => `<tr><td>${escapeHtml(l.label)}</td><td>${l.count}</td></tr>`).join("")}</tbody>
    </table>`
        : ""
    }

    ${
      report.metricRollups.length > 0
        ? `<h2>مجاميع مقاييس التقارير (ReportingMetric)</h2>
    <table>
      <thead><tr><th>المقياس</th><th>طريقة التجميع</th><th>القيمة</th><th>عدد العينات</th></tr></thead>
      <tbody>${report.metricRollups
        .map(
          (m) =>
            `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.aggregationMethod)}</td><td>${m.value !== null ? m.value.toLocaleString("ar-SA", { maximumFractionDigits: 2 }) : "—"} ${escapeHtml(m.unit ?? "")}</td><td>${m.sampleCount}</td></tr>`
        )
        .join("")}</tbody>
    </table>`
        : ""
    }
  `;

  const pdf = await renderHtmlToPdf(reportHtmlShell(`تقرير القسم - ${department.name}`, body));

  await writeAuditLog({ userId: session.user.id, action: "REPORT_EXPORT", entity: "Department", entityId: departmentId });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="department_report.pdf"; filename*=UTF-8''${encodeURIComponent(`department_report_${department.name}.pdf`)}`,
    },
  });
}
