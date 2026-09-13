import { describe, it, expect } from "vitest";
import {
  evaluateAchievement,
  calculateKpiScoreContribution,
  calculateRatingScoreContribution,
  calculateSubcriteriaAverage,
  aggregateEvaluatorScore,
  calculateWeightedFinalScore,
  isWeightSumValid,
  sumWeights,
  resolvePerformanceLabel,
  validatePerformanceLabelRanges,
} from "@/lib/services/scoring";

describe("evaluateAchievement — Higher Is Better", () => {
  it("Target=100, Actual=90 => 90%", () => {
    const result = evaluateAchievement("HIGHER_IS_BETTER", 100, 90);
    expect(result.ok).toBe(true);
    expect(result.ok && result.achievementPct).toBe(90);
  });

  it("يسمح بتجاوز 100% عند تجاوز الهدف (Target=100, Actual=120 => 120%) - يُحفظ كاملاً للتقارير", () => {
    const result = evaluateAchievement("HIGHER_IS_BETTER", 100, 120);
    expect(result.ok).toBe(true);
    expect(result.ok && result.achievementPct).toBe(120);
  });

  it("§15 من المراجعة: Target<=0 => خطأ إعداد صريح (لا يُفترض 100% تلقائيًا)", () => {
    const result = evaluateAchievement("HIGHER_IS_BETTER", 0, 50);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("الهدف يجب أن يكون أكبر من صفر");
    }
  });

  it("Target=-5 => خطأ إعداد أيضًا", () => {
    const result = evaluateAchievement("HIGHER_IS_BETTER", -5, 50);
    expect(result.ok).toBe(false);
  });
});

describe("evaluateAchievement — Lower Is Better", () => {
  it("Target=10 أخطاء, Actual=5 (أفضل من الهدف) => 200% خام لكن محدود بـ100% (لا نسبة مُختلَقة)", () => {
    const result = evaluateAchievement("LOWER_IS_BETTER", 10, 5);
    expect(result.ok).toBe(true);
    expect(result.ok && result.achievementPct).toBe(100);
  });

  it("Target=10, Actual=20 (أسوأ من الهدف) => 50%", () => {
    const result = evaluateAchievement("LOWER_IS_BETTER", 10, 20);
    expect(result.ok).toBe(true);
    expect(result.ok && result.achievementPct).toBe(50);
  });

  it("§16 من المراجعة: Actual=0 (الحالة المثالية) => 100% محدود، وليس 200% مُختلَقة", () => {
    const result = evaluateAchievement("LOWER_IS_BETTER", 10, 0);
    expect(result.ok).toBe(true);
    expect(result.ok && result.achievementPct).toBe(100);
  });

  it("Target=10, Actual=10 => 100% بالضبط", () => {
    const result = evaluateAchievement("LOWER_IS_BETTER", 10, 10);
    expect(result.ok).toBe(true);
    expect(result.ok && result.achievementPct).toBe(100);
  });

  it("قيم سالبة => خطأ إعداد", () => {
    const result = evaluateAchievement("LOWER_IS_BETTER", -1, 5);
    expect(result.ok).toBe(false);
  });
});

describe("calculateKpiScoreContribution — §14 المثال المرجعي المُصحَّح", () => {
  it("Achievement=90%, Weight=20 => المساهمة 18", () => {
    expect(calculateKpiScoreContribution(90, 20)).toBeCloseTo(18, 5);
  });

  it("§14: Achievement=120% (تجاوز), Weight=20 => المساهمة محدودة بـ20/20 (وليس 18/20 كما ورد خطأً في المسودة الأولى)", () => {
    expect(calculateKpiScoreContribution(120, 20)).toBeCloseTo(20, 5);
  });
});

describe("calculateRatingScoreContribution", () => {
  it("Rating=4/5, Weight=10 => المساهمة 8", () => {
    expect(calculateRatingScoreContribution(4, 10)).toBeCloseTo(8, 5);
  });
});

describe("calculateSubcriteriaAverage — §13", () => {
  it("بدون أوزان => متوسط حسابي بسيط", () => {
    const avg = calculateSubcriteriaAverage([{ rating: 4 }, { rating: 5 }, { rating: 3 }]);
    expect(avg).toBeCloseTo((4 + 5 + 3) / 3, 5);
  });

  it("بأوزان تساوي 100% => متوسط مرجّح", () => {
    const avg = calculateSubcriteriaAverage([
      { rating: 4, weight: 60 },
      { rating: 5, weight: 40 },
    ]);
    expect(avg).toBeCloseTo(4 * 0.6 + 5 * 0.4, 5);
  });

  it("يرفض أوزانًا مجموعها ليس 100%", () => {
    expect(() =>
      calculateSubcriteriaAverage([
        { rating: 4, weight: 60 },
        { rating: 5, weight: 30 },
      ])
    ).toThrow();
  });
});

