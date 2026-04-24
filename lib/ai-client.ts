/**
 * lib/ai-client.ts
 * 
 * Unified AI client for Careeva
 * - Claude Sonnet 4.6 (claude-sonnet-4-5): cover letters, resume tailoring, narrative writing
 * - GPT-4o-mini: question answering, scoring rationale, quick responses
 * - Fallback: GPT-4o-mini when Claude key not available
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ─── Client singletons ────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// ─── Model selection ──────────────────────────────────────────────────────────

export type AITask =
  | 'cover_letter'         // Full cover letter generation
  | 'resume_summary'       // Tailored resume summary
  | 'resume_bullets'       // Improve/rewrite resume bullets
  | 'answer_behavioral'    // Long behavioral question answers
  | 'answer_short'         // Short application answers
  | 'job_analysis'         // Tailoring notes for a job
  | 'scoring_rationale'    // Why a job scored X
  | 'quick_answer';        // Simple factual answer from profile

const CLAUDE_TASKS: AITask[] = ['cover_letter', 'resume_summary', 'resume_bullets', 'answer_behavioral'];
const CLAUDE_MODEL = 'claude-sonnet-4-5';
const OPENAI_MODEL = 'gpt-4o-mini';

// ─── Core generation function ─────────────────────────────────────────────────

export interface GenerationOptions {
  task: AITask;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export async function generate(opts: GenerationOptions): Promise<string> {
  const {
    task,
    prompt,
    maxTokens = 800,
    temperature = 0.3,
    systemPrompt,
  } = opts;

  // Use Claude for writing-quality tasks
  const useClaude = CLAUDE_TASKS.includes(task);
  const claude = useClaude ? getAnthropic() : null;

  if (claude) {
    try {
      const response = await claude.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt || buildSystemPrompt(task),
        messages: [{ role: 'user', content: prompt }],
      });
      const content = response.content[0];
      if (content.type === 'text') return content.text;
    } catch (err) {
      console.warn(`[AI] Claude failed for ${task}, falling back to GPT:`, err);
      // Fall through to OpenAI
    }
  }

  // Fall back to OpenAI
  const openai = getOpenAI();
  if (!openai) throw new Error('No AI API key configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to your environment variables.');

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: maxTokens,
    temperature,
    messages: [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ],
  });
  return response.choices[0].message.content || '';
}

// ─── System prompts by task ───────────────────────────────────────────────────

function buildSystemPrompt(task: AITask): string {
  const base = `You are an expert professional writing assistant specializing in job applications. 
You write in a direct, authentic, human voice that avoids corporate clichés.
CRITICAL RULE: Never fabricate, invent, or embellish any experience, skill, metric, company, project, or achievement.
Only use information explicitly provided in the context. If asked about something not in the context, note the gap rather than inventing.`;

  const taskSpecific: Record<AITask, string> = {
    cover_letter: `${base}
You specialize in cover letters that:
- Sound like a specific person, not a template
- Lead with the most relevant experience, not generic praise for the company
- Use concrete details from the candidate's actual work history
- Stay under 350 words (fits on one page with header)
- Never start with "I am writing to apply" or similar clichés`,

    resume_summary: `${base}
You write resume summaries that:
- Compress the candidate's most relevant experience into 2 sentences
- Lead with the most impactful qualifier (years of experience, key specialty, standout achievement)
- End with the value they bring to the target role
- Are factual and grounded in the provided profile`,

    resume_bullets: `${base}
You improve resume bullet points to:
- Use strong action verbs
- Include quantifiable results where the data exists in the profile
- Be specific about scope, scale, and impact
- Never add metrics that were not in the original`,

    answer_behavioral: `${base}
You write behavioral interview answers that:
- Use the STAR format (Situation, Task, Action, Result) naturally
- Include specific details from the provided work history
- Are 150-250 words for long-form fields
- Sound conversational and authentic, not rehearsed`,

    answer_short: `${base}
You write concise application answers that:
- Are direct and factual
- Use 1-3 sentences maximum unless more is required
- Extract the precise answer from the provided profile data`,

    job_analysis: `${base}
You analyze job fit and provide positioning advice that:
- Is honest about genuine gaps without suggesting fabrication
- Identifies transferable skills the candidate may not have highlighted
- Suggests which experience to emphasize for this specific role`,

    scoring_rationale: `${base}
You explain job match scores in plain language, noting what aligned well and what didn't.`,

    quick_answer: `${base}
You provide factual, concise answers directly from the provided profile data.`,
  };

  return taskSpecific[task] || base;
}

// ─── Convenience functions ────────────────────────────────────────────────────

export async function generateCoverLetter(prompt: string): Promise<string> {
  return generate({ task: 'cover_letter', prompt, maxTokens: 900, temperature: 0.4 });
}

export async function generateResumeSummary(prompt: string): Promise<string> {
  return generate({ task: 'resume_summary', prompt, maxTokens: 200, temperature: 0.3 });
}

export async function improveResumeBullets(prompt: string): Promise<string> {
  return generate({ task: 'resume_bullets', prompt, maxTokens: 600, temperature: 0.3 });
}

export async function generateBehavioralAnswer(prompt: string): Promise<string> {
  return generate({ task: 'answer_behavioral', prompt, maxTokens: 400, temperature: 0.3 });
}

export async function generateShortAnswer(prompt: string): Promise<string> {
  return generate({ task: 'answer_short', prompt, maxTokens: 150, temperature: 0.2 });
}

export async function generateJobAnalysis(prompt: string): Promise<string> {
  return generate({ task: 'job_analysis', prompt, maxTokens: 300, temperature: 0.3 });
}

export function isAIConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

export function getActiveAIProvider(): string {
  if (process.env.ANTHROPIC_API_KEY) return `Claude ${CLAUDE_MODEL} (cover letters/resumes) + GPT-4o-mini (answers)`;
  if (process.env.OPENAI_API_KEY) return 'GPT-4o-mini (all tasks)';
  return 'None configured';
}
