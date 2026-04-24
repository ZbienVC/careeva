import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { normalizeQuestion, resolveAnswer } from '@/lib/answer-engine';

// POST /api/answers/resolve
// Resolve an answer for a raw question string.
// Returns stored answer, profile-derived answer, or needsReview flag.
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { questionText } = await request.json();
  if (!questionText) {
    return NextResponse.json({ error: 'questionText required' }, { status: 400 });
  }

  const result = await resolveAnswer(user.id, questionText);
  const norm = normalizeQuestion(questionText);

  return NextResponse.json({
    questionText,
    questionKey: result.questionKey,
    questionFamily: norm.questionFamily,
    answer: result.answer,
    confidence: result.confidence,
    source: result.source,
    needsReview: result.needsReview,
  });
}