import type { AdaptiveRecommendationStats } from "@edagent/domain";

export type PromptTemplate =
  | "company-summary"
  | "outreach-email"
  | "follow-up-email"
  | "project-brief";

export type DraftTone = "formal" | "neutral" | "friendly";

export type CompanyProfileInput = {
  companyName: string;
  industryName: string;
  region: string;
  website?: string;
  stage: string;
  score?: {
    total: number;
    competencyFit: number;
    reputation: number;
    educationReadiness: number;
  } | null;
  topCompetencies: string[];
  contactName?: string;
  contactTitle?: string;
};

export type ProjectBriefInput = {
  companyName: string;
  industryName: string;
  competencies: string[];
  region?: string;
};

export type GeneratedProjectRole = {
  title: string;
  summary: string;
};

export function getPromptPurpose(template: PromptTemplate): string {
  switch (template) {
    case "company-summary":
      return "Summarize the company profile for partner qualification.";
    case "outreach-email":
      return "Generate a personalized first-touch email draft.";
    case "follow-up-email":
      return "Generate a polite follow-up email draft.";
    case "project-brief":
      return "Generate a structured student project brief.";
  }
}

function introByTone(tone: DraftTone): string {
  switch (tone) {
    case "formal":
      return "Здравствуйте";
    case "neutral":
      return "Добрый день";
    case "friendly":
      return "Приветствуем";
  }
}

function partnershipAngle(input: CompanyProfileInput): string {
  if (input.topCompetencies.length === 0) {
    return "видим потенциал для совместных практико-ориентированных проектов";
  }

  const focus = input.topCompetencies.slice(0, 3).join(", ");
  return `видим хороший стык по компетенциям ${focus} и формату практических проектов`;
}

export function generateCompanySummary(input: CompanyProfileInput): string {
  const lines = [
    `${input.companyName} работает в домене ${input.industryName} и сейчас находится на стадии ${input.stage}.`,
    `Основной регион присутствия: ${input.region}.`,
    input.website ? `У компании есть публичный сайт: ${input.website}.` : "Публичный сайт пока не зафиксирован.",
    input.score
      ? `Текущий score: ${input.score.total}/100, competency fit ${input.score.competencyFit}, reputation ${input.score.reputation}, education readiness ${input.score.educationReadiness}.`
      : "Скоринг пока не рассчитан.",
    input.topCompetencies.length > 0
      ? `Наиболее заметные рыночные компетенции: ${input.topCompetencies.join(", ")}.`
      : "Выраженные рыночные компетенции пока не выделены.",
    input.contactName && input.contactTitle
      ? `Ключевой контакт для коммуникации: ${input.contactName}, ${input.contactTitle}.`
      : "Контакт для коммуникации ещё требует уточнения."
  ];

  return lines.join(" ");
}

export function generateOutreachDraft(input: CompanyProfileInput & { tone: DraftTone }): {
  subject: string;
  body: string;
} {
  const greeting = input.contactName ? `${introByTone(input.tone)}, ${input.contactName}!` : `${introByTone(input.tone)}!`;
  const subjectByTone: Record<DraftTone, string> = {
    formal: `Предложение о партнерстве для ${input.companyName}`,
    neutral: `${input.companyName} x Project Learning`,
    friendly: `Идея совместного проекта с ${input.companyName}`
  };

  const body = [
    greeting,
    "",
    `Мы изучили профиль ${input.companyName} и ${partnershipAngle(input)}.`,
    `Особенно интересно направление ${input.industryName} и запрос рынка на ${input.topCompetencies.slice(0, 3).join(", ") || "практические digital-компетенции"}.`,
    "Мы развиваем проектный формат обучения и хотим предложить пилотный кейс, где студенты смогут поработать над реальной задачей компании под совместным кураторством.",
    "Если формат вам откликается, можем прислать короткий one-pager с возможной моделью взаимодействия и примерами проектных ролей.",
    "",
    "С уважением,",
    "Команда Project Learning"
  ].join("\n");

  return {
    subject: subjectByTone[input.tone],
    body
  };
}

export function generateFollowUpDraft(input: CompanyProfileInput & { tone: DraftTone }): {
  subject: string;
  body: string;
} {
  const greeting = input.contactName ? `${introByTone(input.tone)}, ${input.contactName}!` : `${introByTone(input.tone)}!`;

  return {
    subject: `Follow-up по партнерству с ${input.companyName}`,
    body: [
      greeting,
      "",
      `Возвращаемся к нашей идее совместного проекта с ${input.companyName}.`,
      `Мы по-прежнему видим хороший потенциал в связке с направлениями ${input.topCompetencies.slice(0, 3).join(", ") || input.industryName}.`,
      "Если тема актуальна, можем в ответ прислать краткую структуру пилотного проекта и варианты участия со стороны компании.",
      "",
      "С уважением,",
      "Команда Project Learning"
    ].join("\n")
  };
}

