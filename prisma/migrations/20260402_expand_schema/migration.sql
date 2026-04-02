-- Careeva expanded schema migration
-- Adds: PersonalInfo, WorkHistory, ResumeBullet, EducationEntry, Project, Certification,
--       SocialLink, Skill, JobPreferences, WritingPreferences, AutoApplyConfig,
--       Resume, ResumeSection, CoverLetter, ReusableAnswer,
--       extended Job (dedup fields, ATS metadata), extended JobScore (dimensions),
--       ScrapeRun, Company, extended Application, ApplicationDocument, ApplicationAnswer,
--       ApplicationEvent, ApplicationArtifact, AutomationRun, AutomationTask, GenerationRun

-- personal_info
CREATE TABLE IF NOT EXISTS "personal_info" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
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
  CONSTRAINT "personal_info_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- work_history
CREATE TABLE IF NOT EXISTS "work_history" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "work_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- resume_bullets
CREATE TABLE IF NOT EXISTS "resume_bullets" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- education_entries
CREATE TABLE IF NOT EXISTS "education_entries" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "education_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- projects
CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add FK constraints for resume_bullets
DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'resume_bullets_workHistoryId_fkey') THEN
    ALTER TABLE "resume_bullets" ADD CONSTRAINT "resume_bullets_workHistoryId_fkey" FOREIGN KEY ("workHistoryId") REFERENCES "work_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $;
DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'resume_bullets_projectId_fkey') THEN
    ALTER TABLE "resume_bullets" ADD CONSTRAINT "resume_bullets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $;

-- certifications
CREATE TABLE IF NOT EXISTS "certifications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "issueDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "credentialId" TEXT,
  "credentialUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- social_links
CREATE TABLE IF NOT EXISTS "social_links" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "label" TEXT,
  CONSTRAINT "social_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- skills
CREATE TABLE IF NOT EXISTS "skills" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "proficiency" TEXT,
  "yearsUsed" INTEGER,
  "roleFamilies" TEXT[] DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- job_preferences
CREATE TABLE IF NOT EXISTS "job_preferences" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
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
  CONSTRAINT "job_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- writing_preferences
CREATE TABLE IF NOT EXISTS "writing_preferences" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "toneWords" TEXT[] DEFAULT '{}',
  "avoidWords" TEXT[] DEFAULT '{}',
  "exampleBio" TEXT,
  "positioningStatement" TEXT,
  "roleFamilyTones" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "writing_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- auto_apply_config
CREATE TABLE IF NOT EXISTS "auto_apply_config" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
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
  CONSTRAINT "auto_apply_config_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- resumes
CREATE TABLE IF NOT EXISTS "resumes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fileUrl" TEXT,
  "fileType" TEXT,
  "isBase" BOOLEAN NOT NULL DEFAULT false,
  "roleFamilies" TEXT[] DEFAULT '{}',
  "rawText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resumes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- resume_sections
CREATE TABLE IF NOT EXISTS "resume_sections" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "resumeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "resume_sections_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- cover_letters
CREATE TABLE IF NOT EXISTS "cover_letters" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "cover_letters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- reusable_answers
CREATE TABLE IF NOT EXISTS "reusable_answers" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "reusable_answers_userId_questionKey_key" UNIQUE ("userId", "questionKey"),
  CONSTRAINT "reusable_answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Extend jobs table with new columns
ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "salaryMin" INTEGER,
  ADD COLUMN IF NOT EXISTS "salaryMax" INTEGER,
  ADD COLUMN IF NOT EXISTS "isRemote" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isHybrid" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "applyUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ADD COLUMN IF NOT EXISTS "atsType" TEXT,
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT,
  ADD COLUMN IF NOT EXISTS "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canonicalJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "lastScrapedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "roleFamilies" TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "scrapeRunId" TEXT;

CREATE INDEX IF NOT EXISTS "jobs_userId_isActive_idx" ON "jobs"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "jobs_dedupeKey_idx" ON "jobs"("dedupeKey");

-- Extend job_scores with dimension scores
ALTER TABLE "job_scores"
  ADD COLUMN IF NOT EXISTS "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "skillScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "roleScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "techScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "experienceScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "locationScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "compensationScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "roleFamilyScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "recommendation" TEXT;

-- scrape_runs
CREATE TABLE IF NOT EXISTS "scrape_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "scrape_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'jobs_scrapeRunId_fkey') THEN
    ALTER TABLE "jobs" ADD CONSTRAINT "jobs_scrapeRunId_fkey" FOREIGN KEY ("scrapeRunId") REFERENCES "scrape_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $;

-- companies
CREATE TABLE IF NOT EXISTS "companies" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "aliases" TEXT[] DEFAULT '{}',
  "domain" TEXT,
  "atsType" TEXT,
  "careerPageUrl" TEXT,
  "greenhouseId" TEXT,
  "leverId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Extend applications with new fields
ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "applyUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "atsType" TEXT,
  ADD COLUMN IF NOT EXISTS "externalApplicationId" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedVia" TEXT,
  ADD COLUMN IF NOT EXISTS "automationRunId" TEXT;

-- application_documents
CREATE TABLE IF NOT EXISTS "application_documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "resumeId" TEXT,
  "coverLetterId" TEXT,
  "fileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "application_documents_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "application_documents_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "cover_letters"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- application_answers
CREATE TABLE IF NOT EXISTS "application_answers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL,
  "questionText" TEXT NOT NULL,
  "questionKey" TEXT,
  "answer" TEXT NOT NULL,
  "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
  "confidence" DOUBLE PRECISION,
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_answers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- application_events
CREATE TABLE IF NOT EXISTS "application_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- application_artifacts
CREATE TABLE IF NOT EXISTS "application_artifacts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "url" TEXT,
  "content" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_artifacts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- automation_runs
CREATE TABLE IF NOT EXISTS "automation_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'applications_automationRunId_fkey') THEN
    ALTER TABLE "applications" ADD CONSTRAINT "applications_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "automation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $;

-- automation_tasks
CREATE TABLE IF NOT EXISTS "automation_tasks" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "automation_tasks_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- generation_runs
CREATE TABLE IF NOT EXISTS "generation_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "generation_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
