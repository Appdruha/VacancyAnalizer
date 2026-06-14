import type {
  CommunicationPackageInput,
  CompanyProfileInput,
  DraftTone,
  GeneratedCommunicationPackage,
  GeneratedProjectRole,
  ProjectBriefInput,
  PromptTemplate
} from "./types.js";

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
    input.website ? `У компании есть публичный сайт: ${input.website}.` : "Публичный сайт компании пока не зафиксирован.",
    input.score
      ? `Текущий score: ${input.score.total}/100, competency fit ${input.score.competencyFit}, reputation ${input.score.reputation}, education readiness ${input.score.educationReadiness}.`
      : "Оценка компании пока не рассчитана.",
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
    formal: `Предложение о партнёрстве для ${input.companyName}`,
    neutral: `${input.companyName} × Project Learning`,
    friendly: `Идея совместного проекта с ${input.companyName}`
  };

  const topCompetencies = input.topCompetencies.slice(0, 3).join(", ") || "практические digital-компетенции";

  const body = [
    greeting,
    "",
    `Мы изучили профиль ${input.companyName} и ${partnershipAngle(input)}.`,
    `Особенно интересно направление ${input.industryName} и запрос рынка на ${topCompetencies}.`,
    "Мы развиваем проектный формат обучения и хотим предложить пилотный кейс, где студенты смогут поработать над реальной задачей компании под совместным кураторством.",
    "Если формат вам откликается, можем прислать короткий one-pager с возможной моделью взаимодействия и примером проектной роли.",
    "",
    "С уважением,",
    "Команда Project Learning"
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");

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
    subject: `Follow-up по партнёрству с ${input.companyName}`,
    body: [
      greeting,
      "",
      `Возвращаемся к нашей идее совместного проекта с ${input.companyName}.`,
      `Мы по-прежнему видим хороший потенциал в связке с направлениями ${input.topCompetencies.slice(0, 3).join(", ") || input.industryName}.`,
      "Если тема актуальна, можем в ответ прислать краткую структуру пилотного проекта и варианты участия со стороны компании.",
      "",
      "С уважением,",
      "Команда Project Learning"
    ]
      .filter((item): item is string => Boolean(item))
      .join("\n")
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
  if (normalized.includes("prompt") || normalized.includes("machine") || normalized.includes("llm")) {
    return "AI Product Researcher";
  }
  return "Project Contributor";
}

function roleSummaryForCompetency(name: string, industryName: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("typescript") || normalized.includes("react") || normalized.includes("node")) {
    return `Build a working prototype for the ${industryName} use case and translate partner requirements into product features.`;
  }
  if (normalized.includes("analytics") || normalized.includes("data")) {
    return `Structure the metrics layer, analyse outcomes and present evidence-backed recommendations for the ${industryName} scenario.`;
  }
  if (normalized.includes("prompt") || normalized.includes("machine") || normalized.includes("llm")) {
    return "Design and validate the AI-assisted workflow, including evaluation criteria and improvement hypotheses.";
  }
  return `Own the workstream around ${name} and turn partner context into a concrete project deliverable.`;
}

export function generateProjectBrief(input: ProjectBriefInput): {
  title: string;
  summary: string;
  roles: GeneratedProjectRole[];
} {
  const focus = input.competencies.slice(0, 4);
  const communicationHighlights = input.communicationHighlights?.slice(0, 2) ?? [];
  const title =
    focus.length > 0
      ? `${input.companyName}: проект в области ${focus[0]}`
      : `${input.companyName}: индустриальный проект`;

  const summary = [
    `${input.companyName} рассматривается как партнёр для практико-ориентированного проекта в домене ${input.industryName}.`,
    focus.length > 0
      ? `Проект должен опираться на компетенции ${focus.join(", ")}.`
      : "Проект должен опираться на прикладные цифровые компетенции.",
    input.region ? `Контекст компании связан с регионом ${input.region}.` : null,
    input.agreementStatus ? `Текущий статус взаимодействия: ${input.agreementStatus}.` : null,
    input.companyStage ? `Этап компании в pipeline: ${input.companyStage}.` : null,
    input.scoreTotal !== undefined ? `Текущий score компании: ${input.scoreTotal}/100.` : null,
    input.website ? `Публичный контекст компании доступен через ${input.website}.` : null,
    communicationHighlights.length > 0 ? `Из коммуникационных материалов важны следующие акценты: ${communicationHighlights.join(" ")}` : null,
    "Ожидаемый результат — прикладной проект с понятным review checkpoint со стороны партнёра."
  ]
    .filter(Boolean)
    .join(" ");

  const roles = (focus.length > 0 ? focus : ["product thinking", "delivery"])
    .slice(0, 3)
    .map((competency, index) => ({
      title: roleTitleForCompetency(competency, index),
      summary: roleSummaryForCompetency(competency, input.industryName)
    }));

  return {
    title,
    summary,
    roles
  };
}

export function generateCommunicationPackages(input: CommunicationPackageInput): {
  onePager: GeneratedCommunicationPackage;
  faq: GeneratedCommunicationPackage;
} {
  const focus = input.competencies.slice(0, 4);
  const focusLine = focus.length > 0 ? focus.join(", ") : "практические цифровые компетенции";
  const projectLine = input.projectTitle
    ? `В качестве первого шага можно использовать проект «${input.projectTitle}».`
    : "В качестве первого шага можно использовать короткий пилотный проект с понятным review checkpoint.";
  const agreementLine =
    input.agreementStatus && input.agreementStatus !== "draft"
      ? `Текущий статус взаимодействия: ${input.agreementStatus}.`
      : "Сейчас пакет подходит для первого обсуждения и уточнения ожиданий.";

  const onePagerBullets = [
    `Фокус сотрудничества: ${input.industryName}.`,
    `Ключевые компетенции для проекта: ${focusLine}.`,
    input.region ? `Региональный контекст: ${input.region}.` : "Региональный контекст можно уточнить на созвоне.",
    projectLine
  ];

  const faqBullets = [
    "Какой формат участия нужен от компании?",
    "Сколько времени занимает пилотный проект?",
    "Какие результаты получает партнёр по итогам пилота?",
    "Как устроены кураторство и проверка результатов?"
  ];

  return {
    onePager: {
      title: `One-pager для ${input.companyName}`,
      summary: `Краткий пакет о модели партнёрства с ${input.companyName} в домене ${input.industryName}.`,
      body: [
        `${input.companyName} может использовать проектный формат как безопасный способ проверить практическую ценность сотрудничества с образовательной программой.`,
        `Мы предлагаем компактный пилот вокруг направления ${focusLine}, где студенты работают над реальной задачей компании под совместным кураторством.`,
        agreementLine,
        projectLine,
        "На выходе партнёр получает прозрачный процесс, промежуточные контрольные точки и финальный прикладной артефакт."
      ].join(" "),
      bullets: onePagerBullets
    },
    faq: {
      title: `FAQ по партнёрству с ${input.companyName}`,
      summary: "Набор коротких ответов для первого обсуждения формата взаимодействия.",
      body: [
        "1. Компания даёт задачу, контекст и одну-две контрольные точки.",
        "2. Команда программы упаковывает задачу в студенческий проект и сопровождает выполнение.",
        "3. Пилот обычно стартует с небольшой, чётко ограниченной задачи, чтобы быстро проверить пользу формата.",
        "4. При успешном пилоте взаимодействие можно расширить до регулярного каталога проектов."
      ].join(" "),
      bullets: faqBullets
    }
  };
}
