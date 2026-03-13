interface ResumeData {
  skills: string[];
  roles: string[];
  industries: string[];
  yearsExperience: number;
  education: string[];
  technologies: string[];
}

interface JobData {
  title: string;
  description: string;
  requirements: string;
}

interface ScoringResult {
  score: number;
  reasoning: string;
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function calculateSkillOverlap(
  userSkills: string[],
  jobText: string
): { matched: number; total: number } {
  if (userSkills.length === 0) return { matched: 0, total: 0 };

  const jobLower = normalizeText(jobText);
  let matched = 0;

  for (const skill of userSkills) {
    const skillLower = normalizeText(skill);
    if (jobLower.includes(skillLower)) {
      matched++;
    }
  }

  return { matched, total: userSkills.length };
}

function calculateRoleRelevance(
  userRoles: string[],
  jobTitle: string
): number {
  if (userRoles.length === 0) return 0;

  const jobTitleLower = normalizeText(jobTitle);
  let relevantRoles = 0;

  for (const role of userRoles) {
    const roleLower = normalizeText(role);
    if (
      jobTitleLower.includes(roleLower) ||
      roleLower.includes(jobTitleLower.split(" ")[0])
    ) {
      relevantRoles++;
    }
  }

  return Math.min((relevantRoles / userRoles.length) * 100, 100);
}

function calculateTechnologyMatch(
  userTechs: string[],
  jobText: string
): { matched: number; total: number } {
  if (userTechs.length === 0) return { matched: 0, total: 0 };

  const jobLower = normalizeText(jobText);
  let matched = 0;

  for (const tech of userTechs) {
    const techLower = normalizeText(tech);
    if (jobLower.includes(techLower)) {
      matched++;
    }
  }

  return { matched, total: userTechs.length };
}

function calculateExperienceScore(
  userYearsExp: number,
  jobText: string
): number {
  // Extract required years from job description
  const yearsMatch = jobText.match(/(\d+)\s+years?/i);
  if (!yearsMatch) return 50; // neutral if not specified

  const requiredYears = parseInt(yearsMatch[1], 10);

  if (userYearsExp >= requiredYears) {
    return 100;
  } else if (userYearsExp >= requiredYears * 0.5) {
    return 75;
  } else {
    return Math.max(0, (userYearsExp / requiredYears) * 100);
  }
}

export function scoreJob(
  resume: ResumeData,
  job: JobData
): ScoringResult {
  const jobText = `${job.title} ${job.description} ${job.requirements}`;

  // Calculate individual scores
  const skillOverlap = calculateSkillOverlap(resume.skills, jobText);
  const skillScore =
    skillOverlap.total > 0
      ? (skillOverlap.matched / skillOverlap.total) * 100
      : 0;

  const roleScore = calculateRoleRelevance(resume.roles, job.title);

  const techMatch = calculateTechnologyMatch(resume.technologies, jobText);
  const techScore =
    techMatch.total > 0 ? (techMatch.matched / techMatch.total) * 100 : 0;

  const expScore = calculateExperienceScore(resume.yearsExperience, jobText);

  // Weighted average
  const weights = {
    skill: 0.35,
    role: 0.25,
    tech: 0.25,
    experience: 0.15,
  };

  const finalScore =
    skillScore * weights.skill +
    roleScore * weights.role +
    techScore * weights.tech +
    expScore * weights.experience;

  // Build reasoning
  const reasoning = `
    Skill Match: ${skillScore.toFixed(0)}% (${skillOverlap.matched}/${skillOverlap.total})
    Role Relevance: ${roleScore.toFixed(0)}%
    Technology Match: ${techScore.toFixed(0)}% (${techMatch.matched}/${techMatch.total})
    Experience: ${expScore.toFixed(0)}% (${resume.yearsExperience} years)
  `.trim();

  return {
    score: Math.round(finalScore),
    reasoning,
  };
}
