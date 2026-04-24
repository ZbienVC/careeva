/**
 * lib/resume-optimizer.ts
 *
 * Keyword gap analysis and tailored resume summary generation.
 * Uses ai-client (Claude Sonnet 4.6 for writing tasks, GPT-4o-mini fallback).
 */

import { prisma } from '@/lib/prisma';
import { generate, generateResumeSummary } from '@/lib/ai-client';

export interface KeywordAnalysis {
  requiredSkills: string[];
  niceToHaveSkills: string[];
  matchedSkills: string[];
  missingRequired: string[];
  missingNiceToHave: string[];
  unusedStrengths: string[];
  matchScore: number;
  recommendedBullets: string[];
  tailoringNotes: string;
}

export interface ResumeVariant {
  title: string;
  summary: string;
  topBullets: string[];
  highlightedSkills: string[];
  emphasizedExperience: string;
}

// ─── Extract keywords from job description ─────────────────────────────────────

function extractKeywords(text: string): string[] {
  const t = text.toLowerCase();
  const patterns = [
    /\b(python|sql|javascript|typescript|java|scala|go|rust|swift|r\b)\b/g,
    /\b(pandas|numpy|scikit-learn|pytorch|tensorflow|keras)\b/g,
    /\b(snowflake|bigquery|redshift|databricks|spark|kafka|airflow|dbt)\b/g,
    /\b(tableau|looker|power\s?bi|mode|metabase|superset|grafana)\b/g,
    /\b(aws|gcp|azure|s3|ec2|lambda|kubernetes|docker|terraform)\b/g,
    /\b(postgresql|mysql|mongodb|redis|elasticsearch|dynamodb)\b/g,
    /\b(salesforce|hubspot|zendesk|stripe|twilio|segment)\b/g,
    /\b(react|node\.?js|next\.?js|graphql|rest\s?api)\b/g,
    /\b(github|git|ci\/cd|jenkins|jira|confluence|notion)\b/g,
    /\b(machine\s+learning|deep\s+learning|nlp|computer\s+vision|mlops)\b/g,
    /\b(a\/b\s+testing|experimentation|statistical\s+analysis|regression)\b/g,
    /\b(data\s+pipeline|etl|data\s+warehouse|data\s+lake|data\s+mesh)\b/g,
    /\b(product\s+analytics|growth\s+analytics|marketing\s+analytics)\b/g,
    /\b(financial\s+modeling|forecasting|budgeting)\b/g,
    /\b(defi|smart\s+contracts|blockchain|web3|solidity|ethereum)\b/g,
    /\b(payments|fintech|banking|lending|kyc|aml|compliance)\b/g,
    /\b(revenue\s+operations|revops|sales\s+ops|gtm|crm)\b/g,
  ];

  const keywords = new Set<string>();
  for (const pat of patterns) {
    for (const m of t.matchAll(pat)) keywords.add(m[0].trim());
  }
  // Uppercase acronyms
  for (const m of text.matchAll(/\b[A-Z]{2,6}\b/g)) {
    const w = m[0];
    if (!['THE', 'AND', 'FOR', 'ARE', 'THIS', 'WITH', 'FROM', 'THAT', 'HAVE', 'WILL'].includes(w)) {
      keywords.add(w.toLowerCase());
    }
  }
  return Array.from(keywords);
}

// ─── Main keyword gap analysis ────────────────────────────────────────────────

