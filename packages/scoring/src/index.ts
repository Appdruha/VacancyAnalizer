import type { Company, CompanyScore } from "@edagent/domain";

type ScoreInput = Omit<CompanyScore, "total">;

export type CompanyDiscoverySignals = {
  companyName: string;
  industryName: string;
  size: Company["size"];
  vacancyCount: number;
  matchedProgramCompetencies: number;
  totalCompanyCompetencies: number;
  contactCount: number;
  hasWebsite: boolean;
  region: string;
};

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

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sizeReputationBoost(size: Company["size"]): number {
  switch (size) {
    case "startup":
      return 8;
    case "smb":
      return 15;
    case "mid-market":
      return 24;
    case "enterprise":
      return 30;
  }
}

export function estimateCompanySize(vacancyCount: number): Company["size"] {
  if (vacancyCount >= 6) {
    return "enterprise";
  }
  if (vacancyCount >= 4) {
    return "mid-market";
  }
  if (vacancyCount >= 2) {
    return "smb";
  }
  return "startup";
}

export function deriveStageFromScore(total: number, minimumApprovalScore: number): Company["stage"] {
  return total >= minimumApprovalScore ? "shortlisted" : "discovered";
}

export function calculateDiscoveryScore(signals: CompanyDiscoverySignals): CompanyScore {
  const competencyCoverageRatio =
    signals.totalCompanyCompetencies === 0
      ? 0
      : signals.matchedProgramCompetencies / signals.totalCompanyCompetencies;

  const competencyFit = clampScore(
    52 +
      competencyCoverageRatio * 36 +
      Math.min(signals.vacancyCount, 5) * 10
  );

  const reputation = clampScore(
    55 +
      sizeReputationBoost(signals.size) +
      (signals.hasWebsite ? 10 : 0)
  );

  const educationHint = `${signals.companyName} ${signals.industryName} ${signals.region}`.toLowerCase();
  const educationMultiplier =
    educationHint.includes("edu") ||
    educationHint.includes("learning") ||
    educationHint.includes("school") ||
    educationHint.includes("campus") ||
    educationHint.includes("academy") ||
    educationHint.includes("university")
      ? 1
      : 0;

  const educationReadiness = clampScore(
    58 +
      educationMultiplier * 30 +
      Math.min(signals.contactCount, 2) * 8 +
      Math.min(signals.vacancyCount, 4) * 5
  );

  return calculateCompanyScore({
    companyId: "",
    competencyFit,
    reputation,
    educationReadiness
  });
}
