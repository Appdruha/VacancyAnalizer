import type { CompanyScore } from "@edagent/domain";

type ScoreInput = Omit<CompanyScore, "total">;

export function calculateCompanyScore(input: ScoreInput): CompanyScore {
  const total = Math.round(
    input.competencyFit * 0.5 +
      input.reputation * 0.3 +
      input.educationReadiness * 0.2
  );

  return {
    ...input,
    total
  };
}