export async function analyzeJobFit(userId: string, jobId: string): Promise<KeywordAnalysis> {
  const [job, skills, workHistory] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.skill.findMany({ where: { userId } }),
    prisma.workHistory.findMany({ where: { userId }, include: { bullets: true } }),
  ]);

  if (!job) throw new Error('Job not found');

  const jdText = [job.title, job.description, job.requirements].filter(Boolean).join(' ');
  const jdKeywords = extractKeywords(jdText);

  const userSkills = new Set<string>([
    ...skills.map(s => s.name.toLowerCase()),
    ...workHistory.flatMap(w => [...(w.skills || []), ...(w.technologies || [])]).map(s => s.toLowerCase()),
  ]);

  const matchedSkills = jdKeywords.filter(k =>
    userSkills.has(k) || Array.from(userSkills).some(s => s.includes(k) || k.includes(s))
  );

  const jdLines = jdText.split('\n');
  const requiredSection = jdLines.slice(0, Math.floor(jdLines.length * 0.5)).join(' ');
  const missingRequired: string[] = [];
  const missingNiceToHave: string[] = [];

  for (const kw of jdKeywords) {
    if (matchedSkills.includes(kw)) continue;
    if (requiredSection.includes(kw)) missingRequired.push(kw);
    else missingNiceToHave.push(kw);
  }

  const allBullets = workHistory.flatMap(w => w.bullets.map(b => b.content));
  const recommendedBullets = allBullets
    .filter(b => jdKeywords.some(k => b.toLowerCase().includes(k)))
    .slice(0, 5);

  const unusedStrengths = Array.from(userSkills)
    .filter(s => !jdKeywords.some(k => k.includes(s) || s.includes(k)))
    .slice(0, 10);

  const matchScore = jdKeywords.length > 0
    ? Math.round((matchedSkills.length / jdKeywords.length) * 100)
    : 50;

  let tailoringNotes = '';
  if (job.description) {
    try {
      const profileSummary = workHistory
        .slice(0, 2)
        .map(w => w.title + ' at ' + w.company + ': ' + (w.summary || ''))
        .join('. ');
      const missingList = missingRequired.slice(0, 5).join(', ');
      const prompt =
        'In 2-3 sentences, tell me how a candidate with this background should position themselves for this job. ' +
        'Focus on what to emphasize, not what to fabricate.\n' +
        'Background: ' + profileSummary + '\n' +
        'Missing required skills: ' + missingList + '\n' +
        'Job: ' + job.title + ' at ' + job.company + '\n' +
        'Key JD requirements: ' + job.description.slice(0, 500);
      tailoringNotes = await generate({ task: 'job_analysis', prompt, maxTokens: 200 });
    } catch { /* non-fatal */ }
  }

  return {
    requiredSkills: jdKeywords.slice(0, 20),
    niceToHaveSkills: missingNiceToHave.slice(0, 10),
    matchedSkills: matchedSkills.slice(0, 20),
    missingRequired: missingRequired.slice(0, 10),
    missingNiceToHave: missingNiceToHave.slice(0, 10),
    unusedStrengths: unusedStrengths.slice(0, 8),
    matchScore,
    recommendedBullets,
    tailoringNotes,
  };
}

// ─── Generate tailored resume summary ────────────────────────────────────────

export async function generateTailoredSummary(userId: string, jobId: string): Promise<ResumeVariant> {
  const analysis = await analyzeJobFit(userId, jobId);
  const [job, workHistory, personalInfo] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.workHistory.findMany({ where: { userId }, include: { bullets: true }, orderBy: { startDate: 'desc' } }),
    prisma.personalInfo.findUnique({ where: { userId } }),
  ]);

  if (!job) throw new Error('Job not found');

  const profile = workHistory.slice(0, 3).map(w =>
    w.title + ' at ' + w.company + ': ' + (w.summary || '') +
    '\nKey bullets: ' + w.bullets.slice(0, 3).map(b => b.content).join('; ')
  ).join('\n\n');

  const candidateName = personalInfo?.fullName || 'the candidate';
  const matchedList = analysis.matchedSkills.slice(0, 8).join(', ');
  const missingList = analysis.missingRequired.slice(0, 5).join(', ');

  const summaryPrompt =
    'Write a 2-sentence resume summary for ' + candidateName + ' tailored to: ' + job.title + ' at ' + job.company + '.\n\n' +
    'RULES: Only use facts from the profile below. Do not invent anything.\n' +
    'Emphasize these matched skills: ' + matchedList + '\n' +
    'Avoid mentioning missing skills: ' + missingList + '\n\n' +
    'PROFILE:\n' + profile + '\n\n' +
    'Write ONLY the 2-sentence summary. Start with the candidate\'s primary expertise.';

  const summary = await generateResumeSummary(summaryPrompt);

  const allBullets = workHistory.flatMap(w => w.bullets.map(b => ({ content: b.content, company: w.company })));
  const topBullets = allBullets
    .filter(b => analysis.matchedSkills.some(skill => b.content.toLowerCase().includes(skill.toLowerCase())))
    .slice(0, 6)
    .map(b => b.content);

  return {
    title: job.title,
    summary,
    topBullets,
    highlightedSkills: analysis.matchedSkills.slice(0, 12),
    emphasizedExperience: workHistory[0]
      ? workHistory[0].title + ' at ' + workHistory[0].company
      : '',
  };
}
