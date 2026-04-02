-- Careeva Phase 1 schema expansion
-- Adds all new tables for profile engine, materials, job pipeline, application tracker, automation

-- personal_info
CREATE TABLE IF NOT EXISTS "personal_info" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fullName" TEXT,
  "preferredName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "zipCode" TEXT,
  "country" TEXT DEFAULT 'US',
  "timezone" TEXT,
  "linkedinUrl" TEXT,
  "githubUrl" TEXT,
  "portfolioUrl" TEXT,
  "websiteUrl" TEXT,
  "otherLinks" JSONB,
  "workAuthorization" TEXT,
  "requiresSponsorship" BOOLEAN NOT NULL DEFAULT false,
  "sponsorshipNote" TEXT,
  "noticePeriodDays" INTEGER,
  "availableStartDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personal_info_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "personal_info_userId_key" UNIQUE ("userId"),
  CONSTRAINT "personal_info_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- work_history
CREATE TABLE IF NOT EXISTS "work_history" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "location" TEXT,
  "isRemote" BOOLEAN NOT NULL DEFAULT false,
  "summary" TEXT,
  "roleFamilies" TEXT[] DEFAULT '{}',
  "skills" TEXT[] DEFAULT '{}',
  "technologies" TEXT[] DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- projects (before resume_bullets so FK works)
CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isOngoing" BOOLEAN NOT NULL DEFAULT false,
  "roleFamilies" TEXT[] DEFAULT '{}',
  "skills" TEXT[] DEFAULT '{}',
  "technologies" TEXT[] DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- resume_bullets
