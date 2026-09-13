import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  assignmentCoversEmployee,
  getEmployeeVisibilityFilter,
  isEmployeeInEvaluatorScope,
} from "@/lib/services/evaluatorScope";
import { createOrgFixture, cleanupOrgFixture, type OrgFixture } from "./helpers/dbFixtures";

const employee = { id: "emp-1", branchId: "branch-jeddah", departmentId: "dept-cs", jobTitleId: "job-lawyer" };

describe("assignmentCoversEmployee — §4 من المراجعة: AND داخل القاعدة الواحدة، OR بين القواعد والموظفين المحددين", () => {
  it("isAllEmployees=true تطابق أي موظف بصرف النظر عن باقي الحقول", () => {
    const assignment = {
      rules: [{ isAllEmployees: true, branchId: null, departmentId: null, jobTitleId: null }],
      specificEmployees: [],
    };
    expect(assignmentCoversEmployee(assignment, employee)).toBe(true);
  });

  it("قاعدة بحقل واحد (Branch) تطابق فقط موظفي نفس الفرع", () => {
    const assignment = {
      rules: [{ isAllEmployees: false, branchId: "branch-jeddah", departmentId: null, jobTitleId: null }],
      specificEmployees: [],
    };
    expect(assignmentCoversEmployee(assignment, employee)).toBe(true);
    expect(assignmentCoversEmployee(assignment, { ...employee, branchId: "branch-riyadh" })).toBe(false);
  });

  it("قاعدة بحقلين معًا (Branch AND JobTitle) - يجب تطابق كليهما وليس أحدهما فقط", () => {
    const assignment = {
      rules: [{ isAllEmployees: false, branchId: "branch-jeddah", departmentId: null, jobTitleId: "job-lawyer" }],
      specificEmployees: [],
    };
    expect(assignmentCoversEmployee(assignment, employee)).toBe(true);
    // نفس الفرع لكن مسمى وظيفي مختلف => لا تطابق (AND وليس OR بين حقول نفس القاعدة)
    expect(assignmentCoversEmployee(assignment, { ...employee, jobTitleId: "job-secretary" })).toBe(false);
  });

  it("قاعدتان منفصلتان تحت نفس التعيين تُجمَعان بمنطق OR فيما بينهما", () => {
    const assignment = {
      rules: [
        { isAllEmployees: false, branchId: "branch-riyadh", departmentId: null, jobTitleId: null },
        { isAllEmployees: false, branchId: null, departmentId: null, jobTitleId: "job-lawyer" },
      ],
      specificEmployees: [],
    };
    // لا يطابق فرع الرياض، لكن يطابق المسمى الوظيفي عبر القاعدة الثانية => OR يُنجح المطابقة
    expect(assignmentCoversEmployee(assignment, employee)).toBe(true);
  });

  it("موظف محدد بالاسم (specificEmployees) يطابق حتى لو لم تطابقه أي قاعدة نطاق", () => {
    const assignment = {
      rules: [{ isAllEmployees: false, branchId: "branch-riyadh", departmentId: null, jobTitleId: null }],
      specificEmployees: [{ employeeId: "emp-1" }],
    };
    expect(assignmentCoversEmployee(assignment, employee)).toBe(true);
    expect(assignmentCoversEmployee(assignment, { ...employee, id: "emp-2" })).toBe(false);
  });

  it("قاعدة بلا أي حقل محدد وبلا isAllEmployees تُتجاهل (لا تطابق شيئًا)", () => {
    const assignment = {
      rules: [{ isAllEmployees: false, branchId: null, departmentId: null, jobTitleId: null }],
      specificEmployees: [],
    };
    expect(assignmentCoversEmployee(assignment, employee)).toBe(false);
  });

  it("لا قواعد ولا موظفون محددون => لا تطابق إطلاقًا", () => {
    expect(assignmentCoversEmployee({ rules: [], specificEmployees: [] }, employee)).toBe(false);
  });
});

describe("getEmployeeVisibilityFilter / isEmployeeInEvaluatorScope — تكامل فعلي مع قاعدة البيانات", () => {
  let fx: OrgFixture;
  let outOfScopeBranchId: string;
  let outOfScopeEmployeeId: string;
  let unassignedEvaluatorId: string;

  beforeAll(async () => {
    fx = await createOrgFixture(); // مقيّم واحد بتعيين نطاقه فرع fx.branchId فقط
    const runId = fx.runId;

    const otherBranch = await prisma.branch.create({ data: { name: `OtherBranch_${runId}`, code: `OB_${runId}` } });
    outOfScopeBranchId = otherBranch.id;

    const otherEmployee = await prisma.employee.create({
      data: {
        employeeNumber: `EMP_OTHER_${runId}`,
        fullName: `Other Employee ${runId}`,
        branchId: otherBranch.id,
        jobTitleId: fx.jobTitleId,
        hireDate: new Date("2020-01-01"),
      },
    });
    outOfScopeEmployeeId = otherEmployee.id;

    const unassignedUser = await prisma.user.create({
      data: {
        fullName: `Unassigned Evaluator ${runId}`,
        email: `unassigned_${runId}@test.local`,
        passwordHash: "test-hash",
        role: "EVALUATOR",
      },
    });
    unassignedEvaluatorId = unassignedUser.id;
  });

  afterAll(async () => {
    await prisma.employee.deleteMany({ where: { id: outOfScopeEmployeeId } });
    await prisma.branch.deleteMany({ where: { id: outOfScopeBranchId } });
    await prisma.user.deleteMany({ where: { id: unassignedEvaluatorId } });
    await cleanupOrgFixture(fx);
  });

  it("موظف داخل نطاق الفرع المُعيَّن => ضمن نطاق المقيّم", async () => {
    const inScope = await isEmployeeInEvaluatorScope(fx.evaluatorUserIds[0], fx.employeeId);
    expect(inScope).toBe(true);
  });

  it("موظف من فرع مختلف غير مشمول بأي قاعدة => خارج النطاق", async () => {
    const inScope = await isEmployeeInEvaluatorScope(fx.evaluatorUserIds[0], outOfScopeEmployeeId);
    expect(inScope).toBe(false);
  });

  it("مقيّم بلا أي تعيين فعّال إطلاقًا => يرجع فلتر لا يطابق شيئًا ({id:{in:[]}})", async () => {
    const filter = await getEmployeeVisibilityFilter(unassignedEvaluatorId);
    expect(filter).toEqual({ id: { in: [] } });

    const inScope = await isEmployeeInEvaluatorScope(unassignedEvaluatorId, fx.employeeId);
    expect(inScope).toBe(false);
  });
});