function roleTitleForCompetency(name: string, index: number): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("typescript") || normalized.includes("react") || normalized.includes("node")) {
    return index === 0 ? "Fullstack Engineer" : "Frontend Engineer";
  }
  if (normalized.includes("analytics") || normalized.includes("data")) {
    return "Data Analyst";
  }
  if (normalized.includes("prompt") || normalized.includes("machine")) {
    return "AI Product Researcher";
  }
  return "Project Contributor";
}

export function generateProjectBrief(input: ProjectBriefInput): {
  title: string;
  summary: string;
  roles: GeneratedProjectRole[];
} {
  const focus = input.competencies.slice(0, 4);
  const title =
    focus.length > 0
      ? `${input.companyName} Industry Project in ${focus[0]}`
      : `${input.companyName} Industry Project`;

  const summary = [
    `${input.companyName} is looking for a practice-oriented project in the ${input.industryName} domain.`,
    focus.length > 0
      ? `The project should focus on competencies such as ${focus.join(", ")}.`
      : "The project should focus on applied digital product competencies.",
    input.region ? `The partner context is tied to the ${input.region} market.` : null,
    "Students should deliver a scoped prototype, analytics artefact, or product recommendation with a clear review checkpoint from the partner."
  ]
    .filter(Boolean)
    .join(" ");

  const roles = (focus.length > 0 ? focus : ["product thinking", "delivery"])
    .slice(0, 3)
    .map((competency, index) => ({
      title: roleTitleForCompetency(competency, index),
      summary: `Own the workstream around ${competency} and translate partner requirements into a concrete project deliverable.`
    }));

  return {
    title,
    summary,
    roles
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function recommendAdaptiveStrategy(input: AdaptiveRecommendationStats): {
  recommendedTone: DraftTone;
  recommendedFollowUpDays: number;
  confidence: number;
  positiveReplyRate: number;
  meetingRate: number;
  reasons: string[];
} {
  const positiveReplyRate = input.totalReplies > 0 ? input.positiveReplies / input.totalReplies : 0;
  const meetingRate = input.totalReplies > 0 ? input.meetingReplies / input.totalReplies : 0;

  const toneCandidates: DraftTone[] = ["formal", "neutral", "friendly"];
  const toneScores = Object.fromEntries(
    toneCandidates.map((tone) => {
      const positive = input.positiveByTone[tone] ?? 0;
      const negative = input.negativeByTone[tone] ?? 0;
      const score = positive * 2 - negative;
      return [tone, score];
    })
  ) as Record<DraftTone, number>;

  let recommendedTone: DraftTone = "formal";
  let bestToneScore = Number.NEGATIVE_INFINITY;
  for (const tone of toneCandidates) {
    const score = toneScores[tone];
    if (score > bestToneScore) {
      recommendedTone = tone;
      bestToneScore = score;
    }
  }

  if (bestToneScore <= 0) {
    if (positiveReplyRate >= 0.5 || meetingRate >= 0.3) {
      recommendedTone = "friendly";
    } else if (input.declineReplies > input.positiveReplies) {
      recommendedTone = "neutral";
    } else {
      recommendedTone = "formal";
    }
  }

  let recommendedFollowUpDays = 10;
  if (input.meetingReplies >= 1) {
    recommendedFollowUpDays = 4;
  } else if (input.totalReplies >= 2 && positiveReplyRate >= 0.5) {
    recommendedFollowUpDays = 5;
  } else if (input.questionReplies >= 1) {
    recommendedFollowUpDays = 6;
  } else if (input.declineReplies >= 2 && input.positiveReplies === 0) {
    recommendedFollowUpDays = 12;
  } else if (input.followUpsSent > 0 && input.totalReplies === 0) {
    recommendedFollowUpDays = 8;
  }

  const reasons: string[] = [];
  if (input.totalReplies === 0) {
    reasons.push("No reply history yet, so the strategy stays conservative.");
  } else {
    reasons.push(`Observed ${input.totalReplies} replies with ${(positiveReplyRate * 100).toFixed(0)}% positive rate.`);
  }

  if (input.meetingReplies > 0) {
    reasons.push(`Meeting intent appeared ${input.meetingReplies} time(s), so faster follow-up is preferred.`);
  }

  if ((input.positiveByTone[recommendedTone] ?? 0) > 0) {
    reasons.push(`${recommendedTone} tone has the strongest positive reply signal so far.`);
  }

  if (input.declineReplies > input.positiveReplies) {
    reasons.push("History includes more declines than positive replies, so the recommendation stays measured.");
  }

  const confidence = clamp(
    Math.round(
      Math.min(0.95, 0.25 + input.eventCount * 0.05 + input.totalReplies * 0.1 + input.meetingReplies * 0.08) * 100
    ) / 100,
    0.2,
    0.95
  );

  return {
    recommendedTone,
    recommendedFollowUpDays,
    confidence,
    positiveReplyRate: Math.round(positiveReplyRate * 100) / 100,
    meetingRate: Math.round(meetingRate * 100) / 100,
    reasons
  };
}
