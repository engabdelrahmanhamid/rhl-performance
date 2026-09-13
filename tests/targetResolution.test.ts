import { describe, it, expect } from "vitest";
import { resolveEffectiveTarget, buildScopeKey, type TargetRecord } from "@/lib/services/targetResolution";

const employee = {
  employeeId: "emp-ahmed",
  branchId: "branch-jeddah",
  departmentId: "dept-cs",
  jobTitleId: "job-customer-service",
};

function target(
  scopeType: TargetRecord["scopeType"],
  value: number,
  ids: { branchId?: string | null; departmentId?: string | null; jobTitleId?: string | null; employeeId?: string | null } = {}
): TargetRecord {
  return {
    scopeType,
    scopeKey: buildScopeKey(scopeType, ids),
    applicationMode: "PER_EMPLOYEE",
    branchId: ids.branchId ?? null,
    departmentId: ids.departmentId ?? null,
    jobTitleId: ids.jobTitleId ?? null,
    employeeId: ids.employeeId ?? null,
    value,
  };
}

describe("buildScopeKey — §10/§11 من المراجعة: مفتاح طبيعي بدل تفرّد NULL في Postgres", () => {
  it("GLOBAL دائمًا نفس المفتاح", () => {
    expect(buildScopeKey("GLOBAL", {})).toBe("GLOBAL");
  });

  it("BRANCH يتضمن معرّف الفرع", () => {
    expect(buildScopeKey("BRANCH", { branchId: "branch-jeddah" })).toBe("BRANCH:branch-jeddah");
  });

  it("EMPLOYEE يتضمن معرّف الموظف", () => {
    expect(buildScopeKey("EMPLOYEE", { employeeId: "emp-ahmed" })).toBe("EMPLOYEE:emp-ahmed");
  });
});

describe("resolveEffectiveTarget — هرمية الأولوية (Employee > JobTitle > Department > Branch > Global)", () => {
  it("المثال المرجعي: Global=200, Jeddah=250, Ahmed=300 => النتيجة 300 (Employee أولوية)", () => {
    const targets: TargetRecord[] = [
      target("GLOBAL", 200),
      target("BRANCH", 250, { branchId: "branch-jeddah" }),
      target("EMPLOYEE", 300, { employeeId: "emp-ahmed" }),
    ];

    const result = resolveEffectiveTarget(targets, employee);
    expect(result?.value).toBe(300);
    expect(result?.sourceLevel).toBe("EMPLOYEE");
  });

  it("بدون Employee Target => يستخدم Job Title", () => {
    const targets: TargetRecord[] = [
      target("GLOBAL", 200),
      target("JOB_TITLE", 220, { jobTitleId: "job-customer-service" }),
    ];

    const result = resolveEffectiveTarget(targets, employee);
    expect(result?.value).toBe(220);
    expect(result?.sourceLevel).toBe("JOB_TITLE");
  });

  it("بدون Job Title => يستخدم Department", () => {
    const targets: TargetRecord[] = [target("GLOBAL", 200), target("DEPARTMENT", 210, { departmentId: "dept-cs" })];

    const result = resolveEffectiveTarget(targets, employee);
    expect(result?.value).toBe(210);
    expect(result?.sourceLevel).toBe("DEPARTMENT");
  });

  it("بدون Department => يستخدم Branch", () => {
    const targets: TargetRecord[] = [target("GLOBAL", 200), target("BRANCH", 250, { branchId: "branch-jeddah" })];

    const result = resolveEffectiveTarget(targets, employee);
    expect(result?.value).toBe(250);
    expect(result?.sourceLevel).toBe("BRANCH");
  });

  it("بدون أي مستوى محدد => يستخدم Global", () => {
    const targets: TargetRecord[] = [target("GLOBAL", 200)];

    const result = resolveEffectiveTarget(targets, employee);
    expect(result?.value).toBe(200);
    expect(result?.sourceLevel).toBe("GLOBAL");
  });

  it("لا توجد أهداف إطلاقًا => null (لا يُخترع رقم)", () => {
    const result = resolveEffectiveTarget([], employee);
    expect(result).toBeNull();
  });

  it("هدف لفرع آخر لا يؤثر على موظف فرع مختلف", () => {
    const targets: TargetRecord[] = [target("BRANCH", 999, { branchId: "branch-riyadh" })];
    const result = resolveEffectiveTarget(targets, employee);
    expect(result).toBeNull();
  });

  it("§11 من المراجعة: أهداف AGGREGATE تُستبعد تمامًا من الحل الفردي حتى لو كانت على مستوى Employee", () => {
    const targets: TargetRecord[] = [
      { ...target("EMPLOYEE", 999, { employeeId: "emp-ahmed" }), applicationMode: "AGGREGATE" },
      target("GLOBAL", 200),
    ];

    const result = resolveEffectiveTarget(targets, employee);
    expect(result?.value).toBe(200);
    expect(result?.sourceLevel).toBe("GLOBAL");
  });
});
