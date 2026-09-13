import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/rbac";
import { buildImportTemplate } from "@/lib/services/excelImport";

export async function GET() {
  await requireSuperAdmin();
  const buffer = await buildImportTemplate();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employee_import_template.xlsx"',
    },
  });
}
