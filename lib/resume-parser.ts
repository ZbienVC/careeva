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

  // Use OpenAI to extract structured data
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an expert resume parser. Extract the following information from the resume text and return a JSON object with these exact keys:
        - skills: array of technical and soft skills
        - roles: array of job titles/roles held
        - industries: array of industries worked in
        - yearsExperience: total years of work experience (number)
        - education: array of degrees/certifications
        - technologies: array of programming languages, frameworks, and tools used
        
        Return ONLY valid JSON, no markdown formatting.`,
      },
      {
        role: "user",
        content: `Parse this resume:\n\n${resumeText}`,
      },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Failed to parse resume with OpenAI");
  }

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
    // If OpenAI response parsing fails, fall back to basic extraction
    return basicParse(resumeText);
  }
}
