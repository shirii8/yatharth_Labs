-- Referring doctors sign in and see their own patients' reports (last 90 days).
ALTER TYPE "StaffRole" ADD VALUE 'DOCTOR';
ALTER TYPE "AccessAction" ADD VALUE 'DOCTOR_VIEWED_REPORT';

ALTER TABLE "StaffUser" ADD COLUMN "doctorId" TEXT;
CREATE UNIQUE INDEX "StaffUser_doctorId_key" ON "StaffUser"("doctorId");
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "ReferringDoctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
