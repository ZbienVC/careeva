-- AlterTable
ALTER TABLE "applications" ADD COLUMN "company" TEXT,
ADD COLUMN "role" TEXT,
ADD COLUMN "dateApplied" TEXT,
ADD COLUMN "url" TEXT,
ADD COLUMN "notes" TEXT;

-- Make jobId optional
ALTER TABLE "applications" ALTER COLUMN "jobId" DROP NOT NULL;

-- Update appliedAt to use dateApplied if available
UPDATE "applications" 
SET "dateApplied" = TO_CHAR("appliedAt", 'YYYY-MM-DD')
WHERE "dateApplied" IS NULL;

-- Set default company and role for existing records
UPDATE "applications" 
SET "company" = 'Unknown Company', "role" = 'Unknown Role'
WHERE "company" IS NULL OR "role" IS NULL;

-- Make company and role NOT NULL after setting defaults
ALTER TABLE "applications" ALTER COLUMN "company" SET NOT NULL;
ALTER TABLE "applications" ALTER COLUMN "role" SET NOT NULL;
