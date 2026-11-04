-- CreateEnum
CREATE TYPE "AiSummaryStatus" AS ENUM ('SHOWN', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('GOOD', 'NEEDS_CHANGE', 'WRONG');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'TE', 'HI');

-- CreateEnum
CREATE TYPE "ReadingMode" AS ENUM ('SIMPLE', 'COMPACT');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMALE', 'MALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('UPLOAD', 'FOLDER');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('IMPORTED', 'UPDATED', 'UNCHANGED', 'ERROR');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('PATIENT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('OTP_SENT', 'OTP_VERIFIED', 'OTP_FAILED', 'OTP_LOCKED', 'LINK_SENT', 'LINK_RESENT', 'LINK_OPENED', 'LINK_EXPIRED', 'REPORT_OPENED', 'REPORT_PDF_DOWNLOADED', 'CONSENT_GIVEN', 'CONSENT_WITHDRAWN', 'CALLBACK_REQUESTED', 'FLAG_RAISED', 'STAFF_SIGNED_IN', 'STAFF_VIEWED_PATIENT', 'STAFF_VIEWED_PHONE', 'IMPORT_RUN');

-- CreateEnum
CREATE TYPE "CallbackType" AS ENUM ('CRITICAL', 'CALL_ME_BACK');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SAMPLE_GIVEN', 'TESTED', 'SIGNED');

-- CreateEnum
CREATE TYPE "Flag" AS ENUM ('LOW', 'USUAL', 'HIGH');

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('PATIENT', 'LINK', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('FRONT_DESK', 'LAB_ADMIN');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "TextSource" AS ENUM ('HUMAN', 'AI');

-- CreateTable
CREATE TABLE "AiSummary" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "body" TEXT,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" "AiSummaryStatus" NOT NULL,
    "checkerNotes" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "verdict" "ReviewVerdict",
    "reviewNote" TEXT,

    CONSTRAINT "AiSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneCipher" TEXT NOT NULL,
    "phoneMasked" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "readingMode" "ReadingMode",
    "largeText" BOOLEAN NOT NULL DEFAULT false,
    "consentVersion" TEXT,
    "consentAt" TIMESTAMP(3),
    "consentWithdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" "Sex" NOT NULL,
    "relation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL DEFAULT 'UPLOAD',
    "uploadedById" TEXT,
    "totalRows" INTEGER NOT NULL,
    "importedRows" INTEGER NOT NULL,
    "errorRows" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "orderId" TEXT,
    "error" TEXT,
    "raw" JSONB NOT NULL,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportLink" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "firstOpenedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "action" "AccessAction" NOT NULL,
    "householdId" TEXT,
    "patientId" TEXT,
    "reportId" TEXT,
    "ipHash" TEXT,
    "detail" JSONB,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallbackTask" (
    "id" TEXT NOT NULL,
    "type" "CallbackType" NOT NULL,
    "householdId" TEXT NOT NULL,
    "patientId" TEXT,
    "reportId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "note" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,

    CONSTRAINT "CallbackTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientFlag" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,

    CONSTRAINT "PatientFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferringDoctor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ReferringDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "referringDoctorId" TEXT,
    "status" "ReportStatus" NOT NULL,
    "signedAt" TIMESTAMP(3),
    "hasCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "analyteId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "valueText" TEXT NOT NULL,
    "refLow" DOUBLE PRECISION,
    "refHigh" DOUBLE PRECISION,
    "refText" TEXT NOT NULL,
    "flag" "Flag" NOT NULL,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" "SessionKind" NOT NULL,
    "householdId" TEXT,
    "staffUserId" TEXT,
    "reportId" TEXT,
    "patientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummaryTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "TextSource" NOT NULL DEFAULT 'HUMAN',
    "needsDoctorApproval" BOOLEAN NOT NULL DEFAULT false,
    "sourceTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,

    CONSTRAINT "SummaryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TestDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analyte" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "refLow" DOUBLE PRECISION,
    "refHigh" DOUBLE PRECISION,
    "criticalLow" DOUBLE PRECISION,
    "criticalHigh" DOUBLE PRECISION,
    "helper" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Analyte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiSummary_reportId_language_createdAt_idx" ON "AiSummary"("reportId", "language", "createdAt");

-- CreateIndex
CREATE INDEX "AiSummary_reviewedAt_createdAt_idx" ON "AiSummary"("reviewedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Household_phoneHash_key" ON "Household"("phoneHash");

-- CreateIndex
CREATE INDEX "Patient_householdId_idx" ON "Patient"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_householdId_name_key" ON "Patient"("householdId", "name");

-- CreateIndex
CREATE INDEX "ImportBatch_fileHash_idx" ON "ImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_rowNumber_idx" ON "ImportRow"("batchId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReportLink_tokenHash_key" ON "ReportLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ReportLink_reportId_createdAt_idx" ON "ReportLink"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_reportId_at_idx" ON "AccessLog"("reportId", "at");

-- CreateIndex
CREATE INDEX "AccessLog_householdId_at_idx" ON "AccessLog"("householdId", "at");

-- CreateIndex
CREATE INDEX "AccessLog_actorId_at_idx" ON "AccessLog"("actorId", "at");

-- CreateIndex
CREATE INDEX "CallbackTask_status_type_dueAt_idx" ON "CallbackTask"("status", "type", "dueAt");

-- CreateIndex
CREATE INDEX "CallbackTask_householdId_idx" ON "CallbackTask"("householdId");

-- CreateIndex
CREATE INDEX "CallbackTask_patientId_idx" ON "CallbackTask"("patientId");

-- CreateIndex
CREATE INDEX "CallbackTask_reportId_idx" ON "CallbackTask"("reportId");

-- CreateIndex
CREATE INDEX "PatientFlag_status_createdAt_idx" ON "PatientFlag"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PatientFlag_reportId_idx" ON "PatientFlag"("reportId");

-- CreateIndex
CREATE INDEX "PatientFlag_patientId_idx" ON "PatientFlag"("patientId");

-- CreateIndex
CREATE INDEX "OtpChallenge_phoneHash_createdAt_idx" ON "OtpChallenge"("phoneHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferringDoctor_name_key" ON "ReferringDoctor"("name");

-- CreateIndex
CREATE INDEX "Report_patientId_createdAt_idx" ON "Report"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_testId_idx" ON "Report"("testId");

-- CreateIndex
CREATE INDEX "Report_referringDoctorId_signedAt_idx" ON "Report"("referringDoctorId", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_orderId_testId_key" ON "Report"("orderId", "testId");

-- CreateIndex
CREATE INDEX "Result_analyteId_idx" ON "Result"("analyteId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_reportId_analyteId_key" ON "Result"("reportId", "analyteId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_householdId_idx" ON "Session"("householdId");

-- CreateIndex
CREATE INDEX "Session_staffUserId_idx" ON "Session"("staffUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE INDEX "SummaryTemplate_key_language_status_idx" ON "SummaryTemplate"("key", "language", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SummaryTemplate_key_language_version_key" ON "SummaryTemplate"("key", "language", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TestDefinition_code_key" ON "TestDefinition"("code");

-- CreateIndex
CREATE INDEX "Analyte_testId_idx" ON "Analyte"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "Analyte_testId_code_key" ON "Analyte"("testId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Analyte_testId_name_key" ON "Analyte"("testId", "name");

-- AddForeignKey
ALTER TABLE "AiSummary" ADD CONSTRAINT "AiSummary_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportLink" ADD CONSTRAINT "ReportLink_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackTask" ADD CONSTRAINT "CallbackTask_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackTask" ADD CONSTRAINT "CallbackTask_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackTask" ADD CONSTRAINT "CallbackTask_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFlag" ADD CONSTRAINT "PatientFlag_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFlag" ADD CONSTRAINT "PatientFlag_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_referringDoctorId_fkey" FOREIGN KEY ("referringDoctorId") REFERENCES "ReferringDoctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_analyteId_fkey" FOREIGN KEY ("analyteId") REFERENCES "Analyte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analyte" ADD CONSTRAINT "Analyte_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written rules that Prisma cannot express.

-- 1. The access log is append only. Any UPDATE or DELETE is refused by the
--    database itself, so no bug or staff action in the app can rewrite history.
CREATE FUNCTION access_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AccessLog is append only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER access_log_no_update_or_delete
  BEFORE UPDATE OR DELETE ON "AccessLog"
  FOR EACH ROW EXECUTE FUNCTION access_log_append_only();

CREATE TRIGGER access_log_no_truncate
  BEFORE TRUNCATE ON "AccessLog"
  FOR EACH STATEMENT EXECUTE FUNCTION access_log_append_only();

-- 2. At most one open critical callback per report, so a re-import or a
--    retry can never queue the same urgent call twice.
CREATE UNIQUE INDEX "CallbackTask_one_open_critical_per_report"
  ON "CallbackTask" ("reportId")
  WHERE "type" = 'CRITICAL' AND "status" = 'OPEN';
