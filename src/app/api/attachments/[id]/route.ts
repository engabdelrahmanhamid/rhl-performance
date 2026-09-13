import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEmployeeInEvaluatorScope } from "@/lib/services/evaluatorScope";

/**
 * §5.11/§15/§38: تنزيل محمي - لا روابط مباشرة عامة.
 * يُسمح فقط لـSuper Admin أو المقيّم صاحب التقييم (أو أي مقيّم ضمن نفس نطاق الموظف).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const attachment = await prisma.reviewAttachment.findUnique({
    where: { id: params.id },
    include: { reviewEvaluator: { include: { review: true } } },
  });
  if (!attachment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (session.user.role !== "SUPER_ADMIN") {
    const isOwner = attachment.reviewEvaluator.evaluatorId === session.user.id;
    const inScope = await isEmployeeInEvaluatorScope(session.user.id, attachment.reviewEvaluator.review.employeeId);
    if (!isOwner && !inScope) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const fullPath = path.join(process.cwd(), process.env.UPLOADS_DIR ?? "uploads", attachment.filePath);
  const buffer = await readFile(fullPath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    },
  });
}
