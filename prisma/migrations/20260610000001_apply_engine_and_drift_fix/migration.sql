-- 20260610000001_apply_engine_and_drift_fix
-- 1) Consolidates the previously-untracked SQL (add_evaluation_tables.sql was a
--    loose file Prisma never applied; tables may or may not exist on prod).
--    Everything here is IF NOT EXISTS / guarded, so it is safe on both a fresh
--    database and the existing Railway database.
-- 2) Adds the ApplyTask queue + new AutoApplyConfig settings columns.

-- ── Evaluation tables (from the loose add_evaluation_tables.sql) ──
CREATE TABLE IF NOT EXISTS "job_evaluations" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "jobId"     TEXT NOT NULL UNIQUE,
  "userId"    TEXT NOT NULL,
  "blockA"    JSONB NOT NULL DEFAULT '{}',
  "blockB"    JSONB NOT NULL DEFAULT '{}',
  "blockC"    JSONB NOT NULL DEFAULT '{}',
  "blockD"    JSONB NOT NULL DEFAULT '{}',
  "blockE"    JSONB NOT NULL DEFAULT '{}',
  "blockF"    JSONB NOT NULL DEFAULT '{}',
  "blockG"    JSONB NOT NULL DEFAULT '{}',
  "archetype" TEXT NOT NULL DEFAULT '',
  "score"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  ALTER TABLE "job_evaluations" ADD CONSTRAINT "job_evaluations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "star_stories" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "jobId"       TEXT,
  "requirement" TEXT NOT NULL,
  "situation"   TEXT NOT NULL,
  "task"        TEXT NOT NULL,
  "action"      TEXT NOT NULL,
  "result"      TEXT NOT NULL,
  "reflection"  TEXT NOT NULL,
  "tags"        TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  ALTER TABLE "star_stories" ADD CONSTRAINT "star_stories_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── New AutoApplyConfig settings columns ──
ALTER TABLE "auto_apply_config" ADD COLUMN IF NOT EXISTS "submitMode"            TEXT NOT NULL DEFAULT 'approve_first';
ALTER TABLE "auto_apply_config" ADD COLUMN IF NOT EXISTS "unknownQuestionMode"   TEXT NOT NULL DEFAULT 'pause';
ALTER TABLE "auto_apply_config" ADD COLUMN IF NOT EXISTS "attachCoverLetter"     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "auto_apply_config" ADD COLUMN IF NOT EXISTS "resumeVariant"         TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE "auto_apply_config" ADD COLUMN IF NOT EXISTS "maxAppliesPerRun"      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "auto_apply_config" ADD COLUMN IF NOT EXISTS "minDelaySeconds"       INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "auto_apply_config" ADD COLUMN IF NOT EXISTS "maxDelaySeconds"       INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "auto_apply_config" ADD COLUMN IF NOT EXISTS "allowSameCompanyRoles" BOOLEAN NOT NULL DEFAULT false;

-- ── ApplyTask queue ──
CREATE TABLE IF NOT EXISTS "apply_tasks" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "userId"        TEXT NOT NULL,
  "jobId"         TEXT NOT NULL,
  "applicationId" TEXT,
  "status"        TEXT NOT NULL DEFAULT 'queued',
  "mode"          TEXT NOT NULL DEFAULT 'approve_first',
  "atsType"       TEXT,
  "applyUrl"      TEXT,
  "packet"        JSONB,
  "claimedBy"     TEXT,
  "claimedAt"     TIMESTAMP(3),
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "lastError"     TEXT,
  "screenshotKey" TEXT,
  "fieldReport"   JSONB,
  "approvedAt"    TIMESTAMP(3),
  "submittedAt"   TIMESTAMP(3),
  "externalId"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "apply_tasks_status_createdAt_idx" ON "apply_tasks"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "apply_tasks_userId_status_idx" ON "apply_tasks"("userId", "status");
