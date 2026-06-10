/**
 * lib/profile-completeness.ts
 *
 * Single source of truth for "is this profile complete enough to act on?".
 * Used by the dashboard (to show what's missing) and as the gate for auto-apply.
 *
 * Required fields must be REAL user data. Nothing here invents or defaults a
 * value; a missing field is reported as missing, never filled with a placeholder.
 */

import { prisma } from '@/lib/prisma';

export interface CompletenessField {
  key: string;
  label: string;
  present: boolean;
}

export interface CompletenessSection {
  key: string;
  label: string;
  complete: boolean;
  fields: CompletenessField[];
}

export interface ProfileCompleteness {
  readyToAutoApply: boolean;       // all REQUIRED items present
  percentComplete: number;         // across required + recommended (0–100)
  missingRequired: string[];       // labels of missing required items
  missingRecommended: string[];    // labels of missing recommended items
  sections: CompletenessSection[];
}

export async function getProfileCompleteness(userId: string): Promise<ProfileCompleteness> {
  const [personalInfo, workHistoryCount, resumeCount, skillCount, jobPrefs] = await Promise.all([
    prisma.personalInfo.findUnique({ where: { userId } }),
    prisma.workHistory.count({ where: { userId } }),
    prisma.resume.count({ where: { userId } }),
    prisma.skill.count({ where: { userId } }),
    prisma.jobPreferences.findUnique({ where: { userId } }),
  ]);

  const has = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';
  const hasLocation = has(personalInfo?.city) && has(personalInfo?.state);
  const hasTargetTitles =
    Array.isArray(jobPrefs?.targetTitles) && jobPrefs!.targetTitles.length > 0;

  // ── Required for auto-apply ──
  const required: CompletenessField[] = [
    { key: 'fullName', label: 'Full name', present: has(personalInfo?.fullName) },
    { key: 'email', label: 'Email', present: has(personalInfo?.email) },
    { key: 'phone', label: 'Phone', present: has(personalInfo?.phone) },
    { key: 'workAuthorization', label: 'Work authorization', present: has(personalInfo?.workAuthorization) },
    { key: 'workHistory', label: 'At least one work history entry', present: workHistoryCount > 0 },
    { key: 'resume', label: 'An uploaded resume', present: resumeCount > 0 },
  ];

  // ── Recommended (improves match quality + application answers) ──
  const recommended: CompletenessField[] = [
    { key: 'location', label: 'Location (city + state)', present: hasLocation },
    { key: 'linkedinUrl', label: 'LinkedIn URL', present: has(personalInfo?.linkedinUrl) },
    { key: 'skills', label: 'At least one skill', present: skillCount > 0 },
    { key: 'targetTitles', label: 'Target job titles', present: hasTargetTitles },
    { key: 'salaryTarget', label: 'Salary expectation', present: has(jobPrefs?.salaryMinUSD) },
  ];

  const sections: CompletenessSection[] = [
    {
      key: 'required',
      label: 'Required to auto-apply',
      complete: required.every((f) => f.present),
      fields: required,
    },
    {
      key: 'recommended',
      label: 'Recommended',
      complete: recommended.every((f) => f.present),
      fields: recommended,
    },
  ];

  const allFields = [...required, ...recommended];
  const presentCount = allFields.filter((f) => f.present).length;
  const percentComplete = Math.round((presentCount / allFields.length) * 100);

  return {
    readyToAutoApply: required.every((f) => f.present),
    percentComplete,
    missingRequired: required.filter((f) => !f.present).map((f) => f.label),
    missingRecommended: recommended.filter((f) => !f.present).map((f) => f.label),
    sections,
  };
}
