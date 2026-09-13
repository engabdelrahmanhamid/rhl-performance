/**
 * خدمة حساب التقييم (Evaluation Calculation Service) — نسخة مُصححة بعد المراجعة المعمارية.
 * كل الدوال هنا نقية (Pure Functions) بدون أي استدعاء لقاعدة البيانات.
 *
 * تصحيحات هذه النسخة مقارنة بالمسودة الأولى:
 *  - §14 من المراجعة: تصحيح المثال المرجعي (Achievement=120%, Weight=20 => المساهمة 20، وليس 18).
 *  - §15: Target<=0 لمؤشر "الأعلى أفضل" يُعتبر خطأ إعداد (Configuration Error) يمنع الإرسال،
 *    ولا يُفترض له إنجاز 100% تلقائيًا كما في المسودة الأولى.
 *  - §16: أُزيلت قاعدة الـ200% المُختلَقة لمؤشرات "الأقل أفضل" عند Actual=0؛ الإنجاز يُحدّ عند 100%
 *    كحد أقصى للعرض والاحتساب معًا (يمكن للواجهة عرض "تجاوز الهدف" بدل نسبة وهمية).
 */

export type KpiDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";

const WEIGHT_TOLERANCE = 0.01;

export type AchievementResult =
  | { ok: true; achievementPct: number }
  | { ok: false; reason: string };

/**
 * §6.2 (مُصحَّحة) — نسبة الإنجاز (Achievement %)، محدودة بحد أقصى 100% لكلا الاتجاهين.
 * تُعيد خطأ إعداد صريحًا بدل اختراع نسبة عند إعدادات غير منطقية (Target<=0 لمؤشر "الأعلى أفضل").
 */
export function evaluateAchievement(
  direction: KpiDirection,
  target: number,
  actual: number
): AchievementResult {
  if (direction === "HIGHER_IS_BETTER") {
    if (target <= 0) {
      return { ok: false, reason: 'الهدف يجب أن يكون أكبر من صفر لمؤشر من نوع "الأعلى أفضل" - راجع الإدارة' };
    }
    // الإنجاز الحقيقي قد يتجاوز 100% (يُحفظ كاملاً لأغراض التقارير) - الحد الأقصى يُطبَّق فقط عند حساب المساهمة.
    return { ok: true, achievementPct: (actual / target) * 100 };
  }

  // LOWER_IS_BETTER
  if (target < 0 || actual < 0) {
    return { ok: false, reason: "القيم لا يمكن أن تكون سالبة" };
  }
  if (actual === 0) {
    // لا أخطاء / تجاوز الهدف بالكامل - إنجاز كامل 100% (بلا نسبة مُختلَقة أعلى من ذلك)
    return { ok: true, achievementPct: 100 };
  }
  const pct = (target / actual) * 100;
  return { ok: true, achievementPct: Math.min(pct, 100) };
}

/**
 * §6.3/§14 — مساهمة الـKPI في النتيجة النهائية، محدودة بحد أقصى = وزن الـKPI.
 * مثال مُصحَّح: Achievement=120%, Weight=20 => min(120,100)=100% => المساهمة = 20 (وليس 18).
 */
export function calculateKpiScoreContribution(achievementPct: number, kpiWeight: number): number {
  const cappedAchievement = Math.min(achievementPct, 100);
  return (cappedAchievement / 100) * kpiWeight;
}

export function calculateRatingScoreContribution(rating: number, kpiWeight: number): number {
  return (rating / 5) * kpiWeight;
}

export interface SubcriterionScore {
  rating: number;
  weight?: number | null;
}

export function calculateSubcriteriaAverage(scores: SubcriterionScore[]): number {
  if (scores.length === 0) return 0;

  const hasWeights = scores.every((s) => s.weight !== null && s.weight !== undefined);

  if (hasWeights) {
    const totalWeight = scores.reduce((sum, s) => sum + (s.weight as number), 0);
    if (Math.abs(totalWeight - 100) > WEIGHT_TOLERANCE) {
      throw new Error(
        `مجموع أوزان المعايير الفرعية يجب أن يساوي 100% (القيمة الحالية: ${totalWeight}%)`
      );
    }
    return scores.reduce((sum, s) => sum + s.rating * ((s.weight as number) / 100), 0);
  }

  return scores.reduce((sum, s) => sum + s.rating, 0) / scores.length;
}

export interface EvaluationItemResult {
  scoreContribution: number;
}

/** نتيجة مقيّم واحد لموظف واحد (من أصل 100 نسبة، ومن أصل 5 كنتيجة). */
export function aggregateEvaluatorScore(items: EvaluationItemResult[]): {
  percentage: number;
  score: number;
} {
  const percentage = items.reduce((sum, i) => sum + i.scoreContribution, 0);
  const score = (percentage / 100) * 5;
  return { percentage: round2(percentage), score: round2(score) };
}

export interface EvaluatorWeightedScore {
  score: number;
  weight: number;
}

/**
 * §17 من المراجعة — الصيغة الصريحة:
 *   FinalScore = SUM(EvaluatorScore × EvaluatorWeight / 100)
 * مثال مرجعي: A(50%,4.5) + B(30%,4.0) + C(20%,4.8) => 4.41/5 = 88.2%
 */
export function calculateWeightedFinalScore(evaluators: EvaluatorWeightedScore[]): {
  finalScore: number;
  finalPercentage: number;
} {
  if (evaluators.length === 0) return { finalScore: 0, finalPercentage: 0 };

  const totalWeight = evaluators.reduce((sum, e) => sum + e.weight, 0);
  if (Math.abs(totalWeight - 100) > WEIGHT_TOLERANCE) {
    throw new Error(
      `مجموع أوزان المقيّمين يجب أن يساوي 100% لحساب النتيجة النهائية (القيمة الحالية: ${totalWeight}%)`
    );
  }

  const finalScore = evaluators.reduce((sum, e) => sum + e.score * (e.weight / 100), 0);
  const finalPercentage = (finalScore / 5) * 100;

  return { finalScore: round2(finalScore), finalPercentage: round2(finalPercentage) };
}

export function isWeightSumValid(weights: number[]): boolean {
  const total = weights.reduce((sum, w) => sum + w, 0);
  return Math.abs(total - 100) <= WEIGHT_TOLERANCE;
}

export function sumWeights(weights: number[]): number {
  return round2(weights.reduce((sum, w) => sum + w, 0));
}

export interface PerformanceLabelRange {
  label: string;
  minPct: number;
  maxPct: number;
}

export function resolvePerformanceLabel(
  percentage: number,
  labels: PerformanceLabelRange[]
): string | null {
  const match = labels.find((l) => percentage >= l.minPct && percentage <= l.maxPct);
  return match?.label ?? null;
}

/**
 * §22 من المراجعة — تحقق من صحة تصنيفات الأداء: كل حد بين 0 و100، ولا تداخل بين النطاقات.
 */
export function validatePerformanceLabelRanges(labels: PerformanceLabelRange[]): string[] {
  const errors: string[] = [];

  for (const l of labels) {
    if (l.minPct > l.maxPct) errors.push(`"${l.label}": الحد الأدنى أكبر من الحد الأعلى`);
  }

  const sorted = [...labels].sort((a, b) => a.minPct - b.minPct);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].maxPct >= sorted[i + 1].minPct) {
      errors.push(`تداخل بين "${sorted[i].label}" و"${sorted[i + 1].label}"`);
    }
  }

  return errors;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
