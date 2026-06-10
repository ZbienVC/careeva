'use client';

import { JobScore } from '@/lib/types';
import { IconSparkles } from '@/components/icons';

interface JobScorerProps {
  score: JobScore;
}

export default function JobScorer({ score }: JobScorerProps) {
  const categories = [
    { label: 'Skills Match', value: score.skillsScore, weight: '35%' },
    { label: 'Role Match', value: score.roleScore, weight: '25%' },
    { label: 'Technologies', value: score.techScore, weight: '25%' },
    { label: 'Experience', value: score.experienceScore, weight: '15%' },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Score Circle */}
      <div className="flex justify-center mb-8">
        <div className="relative flex h-48 w-48 items-center justify-center rounded-full border-8 border-blue-500/30 bg-white/[0.03]">
          <div className="text-center">
            <div className="text-5xl font-bold text-blue-300">
              {Math.round(score.overallScore)}
            </div>
            <div className="mt-2 text-sm text-slate-400">Match Score</div>
            <div className="mt-1 text-xs text-slate-500">
              {score.overallScore >= 80
                ? 'Excellent Match'
                : score.overallScore >= 60
                ? 'Good Match'
                : score.overallScore >= 40
                ? 'Fair Match'
                : 'Limited Match'}
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Score Breakdown</h3>

        {categories.map((category) => (
          <div key={category.label}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-white">{category.label}</h4>
                <p className="text-xs text-slate-500">{category.weight} of total</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-300">{Math.round(category.value)}</div>
                <div className="text-xs text-slate-500">/100</div>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all"
                style={{ width: `${category.value}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Reasoning */}
      <div className="premium-card-soft p-5">
        <h3 className="mb-3 font-medium text-white">Why This Score?</h3>
        <p className="text-sm leading-relaxed text-slate-300">{score.reasoning}</p>
      </div>

      {/* Quality Indicator */}
      <div className="alert-info flex items-start gap-3">
        <IconSparkles size={16} className="mt-0.5 shrink-0 text-blue-300" />
        <p>
          <strong className="font-semibold">Tip:</strong> This score is based on your resume data and job requirements.
          Consider applying to positions with scores above 60 for the best fit.
        </p>
      </div>
    </div>
  );
}
