"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { kpiSchema, kpiSubcriterionSchema } from "@/lib/validations";
import { isWeightSumValid, sumWeights } from "@/lib/services/scoring";

export async function createKpiTemplateForJobTitle(jobTitleId: string) {
  const session = await requireSuperAdmin();
  const lastVersion = await prisma.kpiTemplate.findFirst({
    where: { jobTitleId },
    orderBy: { version: "desc" },
  });
  const jobTitle = await prisma.jobTitle.findUniqueOrThrow({ where: { id: jobTitleId } });

  const template = await prisma.kpiTemplate.create({
    data: {
      jobTitleId,
      name: `قالب ${jobTitle.name} - الإصدار ${(lastVersion?.version ?? 0) + 1}`,
      version: (lastVersion?.version ?? 0) + 1,
      isActive: false,
    },
  });

  await writeAuditLog({ userId: session.user.id, action: "CREATE", entity: "KpiTemplate", entityId: template.id, afterData: template });
  revalidatePath("/admin/kpi-templates");
  return template;
}

export async function addKpi(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = kpiSchema.parse({
    kpiTemplateId: formData.get("kpiTemplateId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    weight: formData.get("weight"),
    measurementType: formData.get("measurementType"),
    direction: formData.get("direction") || "HIGHER_IS_BETTER",
    measurementInstructions: formData.get("measurementInstructions") || null,
    sortOrder: formData.get("sortOrder") || 0,
  });

  const kpi = await prisma.kpi.create({ data: parsed });

  // أي تعديل على الأوزان يُعطّل القالب تلقائيًا حتى تُعاد مراجعته وتفعيله يدويًا
  await prisma.kpiTemplate.update({ where: { id: parsed.kpiTemplateId }, data: { isActive: false } });

  await writeAuditLog({ userId: session.user.id, action: "CREATE", entity: "Kpi", entityId: kpi.id, afterData: kpi });
  revalidatePath(`/admin/kpi-templates/${parsed.kpiTemplateId}`);
}

export async function updateKpi(id: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = kpiSchema.parse({
    kpiTemplateId: formData.get("kpiTemplateId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    weight: formData.get("weight"),
    measurementType: formData.get("measurementType"),
    direction: formData.get("direction") || "HIGHER_IS_BETTER",
    measurementInstructions: formData.get("measurementInstructions") || null,
    sortOrder: formData.get("sortOrder") || 0,
  });

  const before = await prisma.kpi.findUniqueOrThrow({ where: { id } });
  const after = await prisma.kpi.update({ where: { id }, data: parsed });
  await prisma.kpiTemplate.update({ where: { id: parsed.kpiTemplateId }, data: { isActive: false } });

  await writeAuditLog({ userId: session.user.id, action: "UPDATE", entity: "Kpi", entityId: id, beforeData: before, afterData: after });
  revalidatePath(`/admin/kpi-templates/${parsed.kpiTemplateId}`);
}

export async function deleteKpi(id: string, kpiTemplateId: string) {
  const session = await requireSuperAdmin();
  const before = await prisma.kpi.findUniqueOrThrow({ where: { id } });

  const usedInEvaluations = await prisma.reviewEvaluatorItem.count({ where: { kpiId: id } });
  if (usedInEvaluations > 0) {
    throw new Error("لا يمكن حذف مؤشر مستخدم في تقييمات سابقة. عطّله بدلاً من ذلك.");
  }

  await prisma.kpi.delete({ where: { id } });
  await prisma.kpiTemplate.update({ where: { id: kpiTemplateId }, data: { isActive: false } });

  await writeAuditLog({ userId: session.user.id, action: "ARCHIVE", entity: "Kpi", entityId: id, beforeData: before });
  revalidatePath(`/admin/kpi-templates/${kpiTemplateId}`);
}

/** §10: لا يسمح النظام بتفعيل Template غير صحيح (مجموع الأوزان يجب أن يساوي 100%). */
export async function activateTemplate(templateId: string) {
  const session = await requireSuperAdmin();
  const template = await prisma.kpiTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { kpis: { where: { isActive: true } } },
  });

  const weights = template.kpis.map((k) => Number(k.weight));
  if (!isWeightSumValid(weights)) {
    throw new Error(
      `لا يمكن تفعيل القالب: مجموع أوزان المؤشرات النشطة = ${sumWeights(weights)}% (يجب أن يساوي 100%)`
    );
  }

  // تعطيل أي إصدار آخر نشط لنفس المسمى الوظيفي (نسخة واحدة نشطة فقط)
  await prisma.kpiTemplate.updateMany({
    where: { jobTitleId: template.jobTitleId, id: { not: templateId } },
    data: { isActive: false },
  });

  const after = await prisma.kpiTemplate.update({ where: { id: templateId }, data: { isActive: true } });

  await writeAuditLog({ userId: session.user.id, action: "UPDATE", entity: "KpiTemplate", entityId: templateId, afterData: after });
  revalidatePath(`/admin/kpi-templates/${templateId}`);
  revalidatePath("/admin/kpi-templates");
}

export async function addSubcriterion(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = kpiSubcriterionSchema.parse({
    kpiId: formData.get("kpiId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    weight: formData.get("weight") || null,
    sortOrder: formData.get("sortOrder") || 0,
  });

  const sub = await prisma.kpiSubcriterion.create({ data: parsed });
  await writeAuditLog({ userId: session.user.id, action: "CREATE", entity: "KpiSubcriterion", entityId: sub.id, afterData: sub });
  revalidatePath(`/admin/kpi-templates/kpi/${parsed.kpiId}/subcriteria`);
}

export async function deleteSubcriterion(id: string, kpiId: string) {
  const session = await requireSuperAdmin();
  const before = await prisma.kpiSubcriterion.findUniqueOrThrow({ where: { id } });
  await prisma.kpiSubcriterion.delete({ where: { id } });
  await writeAuditLog({ userId: session.user.id, action: "ARCHIVE", entity: "KpiSubcriterion", entityId: id, beforeData: before });
  revalidatePath(`/admin/kpi-templates/kpi/${kpiId}/subcriteria`);
}
