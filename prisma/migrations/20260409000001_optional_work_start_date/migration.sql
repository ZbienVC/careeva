-- Make WorkHistory.startDate optional
ALTER TABLE work_history ALTER COLUMN "startDate" DROP NOT NULL;