describe("aggregateEvaluatorScore — §6.5", () => {
  it("مجموع المساهمات 88 => نتيجة 4.4/5 ونسبة 88%", () => {
    const result = aggregateEvaluatorScore([
      { scoreContribution: 30 },
      { scoreContribution: 28 },
      { scoreContribution: 30 },
    ]);
    expect(result.percentage).toBeCloseTo(88, 5);
    expect(result.score).toBeCloseTo(4.4, 5);
  });
});

describe("calculateWeightedFinalScore — §17 المثال المرجعي", () => {
  it("A(50%,4.5) + B(30%,4.0) + C(20%,4.8) => 4.41/5 و88.2%", () => {
    const result = calculateWeightedFinalScore([
      { weight: 50, score: 4.5 },
      { weight: 30, score: 4.0 },
      { weight: 20, score: 4.8 },
    ]);
    expect(result.finalScore).toBeCloseTo(4.41, 2);
    expect(result.finalPercentage).toBeCloseTo(88.2, 1);
  });

  it("يرفض الحساب إذا لم يكن مجموع الأوزان 100%", () => {
    expect(() =>
      calculateWeightedFinalScore([
        { weight: 50, score: 4.5 },
        { weight: 30, score: 4.0 },
      ])
    ).toThrow();
  });

  it("مقيّم واحد بوزن 100% => النتيجة تساوي نتيجته مباشرة", () => {
    const result = calculateWeightedFinalScore([{ weight: 100, score: 3.8 }]);
    expect(result.finalScore).toBeCloseTo(3.8, 5);
  });
});

describe("isWeightSumValid / sumWeights", () => {
  it("100% بالضبط صالح", () => {
    expect(isWeightSumValid([35, 20, 15, 10, 10, 10])).toBe(true);
  });

  it("99.99% (خطأ تقريب عشري) يُقبل ضمن الهامش", () => {
    expect(isWeightSumValid([33.33, 33.33, 33.34])).toBe(true);
  });

  it("90% غير صالح", () => {
    expect(isWeightSumValid([30, 30, 30])).toBe(false);
  });

  it("sumWeights يعيد المجموع الصحيح مقربًا لمنزلتين", () => {
    expect(sumWeights([35, 20, 15, 10, 10, 10])).toBe(100);
  });
});

describe("resolvePerformanceLabel — §23", () => {
  const labels = [
    { label: "متميز", minPct: 90, maxPct: 999 },
    { label: "يفوق التوقعات", minPct: 80, maxPct: 89.99 },
    { label: "جيد", minPct: 70, maxPct: 79.99 },
    { label: "يحتاج تطوير", minPct: 60, maxPct: 69.99 },
    { label: "يحتاج متابعة", minPct: -999, maxPct: 59.99 },
  ];

  it("88.2% => يفوق التوقعات", () => {
    expect(resolvePerformanceLabel(88.2, labels)).toBe("يفوق التوقعات");
  });

  it("95% => متميز", () => {
    expect(resolvePerformanceLabel(95, labels)).toBe("متميز");
  });

  it("55% => يحتاج متابعة", () => {
    expect(resolvePerformanceLabel(55, labels)).toBe("يحتاج متابعة");
  });
});

describe("validatePerformanceLabelRanges — §22 من المراجعة", () => {
  it("نطاقات صحيحة بلا تداخل => لا أخطاء", () => {
    const errors = validatePerformanceLabelRanges([
      { label: "متميز", minPct: 90, maxPct: 100 },
      { label: "جيد", minPct: 70, maxPct: 89.99 },
      { label: "ضعيف", minPct: 0, maxPct: 69.99 },
    ]);
    expect(errors).toHaveLength(0);
  });

  it("حد أدنى أكبر من الحد الأعلى => خطأ", () => {
    const errors = validatePerformanceLabelRanges([{ label: "خطأ", minPct: 80, maxPct: 70 }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("تداخل بين نطاقين => خطأ", () => {
    const errors = validatePerformanceLabelRanges([
      { label: "أ", minPct: 70, maxPct: 90 },
      { label: "ب", minPct: 85, maxPct: 100 },
    ]);
    expect(errors.length).toBeGreaterThan(0);
  });
});
