import type {
  CommunicationPackageInput,
  CompanyProfileInput,
  DraftTone,
  GeneratedCommunicationPackage,
  GeneratedProjectRole,
  ProjectBriefInput,
  RetrievedContextSnippet,
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
      return "Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ";
    case "neutral":
      return "Р”РѕР±СЂС‹Р№ РґРµРЅСЊ";
    case "friendly":
      return "РџСЂРёРІРµС‚СЃС‚РІСѓРµРј";
  }
}

function partnershipAngle(input: CompanyProfileInput): string {
  if (input.topCompetencies.length === 0) {
    return "РІРёРґРёРј РїРѕС‚РµРЅС†РёР°Р» РґР»СЏ СЃРѕРІРјРµСЃС‚РЅС‹С… РїСЂР°РєС‚РёРєРѕ-РѕСЂРёРµРЅС‚РёСЂРѕРІР°РЅРЅС‹С… РїСЂРѕРµРєС‚РѕРІ";
  }

  const focus = input.topCompetencies.slice(0, 3).join(", ");
  return `РІРёРґРёРј С…РѕСЂРѕС€РёР№ СЃС‚С‹Рє РїРѕ РєРѕРјРїРµС‚РµРЅС†РёСЏРј ${focus} Рё С„РѕСЂРјР°С‚Сѓ РїСЂР°РєС‚РёС‡РµСЃРєРёС… РїСЂРѕРµРєС‚РѕРІ`;
}

function renderRetrievedContext(snippets?: RetrievedContextSnippet[]): string | null {
  if (!snippets || snippets.length === 0) {
    return null;
  }

  return [
    "RAG context:",
    ...snippets.slice(0, 3).map((snippet, index) => {
      const normalizedContent = snippet.content.replace(/\s+/g, " ").trim().slice(0, 180);
      return `${index + 1}. [${snippet.kind}] ${snippet.title}: ${normalizedContent}`;
    })
  ].join("\n");
}

export function generateCompanySummary(input: CompanyProfileInput): string {
  const lines = [
    `${input.companyName} СЂР°Р±РѕС‚Р°РµС‚ РІ РґРѕРјРµРЅРµ ${input.industryName} Рё СЃРµР№С‡Р°СЃ РЅР°С…РѕРґРёС‚СЃСЏ РЅР° СЃС‚Р°РґРёРё ${input.stage}.`,
    `РћСЃРЅРѕРІРЅРѕР№ СЂРµРіРёРѕРЅ РїСЂРёСЃСѓС‚СЃС‚РІРёСЏ: ${input.region}.`,
    input.website ? `РЈ РєРѕРјРїР°РЅРёРё РµСЃС‚СЊ РїСѓР±Р»РёС‡РЅС‹Р№ СЃР°Р№С‚: ${input.website}.` : "РџСѓР±Р»РёС‡РЅС‹Р№ СЃР°Р№С‚ РїРѕРєР° РЅРµ Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅ.",
    input.score
      ? `РўРµРєСѓС‰РёР№ score: ${input.score.total}/100, competency fit ${input.score.competencyFit}, reputation ${input.score.reputation}, education readiness ${input.score.educationReadiness}.`
      : "РЎРєРѕСЂРёРЅРі РїРѕРєР° РЅРµ СЂР°СЃСЃС‡РёС‚Р°РЅ.",
    input.topCompetencies.length > 0
      ? `РќР°РёР±РѕР»РµРµ Р·Р°РјРµС‚РЅС‹Рµ СЂС‹РЅРѕС‡РЅС‹Рµ РєРѕРјРїРµС‚РµРЅС†РёРё: ${input.topCompetencies.join(", ")}.`
      : "Р’С‹СЂР°Р¶РµРЅРЅС‹Рµ СЂС‹РЅРѕС‡РЅС‹Рµ РєРѕРјРїРµС‚РµРЅС†РёРё РїРѕРєР° РЅРµ РІС‹РґРµР»РµРЅС‹.",
    input.contactName && input.contactTitle
      ? `РљР»СЋС‡РµРІРѕР№ РєРѕРЅС‚Р°РєС‚ РґР»СЏ РєРѕРјРјСѓРЅРёРєР°С†РёРё: ${input.contactName}, ${input.contactTitle}.`
      : "РљРѕРЅС‚Р°РєС‚ РґР»СЏ РєРѕРјРјСѓРЅРёРєР°С†РёРё РµС‰С‘ С‚СЂРµР±СѓРµС‚ СѓС‚РѕС‡РЅРµРЅРёСЏ."
  ];

  return lines.join(" ");
}