CREATE TABLE IF NOT EXISTS "resume_bullets" (
  "id" TEXT NOT NULL,
  "workHistoryId" TEXT,
  "projectId" TEXT,
  "content" TEXT NOT NULL,
  "isQuantified" BOOLEAN NOT NULL DEFAULT false,
  "metric" TEXT,
  "roleFamilies" TEXT[] DEFAULT '{}',
  "skills" TEXT[] DEFAULT '{}',
  "isHighlight" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resume_bullets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resume_bullets_workHistoryId_fkey" FOREIGN KEY ("workHistoryId") REFERENCES "work_history"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "resume_bullets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- education_entries
CREATE TABLE IF NOT EXISTS "education_entries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "degree" TEXT,
  "fieldOfStudy" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "gpa" TEXT,
  "honors" TEXT,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "education_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "education_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- certifications
CREATE TABLE IF NOT EXISTS "certifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "issueDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "credentialId" TEXT,
  "credentialUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "certifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- social_links
CREATE TABLE IF NOT EXISTS "social_links" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "label" TEXT,
  CONSTRAINT "social_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- skills
CREATE TABLE IF NOT EXISTS "skills" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "proficiency" TEXT,
  "yearsUsed" INTEGER,
  "roleFamilies" TEXT[] DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "skills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- job_preferences
CREATE TABLE IF NOT EXISTS "job_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetTitles" TEXT[] DEFAULT '{}',
  "targetFunctions" TEXT[] DEFAULT '{}',
  "targetIndustries" TEXT[] DEFAULT '{}',
  "targetCompanyTypes" TEXT[] DEFAULT '{}',
  "roleFamilies" TEXT[] DEFAULT '{}',
  "salaryMinUSD" INTEGER,
  "salaryMaxUSD" INTEGER,
  "salaryNote" TEXT,
  "preferredLocations" TEXT[] DEFAULT '{}',
  "remotePreference" TEXT,
  "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
  "relocationNote" TEXT,
  "fullTimeOk" BOOLEAN NOT NULL DEFAULT true,
  "partTimeOk" BOOLEAN NOT NULL DEFAULT false,
  "contractOk" BOOLEAN NOT NULL DEFAULT false,
  "willingToTravel" BOOLEAN NOT NULL DEFAULT false,
  "travelPercent" INTEGER,
  "seniority" TEXT[] DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_preferences_userId_key" UNIQUE ("userId"),
  CONSTRAINT "job_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- writing_preferences
CREATE TABLE IF NOT EXISTS "writing_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "toneWords" TEXT[] DEFAULT '{}',
  "avoidWords" TEXT[] DEFAULT '{}',
  "exampleBio" TEXT,
  "positioningStatement" TEXT,
  "roleFamilyTones" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "writing_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "writing_preferences_userId_key" UNIQUE ("userId"),
  CONSTRAINT "writing_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- auto_apply_config
CREATE TABLE IF NOT EXISTS "auto_apply_config" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultMode" TEXT NOT NULL DEFAULT 'prep_only',
  "maxApplicationsPerDay" INTEGER NOT NULL DEFAULT 5,
  "requireResumeReview" BOOLEAN NOT NULL DEFAULT true,
  "requireCoverReview" BOOLEAN NOT NULL DEFAULT true,
  "stopOnCaptcha" BOOLEAN NOT NULL DEFAULT true,
  "stopOnUnknownQuestion" BOOLEAN NOT NULL DEFAULT true,
  "stopOnLowConfidence" BOOLEAN NOT NULL DEFAULT true,
  "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  "minScoreToApply" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
  "minScoreToAutoApply" DOUBLE PRECISION NOT NULL DEFAULT 75.0,
  "enabledSources" TEXT[] DEFAULT '{}',
  "disabledAts" TEXT[] DEFAULT '{}',
  "companyBlacklist" TEXT[] DEFAULT '{}',
  "companyPriority" TEXT[] DEFAULT '{}',
  "titleWhitelist" TEXT[] DEFAULT '{}',
  "titleBlacklist" TEXT[] DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auto_apply_config_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auto_apply_config_userId_key" UNIQUE ("userId"),
  CONSTRAINT "auto_apply_config_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- resumes
CREATE TABLE IF NOT EXISTS "resumes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fileUrl" TEXT,
  "fileType" TEXT,
  "isBase" BOOLEAN NOT NULL DEFAULT false,
  "roleFamilies" TEXT[] DEFAULT '{}',
  "rawText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resumes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resumes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- resume_sections
CREATE TABLE IF NOT EXISTS "resume_sections" (
  "id" TEXT NOT NULL,
  "resumeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "resume_sections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resume_sections_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- cover_letters
CREATE TABLE IF NOT EXISTS "cover_letters" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT,
  "jobId" TEXT,
  "jobTitle" TEXT,
  "company" TEXT,
  "content" TEXT NOT NULL,
  "tone" TEXT,
  "roleFamilies" TEXT[] DEFAULT '{}',
  "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cover_letters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cover_letters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- reusable_answers
CREATE TABLE IF NOT EXISTS "reusable_answers" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "questionFamily" TEXT NOT NULL,
  "questionText" TEXT,
  "answer" TEXT NOT NULL,
  "answerShort" TEXT,
  "answerLong" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
  "confidence" DOUBLE PRECISION,
  "roleFamilies" TEXT[] DEFAULT '{}',
  "companyTypes" TEXT[] DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reusable_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reusable_answers_userId_questionKey_key" UNIQUE ("userId", "questionKey"),
  CONSTRAINT "reusable_answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- scrape_runs
CREATE TABLE IF NOT EXISTS "scrape_runs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "jobsFound" INTEGER NOT NULL DEFAULT 0,
  "jobsNew" INTEGER NOT NULL DEFAULT 0,
  "jobsDuped" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scrape_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scrape_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- companies
CREATE TABLE IF NOT EXISTS "companies" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "aliases" TEXT[] DEFAULT '{}',
  "domain" TEXT,
  "atsType" TEXT,
  "careerPageUrl" TEXT,
  "greenhouseId" TEXT,
  "leverId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "companies_name_key" UNIQUE ("name")
);

-- automation_runs
CREATE TABLE IF NOT EXISTS "automation_runs" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "jobId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "mode" TEXT NOT NULL DEFAULT 'prep_only',
  "atsType" TEXT,
  "url" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
  "stepsFailed" INTEGER NOT NULL DEFAULT 0,
  "lastCheckpoint" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- automation_tasks
CREATE TABLE IF NOT EXISTS "automation_tasks" (
  "id" TEXT NOT NULL,
  "automationRunId" TEXT NOT NULL,
  "stepName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "inputData" JSONB,
  "outputData" JSONB,
  "errorMessage" TEXT,
  "screenshotUrl" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "automation_tasks_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- application_documents
CREATE TABLE IF NOT EXISTS "application_documents" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "resumeId" TEXT,
  "coverLetterId" TEXT,
  "fileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_documents_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "application_documents_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "cover_letters"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- application_answers
CREATE TABLE IF NOT EXISTS "application_answers" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "questionText" TEXT NOT NULL,
  "questionKey" TEXT,
  "answer" TEXT NOT NULL,
  "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
  "confidence" DOUBLE PRECISION,
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_answers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- application_events
CREATE TABLE IF NOT EXISTS "application_events" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- application_artifacts
CREATE TABLE IF NOT EXISTS "application_artifacts" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "url" TEXT,
  "content" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_artifacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_artifacts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- generation_runs
CREATE TABLE IF NOT EXISTS "generation_runs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "promptKey" TEXT,
  "jobId" TEXT,
  "jobTitle" TEXT,
  "company" TEXT,
  "groundedFields" TEXT[] DEFAULT '{}',
  "output" TEXT,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "generation_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "generation_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Extend jobs table
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "salaryMin" INTEGER;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "salaryMax" INTEGER;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "isRemote" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "isHybrid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "applyUrl" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "atsType" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "isDuplicate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "canonicalJobId" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "lastScrapedAt" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "roleFamilies" TEXT[] DEFAULT '{}';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "scrapeRunId" TEXT;

CREATE INDEX IF NOT EXISTS "jobs_userId_isActive_idx" ON "jobs"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "jobs_dedupeKey_idx" ON "jobs"("dedupeKey");

-- Add FK for scrapeRunId after scrape_runs table exists
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_scrapeRunId_fkey"
  FOREIGN KEY ("scrapeRunId") REFERENCES "scrape_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend job_scores
ALTER TABLE "job_scores" ADD COLUMN IF NOT EXISTS "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "job_scores" ADD COLUMN IF NOT EXISTS "skillScore" DOUBLE PRECISION;
ALTER TABLE "job_scores" ADD COLUMN IF NOT EXISTS "roleScore" DOUBLE PRECISION;
ALTER TABLE "job_scores" ADD COLUMN IF NOT EXISTS "techScore" DOUBLE PRECISION;
ALTER TABLE "job_scores" ADD COLUMN IF NOT EXISTS "experienceScore" DOUBLE PRECISION;
ALTER TABLE "job_scores" ADD COLUMN IF NOT EXISTS "locationScore" DOUBLE PRECISION;
ALTER TABLE "job_scores" ADD COLUMN IF NOT EXISTS "compensationScore" DOUBLE PRECISION;
ALTER TABLE "job_scores" ADD COLUMN IF NOT EXISTS "roleFamilyScore" DOUBLE PRECISION;
ALTER TABLE "job_scores" ADD COLUMN IF NOT EXISTS "recommendation" TEXT;

-- Extend applications
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "applyUrl" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "atsType" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "externalApplicationId" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "submittedVia" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "automationRunId" TEXT;

-- Add FK for automationRunId after automation_runs table exists
ALTER TABLE "applications" ADD CONSTRAINT "applications_automationRunId_fkey"
  FOREIGN KEY ("automationRunId") REFERENCES "automation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
