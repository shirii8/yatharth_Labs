-- Who is on this number: patients can now name how each person relates to them.
ALTER TYPE "AccessAction" ADD VALUE 'RELATION_CHANGED';

-- When the number holder finished first-time setup (confirmed who is on the number).
ALTER TABLE "Household" ADD COLUMN "setupAt" TIMESTAMP(3);
