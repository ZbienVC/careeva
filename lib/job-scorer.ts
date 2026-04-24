/**
 * Careeva Job Scorer v2
 * Multi-dimensional scoring using all profile data
 * Returns 0-100 score + dimension breakdown
 */

interface ProfileData {
  skills: string[];
  roles: string[];
  industries: string[];
  yearsExperience: number;
  education: string[];
  technologies: string[];
  // New structured fields
  targetTitles?: string[];
  targetIndustries?: string[];
  roleFamilies?: string[];
  salaryMin?: number;
  salaryMax?: number;
  remotePreference?: string;
  preferredLocations?: string[];
}

interface JobData {
  title: string;
  description: string;
  requirements: string;
  // New fields
  salaryMin?: number;
  salaryMax?: number;
  isRemote?: boolean;
  isHybrid?: boolean;
  location?: string;
  roleFamilies?: string[];
  atsType?: string;
}

export interface ScoringResult {
  score: number;
  overallScore: number;
  skillScore: number;
  roleScore: number;
  techScore: number;
  experienceScore: number;
  locationScore: number;
  compensationScore: number;
  roleFamilyScore: number;
  reasoning: string;
  recommendation: 'auto_apply' | 'autofill_draft' | 'save_for_review' | 'ignore';
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function overlap(userItems: string[], jobText: string): number {
  if (!userItems?.length) return 0;
  const jLow = normalize(jobText);
  const matched = userItems.filter(i => jLow.includes(normalize(i))).length;
  return Math.min(1, matched / Math.min(userItems.length, 10));
}

function titleMatch(userTitles: string[], jobTitle: string): number {
  if (!userTitles?.length) return 0;
  const jLow = normalize(jobTitle);
  // Exact or partial title match
  for (const t of userTitles) {
    const tLow = normalize(t);
    if (jLow.includes(tLow) || tLow.includes(jLow)) return 1;
    // Word-level overlap
    const tWords = tLow.split(/\s+/);
    const jWords = jLow.split(/\s+/);
    const shared = tWords.filter(w => w.length > 3 && jWords.includes(w)).length;
    if (shared >= 2) return 0.7;
    if (shared >= 1) return 0.4;
  }
  return 0;
}

function locationMatch(job: JobData, prefs: ProfileData): number {
  if (!prefs.remotePreference) return 0.5; // no preference = neutral

  if (job.isRemote) {
    if (prefs.remotePreference === 'remote_only' || prefs.remotePreference === 'hybrid_ok' || prefs.remotePreference === 'any') return 1;
    return 0.4;
  }
  if (job.isHybrid) {
    if (prefs.remotePreference === 'hybrid_ok' || prefs.remotePreference === 'onsite_ok' || prefs.remotePreference === 'any') return 0.85;
    if (prefs.remotePreference === 'remote_only') return 0.2;
    return 0.6;
  }
  // Onsite
  if (prefs.remotePreference === 'remote_only') return 0.1;
  if (prefs.remotePreference === 'hybrid_ok') return 0.5;
  if (prefs.remotePreference === 'onsite_ok' || prefs.remotePreference === 'any') return 0.9;

  // Location text match
  if (job.location && prefs.preferredLocations?.length) {
    const jLoc = normalize(job.location);
    const matches = prefs.preferredLocations.some(l => jLoc.includes(normalize(l)) || normalize(l).includes(jLoc));
    return matches ? 0.9 : 0.4;
  }

  return 0.5;
}

function compensationMatch(job: JobData, prefs: ProfileData): number {
  if (!prefs.salaryMin || (!job.salaryMin && !job.salaryMax)) return 0.5; // unknown = neutral

  const jobMax = job.salaryMax || job.salaryMin || 0;
  const jobMin = job.salaryMin || jobMax;
  const userMin = prefs.salaryMin || 0;

  if (jobMax >= userMin) return 1;                    // job pays enough
  if (jobMax >= userMin * 0.9) return 0.8;            // close
  if (jobMax >= userMin * 0.75) return 0.5;           // below but maybe negotiable
  return 0.2;                                         // too low
}

function roleFamilyMatch(job: JobData, prefs: ProfileData): number {
  if (!job.roleFamilies?.length || !prefs.roleFamilies?.length) return 0.5;
  const matches = job.roleFamilies.filter(rf => prefs.roleFamilies!.includes(rf)).length;
  return matches > 0 ? Math.min(1, matches * 0.5) : 0.2;
}

export function scoreJob(profile: ProfileData, job: JobData): ScoringResult {
  const jobText = `${job.title} ${job.description} ${job.requirements}`;

  // Dimension scores (0-1)
  const skillScore = overlap(profile.skills, jobText) * 0.9 + overlap(profile.technologies, jobText) * 0.1;
  const roleScore = titleMatch([...(profile.targetTitles || []), ...(profile.roles || [])], job.title);
  const techScore = overlap(profile.technologies, jobText);
  const experienceScore = profile.yearsExperience > 0
    ? Math.min(1, profile.yearsExperience / 8)  // Normalize to 8 years = perfect
    : 0.3;
  const locationScore = locationMatch(job, profile);
  const compensationScore = compensationMatch(job, profile);
  const roleFamilyScore = roleFamilyMatch(job, profile);
  const industryScore = overlap(profile.industries || [], jobText);

  // Weighted final score
  const weightedScore = (
    skillScore * 0.30 +
    roleScore * 0.25 +
    techScore * 0.15 +
    experienceScore * 0.10 +
    locationScore * 0.10 +
    compensationScore * 0.05 +
    roleFamilyScore * 0.03 +
    industryScore * 0.02
  );

  const overallScore = Math.round(weightedScore * 100);

  // Build reasoning
  const reasons: string[] = [];
  if (skillScore > 0.6) reasons.push(`Strong skill match (${Math.round(skillScore * 100)}%)`);
  if (roleScore > 0.5) reasons.push(`Title aligns with your targets`);
  if (locationScore < 0.3) reasons.push(`⚠️ Location may not match preferences`);
  if (compensationScore < 0.4) reasons.push(`⚠️ Salary may be below minimum`);
  if (skillScore < 0.3) reasons.push(`Low skill overlap - consider gap analysis`);

  // Recommendation
  let recommendation: ScoringResult['recommendation'] = 'ignore';
  if (overallScore >= 80) recommendation = 'auto_apply';
  else if (overallScore >= 65) recommendation = 'autofill_draft';
  else if (overallScore >= 45) recommendation = 'save_for_review';

  return {
    score: overallScore,
    overallScore,
    skillScore: Math.round(skillScore * 100),
    roleScore: Math.round(roleScore * 100),
    techScore: Math.round(techScore * 100),
    experienceScore: Math.round(experienceScore * 100),
    locationScore: Math.round(locationScore * 100),
    compensationScore: Math.round(compensationScore * 100),
    roleFamilyScore: Math.round(roleFamilyScore * 100),
    reasoning: reasons.join('. ') || `Score: ${overallScore}/100`,
    recommendation,
  };
}