export function generateOutreachDraft(input: CompanyProfileInput & { tone: DraftTone }): {
  subject: string;
  body: string;
} {
  const greeting = input.contactName ? `${introByTone(input.tone)}, ${input.contactName}!` : `${introByTone(input.tone)}!`;
  const subjectByTone: Record<DraftTone, string> = {
    formal: `РџСЂРµРґР»РѕР¶РµРЅРёРµ Рѕ РїР°СЂС‚РЅРµСЂСЃС‚РІРµ РґР»СЏ ${input.companyName}`,
    neutral: `${input.companyName} x Project Learning`,
    friendly: `РРґРµСЏ СЃРѕРІРјРµСЃС‚РЅРѕРіРѕ РїСЂРѕРµРєС‚Р° СЃ ${input.companyName}`
  };

  const body = [
    greeting,
    "",
    `РњС‹ РёР·СѓС‡РёР»Рё РїСЂРѕС„РёР»СЊ ${input.companyName} Рё ${partnershipAngle(input)}.`,
    `РћСЃРѕР±РµРЅРЅРѕ РёРЅС‚РµСЂРµСЃРЅРѕ РЅР°РїСЂР°РІР»РµРЅРёРµ ${input.industryName} Рё Р·Р°РїСЂРѕСЃ СЂС‹РЅРєР° РЅР° ${input.topCompetencies.slice(0, 3).join(", ") || "РїСЂР°РєС‚РёС‡РµСЃРєРёРµ digital-РєРѕРјРїРµС‚РµРЅС†РёРё"}.`,
    "РњС‹ СЂР°Р·РІРёРІР°РµРј РїСЂРѕРµРєС‚РЅС‹Р№ С„РѕСЂРјР°С‚ РѕР±СѓС‡РµРЅРёСЏ Рё С…РѕС‚РёРј РїСЂРµРґР»РѕР¶РёС‚СЊ РїРёР»РѕС‚РЅС‹Р№ РєРµР№СЃ, РіРґРµ СЃС‚СѓРґРµРЅС‚С‹ СЃРјРѕРіСѓС‚ РїРѕСЂР°Р±РѕС‚Р°С‚СЊ РЅР°Рґ СЂРµР°Р»СЊРЅРѕР№ Р·Р°РґР°С‡РµР№ РєРѕРјРїР°РЅРёРё РїРѕРґ СЃРѕРІРјРµСЃС‚РЅС‹Рј РєСѓСЂР°С‚РѕСЂСЃС‚РІРѕРј.",
    "Р•СЃР»Рё С„РѕСЂРјР°С‚ РІР°Рј РѕС‚РєР»РёРєР°РµС‚СЃСЏ, РјРѕР¶РµРј РїСЂРёСЃР»Р°С‚СЊ РєРѕСЂРѕС‚РєРёР№ one-pager СЃ РІРѕР·РјРѕР¶РЅРѕР№ РјРѕРґРµР»СЊСЋ РІР·Р°РёРјРѕРґРµР№СЃС‚РІРёСЏ Рё РїСЂРёРјРµСЂР°РјРё РїСЂРѕРµРєС‚РЅС‹С… СЂРѕР»РµР№.",
    renderRetrievedContext(input.retrievedContext),
    "",
    "РЎ СѓРІР°Р¶РµРЅРёРµРј,",
    "РљРѕРјР°РЅРґР° Project Learning"
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
    subject: `Follow-up РїРѕ РїР°СЂС‚РЅРµСЂСЃС‚РІСѓ СЃ ${input.companyName}`,
    body: [
      greeting,
      "",
      `Р’РѕР·РІСЂР°С‰Р°РµРјСЃСЏ Рє РЅР°С€РµР№ РёРґРµРµ СЃРѕРІРјРµСЃС‚РЅРѕРіРѕ РїСЂРѕРµРєС‚Р° СЃ ${input.companyName}.`,
      `РњС‹ РїРѕ-РїСЂРµР¶РЅРµРјСѓ РІРёРґРёРј С…РѕСЂРѕС€РёР№ РїРѕС‚РµРЅС†РёР°Р» РІ СЃРІСЏР·РєРµ СЃ РЅР°РїСЂР°РІР»РµРЅРёСЏРјРё ${input.topCompetencies.slice(0, 3).join(", ") || input.industryName}.`,
      "Р•СЃР»Рё С‚РµРјР° Р°РєС‚СѓР°Р»СЊРЅР°, РјРѕР¶РµРј РІ РѕС‚РІРµС‚ РїСЂРёСЃР»Р°С‚СЊ РєСЂР°С‚РєСѓСЋ СЃС‚СЂСѓРєС‚СѓСЂСѓ РїРёР»РѕС‚РЅРѕРіРѕ РїСЂРѕРµРєС‚Р° Рё РІР°СЂРёР°РЅС‚С‹ СѓС‡Р°СЃС‚РёСЏ СЃРѕ СЃС‚РѕСЂРѕРЅС‹ РєРѕРјРїР°РЅРёРё.",
      renderRetrievedContext(input.retrievedContext),
      "",
      "РЎ СѓРІР°Р¶РµРЅРёРµРј,",
      "РљРѕРјР°РЅРґР° Project Learning"
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
  if (normalized.includes("prompt") || normalized.includes("machine")) {
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
  if (normalized.includes("prompt") || normalized.includes("machine")) {
    return `Design and validate the AI-assisted workflow, including evaluation criteria and improvement hypotheses.`;
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
      ? `${input.companyName} Industry Project in ${focus[0]}`
      : `${input.companyName} Industry Project`;

  const summary = [
    `${input.companyName} is looking for a practice-oriented project in the ${input.industryName} domain.`,
    focus.length > 0
      ? `The project should focus on competencies such as ${focus.join(", ")}.`
      : "The project should focus on applied digital product competencies.",
    input.region ? `The partner context is tied to the ${input.region} market.` : null,
    input.agreementStatus ? `The collaboration currently sits at the ${input.agreementStatus} agreement stage.` : null,
    input.companyStage ? `The company pipeline stage is ${input.companyStage}.` : null,
    input.scoreTotal !== undefined ? `Current company score is ${input.scoreTotal}/100.` : null,
    input.website ? `Public company context is available through ${input.website}.` : null,
    communicationHighlights.length > 0 ? `Existing communication materials highlight: ${communicationHighlights.join(" ")}` : null,
    renderRetrievedContext(input.retrievedContext),
    "Students should deliver a scoped prototype, analytics artefact, or product recommendation with a clear review checkpoint from the partner."
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
  const focusLine = focus.length > 0 ? focus.join(", ") : "РїСЂР°РєС‚РёС‡РµСЃРєРёРµ С†РёС„СЂРѕРІС‹Рµ РєРѕРјРїРµС‚РµРЅС†РёРё";
  const projectLine = input.projectTitle
    ? `Р’ РєР°С‡РµСЃС‚РІРµ РїРµСЂРІРѕРіРѕ С€Р°РіР° РјРѕР¶РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РїСЂРѕРµРєС‚ "${input.projectTitle}".`
    : "Р’ РєР°С‡РµСЃС‚РІРµ РїРµСЂРІРѕРіРѕ С€Р°РіР° РјРѕР¶РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РєРѕСЂРѕС‚РєРёР№ РїРёР»РѕС‚РЅС‹Р№ РїСЂРѕРµРєС‚ СЃ РїРѕРЅСЏС‚РЅС‹Рј review checkpoint.";
  const agreementLine =
    input.agreementStatus && input.agreementStatus !== "draft"
      ? `РўРµРєСѓС‰РёР№ СЃС‚Р°С‚СѓСЃ РІР·Р°РёРјРѕРґРµР№СЃС‚РІРёСЏ: ${input.agreementStatus}.`
      : "РЎРµР№С‡Р°СЃ РїР°РєРµС‚ РїРѕРґС…РѕРґРёС‚ РґР»СЏ РїРµСЂРІРѕРіРѕ РѕР±СЃСѓР¶РґРµРЅРёСЏ Рё СѓС‚РѕС‡РЅРµРЅРёСЏ РѕР¶РёРґР°РЅРёР№.";

  const onePagerBullets = [
    `Р¤РѕРєСѓСЃ СЃРѕС‚СЂСѓРґРЅРёС‡РµСЃС‚РІР°: ${input.industryName}.`,
    `РљР»СЋС‡РµРІС‹Рµ РєРѕРјРїРµС‚РµРЅС†РёРё РґР»СЏ РїСЂРѕРµРєС‚Р°: ${focusLine}.`,
    input.region ? `Р РµРіРёРѕРЅР°Р»СЊРЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚: ${input.region}.` : "Р РµРіРёРѕРЅР°Р»СЊРЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚ РјРѕР¶РЅРѕ СѓС‚РѕС‡РЅРёС‚СЊ РЅР° СЃРѕР·РІРѕРЅРµ.",
    projectLine
  ];

  const faqBullets = [
    "РљР°РєРѕР№ С„РѕСЂРјР°С‚ СѓС‡Р°СЃС‚РёСЏ РЅСѓР¶РµРЅ РѕС‚ РєРѕРјРїР°РЅРёРё?",
    "РЎРєРѕР»СЊРєРѕ РІСЂРµРјРµРЅРё Р·Р°РЅРёРјР°РµС‚ РїРёР»РѕС‚РЅС‹Р№ РїСЂРѕРµРєС‚?",
    "РљР°РєРёРµ СЂРµР·СѓР»СЊС‚Р°С‚С‹ РїРѕР»СѓС‡Р°РµС‚ РїР°СЂС‚РЅС‘СЂ РїРѕ РёС‚РѕРіР°Рј РїРёР»РѕС‚Р°?",
    "РљР°Рє СѓСЃС‚СЂРѕРµРЅРѕ РєСѓСЂР°С‚РѕСЂСЃС‚РІРѕ Рё РїСЂРѕРІРµСЂРєР° СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ?"
  ];

  return {
    onePager: {
      title: `One-pager РґР»СЏ ${input.companyName}`,
      summary: `РљСЂР°С‚РєРёР№ РїР°РєРµС‚ Рѕ РјРѕРґРµР»Рё РїР°СЂС‚РЅС‘СЂСЃС‚РІР° СЃ ${input.companyName} РІ РґРѕРјРµРЅРµ ${input.industryName}.`,
      body: [
        `${input.companyName} РјРѕР¶РµС‚ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РїСЂРѕРµРєС‚РЅС‹Р№ С„РѕСЂРјР°С‚ РєР°Рє Р±РµР·РѕРїР°СЃРЅС‹Р№ СЃРїРѕСЃРѕР± РїСЂРѕРІРµСЂРёС‚СЊ РїСЂР°РєС‚РёС‡РµСЃРєСѓСЋ С†РµРЅРЅРѕСЃС‚СЊ СЃРѕС‚СЂСѓРґРЅРёС‡РµСЃС‚РІР° СЃ РѕР±СЂР°Р·РѕРІР°С‚РµР»СЊРЅРѕР№ РїСЂРѕРіСЂР°РјРјРѕР№.`,
        `РњС‹ РїСЂРµРґР»Р°РіР°РµРј РєРѕРјРїР°РєС‚РЅС‹Р№ РїРёР»РѕС‚ РІРѕРєСЂСѓРі РЅР°РїСЂР°РІР»РµРЅРёР№ ${focusLine}, РіРґРµ СЃС‚СѓРґРµРЅС‚С‹ СЂР°Р±РѕС‚Р°СЋС‚ РЅР°Рґ СЂРµР°Р»СЊРЅРѕР№ Р·Р°РґР°С‡РµР№ РєРѕРјРїР°РЅРёРё РїРѕРґ СЃРѕРІРјРµСЃС‚РЅС‹Рј РєСѓСЂР°С‚РѕСЂСЃС‚РІРѕРј.`,
        agreementLine,
        projectLine,
        "РќР° РІС‹С…РѕРґРµ РїР°СЂС‚РЅС‘СЂ РїРѕР»СѓС‡Р°РµС‚ РїСЂРѕР·СЂР°С‡РЅС‹Р№ РїСЂРѕС†РµСЃСЃ, РїСЂРѕРјРµР¶СѓС‚РѕС‡РЅС‹Рµ РєРѕРЅС‚СЂРѕР»СЊРЅС‹Рµ С‚РѕС‡РєРё Рё С„РёРЅР°Р»СЊРЅС‹Р№ РїСЂРёРєР»Р°РґРЅРѕР№ Р°СЂС‚РµС„Р°РєС‚."
      ].join(" "),
      bullets: onePagerBullets
    },
    faq: {
      title: `FAQ РїРѕ РїР°СЂС‚РЅС‘СЂСЃС‚РІСѓ СЃ ${input.companyName}`,
      summary: "РќР°Р±РѕСЂ РєРѕСЂРѕС‚РєРёС… РѕС‚РІРµС‚РѕРІ РґР»СЏ РїРµСЂРІРѕРіРѕ РѕР±СЃСѓР¶РґРµРЅРёСЏ С„РѕСЂРјР°С‚Р° РІР·Р°РёРјРѕРґРµР№СЃС‚РІРёСЏ.",
      body: [
        "1. РљРѕРјРїР°РЅРёСЏ РґР°С‘С‚ Р·Р°РґР°С‡Сѓ, РєРѕРЅС‚РµРєСЃС‚ Рё РѕРґРЅСѓ-РґРІРµ РєРѕРЅС‚СЂРѕР»СЊРЅС‹Рµ С‚РѕС‡РєРё.",
        "2. РљРѕРјР°РЅРґР° РїСЂРѕРіСЂР°РјРјС‹ РїРѕРјРѕРіР°РµС‚ СѓРїР°РєРѕРІР°С‚СЊ Р·Р°РґР°С‡Сѓ РІ СЃС‚СѓРґРµРЅС‡РµСЃРєРёР№ РїСЂРѕРµРєС‚ Рё СЃРѕРїСЂРѕРІРѕР¶РґР°РµС‚ РІС‹РїРѕР»РЅРµРЅРёРµ.",
        "3. РџРёР»РѕС‚ РѕР±С‹С‡РЅРѕ СЃС‚Р°СЂС‚СѓРµС‚ СЃ РЅРµР±РѕР»СЊС€РѕР№, С‡С‘С‚РєРѕ РѕРіСЂР°РЅРёС‡РµРЅРЅРѕР№ Р·Р°РґР°С‡Рё, С‡С‚РѕР±С‹ Р±С‹СЃС‚СЂРѕ РїСЂРѕРІРµСЂРёС‚СЊ РїРѕР»СЊР·Сѓ С„РѕСЂРјР°С‚Р°.",
        "4. РџСЂРё СѓСЃРїРµС€РЅРѕРј РїРёР»РѕС‚Рµ РІР·Р°РёРјРѕРґРµР№СЃС‚РІРёРµ РјРѕР¶РЅРѕ СЂР°СЃС€РёСЂРёС‚СЊ РґРѕ СЂРµРіСѓР»СЏСЂРЅРѕРіРѕ РєР°С‚Р°Р»РѕРіР° РїСЂРѕРµРєС‚РѕРІ."
      ].join(" "),
      bullets: faqBullets
    }
  };
}
