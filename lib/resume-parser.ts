import * as fs from "fs";
import * as path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";

interface ParsedResume {
  skills: string[];
  roles: string[];
  industries: string[];
  yearsExperience: number;
  education: string[];
  technologies: string[];
  rawText: string;
}

async function extractTextFromPDF(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function extractTextFromDOCX(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

// ─── Fallback: keyword-based parse when OpenAI unavailable ───────────────────

function basicParse(text: string): ParsedResume {
  const lower = text.toLowerCase();

  const techKeywords = ['python', 'javascript', 'typescript', 'java', 'sql', 'react', 'node.js',
    'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'git', 'postgresql', 'mysql', 'mongodb',
    'graphql', 'rest api', 'next.js', 'vue', 'angular', 'tensorflow', 'pytorch', 'spark',
    'tableau', 'snowflake', 'databricks', 'dbt', 'kafka', 'redis', 'elasticsearch',
    'solidity', 'rust', 'go', 'scala', 'r', 'matlab', 'excel', 'figma', 'sketch'];

  const technologies = techKeywords.filter(kw => lower.includes(kw));
  const skills = technologies.slice(0, 20);

  // Rough years experience from text
  const yearsMatch = text.match(/(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|exp)/i);
  const yearsExperience = yearsMatch ? parseInt(yearsMatch[1]) : 0;

  // Rough roles from common patterns
  const rolePatterns = ['engineer', 'developer', 'analyst', 'manager', 'director', 'designer',
    'scientist', 'architect', 'lead', 'consultant', 'specialist', 'coordinator'];
  const roles: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 60 && rolePatterns.some(r => trimmed.toLowerCase().includes(r))) {
      roles.push(trimmed);
    }
  }

  return {
    skills,
    roles: roles.slice(0, 5),
    industries: [],
    yearsExperience,
    education: [],
    technologies,
    rawText: text,
  };
}
export async function parseResume(filePath: string): Promise<ParsedResume> {
  let resumeText: string;

  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    resumeText = await extractTextFromPDF(filePath);
  } else if (ext === ".docx") {
    resumeText = await extractTextFromDOCX(filePath);
  } else {
    throw new Error("Unsupported file format. Please upload PDF or DOCX.");
  }

  // If no OpenAI key, return basic keyword extraction from raw text
  if (!process.env.OPENAI_API_KEY) {
    return basicParse(resumeText);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Try OpenAI for structured extraction - fall back to keyword parse on any error (quota, network, etc.)
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume parser. Extract JSON with keys: skills (string[]), roles (string[]), industries (string[]), yearsExperience (number), education (string[]), technologies (string[]). Return ONLY valid JSON.',
        },
        { role: 'user', content: 'Parse this resume:\n\n' + resumeText.slice(0, 6000) },
      ],
      temperature: 0.3,
    });
    const content = response.choices[0].message.content;
    if (!content) return basicParse(resumeText);
    try {
      const parsed = JSON.parse(content);
      return {
        skills: parsed.skills || [],
        roles: parsed.roles || [],
        industries: parsed.industries || [],
        yearsExperience: parsed.yearsExperience || 0,
        education: parsed.education || [],
        technologies: parsed.technologies || [],
        rawText: resumeText || '',
      };
    } catch {
      return basicParse(resumeText);
    }
  } catch (err) {
    // Quota exceeded, network error, or any other OpenAI failure - use keyword extraction
    console.warn('OpenAI parse failed, using basicParse fallback:', err instanceof Error ? err.message : err);
    return basicParse(resumeText);
  }
}