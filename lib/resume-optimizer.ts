/**
 * lib/resume-optimizer.ts
 * 
 * Analyzes job descriptions to find keyword gaps in user's profile
 * and generates tailoring recommendations for applications.
 * 
 * Does NOT fabricate experience - only surfaces what's already there
 * and identifies genuine gaps for user awareness.
 */

import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface KeywordAnalysis {
  requiredSkills: string[];
  niceToHaveSkills: string[];
  matchedSkills: string[];        // in both JD and profile
  missingRequired: string[];      // in JD required, NOT in profile
  missingNiceToHave: string[];    // in JD nice-to-have, NOT in profile  
  unusedStrengths: string[];      // in profile but NOT in JD (opportunity to mention)
  matchScore: number;             // 0-100
  recommendedBullets: string[];   // existing bullets to highlight for this job
  tailoringNotes: string;         // AI analysis of how to position for this role
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
  const text_lower = text.toLowerCase();
  
  // Common tech keywords
  const techPatterns = [
    /\b(python|sql|r\b|javascript|typescript|java|scala|go|rust|swift)\b/g,
    /\b(pandas|numpy|scikit-learn|pytorch|tensorflow|keras)\b/g,
    /\b(snowflake|bigquery|redshift|databricks|spark|kafka|airflow|dbt)\b/g,
    /\b(tableau|looker|power\s?bi|mode|metabase|superset|grafana)\b/g,
    /\b(aws|gcp|azure|s3|ec2|lambda|kubernetes|docker|terraform)\b/g,
    /\b(postgresql|mysql|mongodb|redis|elasticsearch|dynamodb)\b/g,
    /\b(salesforce|hubspot|zendesk|stripe|twilio|segment)\b/g,
    /\b(react|node\.?js|next\.?js|graphql|rest\s?api)\b/g,
    /\b(github|git|ci\/cd|jenkins|jira|confluence|notion)\b/g,
  ];
  
  const domainPatterns = [
    /\b(machine\s+learning|deep\s+learning|nlp|computer\s+vision|mlops)\b/g,
    /\b(a\/b\s+testing|experimentation|statistical\s+analysis|regression)\b/g,
    /\b(data\s+pipeline|etl|data\s+warehouse|data\s+lake|data\s+mesh)\b/g,
    /\b(product\s+analytics|growth\s+analytics|marketing\s+analytics)\b/g,
    /\b(financial\s+modeling|forecasting|budgeting|p&l)\b/g,
    /\b(defi|smart\s+contracts|blockchain|web3|solidity|ethereum)\b/g,
    /\b(payments|fintech|banking|lending|kyc|aml|compliance)\b/g,
    /\b(customer\s+success|account\s+management|churn|nps|csat)\b/g,
    /\b(supply\s+chain|logistics|fulfillment|inventory|procurement)\b/g,
    /\b(revenue\s+operations|revops|sales\s+ops|gtm|crm)\b/g,
  ];
  
  const keywords: Set<string> = new Set();
  
  [...techPatterns, ...domainPatterns].forEach(pattern => {
    const matches = text_lower.match(pattern) || [];
    matches.forEach(m => keywords.add(m.trim()));
  });
  
  // Also extract capitalized acronyms (SQL, API, AWS, etc.)
  const acronyms = text.match(/\b[A-Z]{2,6}\b/g) || [];
  acronyms.forEach(a => {
    if (!['THE', 'AND', 'FOR', 'ARE', 'THIS', 'WITH', 'FROM', 'THAT', 'HAVE', 'WILL'].includes(a)) {
      keywords.add(a.toLowerCase());
    }
  });
  
  return Array.from(keywords);
}

// ─── Main analysis function ───────────────────────────────────────────────────

