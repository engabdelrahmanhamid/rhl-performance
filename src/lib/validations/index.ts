import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().min(2, "اسم الفرع مطلوب"),
  code: z.string().min(2, "رمز الفرع مطلوب"),
});

/** فارغ branchIds = القسم متاح في كل الفروع (BranchDepartment اختياري - انظر تعليق النموذج). */
export const departmentSchema = z.object({
  name: z.string().min(2, "اسم القسم مطلوب"),
  branchIds: z.array(z.string()).default([]),
});

export const jobTitleSchema = z.object({
  name: z.string().min(2, "اسم المسمى الوظيفي مطلوب"),
  description: z.string().optional().nullable(),
});

export const employeeSchema = z.object({
  employeeNumber: z.string().min(1, "الرقم الوظيفي مطلوب"),
  fullName: z.string().min(2, "الاسم مطلوب"),
  branchId: z.string().min(1, "الفرع مطلوب"),
  departmentId: z.string().optional().nullable(),
  jobTitleId: z.string().min(1, "المسمى الوظيفي مطلوب"),
  employmentStatus: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  hireDate: z.coerce.date(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const userSchema = z.object({
  fullName: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").optional(),
  role: z.enum(["SUPER_ADMIN", "EVALUATOR"]),
});

export const kpiTemplateSchema = z.object({
  jobTitleId: z.string().min(1),
  name: z.string().min(2),
});

export const kpiSchema = z.object({
  kpiTemplateId: z.string().min(1),
  name: z.string().min(2, "اسم المؤشر مطلوب"),
  description: z.string().optional().nullable(),
  weight: z.coerce.number().min(0.01).max(100),
  measurementType: z.enum(["NUMBER", "PERCENTAGE", "CURRENCY", "RATING_1_5", "SUBCRITERIA_RATING"]),
  direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER"]).default("HIGHER_IS_BETTER"),
  measurementInstructions: z.string().optional().nullable(),
  sortOrder: z.coerce.number().default(0),
});

export const kpiSubcriterionSchema = z.object({
  kpiId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  weight: z.coerce.number().min(0).max(100).optional().nullable(),
  sortOrder: z.coerce.number().default(0),
});

export const targetSchema = z.object({
  kpiId: z.string().min(1),
  level: z.enum(["GLOBAL", "BRANCH", "DEPARTMENT", "JOB_TITLE", "EMPLOYEE"]),
  /** PER_EMPLOYEE: يخضع لهرمية الحل الفردي. AGGREGATE: رقم إجمالي للتقارير فقط - §3.3/§11 من المراجعة. */
  applicationMode: z.enum(["PER_EMPLOYEE", "AGGREGATE"]).default("PER_EMPLOYEE"),
  branchId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  jobTitleId: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
  value: z.coerce.number(),
});

export const evaluationCycleSchema = z.object({
  name: z.string().min(2),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  openDate: z.coerce.date(),
  deadline: z.coerce.date(),
});

/**
 * قاعدة نطاق واحدة (EvaluatorAssignmentRule) - §4 من المراجعة: الحقول المحددة داخل نفس
 * القاعدة تُطبَّق AND. إما isAllEmployees=true (بلا أي حقل آخر)، أو حقل واحد على الأقل محدد.
 */
export const evaluatorAssignmentRuleSchema = z
  .object({
    isAllEmployees: z.boolean().default(false),
    branchId: z.string().optional().nullable(),
    departmentId: z.string().optional().nullable(),
    jobTitleId: z.string().optional().nullable(),
  })
  .refine((r) => r.isAllEmployees || r.branchId || r.departmentId || r.jobTitleId, {
    message: "حدّد فرعًا أو قسمًا أو مسمى وظيفيًا لهذه القاعدة، أو اختر (كل الموظفين)",
  });

export const evaluatorAssignmentSchema = z
  .object({
    evaluatorId: z.string().min(1, "المقيّم مطلوب"),
    label: z.string().optional().nullable(),
    defaultWeight: z.coerce.number().min(0.01).max(100),
    rules: z.array(evaluatorAssignmentRuleSchema).default([]),
    specificEmployeeIds: z.array(z.string()).default([]),
  })
  .refine((data) => data.rules.length > 0 || data.specificEmployeeIds.length > 0, {
    message: "يجب تحديد قاعدة نطاق واحدة على الأقل أو موظف محدد واحد على الأقل",
  });

/** يحفظ القيمة الفعلية المشتركة (ReviewKpiActual) لمؤشر رقمي واحد - §7: مشتركة بين كل المقيّمين. */
export const actualValueSaveSchema = z.object({
  reviewEvaluatorId: z.string().min(1),
  kpiId: z.string().min(1),
  actualValue: z.coerce.number().optional().nullable(),
});

/**
 * يحفظ حقول ReviewEvaluatorItem الخاصة بهذا المقيّم فقط: ratingValue (لمؤشرات Rating)،
 * والتبرير/الملاحظات (تنطبق على أي نوع مؤشر - حتى الموضوعية، كتعليق شخصي من المقيّم).
 */
export const itemFieldsSaveSchema = z.object({
  reviewEvaluatorId: z.string().min(1),
  kpiId: z.string().min(1),
  ratingValue: z.coerce.number().min(1).max(5).optional().nullable(),
  justification: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const reopenEvaluationSchema = z.object({
  reviewEvaluatorId: z.string().min(1),
  reason: z.string().min(5, "سبب إعادة الفتح إلزامي (5 أحرف على الأقل)"),
});
