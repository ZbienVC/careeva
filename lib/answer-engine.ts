/**
 * Reusable Answer Engine
 * Normalizes application questions to known keys and resolves answers
 * from the user's structured profile before falling back to LLM generation.
 */

import { prisma } from '@/lib/db';

// â”€â”€â”€ Question normalization map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Maps common question patterns to canonical keys

const QUESTION_PATTERNS: Array<{
  key: string;
  family: string;
  patterns: RegExp[];
}> = [
  {
    key: 'work_authorization_us',
    family: 'legal',
    patterns: [
      /authorized to work in the (united states|u\.?s\.?)/i,
      /legally authorized.*work/i,
      /work authorization/i,
      /right to work/i,
    ],
  },
  {
    key: 'requires_sponsorship',
    family: 'legal',
    patterns: [
      /require.*visa.*sponsorship/i,
      /sponsorship.*required/i,
      /will you now or in the future require/i,
      /require.*authorization.*to work/i,
    ],
  },
  {
    key: 'salary_expectation',
    family: 'compensation',
    patterns: [
      /salary expectation/i,
      /desired.*salary/i,
      /compensation.*expectation/i,
      /what.*salary.*looking/i,
      /expected.*compensation/i,
    ],
  },
  {
    key: 'remote_preference',
    family: 'logistics',
    patterns: [
      /remote.*preference/i,
      /open to (in.?person|onsite|hybrid)/i,
      /work.*remotely/i,
      /prefer.*work.*arrangement/i,
    ],
  },
  {
    key: 'willing_to_relocate',
    family: 'logistics',
    patterns: [
      /willing.*relocate/i,
      /open.*relocation/i,
      /relocate.*for.*position/i,
    ],
  },
  {
    key: 'years_experience',
    family: 'experience',
    patterns: [
      /years of (experience|relevant)/i,
      /how many years/i,
      /total.*experience/i,
    ],
  },
  {
    key: 'start_date',
    family: 'logistics',
    patterns: [
      /earliest.*start date/i,
      /when can you start/i,
      /available to start/i,
      /notice period/i,
    ],
  },
  {
    key: 'linkedin_url',
    family: 'links',
    patterns: [/linkedin (url|profile|link)/i, /linkedin\.com/i],
  },
  {
    key: 'github_url',
    family: 'links',
    patterns: [/github (url|profile|link)/i, /github\.com/i],
  },
  {
    key: 'portfolio_url',
    family: 'links',
    patterns: [/portfolio (url|link|site)/i, /personal (website|site)/i],
  },
  {
    key: 'phone',
    family: 'personal',
    patterns: [/phone (number|#)/i, /mobile number/i, /contact number/i],
  },
  {
    key: 'address',
    family: 'personal',
    patterns: [/current address/i, /street address/i, /city.*state.*zip/i],
  },
  {
    key: 'gender',
    family: 'eeo',
    patterns: [/gender.*identity/i, /self.?identify.*gender/i],
  },
  {
    key: 'ethnicity',
    family: 'eeo',
    patterns: [/ethnic.*background/i, /race.*ethnicity/i, /self.?identify.*race/i],
  },
  {
    key: 'veteran_status',
    family: 'eeo',
    patterns: [/veteran status/i, /protected veteran/i],
  },
  {
    key: 'disability_status',
    family: 'eeo',
    patterns: [/disability status/i, /person with (a )?disability/i],
  },
  {
    key: 'referral_source',
    family: 'misc',
    patterns: [/how did you hear/i, /referral source/i, /where did you find/i],
  },
];

export type QuestionNormalizationResult = {
  matched: boolean;
  questionKey: string | null;
  questionFamily: string | null;
  confidence: number;
};

/**
 * Normalize a raw question string to a canonical key.
 */
export function normalizeQuestion(questionText: string): QuestionNormalizationResult {
  const text = questionText.trim();

  for (const { key, family, patterns } of QUESTION_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return { matched: true, questionKey: key, questionFamily: family, confidence: 0.9 };
      }
    }
  }

  return { matched: false, questionKey: null, questionFamily: null, confidence: 0 };
}

/**
 * Resolve an answer for a normalized question key from the user's structured profile.
 * Returns null if the profile doesn't have enough data to answer.
 */
