-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'EVALUATOR');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'UPCOMING', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvaluatorSubmissionStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AWAITING_EVALUATIONS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('NUMBER', 'PERCENTAGE', 'CURRENCY', 'RATING_1_5', 'SUBCRITERIA_RATING');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER');

-- CreateEnum
CREATE TYPE "TargetScopeType" AS ENUM ('GLOBAL', 'BRANCH', 'DEPARTMENT', 'JOB_TITLE', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "TargetApplicationMode" AS ENUM ('PER_EMPLOYEE', 'AGGREGATE');

-- CreateEnum
CREATE TYPE "ActualSource" AS ENUM ('MANUAL', 'EXTERNAL_API');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('READY', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "AggregationMethod" AS ENUM ('SUM', 'AVERAGE', 'COUNT', 'PERCENTAGE', 'CUSTOM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "employeeId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "userId" TEXT NOT NULL,
    "permissionCode" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("userId","permissionCode")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_departments" (
    "branchId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "branch_departments_pkey" PRIMARY KEY ("branchId","departmentId")
);

-- CreateTable
CREATE TABLE "job_titles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "departmentId" TEXT,
    "jobTitleId" TEXT NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "externalRefId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_metrics" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "aggregationMethod" "AggregationMethod" NOT NULL,

    CONSTRAINT "reporting_metrics_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "kpi_templates" (
    "id" TEXT NOT NULL,
    "jobTitleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpis" (
    "id" TEXT NOT NULL,
    "kpiTemplateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(5,2) NOT NULL,
    "measurementType" "MeasurementType" NOT NULL,
    "direction" "KpiDirection" NOT NULL DEFAULT 'HIGHER_IS_BETTER',
    "measurementInstructions" TEXT,
    "reportingMetricCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_subcriteria" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(5,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kpi_subcriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "scopeType" "TargetScopeType" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "branchId" TEXT,
    "departmentId" TEXT,
    "jobTitleId" TEXT,
    "employeeId" TEXT,
    "applicationMode" "TargetApplicationMode" NOT NULL DEFAULT 'PER_EMPLOYEE',
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openDate" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluator_assignments" (
    "id" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "label" TEXT,
    "defaultWeight" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluator_assignment_rules" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "isAllEmployees" BOOLEAN NOT NULL DEFAULT false,
    "branchId" TEXT,
    "departmentId" TEXT,
    "jobTitleId" TEXT,

    CONSTRAINT "evaluator_assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluator_assignment_employees" (
    "assignmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "evaluator_assignment_employees_pkey" PRIMARY KEY ("assignmentId","employeeId")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeNumberSnapshot" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT NOT NULL,
    "branchIdSnapshot" TEXT NOT NULL,
    "branchNameSnapshot" TEXT NOT NULL,
    "departmentIdSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "jobTitleIdSnapshot" TEXT NOT NULL,
    "jobTitleNameSnapshot" TEXT NOT NULL,
    "kpiTemplateId" TEXT NOT NULL,
    "templateVersionSnapshot" INTEGER NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "finalScore" DECIMAL(4,2),
    "finalPercentage" DECIMAL(6,2),
    "performanceLabelSnapshot" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_kpi_actuals" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "kpiNameSnapshot" TEXT NOT NULL,
    "kpiWeightSnapshot" DECIMAL(5,2) NOT NULL,
    "kpiDirectionSnapshot" "KpiDirection" NOT NULL,
    "kpiMeasurementTypeSnapshot" "MeasurementType" NOT NULL,
    "targetValueSnapshot" DECIMAL(14,2),
    "targetScopeLevelSnapshot" "TargetScopeType",
    "isConfigurationError" BOOLEAN NOT NULL DEFAULT false,
    "configurationErrorReason" TEXT,
    "actualValue" DECIMAL(14,2),
    "actualSource" "ActualSource" NOT NULL DEFAULT 'MANUAL',
    "enteredById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_kpi_actuals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_evaluators" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "weightSnapshot" DECIMAL(5,2) NOT NULL,
    "status" "EvaluatorSubmissionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "overallScore" DECIMAL(4,2),
    "overallPercentage" DECIMAL(6,2),
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_evaluators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_evaluator_items" (
    "id" TEXT NOT NULL,
    "reviewEvaluatorId" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "ratingValue" INTEGER,
    "achievementPct" DECIMAL(7,2),
    "scoreContribution" DECIMAL(6,2),
    "justification" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_evaluator_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_evaluator_subcriteria_scores" (
    "id" TEXT NOT NULL,
    "reviewEvaluatorItemId" TEXT NOT NULL,
    "subcriterionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "justification" TEXT NOT NULL,

    CONSTRAINT "review_evaluator_subcriteria_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_attachments" (
    "id" TEXT NOT NULL,
    "reviewEvaluatorId" TEXT NOT NULL,
    "kpiId" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "reviewEvaluatorId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_labels" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPct" DECIMAL(5,2) NOT NULL,
    "maxPct" DECIMAL(5,2) NOT NULL,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "performance_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "excel_import_batches" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "readyRows" INTEGER NOT NULL,
    "warningRows" INTEGER NOT NULL,
    "errorRows" INTEGER NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excel_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excel_import_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "resolvedData" JSONB,
    "status" "ImportRowStatus" NOT NULL,
    "messages" TEXT[],
    "employeeId" TEXT,

    CONSTRAINT "excel_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_name_key" ON "branches"("name");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "job_titles_name_key" ON "job_titles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeNumber_key" ON "employees"("employeeNumber");

-- CreateIndex
CREATE INDEX "employees_branchId_idx" ON "employees"("branchId");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_jobTitleId_idx" ON "employees"("jobTitleId");

-- CreateIndex
CREATE INDEX "employees_employmentStatus_idx" ON "employees"("employmentStatus");

-- CreateIndex
CREATE INDEX "kpi_templates_jobTitleId_isActive_idx" ON "kpi_templates"("jobTitleId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_templates_jobTitleId_version_key" ON "kpi_templates"("jobTitleId", "version");

-- CreateIndex
CREATE INDEX "kpis_kpiTemplateId_idx" ON "kpis"("kpiTemplateId");

-- CreateIndex
CREATE INDEX "kpi_subcriteria_kpiId_idx" ON "kpi_subcriteria"("kpiId");

-- CreateIndex
CREATE INDEX "targets_kpiId_month_year_idx" ON "targets"("kpiId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "targets_kpiId_scopeType_scopeKey_month_year_key" ON "targets"("kpiId", "scopeType", "scopeKey", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_cycles_month_year_key" ON "evaluation_cycles"("month", "year");

-- CreateIndex
CREATE INDEX "evaluator_assignments_evaluatorId_idx" ON "evaluator_assignments"("evaluatorId");

-- CreateIndex
CREATE INDEX "evaluator_assignment_rules_assignmentId_idx" ON "evaluator_assignment_rules"("assignmentId");

-- CreateIndex
CREATE INDEX "performance_reviews_cycleId_status_idx" ON "performance_reviews"("cycleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_cycleId_employeeId_key" ON "performance_reviews"("cycleId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "review_kpi_actuals_reviewId_kpiId_key" ON "review_kpi_actuals"("reviewId", "kpiId");

-- CreateIndex
CREATE INDEX "review_evaluators_reviewId_status_idx" ON "review_evaluators"("reviewId", "status");

-- CreateIndex
CREATE INDEX "review_evaluators_evaluatorId_idx" ON "review_evaluators"("evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "review_evaluators_reviewId_evaluatorId_key" ON "review_evaluators"("reviewId", "evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "review_evaluator_items_reviewEvaluatorId_kpiId_key" ON "review_evaluator_items"("reviewEvaluatorId", "kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "review_evaluator_subcriteria_scores_reviewEvaluatorItemId_s_key" ON "review_evaluator_subcriteria_scores"("reviewEvaluatorItemId", "subcriterionId");

-- CreateIndex
CREATE INDEX "review_attachments_reviewEvaluatorId_idx" ON "review_attachments"("reviewEvaluatorId");

-- CreateIndex
CREATE INDEX "review_comments_reviewEvaluatorId_idx" ON "review_comments"("reviewEvaluatorId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "excel_import_rows_batchId_idx" ON "excel_import_rows"("batchId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "permissions"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_departments" ADD CONSTRAINT "branch_departments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_departments" ADD CONSTRAINT "branch_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "job_titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_templates" ADD CONSTRAINT "kpi_templates_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "job_titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_kpiTemplateId_fkey" FOREIGN KEY ("kpiTemplateId") REFERENCES "kpi_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_reportingMetricCode_fkey" FOREIGN KEY ("reportingMetricCode") REFERENCES "reporting_metrics"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_subcriteria" ADD CONSTRAINT "kpi_subcriteria_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "job_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignments" ADD CONSTRAINT "evaluator_assignments_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignment_rules" ADD CONSTRAINT "evaluator_assignment_rules_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "evaluator_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignment_rules" ADD CONSTRAINT "evaluator_assignment_rules_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignment_rules" ADD CONSTRAINT "evaluator_assignment_rules_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignment_rules" ADD CONSTRAINT "evaluator_assignment_rules_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "job_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignment_employees" ADD CONSTRAINT "evaluator_assignment_employees_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "evaluator_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignment_employees" ADD CONSTRAINT "evaluator_assignment_employees_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "evaluation_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_kpiTemplateId_fkey" FOREIGN KEY ("kpiTemplateId") REFERENCES "kpi_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_kpi_actuals" ADD CONSTRAINT "review_kpi_actuals_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_kpi_actuals" ADD CONSTRAINT "review_kpi_actuals_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_kpi_actuals" ADD CONSTRAINT "review_kpi_actuals_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_evaluators" ADD CONSTRAINT "review_evaluators_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_evaluators" ADD CONSTRAINT "review_evaluators_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_evaluator_items" ADD CONSTRAINT "review_evaluator_items_reviewEvaluatorId_fkey" FOREIGN KEY ("reviewEvaluatorId") REFERENCES "review_evaluators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_evaluator_items" ADD CONSTRAINT "review_evaluator_items_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_evaluator_subcriteria_scores" ADD CONSTRAINT "review_evaluator_subcriteria_scores_reviewEvaluatorItemId_fkey" FOREIGN KEY ("reviewEvaluatorItemId") REFERENCES "review_evaluator_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_evaluator_subcriteria_scores" ADD CONSTRAINT "review_evaluator_subcriteria_scores_subcriterionId_fkey" FOREIGN KEY ("subcriterionId") REFERENCES "kpi_subcriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_attachments" ADD CONSTRAINT "review_attachments_reviewEvaluatorId_fkey" FOREIGN KEY ("reviewEvaluatorId") REFERENCES "review_evaluators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_attachments" ADD CONSTRAINT "review_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_reviewEvaluatorId_fkey" FOREIGN KEY ("reviewEvaluatorId") REFERENCES "review_evaluators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excel_import_rows" ADD CONSTRAINT "excel_import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "excel_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
