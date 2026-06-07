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

export type DiscoveryScoreBreakdown = {
  total: number;
  competencyFit: number;
  reputation: number;
  educationReadiness: number;
  signals: {
    vacancyCount: number;
    matchedProgramCompetencies: number;
    totalCompanyCompetencies: number;
    contactCount: number;
    hasWebsite: boolean;
    region: string;
    size: Company["size"];
  };
  reasons: string[];
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

function hasEducationSignal(input: string): boolean {
  const hint = input.toLowerCase();
  return (
    hint.includes("edu") ||
    hint.includes("edtech") ||
    hint.includes("education") ||
    hint.includes("learning") ||
    hint.includes("school") ||
    hint.includes("campus") ||
    hint.includes("academy") ||
    hint.includes("training") ||
    hint.includes("university")
  );
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

  const educationMultiplier = hasEducationSignal(
    `${signals.companyName} ${signals.industryName} ${signals.region}`
  )
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

export function explainDiscoveryScore(signals: CompanyDiscoverySignals): DiscoveryScoreBreakdown {
  const score = calculateDiscoveryScore(signals);
  const reasons: string[] = [];

  if (signals.matchedProgramCompetencies > 0) {
    reasons.push(
      `Matches ${signals.matchedProgramCompetencies} program competencies out of ${signals.totalCompanyCompetencies || 0} detected.`
    );
  } else {
    reasons.push("No direct overlap with current program competencies detected yet.");
  }

  if (signals.vacancyCount > 0) {
    reasons.push(`Observed ${signals.vacancyCount} vacancy signal${signals.vacancyCount === 1 ? "" : "s"} for this company.`);
  }

  if (signals.hasWebsite) {
    reasons.push("Company profile has a website, which improves reputation confidence.");
  } else {
    reasons.push("No website signal yet, so reputation stays conservative.");
  }

  if (signals.contactCount > 0) {
    reasons.push(`Found ${signals.contactCount} contact candidate${signals.contactCount === 1 ? "" : "s"} for outreach.`);
  } else {
    reasons.push("No contact candidates found yet.");
  }

  if (hasEducationSignal(`${signals.industryName} ${signals.companyName}`)) {
    reasons.push("Education-related language boosts readiness for partnership format.");
  }

  return {
    total: score.total,
    competencyFit: score.competencyFit,
    reputation: score.reputation,
    educationReadiness: score.educationReadiness,
    signals: {
      vacancyCount: signals.vacancyCount,
      matchedProgramCompetencies: signals.matchedProgramCompetencies,
      totalCompanyCompetencies: signals.totalCompanyCompetencies,
      contactCount: signals.contactCount,
      hasWebsite: signals.hasWebsite,
      region: signals.region,
      size: signals.size
    },
    reasons
  };
}