export async function resolveAnswerFromProfile(
  userId: string,
  questionKey: string
): Promise<{ answer: string; confidence: number; source: string } | null> {
  const [personalInfo, jobPrefs, workHistory] = await Promise.all([
    prisma.personalInfo.findUnique({ where: { userId } }),
    prisma.jobPreferences.findUnique({ where: { userId } }),
    prisma.workHistory.findMany({ where: { userId }, orderBy: { startDate: 'asc' } }),
  ]);

  switch (questionKey) {
    case 'work_authorization_us':
      if (personalInfo?.workAuthorization) {
        const auth = personalInfo.workAuthorization;
        if (auth === 'us_citizen') return { answer: 'Yes', confidence: 1.0, source: 'personal_info' };
        if (auth === 'green_card') return { answer: 'Yes', confidence: 1.0, source: 'personal_info' };
        if (auth === 'h1b' || auth === 'opt') return { answer: 'Yes', confidence: 0.9, source: 'personal_info' };
        return { answer: 'No', confidence: 0.9, source: 'personal_info' };
      }
      return null;

    case 'requires_sponsorship':
      if (personalInfo?.requiresSponsorship !== undefined) {
        return {
          answer: personalInfo.requiresSponsorship ? 'Yes' : 'No',
          confidence: 1.0,
          source: 'personal_info',
        };
      }
      return null;

    case 'salary_expectation':
      if (jobPrefs?.salaryMinUSD) {
        const min = jobPrefs.salaryMinUSD;
        const max = jobPrefs.salaryMaxUSD;
        const answer = max ? `$${min.toLocaleString()} â€“ $${max.toLocaleString()}` : `$${min.toLocaleString()}+`;
        return { answer, confidence: 0.95, source: 'job_preferences' };
      }
      return null;

    case 'remote_preference':
      if (jobPrefs?.remotePreference) {
        const map: Record<string, string> = {
          remote_only: 'Remote',
          hybrid_ok: 'Open to hybrid or remote',
          onsite_ok: 'Open to onsite, hybrid, or remote',
          any: 'Flexible â€” open to all arrangements',
        };
        return {
          answer: map[jobPrefs.remotePreference] || jobPrefs.remotePreference,
          confidence: 0.9,
          source: 'job_preferences',
        };
      }
      return null;

    case 'willing_to_relocate':
      if (jobPrefs?.willingToRelocate !== undefined) {
        return {
          answer: jobPrefs.willingToRelocate ? 'Yes' : 'No',
          confidence: 1.0,
          source: 'job_preferences',
        };
      }
      return null;

    case 'years_experience':
      if (workHistory.length > 0) {
        const earliest = workHistory[0].startDate;
        const years = Math.floor((Date.now() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24 * 365));
        return { answer: String(years), confidence: 0.85, source: 'work_history' };
      }
      return null;

    case 'start_date':
      if (personalInfo?.availableStartDate) {
        return {
          answer: new Date(personalInfo.availableStartDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          confidence: 0.9,
          source: 'personal_info',
        };
      }
      if (personalInfo?.noticePeriodDays !== undefined) {
        const days = personalInfo.noticePeriodDays;
        return {
          answer: days === 0 ? 'Immediately' : `${days} days notice`,
          confidence: 0.85,
          source: 'personal_info',
        };
      }
      return null;

    case 'linkedin_url':
      return personalInfo?.linkedinUrl
        ? { answer: personalInfo.linkedinUrl, confidence: 1.0, source: 'personal_info' }
        : null;

    case 'github_url':
      return personalInfo?.githubUrl
        ? { answer: personalInfo.githubUrl, confidence: 1.0, source: 'personal_info' }
        : null;

    case 'portfolio_url':
      return personalInfo?.portfolioUrl
        ? { answer: personalInfo.portfolioUrl, confidence: 1.0, source: 'personal_info' }
        : null;

    case 'phone':
      return personalInfo?.phone
        ? { answer: personalInfo.phone, confidence: 1.0, source: 'personal_info' }
        : null;

    case 'address':
      if (personalInfo?.city && personalInfo?.state) {
        const addr = [personalInfo.addressLine1, personalInfo.city, personalInfo.state, personalInfo.zipCode]
          .filter(Boolean)
          .join(', ');
        return { answer: addr, confidence: 0.95, source: 'personal_info' };
      }
      return null;

    // EEO fields â€” only answer if user has stored a preference
    case 'gender':
    case 'ethnicity':
    case 'veteran_status':
    case 'disability_status':
      // These require explicit user-stored preferences; don't auto-answer
      return null;

    default:
      return null;
  }
}

/**
 * Full answer resolution pipeline:
 * 1. Check stored reusable answers (highest priority â€” user-verified)
 * 2. Resolve from structured profile fields
 * 3. Return null (caller should use LLM or flag for review)
 */
export async function resolveAnswer(
  userId: string,
  questionText: string
): Promise<{
  answer: string | null;
  confidence: number;
  source: 'stored' | 'profile' | 'none';
  questionKey: string | null;
  needsReview: boolean;
}> {
  const norm = normalizeQuestion(questionText);

  // 1. Check stored reusable answers
  if (norm.questionKey) {
    const stored = await prisma.reusableAnswer.findUnique({
      where: { userId_questionKey: { userId, questionKey: norm.questionKey } },
    });
    if (stored?.isVerified) {
      return {
        answer: stored.answer,
        confidence: 1.0,
        source: 'stored',
        questionKey: norm.questionKey,
        needsReview: false,
      };
    }
  }

  // 2. Resolve from profile
  if (norm.questionKey) {
    const resolved = await resolveAnswerFromProfile(userId, norm.questionKey);
    if (resolved && resolved.confidence >= 0.8) {
      return {
        answer: resolved.answer,
        confidence: resolved.confidence,
        source: 'profile',
        questionKey: norm.questionKey,
        needsReview: resolved.confidence < 0.9,
      };
    }
  }

  // 3. Unknown â€” needs LLM or review
  return {
    answer: null,
    confidence: 0,
    source: 'none',
    questionKey: norm.questionKey,
    needsReview: true,
  };
}
