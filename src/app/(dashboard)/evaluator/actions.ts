"use server";

import { revalidatePath } from "next/cache";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireEvaluator } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import {
  recalculateReviewEvaluatorItem,
  recalculatePerformanceReviewStatus,
  validateReviewEvaluatorForSubmit,
} from "@/lib/services/reviewEngine";
import { actualValueSaveSchema, itemFieldsSaveSchema } from "@/lib/validations";

/**
 * كل شاشات المقيّم تعمل على ReviewEvaluator (مساهمة هذا المقيّم بالذات داخل مراجعة أداء
 * موظف واحد). الملكية (evaluatorId) هي ضبط الوصول الفعلي - لا حاجة لإعادة فحص نطاق
 * المقيّم هنا لأن ReviewEvaluator لم يُنشأ أصلًا إلا وقت فتح الدورة لتعيين مطابق فعليًا.
 */
async function assertOwnedReviewEvaluator(reviewEvaluatorId: string, evaluatorUserId: string) {
  const reviewEvaluator = await prisma.reviewEvaluator.findUniqueOrThrow({
    where: { id: reviewEvaluatorId },
    include: { review: true },
  });

  if (reviewEvaluator.evaluatorId !== evaluatorUserId) {
    throw new Error("غير مصرح لك بالوصول لهذا التقييم");
  }
  if (reviewEvaluator.status === "SUBMITTED") {
    throw new Error("هذا التقييم مُرسَل ومقفل. لا يمكن تعديله إلا عبر إعادة الفتح من الإدارة.");
  }

  return reviewEvaluator;
}

async function markStartedIfNeeded(reviewEvaluatorId: string, currentStatus: string) {
  if (currentStatus === "NOT_STARTED") {
    await prisma.reviewEvaluator.update({ where: { id: reviewEvaluatorId }, data: { status: "DRAFT" } });
  }
}

/** يحفظ القيمة الفعلية المشتركة لمؤشر رقمي، ويعيد حساب نتيجة كل المقيّمين المتأثرين بها - §7. */
export async function saveActualValue(formData: FormData) {
  const session = await requireEvaluator();
  const parsed = actualValueSaveSchema.parse({
    reviewEvaluatorId: formData.get("reviewEvaluatorId"),
    kpiId: formData.get("kpiId"),
    actualValue: formData.get("actualValue") || null,
  });

  const reviewEvaluator = await assertOwnedReviewEvaluator(parsed.reviewEvaluatorId, session.user.id);

  await prisma.reviewKpiActual.update({
    where: { reviewId_kpiId: { reviewId: reviewEvaluator.reviewId, kpiId: parsed.kpiId } },
    data: { actualValue: parsed.actualValue ?? null, actualSource: "MANUAL", enteredById: session.user.id },
  });

  const affectedItems = await prisma.reviewEvaluatorItem.findMany({
    where: { kpiId: parsed.kpiId, reviewEvaluator: { reviewId: reviewEvaluator.reviewId } },
  });
  for (const item of affectedItems) {
    await recalculateReviewEvaluatorItem(item.id);
  }
  await recalculatePerformanceReviewStatus(reviewEvaluator.reviewId);

  await markStartedIfNeeded(parsed.reviewEvaluatorId, reviewEvaluator.status);

  await writeAuditLog({
    userId: session.user.id,
    action: "EVALUATION_SAVE",
    entity: "ReviewKpiActual",
    entityId: parsed.kpiId,
  });

  revalidatePath(`/evaluator/evaluate/${parsed.reviewEvaluatorId}`);
}

/** يحفظ رأي المقيّم الذاتي (Rating + تبرير + ملاحظات) الخاص بهذا المقيّم فقط لأي مؤشر. */
export async function saveItemFields(formData: FormData) {
  const session = await requireEvaluator();
  const parsed = itemFieldsSaveSchema.parse({
    reviewEvaluatorId: formData.get("reviewEvaluatorId"),
    kpiId: formData.get("kpiId"),
    ratingValue: formData.get("ratingValue") || null,
    justification: formData.get("justification") || null,
    notes: formData.get("notes") || null,
  });

  const reviewEvaluator = await assertOwnedReviewEvaluator(parsed.reviewEvaluatorId, session.user.id);

  const item = await prisma.reviewEvaluatorItem.update({
    where: { reviewEvaluatorId_kpiId: { reviewEvaluatorId: parsed.reviewEvaluatorId, kpiId: parsed.kpiId } },
    data: {
      ratingValue: parsed.ratingValue ?? null,
      justification: parsed.justification ?? null,
      notes: parsed.notes ?? null,
    },
  });

  await recalculateReviewEvaluatorItem(item.id);
  await markStartedIfNeeded(parsed.reviewEvaluatorId, reviewEvaluator.status);

  await writeAuditLog({
    userId: session.user.id,
    action: "EVALUATION_SAVE",
    entity: "ReviewEvaluatorItem",
    entityId: item.id,
  });

  revalidatePath(`/evaluator/evaluate/${parsed.reviewEvaluatorId}`);
}

