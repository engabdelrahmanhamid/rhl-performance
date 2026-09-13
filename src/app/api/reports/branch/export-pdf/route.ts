import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { getBranchReport } from "@/lib/services/reports";
import { renderHtmlToPdf, reportHtmlShell, escapeHtml } from "@/lib/services/pdfExport";

export async function GET(req: NextRequest) {
  const session = await requireSuperAdmin();
  const branchId = req.nextUrl.searchParams.get("branchId");
  const cycleId = req.nextUrl.searchParams.get("cycleId");
  if (!branchId || !cycleId) return NextResponse.json({ error: "branchId و cycleId مطلوبان" }, { status: 400 });

  const branch = await prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
  const report = await getBranchReport(branchId, cycleId);

  const body = `
    <h1>تقرير الفرع</h1>
    <p class="subtitle">${escapeHtml(branch.name)} — ${escapeHtml(report.cycleName)}</p>

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

  const pdf = await renderHtmlToPdf(reportHtmlShell(`تقرير الفرع - ${branch.name}`, body));

  await writeAuditLog({ userId: session.user.id, action: "REPORT_EXPORT", entity: "Branch", entityId: branchId });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="branch_report.pdf"; filename*=UTF-8''${encodeURIComponent(`branch_report_${branch.name}.pdf`)}`,
    },
  });
}
