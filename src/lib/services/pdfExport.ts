/**
 * توليد PDF من نفس قوالب HTML المستخدَمة للعرض - بدل مكتبات PDF الخفيفة (pdfkit/react-pdf)
 * التي لا تدعم تشكيل الحروف العربية (Shaping/Ligatures) فتُخرِج نصًا عربيًا منفصلًا وغير مقروء.
 * القالب نفسه (reportHtmlShell + escapeHtml) هو مصدر الحقيقة الوحيد؛ ما يتغيّر هو فقط أي محرك
 * يُحوِّله إلى PDF - محليًا (Playwright) أو خارجيًا (Browserless) - كلاهما Chromium حقيقي
 * فتكون جودة تشكيل النص العربي مطابقة تمامًا بصرف النظر عن المحرك المُختار.
 *
 * محرك قابل للتبديل عبر PDF_ENGINE لأن استضافة Hostinger المُدارة (Cloud Startup) لا تضمن
 * توفر Chromium على مستوى نظام التشغيل - هذا افتراض غير مضمون ويجب التحقق منه فعليًا بعد
 * النشر (حاول تصدير PDF حقيقي؛ إن ظهرت رسالة الخطأ أدناه فبدّل إلى PDF_ENGINE=browserless):
 *   - PDF_ENGINE=playwright (افتراضي): يشغّل Chromium محليًا عبر Playwright. يعمل مؤكَّدًا
 *     في التطوير المحلي (تم التحقق فعليًا). قد لا يعمل في بيئة استضافة مُدارة بلا صلاحية
 *     تثبيت مكتبات نظام (مثل ما يحتاجه Chromium: fonts, libnss3, ...).
 *   - PDF_ENGINE=browserless: يستدعي خدمة Browserless.io (Headless Chrome كخدمة خارجية عبر
 *     HTTP) - يتطلب BROWSERLESS_API_KEY. لا حاجة لتثبيت أي شيء على السيرفر.
 */

import { chromium } from "playwright";

export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const PDF_MARGIN = { top: "18mm", bottom: "16mm", left: "14mm", right: "14mm" };

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const engine = (process.env.PDF_ENGINE ?? "playwright").toLowerCase();
  return engine === "browserless" ? renderViaBrowserless(html) : renderViaPlaywright(html);
}

async function renderViaPlaywright(html: string): Promise<Buffer> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    throw new Error(
      "تعذّر تشغيل Chromium محليًا عبر Playwright - متوقَّع في بيئة استضافة مُدارة بلا صلاحية تثبيت مكتبات نظام. " +
        'اضبط متغيّر البيئة PDF_ENGINE=browserless مع BROWSERLESS_API_KEY بدل ذلك. الخطأ الأصلي: ' +
        (err instanceof Error ? err.message : String(err))
    );
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    return await page.pdf({ format: "A4", printBackground: true, margin: PDF_MARGIN });
  } finally {
    await browser.close();
  }
}

async function renderViaBrowserless(html: string): Promise<Buffer> {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) throw new Error("BROWSERLESS_API_KEY غير مضبوط - مطلوب عند PDF_ENGINE=browserless");

  const endpoint = process.env.BROWSERLESS_URL ?? "https://chrome.browserless.io";
  const res = await fetch(`${endpoint}/pdf?token=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, options: { format: "A4", printBackground: true, margin: PDF_MARGIN } }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`فشل توليد PDF عبر Browserless (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export function reportHtmlShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @font-face {
    font-family: "Cairo";
    src: local("Cairo");
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Cairo", "Tahoma", "Arial", sans-serif;
    color: #1e293b;
    margin: 0;
    padding: 0;
    font-size: 13px;
  }
  header.letterhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #4f46e5;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  header.letterhead .office-name {
    font-size: 16px;
    font-weight: 700;
    color: #4f46e5;
  }
  header.letterhead .meta {
    font-size: 11px;
    color: #64748b;
    text-align: left;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; color: #334155; }
  p.subtitle { color: #64748b; margin: 0 0 20px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  th { background: #f8fafc; color: #64748b; font-weight: 600; }
  .stat-grid { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat-box { flex: 1; min-width: 110px; background: #f8fafc; border-radius: 10px; padding: 12px 14px; }
  .stat-box .value { font-size: 20px; font-weight: 700; color: #1e293b; }
  .stat-box .label { font-size: 11px; color: #64748b; margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge.green { background: #d1fae5; color: #047857; }
  .badge.amber { background: #fef3c7; color: #92400e; }
  .badge.slate { background: #f1f5f9; color: #475569; }
  footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <header class="letterhead">
    <div class="office-name">مكتب المحامي رامي الحامد</div>
    <div class="meta">تاريخ التصدير: ${new Date().toLocaleDateString("ar-SA")}</div>
  </header>
  ${bodyHtml}
  <footer>مستند مُولَّد آليًا من نظام إدارة تقييم الأداء - سري وللاستخدام الداخلي فقط</footer>
</body>
</html>`;
}
