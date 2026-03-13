import * as fs from "fs";
import * as path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ParsedResume {
  skills: string[];
  roles: string[];
  industries: string[];
  yearsExperience: number;
  education: string[];
  technologies: string[];
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
    };
  } catch (error) {
    throw new Error("Failed to parse OpenAI response");
  }
}
