-- prisma/migrations/add_evaluation_tables.sql
-- Run this in your Railway Postgres console

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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_evaluations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

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
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "star_stories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
