/**
 * lib/resume-parser.ts
 *
 * Parses resume files (PDF, DOCX) into structured data.
 * Uses Claude/OpenAI when available, falls back to keyword extraction.
 * Extracts: skills, technologies, roles, work history positions, education, years experience, raw text.
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import OpenAI from 'openai';

export interface WorkHistoryEntry {
  company: string;
  title: string;
  startDate?: string;   // YYYY-MM format
  endDate?: string;     // YYYY-MM format or null if current
  isCurrent: boolean;
  summary: string;
  skills: string[];
  technologies: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  endDate?: string;     // YYYY or YYYY-MM
}

export interface ParsedResume {
  skills: string[];
  roles: string[];
  industries: string[];
  yearsExperience: number;
  education: string[];            // flat strings for backward compat
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

// ─── Fallback keyword parser ──────────────────────────────────────────────────

function basicParse(text: string): ParsedResume {
  const lower = text.toLowerCase();

  const techKeywords = [
    'python', 'javascript', 'typescript', 'java', 'sql', 'react', 'node.js', 'nodejs',
    'aws', 'gcp', 'azure', 's3', 'lambda', 'ec2', 'docker', 'kubernetes', 'git',
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
    'graphql', 'rest', 'next.js', 'nextjs', 'vue', 'angular', 'tensorflow', 'pytorch',
    'spark', 'kafka', 'airflow', 'dbt', 'snowflake', 'databricks', 'tableau', 'looker',
    'solidity', 'rust', 'go', 'scala', 'r', 'excel', 'figma', 'sketch', 'jira',
    'github', 'gitlab', 'jenkins', 'terraform', 'ansible', 'fastapi', 'flask', 'django',
  ];
  const technologies = techKeywords.filter(kw => lower.includes(kw));
  const skills = technologies.slice(0, 20);

  const yearsMatch = text.match(/(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|exp)/i);
  const yearsExperience = yearsMatch ? parseInt(yearsMatch[1]) : 0;

  const rolePatterns = ['engineer', 'developer', 'analyst', 'manager', 'director', 'designer',
    'scientist', 'architect', 'lead', 'consultant', 'specialist', 'coordinator', 'vp', 'head of'];
  const roles: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 3 && trimmed.length < 80 &&
        rolePatterns.some(r => trimmed.toLowerCase().includes(r)) &&
        !trimmed.includes('•') && !trimmed.includes('@')) {
      roles.push(trimmed);
    }
  }

  return {
    skills,
    roles: [...new Set(roles)].slice(0, 8),
    industries: [],
    yearsExperience,
    education: [],
    technologies,
    rawText: text,
    workHistory: [],
    educationEntries: [],
  };
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
    throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT.');
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
- skills: string[] (technical and soft skills mentioned)
- roles: string[] (job titles/roles held - exact titles from resume)
- industries: string[] (industries the person has worked in)
- yearsExperience: number (total years of work experience)
- education: string[] (degrees and certifications as plain strings)
- technologies: string[] (programming languages, frameworks, tools)
- workHistory: array of { company: string, title: string, startDate: string (YYYY-MM), endDate: string (YYYY-MM or null if current), isCurrent: boolean, summary: string (1-2 sentences), skills: string[], technologies: string[] }
- educationEntries: array of { institution: string, degree: string, fieldOfStudy: string, endDate: string (YYYY) }
Return ONLY valid JSON. Do not fabricate or infer anything not in the resume.`,
        },
        {
          role: 'user',
          content: 'Parse this resume:\n\n' + resumeText.slice(0, 8000),
        },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0].message.content || '';
    // Strip markdown code blocks if present
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        skills: parsed.skills || [],
        roles: parsed.roles || [],
        industries: parsed.industries || [],
        yearsExperience: parsed.yearsExperience || 0,
        education: parsed.education || [],
        technologies: parsed.technologies || [],
        rawText: resumeText,
        workHistory: (parsed.workHistory || []).map((w: any) => ({
          company: w.company || '',
          title: w.title || '',
          startDate: w.startDate || null,
          endDate: w.isCurrent ? null : (w.endDate || null),
          isCurrent: !!w.isCurrent,
          summary: w.summary || '',
          skills: w.skills || [],
          technologies: w.technologies || [],
        })),
        educationEntries: (parsed.educationEntries || []).map((e: any) => ({
          institution: e.institution || '',
          degree: e.degree || '',
          fieldOfStudy: e.fieldOfStudy || '',
          endDate: e.endDate || null,
        })),
      };
    } catch {
      return basicParse(resumeText);
    }
  } catch (err) {
    console.warn('OpenAI parse failed, using basicParse:', err instanceof Error ? err.message : err);
    return basicParse(resumeText);
  }
}
