/**
 * lib/resume-parser.ts
 *
 * Parses PDF/DOCX/TXT resumes into structured data.
 * Uses OpenAI when available; falls back to heuristic parsing.
 * Always returns workHistory[], educationEntries[], skills[], technologies[].
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import OpenAI from 'openai';

export interface WorkHistoryEntry {
  company: string;
  title: string;
  startDate?: string;   // YYYY-MM
  endDate?: string;     // YYYY-MM or null if current
  isCurrent: boolean;
  summary: string;
  skills: string[];
  technologies: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  endDate?: string;     // YYYY
}

export interface ParsedResume {
  skills: string[];
  roles: string[];
  industries: string[];
  yearsExperience: number;
  education: string[];
  technologies: string[];
  rawText: string;
  workHistory: WorkHistoryEntry[];
  educationEntries: EducationEntry[];
}

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractTextFromPDF(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function extractTextFromDOCX(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

function extractTextFromTXT(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

// ─── Heuristic fallback parser ───────────────────────────────────────────────
// Used when OpenAI is unavailable. Extracts structured data from plain text.

function basicParse(text: string): ParsedResume {
  const lower = text.toLowerCase();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Skills / technologies ──
  const techKeywords = [
    'python', 'javascript', 'typescript', 'java', 'sql', 'react', 'node.js', 'nodejs',
    'aws', 'gcp', 'azure', 's3', 'lambda', 'ec2', 'docker', 'kubernetes', 'git',
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
    'graphql', 'rest', 'next.js', 'nextjs', 'vue', 'angular', 'tensorflow', 'pytorch',
    'spark', 'kafka', 'airflow', 'dbt', 'snowflake', 'databricks', 'tableau', 'looker',
    'solidity', 'rust', 'go', 'scala', 'r', 'excel', 'figma', 'sketch', 'jira',
    'github', 'gitlab', 'jenkins', 'terraform', 'ansible', 'fastapi', 'flask', 'django',
    'stripe', 'twilio', 'salesforce', 'hubspot', 'zapier', 'notion', 'linear',
  ];
  const technologies = techKeywords.filter(kw => lower.includes(kw));
  const skills = technologies.slice(0, 20);

  // ── Years of experience ──
  const yearsMatch = text.match(/(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|exp)/i);
  const yearsExperience = yearsMatch ? parseInt(yearsMatch[1]) : 0;

  // ── Work history heuristic extraction ──
  // Strategy: find lines that look like job titles (contain role keywords)
  // followed by company names, then grab surrounding text as summary
  const rolePatterns = [
    'engineer', 'developer', 'analyst', 'manager', 'director', 'designer',
    'scientist', 'architect', 'lead', 'consultant', 'specialist', 'coordinator',
    'vp', 'vice president', 'head of', 'founder', 'cto', 'ceo', 'coo', 'cfo',
    'product', 'marketing', 'operations', 'strategy', 'growth', 'data',
  ];

  const workHistory: WorkHistoryEntry[] = [];
  const seenCompanies = new Set<string>();

  // Date patterns like "Jan 2020", "2020 - 2022", "2020–Present"
  const dateRe = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}\s*[-–—]\s*(?:\d{4}|present|current)/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Skip lines that are too short, too long, or are section headers
    if (line.length < 5 || line.length > 100) continue;
    if (/^(education|skills|certif|awards|projects|summary|experience|work|employment)/i.test(line)) continue;

    const isRoleLine = rolePatterns.some(r => lineLower.includes(r));
    if (!isRoleLine) continue;

    // Try to find company on adjacent lines
    const prevLine = i > 0 ? lines[i - 1] : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1] : '';

    // Company heuristic: short line near role line, not a date, not a url
    const companyCandidate = [prevLine, nextLine].find(l =>
      l.length > 2 && l.length < 80 &&
      !dateRe.test(l) &&
      !l.includes('@') &&
      !l.includes('http') &&
      !/^\d/.test(l) &&
      !rolePatterns.some(r => l.toLowerCase().includes(r))
    );

    const company = companyCandidate || '';
    if (!company || seenCompanies.has(company.toLowerCase())) continue;
    seenCompanies.add(company.toLowerCase());

    // Extract dates from surrounding context
    const context = lines.slice(Math.max(0, i - 2), i + 3).join(' ');
    const dates = context.match(dateRe) || [];
    let startDate: string | undefined;
    let endDate: string | undefined;
    let isCurrent = /present|current/i.test(context);

    if (dates.length >= 1) {
    if (dates.length >= 1 && dates[0]) {
      startDate = normalizeDateStr(dates[0] as string);
    if (dates.length >= 2) {
    if (dates.length >= 2 && dates[1]) {
      endDate = isCurrent ? undefined : normalizeDateStr(dates[1] as string);

    // Grab up to 3 lines after as summary
    const summaryLines = lines.slice(i + 1, i + 4)
      .filter(l => l.length > 20 && !dateRe.test(l) && l !== company)
      .slice(0, 2);
    const summary = summaryLines.join(' ').slice(0, 300);

    workHistory.push({
      company,
      title: line,
      startDate,
      endDate,
      isCurrent,
      summary,
      skills: technologies.slice(0, 5),
      technologies: technologies.slice(0, 5),
    });

    if (workHistory.length >= 5) break;
  }

  // ── Education heuristic extraction ──
  const educationEntries: EducationEntry[] = [];
  const degreeKeywords = ["bachelor", "master", "phd", "doctor", "associate", "mba", "b.s", "m.s", "b.a", "m.a", "b.eng", "m.eng"];
  const universityKeywords = ["university", "college", "institute", "school", "academy"];

  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    const isDegree = degreeKeywords.some(d => lineLower.includes(d));
    const isUniversity = universityKeywords.some(u => lineLower.includes(u));

    if (!isDegree && !isUniversity) continue;

    const institution = isUniversity ? lines[i] : (lines[i + 1] || lines[i - 1] || lines[i]);
    const degree = isDegree ? lines[i] : '';
    const yearMatch = lines.slice(Math.max(0, i - 1), i + 3).join(' ').match(/\b(19|20)\d{2}\b/);

    educationEntries.push({
      institution: institution.slice(0, 100),
      degree: degree.slice(0, 80),
      fieldOfStudy: '',
      endDate: yearMatch ? yearMatch[0] : undefined,
    });

    if (educationEntries.length >= 3) break;
  }

  return {
    skills,
    roles: workHistory.map(w => w.title).slice(0, 5),
    industries: [],
    yearsExperience,
    education: educationEntries.map(e => e.degree + (e.institution ? ' at ' + e.institution : '')),
    technologies,
    rawText: text,
    workHistory,
    educationEntries,
  };
}

// ─── Date normalization helper ────────────────────────────────────────────────

function normalizeDateStr(dateStr: string): string {
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const lower = dateStr.toLowerCase();
  for (const [mon, num] of Object.entries(monthMap)) {
    if (lower.includes(mon)) {
      const yearMatch = dateStr.match(/\d{4}/);
      if (yearMatch) return yearMatch[0] + '-' + num;
    }
  }
  const yearMatch = dateStr.match(/\d{4}/);
  return yearMatch ? yearMatch[0] + '-01' : '';
}

// ─── Main parse function ──────────────────────────────────────────────────────

export async function parseResume(filePath: string): Promise<ParsedResume> {
  const ext = path.extname(filePath).toLowerCase();
  let resumeText: string;

  if (ext === '.pdf') {
    resumeText = await extractTextFromPDF(filePath);
  } else if (ext === '.docx' || ext === '.doc') {
    resumeText = await extractTextFromDOCX(filePath);
  } else if (ext === '.txt') {
    resumeText = extractTextFromTXT(filePath);
  } else {
    throw new Error('Unsupported format. Upload PDF, DOCX, or TXT.');
  }

  if (!process.env.OPENAI_API_KEY) {
    return basicParse(resumeText);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert resume parser. Extract ONLY information explicitly stated in the resume. Return a JSON object with these exact keys:
- skills: string[] (technical and soft skills)
- roles: string[] (exact job titles from resume)
- industries: string[] (industries worked in)
- yearsExperience: number (total years of work experience)
- education: string[] (degrees as plain strings)
- technologies: string[] (languages, frameworks, tools)
- workHistory: array of { company: string, title: string, startDate: string (YYYY-MM or ""), endDate: string (YYYY-MM or ""), isCurrent: boolean, summary: string (1-2 sentences max), skills: string[], technologies: string[] }
- educationEntries: array of { institution: string, degree: string, fieldOfStudy: string, endDate: string (YYYY or "") }
Return ONLY valid JSON. Never fabricate or infer anything not explicitly in the resume.`,
        },
        {
          role: 'user',
          content: 'Parse this resume:\n\n' + resumeText.slice(0, 8000),
        },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0].message.content || '';
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        roles: Array.isArray(parsed.roles) ? parsed.roles : [],
        industries: Array.isArray(parsed.industries) ? parsed.industries : [],
        yearsExperience: Number(parsed.yearsExperience) || 0,
        education: Array.isArray(parsed.education) ? parsed.education : [],
        technologies: Array.isArray(parsed.technologies) ? parsed.technologies : [],
        rawText: resumeText,
        workHistory: (Array.isArray(parsed.workHistory) ? parsed.workHistory : []).map((w: any) => ({
          company: String(w.company || ''),
          title: String(w.title || ''),
          startDate: w.startDate || undefined,
          endDate: w.isCurrent ? undefined : (w.endDate || undefined),
          isCurrent: Boolean(w.isCurrent),
          summary: String(w.summary || ''),
          skills: Array.isArray(w.skills) ? w.skills : [],
          technologies: Array.isArray(w.technologies) ? w.technologies : [],
        })),
        educationEntries: (Array.isArray(parsed.educationEntries) ? parsed.educationEntries : []).map((e: any) => ({
          institution: String(e.institution || ''),
          degree: String(e.degree || ''),
          fieldOfStudy: String(e.fieldOfStudy || ''),
          endDate: e.endDate || undefined,
        })),
      };
    } catch {
      // JSON parse failed — fall back to heuristic
      return basicParse(resumeText);
    }
  } catch (err) {
    console.warn('OpenAI parse failed, using heuristic fallback:', err instanceof Error ? err.message : err);
    return basicParse(resumeText);
  }
}