export async function saveSubcriterionScore(
  reviewEvaluatorId: string,
  kpiId: string,
  subcriterionId: string,
  rating: number,
  justification: string
) {
  const session = await requireEvaluator();
  const reviewEvaluator = await assertOwnedReviewEvaluator(reviewEvaluatorId, session.user.id);

  // الحفظ التلقائي (autosave) يحفظ فورًا دون حجب - إلزامية التبرير للتقييمات المنخفضة (<3)
  // تُفرَض عند محاولة الإرسال النهائي فقط (validateReviewEvaluatorForSubmit)، لتفادي فقدان
  // التقييم صامتًا لو كتب المقيّم التبرير بعد اختيار الرقم بدل قبله.

  const item = await prisma.reviewEvaluatorItem.findUniqueOrThrow({
    where: { reviewEvaluatorId_kpiId: { reviewEvaluatorId, kpiId } },
  });

  await prisma.reviewEvaluatorSubcriterionScore.upsert({
    where: { reviewEvaluatorItemId_subcriterionId: { reviewEvaluatorItemId: item.id, subcriterionId } },
    update: { rating, justification },
    create: { reviewEvaluatorItemId: item.id, subcriterionId, rating, justification },
  });

  await recalculateReviewEvaluatorItem(item.id);
  await markStartedIfNeeded(reviewEvaluatorId, reviewEvaluator.status);

  revalidatePath(`/evaluator/evaluate/${reviewEvaluatorId}`);
}

export async function uploadAttachment(formData: FormData) {
  const session = await requireEvaluator();
  const reviewEvaluatorId = formData.get("reviewEvaluatorId") as string;
  const kpiId = (formData.get("kpiId") as string) || null;
  const file = formData.get("file") as File | null;

  if (!file) throw new Error("لم يتم اختيار ملف");

  await assertOwnedReviewEvaluator(reviewEvaluatorId, session.user.id);

  const allowedExt = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg"];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExt.includes(ext)) throw new Error("امتداد الملف غير مسموح به");

  const maxSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 10);
  if (file.size > maxSizeMb * 1024 * 1024) throw new Error(`حجم الملف يتجاوز الحد المسموح (${maxSizeMb}MB)`);

  const uploadsDir = path.join(process.cwd(), process.env.UPLOADS_DIR ?? "uploads", reviewEvaluatorId);
  await mkdir(uploadsDir, { recursive: true });

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_؀-ۿ]/g, "_")}`;
  const filePath = path.join(uploadsDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const attachment = await prisma.reviewAttachment.create({
    data: {
      reviewEvaluatorId,
      kpiId,
      fileName: file.name,
      filePath: path.join(reviewEvaluatorId, safeName),
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      uploadedById: session.user.id,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "ATTACHMENT_UPLOAD",
    entity: "ReviewAttachment",
    entityId: attachment.id,
  });

  revalidatePath(`/evaluator/evaluate/${reviewEvaluatorId}`);
  return attachment;
}

export async function checkSubmitReadiness(reviewEvaluatorId: string) {
  const session = await requireEvaluator();
  await assertOwnedReviewEvaluator(reviewEvaluatorId, session.user.id);
  return validateReviewEvaluatorForSubmit(reviewEvaluatorId);
}

/** §26/§5.8-5.9: تحقق كامل، ثم إرسال وقفل مساهمة هذا المقيّم، وإعادة حساب حالة المراجعة الأب. */
export async function submitEvaluation(reviewEvaluatorId: string) {
  const session = await requireEvaluator();
  const reviewEvaluator = await assertOwnedReviewEvaluator(reviewEvaluatorId, session.user.id);

  const issues = await validateReviewEvaluatorForSubmit(reviewEvaluatorId);
  if (issues.length > 0) {
    throw new Error(`لا يمكن الإرسال - يوجد ${issues.length} عنصر ناقص. راجع شاشة المراجعة.`);
  }

  const after = await prisma.reviewEvaluator.update({
    where: { id: reviewEvaluatorId },
    data: { status: "SUBMITTED", submittedAt: new Date(), lockedAt: new Date() },
  });

  await recalculatePerformanceReviewStatus(reviewEvaluator.reviewId);

  await writeAuditLog({
    userId: session.user.id,
    action: "EVALUATION_SUBMIT",
    entity: "ReviewEvaluator",
    entityId: reviewEvaluatorId,
    beforeData: { status: reviewEvaluator.status },
    afterData: { status: after.status, overallScore: after.overallScore, overallPercentage: after.overallPercentage },
  });

  revalidatePath(`/evaluator/evaluate/${reviewEvaluatorId}`);
  revalidatePath("/evaluator");
  return after;
}