export async function analyzeJobFit(userId: string, jobId: string): Promise<KeywordAnalysis> {
  const [job, skills, workHistory] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.skill.findMany({ where: { userId } }),
    prisma.workHistory.findMany({ where: { userId }, include: { bullets: true } }),
  ]);

  if (!job) throw new Error('Job not found');

  const jdText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
  const jdKeywords = extractKeywords(jdText);

  // User's skill set
  const userSkills = new Set([
    ...skills.map(s => s.name.toLowerCase()),
    ...workHistory.flatMap(w => [...(w.skills || []), ...(w.technologies || [])]).map(s => s.toLowerCase()),
  ]);

  // Find matches and gaps
  const matchedSkills = jdKeywords.filter(k => userSkills.has(k) || Array.from(userSkills).some(s => s.includes(k) || k.includes(s)));
  const missingRequired: string[] = [];
  const missingNiceToHave: string[] = [];

  // Simple heuristic: keywords in first 30% of JD = required, rest = nice-to-have
  const jdLines = jdText.split('\n');
  const requiredSection = jdLines.slice(0, Math.floor(jdLines.length * 0.5)).join(' ');
  
  for (const kw of jdKeywords) {
    if (matchedSkills.includes(kw)) continue;
    if (requiredSection.includes(kw)) {
      missingRequired.push(kw);
    } else {
      missingNiceToHave.push(kw);
    }
  }

  // Find bullets that best match this job
  const allBullets = workHistory.flatMap(w => w.bullets.map(b => b.content));
  const recommendedBullets = allBullets
    .filter(b => jdKeywords.some(k => b.toLowerCase().includes(k)))
    .slice(0, 5);

  // Unused strengths
  const unusedStrengths = Array.from(userSkills)
    .filter(s => !jdKeywords.some(k => k.includes(s) || s.includes(k)))
    .slice(0, 10);

  const matchScore = jdKeywords.length > 0 
    ? Math.round((matchedSkills.length / jdKeywords.length) * 100) 
    : 50;

  // AI tailoring notes (only if OpenAI configured)
  let tailoringNotes = '';
  if (openai && job.description) {
    try {
      const profileSummary = workHistory.slice(0, 2).map(w => `${w.title} at ${w.company}: ${w.summary || ''}`).join('. ');
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `In 2-3 sentences, tell me how a candidate with this background should position themselves for this job. Focus on what to emphasize, not what to fabricate.
Background: ${profileSummary}
Missing required skills: ${missingRequired.slice(0, 5).join(', ')}
Job: ${job.title} at ${job.company}
Key JD requirements: ${job.description.slice(0, 500)}`,
        }],
        max_tokens: 200,
        temperature: 0.3,
      });
      tailoringNotes = res.choices[0].message.content || '';
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

// ─── Generate tailored resume summary for a specific job ─────────────────────

export async function generateTailoredSummary(
  userId: string,
  jobId: string
): Promise<ResumeVariant> {
  const analysis = await analyzeJobFit(userId, jobId);
  const [job, workHistory, personalInfo] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.workHistory.findMany({ where: { userId }, include: { bullets: true }, orderBy: { startDate: 'desc' } }),
    prisma.personalInfo.findUnique({ where: { userId } }),
  ]);

  if (!job || !openai) throw new Error('Cannot generate without job or OpenAI');

  const profile = workHistory.slice(0, 3).map(w => 
    `${w.title} at ${w.company}: ${w.summary || ''}\nKey bullets: ${w.bullets.slice(0, 3).map(b => b.content).join('; ')}`
  ).join('\n\n');

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Write a 2-sentence resume summary for ${personalInfo?.fullName || 'the candidate'} tailored to: ${job.title} at ${job.company}.

RULES: Only use facts from the profile below. Do not invent anything.
Emphasize these matched skills: ${analysis.matchedSkills.slice(0, 8).join(', ')}
Avoid mentioning missing skills: ${analysis.missingRequired.slice(0, 5).join(', ')}

PROFILE:
${profile}

Write ONLY the 2-sentence summary. Start with the candidate's primary expertise.`,
    }],
    max_tokens: 150,
    temperature: 0.3,
  });

  const summary = res.choices[0].message.content || '';
  
  // Select best bullets for this job
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
    emphasizedExperience: workHistory[0]?.title ? `${workHistory[0].title} at ${workHistory[0].company}` : '',
  };
}
